import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import Button from '../../components/Button.tsx';
import { IconUpload, IconSparkles, IconTrash, IconUndo, IconRedo, IconDownload, IconImageIcon, IconEdit } from '../../components/Icons.tsx';
import { toBase64, base64ToFile } from '../../utils/imageUtils.ts';
import { generateImageWithRetry, translateText } from '../../geminiService.ts';
import { parseDngPreset } from '../../utils/dngPresetParser.ts';
import UploadOptionsModal from '../UploadOptionsModal.tsx';
import GalleryPickerModal from '../GalleryPickerModal.tsx';
import { uploadUserAsset, getUserAssets, deleteUserAsset, renameUserAsset, getPublicAssets } from '../../services/databaseService.ts';
import type { UploadedAsset, PublicAsset } from '../../types.ts';
import { ProfessionalEditorContext, Adjustments, AdjustmentKey, DEFAULT_ADJUSTMENTS } from '../../types.ts';
import { showGoogleDrivePicker } from '../../services/googleDriveService.ts';

type AdjustmentPanel = 'Luz' | 'Cor' | 'Efeitos';

const ADJUSTMENT_CONFIG: { [key in AdjustmentPanel]: AdjustmentKey[] } = {
    'Luz': ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'],
    'Cor': ['temperature', 'tint', 'vibrance', 'saturation'],
    'Efeitos': ['texture', 'clarity', 'dehaze', 'grain', 'vignette', 'sharpness'],
};

const AdjustmentSlider: React.FC<{ name: AdjustmentKey, label: string, value: number, onChange: (val: number) => void, onCommit: () => void }> = ({ name, label, value, onChange, onCommit }) => (
    <div>
        <div className="flex justify-between items-center text-xs text-gray-400">
            <label htmlFor={name}>{label}</label>
            <span>{value.toFixed(0)}</span>
        </div>
        <input id={name} type="range" min="-100" max="100" value={value} onChange={e => onChange(Number(e.target.value))} onMouseUp={onCommit} onTouchEnd={onCommit} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm" />
    </div>
);


const ProfessionalEditorView: React.FC = () => {
    const context = useContext(ProfessionalEditorContext);
    if (!context) {
        throw new Error("ProfessionalEditorView must be used within a ProfessionalEditorProvider");
    }
    const { 
        image, setImage, 
        liveAdjustments, setLiveAdjustments,
        history, undo, redo, pushHistory, resetHistory 
    } = context;
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [aiPrompt, setAiPrompt] = useState('');
    const [isLoading, setIsLoading] = useState<'upload' | 'ai' | 'upscale' | 'gallery' | null>(null);
    const [activeTab, setActiveTab] = useState<'Ajustes' | 'Predefinições'>('Ajustes');
    const [userPresets, setUserPresets] = useState<UploadedAsset[]>([]);
    const [publicPresets, setPublicPresets] = useState<PublicAsset[]>([]);
    const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const [isUploadOptionsModalOpen, setIsUploadOptionsModalOpen] = useState(false);
    const [isGalleryPickerModalOpen, setIsGalleryPickerModalOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dngFileInputRef = useRef<HTMLInputElement>(null);

    const loadPresets = async () => {
        setIsLoading('gallery');
        try {
            const [allUserAssets, allPublicAssets] = await Promise.all([getUserAssets(), getPublicAssets()]);
            const userPresetAssets = allUserAssets.filter(asset => asset.type === 'dng' || asset.type === 'brmp');
            setUserPresets(userPresetAssets);
            const publicPresetAssets = allPublicAssets.filter(asset => asset.asset_type === 'dng' || asset.asset_type === 'brmp');
            setPublicPresets(publicPresetAssets);
        } catch (e) {
            console.error("Failed to load presets", e);
            alert("Não foi possível carregar as predefinições.");
        } finally {
            setIsLoading(null);
        }
    };

    useEffect(() => {
        if(activeTab === 'Predefinições') {
            loadPresets();
        }
    }, [activeTab]);

    const getCssFilter = (adjustmentsToApply: Adjustments) => {
        const { exposure, contrast, saturation, temperature } = adjustmentsToApply;
        const brightness = 1 + exposure / 100;
        const contrastVal = 1 + contrast / 100;
        const saturationVal = 1 + saturation / 100;
        const sepia = temperature > 0 ? temperature / 100 : 0;
        return `brightness(${brightness}) contrast(${contrastVal}) saturate(${saturationVal}) sepia(${sepia})`;
    };

    const drawImage = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !image) return;

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        ctx.filter = getCssFilter(liveAdjustments);
        ctx.drawImage(image, 0, 0);
    };

    useEffect(() => {
        drawImage();
    }, [image, liveAdjustments]);


    const handleImageUpload = async (file: File) => {
        setIsLoading('upload');
        try {
            const base64 = await toBase64(file);
            const img = new Image();
            img.onload = () => {
                setImage(img); // From context, also resets history
                setIsLoading(null);
            };
            img.src = base64;
        } catch (error) {
            console.error("Image upload failed", error);
            setIsLoading(null);
        }
    };
    
    const handleSelectFromGallery = (asset: UploadedAsset) => {
        setIsLoading('upload');
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.onload = () => {
            setImage(img); // From context
            setIsLoading(null);
        };
        img.onerror = () => {
            console.error("Failed to load image from gallery URL:", asset.url);
            setIsLoading(null);
        };
        img.src = asset.url;
    };

    const handleGoogleDriveUpload = async () => {
        setIsUploadOptionsModalOpen(false);
        setIsLoading('upload');
        try {
            const images = await showGoogleDrivePicker();
            if (images.length > 0) {
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    setIsLoading(null);
                };
                img.src = images[0];
            } else {
                setIsLoading(null);
            }
        } catch (error) {
            console.error("Google Drive upload failed", error);
            setIsLoading(null);
        }
    };

    const handleAiEdit = async () => {
        if (!canvasRef.current || !aiPrompt) return;
        setIsLoading('ai');
        try {
            const adjustedImage = canvasRef.current.toDataURL('image/png');

            const translatedPrompt = await translateText(aiPrompt, 'English');

            const modelInstruction = `**CRITICAL TASK: HYPER-REALISTIC, MASK-FREE INPAINTING**
You are an advanced AI inpainting tool. Your function is to execute a user's edit request on a specific part of an image while leaving the rest of the image COMPLETELY UNTOUCHED. You must identify the subject of the edit from the prompt and apply changes ONLY to that subject.

**USER'S EDIT REQUEST (in English):** "${translatedPrompt}"

**ABSOLUTE MANDATORY DIRECTIVES (Failure to follow will result in a failed task):**
1.  **DO NOT CHANGE THE PERSON:** The person's face, facial expression, hair style and color, skin tone, and body pose MUST remain 100% identical to the original image.
2.  **DO NOT CHANGE THE BACKGROUND:** The background, lighting, shadows, and composition must remain 100% identical to the original image.
3.  **ISOLATE THE EDIT:** The change must be applied ONLY to the object mentioned in the prompt (e.g., only the 'blouse', only the 'watch').
4.  **MAINTAIN REALISM:** The edit must be photorealistic and seamlessly integrated.

**Example:** If the prompt is "change the shirt to red," you must change ONLY the shirt's color to red. The person's face, hair, the wall behind them, etc., MUST NOT be altered in any way. You are performing a targeted replacement, not a re-generation.`;

            const newImageSrc = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: adjustedImage
            });
            const newImage = new Image();
            newImage.onload = () => {
                setImage(newImage);
                setAiPrompt('');
                setIsLoading(null);
            }
            newImage.src = newImageSrc;
        } catch (error) {
            console.error("AI edit failed", error);
            const errorMessage = error instanceof Error ? `A edição com IA falhou: ${error.message}` : "A edição com IA falhou.";
            alert(errorMessage);
            setIsLoading(null);
        }
    };
    
    const handleDngFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        const saveAndReload = async (presetAdjustments: any, fileName: string) => {
            setIsLoading('gallery');
            try {
                const presetContent = JSON.stringify(presetAdjustments);
                const newPresetName = fileName.replace(/\.[^/.]+$/, "") + ".brmp";
                const presetFile = new File([presetContent], newPresetName, { type: 'application/json' });
                
                await uploadUserAsset(presetFile);
                await loadPresets();
            } catch (err) {
                console.error("Failed to save preset to gallery:", err);
                alert("Falha ao salvar a predefinição na galeria.");
            } finally {
                setIsLoading(null);
            }
        };
    
        try {
            const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsText(file, 'latin1');
            });
            
            const presetAdjustments = parseDngPreset(content);
            if (!presetAdjustments || Object.keys(presetAdjustments).length === 0) {
                alert("Não foi possível encontrar predefinições válidas neste ficheiro DNG.");
                return;
            }
    
            const newAdjustments = {...DEFAULT_ADJUSTMENTS, ...presetAdjustments} as Adjustments;
            setLiveAdjustments(newAdjustments);
            pushHistory(newAdjustments);
    
            saveAndReload(presetAdjustments, file.name);
    
        } catch (err) {
            console.error("Failed to read DNG file:", err);
            alert("Falha ao ler o ficheiro DNG.");
        } finally {
            if (e.target) {
                e.target.value = '';
            }
        }
    };

    const applyPreset = async (preset: UploadedAsset | PublicAsset) => {
        const url = 'asset_url' in preset ? preset.asset_url : preset.url;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const adjustments = await response.json();
            const newAdjustments = { ...DEFAULT_ADJUSTMENTS, ...adjustments };
            setLiveAdjustments(newAdjustments);
            pushHistory(newAdjustments);
        } catch (error) {
            console.error("Failed to fetch or apply preset:", error);
            alert("Não foi possível aplicar a predefinição.");
        }
    };
    
    const handleStartRename = (preset: UploadedAsset) => {
        setRenamingPresetId(preset.id);
        setRenameValue(preset.name.replace('.brmp', ''));
    };

    const handleRenameCancel = () => {
        setRenamingPresetId(null);
        setRenameValue('');
    };

    const handleRenameConfirm = async () => {
        if (!renamingPresetId) return;
        const assetToRename = userPresets.find(p => p.id === renamingPresetId);
        const newName = renameValue.trim();
        
        if (!assetToRename || !newName || newName === assetToRename.name.replace('.brmp', '')) {
            handleRenameCancel();
            return;
        }
        
        const newFileName = `${newName}.brmp`;
        const originalName = assetToRename.name;
        
        setUserPresets(prev => prev.map(p => p.id === renamingPresetId ? { ...p, name: newFileName } : p));
        handleRenameCancel();

        try {
            await renameUserAsset(renamingPresetId, newFileName);
        } catch (err) {
            console.error("Failed to rename preset:", err);
            alert("Falha ao renomear a predefinição.");
            setUserPresets(prev => prev.map(p => p.id === renamingPresetId ? { ...p, name: originalName } : p));
        }
    };

    const deletePreset = async (preset: UploadedAsset) => {
        if (window.confirm(`Tem certeza de que quer apagar a predefinição "${preset.name.replace('.brmp', '')}"?`)) {
            try {
                await deleteUserAsset(preset);
                setUserPresets(prev => prev.filter(p => p.id !== preset.id));
            } catch (err) {
                console.error("Failed to delete preset:", err);
                alert("Falha ao apagar a predefinição.");
            }
        }
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `GenIA-Edited-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleSaveToGallery = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        setIsLoading('gallery');
        try {
            const imageDataUrl = canvas.toDataURL('image/png');
            const file = base64ToFile(imageDataUrl, `Edited_Image_${Date.now()}.png`);
            await uploadUserAsset(file);
            alert('Imagem salva na galeria com sucesso!');
        } catch(err) {
            console.error("Failed to save to gallery:", err);
            alert('Falha ao salvar na galeria.');
        } finally {
            setIsLoading(null);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
    };


    return (
      <>
        <UploadOptionsModal 
            isOpen={isUploadOptionsModalOpen}
            onClose={() => setIsUploadOptionsModalOpen(false)}
            onLocalUpload={() => {
                setIsUploadOptionsModalOpen(false);
                fileInputRef.current?.click();
            }}
            onGalleryUpload={() => {
                setIsUploadOptionsModalOpen(false);
                setIsGalleryPickerModalOpen(true);
            }}
            onGoogleDriveUpload={handleGoogleDriveUpload}
            galleryEnabled={true}
        />
        <GalleryPickerModal 
            isOpen={isGalleryPickerModalOpen}
            onClose={() => setIsGalleryPickerModalOpen(false)}
            onSelectAsset={handleSelectFromGallery}
        />
        <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} accept="image/*" className="hidden" />
        <input type="file" ref={dngFileInputRef} onChange={handleDngFileSelect} accept=".dng" className="hidden" />

        <div className="h-full w-full flex flex-col md:flex-row gap-6 p-6">
            <main className="flex-1 flex flex-col items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px] md:min-h-0">
            {image ? (
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
            ) : (
                <div className="text-center text-gray-500">
                    <IconUpload className="mx-auto" />
                    <p className="mt-2">Carregue uma imagem para começar a editar</p>
                    <Button onClick={() => setIsUploadOptionsModalOpen(true)} primary className="mt-4" disabled={isLoading === 'upload'}>
                        {isLoading === 'upload' ? 'A carregar...' : 'Carregar Imagem'}
                    </Button>
                </div>
            )}
            </main>
            
            <aside className="w-full md:w-80 flex-shrink-0 bg-brand-light/50 p-4 rounded-lg flex flex-col gap-4 overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Editar</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={undo} disabled={history.currentIndex <= 0} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Desfazer"><IconUndo/></button>
                        <button onClick={redo} disabled={history.currentIndex >= history.snapshots.length - 1} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Refazer"><IconRedo/></button>
                    </div>
                </div>

                {image && (
                    <div className="flex gap-2 border-b border-brand-accent pb-4">
                        <Button onClick={() => setIsUploadOptionsModalOpen(true)} className="w-full">Mudar Imagem</Button>
                        <Button onClick={handleRemoveImage} className="!px-3"><IconTrash /></Button>
                    </div>
                )}

                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('Ajustes')} className={`w-full text-center py-2 rounded-md font-semibold text-sm ${activeTab === 'Ajustes' ? 'bg-brand-primary text-white' : 'bg-brand-accent'}`}>Ajustes</button>
                    <button onClick={() => setActiveTab('Predefinições')} className={`w-full text-center py-2 rounded-md font-semibold text-sm ${activeTab === 'Predefinições' ? 'bg-brand-primary text-white' : 'bg-brand-accent'}`}>Predefinições</button>
                </div>

                {activeTab === 'Ajustes' && (
                    <div className="space-y-4 flex-grow overflow-y-auto pr-1">
                        {Object.entries(ADJUSTMENT_CONFIG).map(([panel, keys]) => (
                            <div key={panel}>
                                <p className="font-semibold text-gray-300 mb-2">{panel}</p>
                                <div className="space-y-3 bg-brand-dark/50 p-3 rounded-lg">
                                    {keys.map(key => <AdjustmentSlider key={key} name={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={liveAdjustments[key]} onChange={(val) => setLiveAdjustments(prev => ({...prev, [key]: val}))} onCommit={() => pushHistory(liveAdjustments)} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {activeTab === 'Predefinições' && (
                    <div className="space-y-4 flex-grow flex flex-col">
                        <Button 
                            onClick={() => dngFileInputRef.current?.click()} 
                            className="w-full" 
                            disabled={!image || !!isLoading}
                        >
                            {isLoading === 'gallery' ? 'A processar...' : 'Importar Predefinição (.dng)'}
                        </Button>
                        <div className="space-y-2 pt-2 border-t border-brand-accent/50 flex-grow flex flex-col min-h-0">
                            <h4 className="font-semibold text-gray-300">Suas Predefinições</h4>
                            {userPresets.length === 0 ? <p className="text-xs text-gray-500 flex-grow flex items-center justify-center">Importe uma predefinição .dng para salvá-la aqui.</p> :
                            <div className="flex-grow overflow-y-auto pr-1 space-y-1">
                                {userPresets.map(preset => (
                                    <div key={preset.id} className="flex items-center justify-between p-2 rounded-md hover:bg-brand-accent/50 group bg-brand-dark/50 border border-brand-accent/30">
                                        {renamingPresetId === preset.id ? (
                                            <input
                                                type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') handleRenameCancel(); }}
                                                onBlur={handleRenameConfirm} autoFocus
                                                className="text-left flex-grow bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 text-sm w-0"
                                            />
                                        ) : (
                                            <button onClick={() => applyPreset(preset)} className="text-left flex-grow text-sm truncate">
                                                {preset.name.replace('.brmp', '')}
                                            </button>
                                        )}
                                        <div className="flex items-center gap-1 flex-shrink-0 pl-2">
                                            <button onClick={() => handleStartRename(preset)} className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><IconEdit className="w-4 h-4" /></button>
                                            <button onClick={() => deletePreset(preset)} className="p-1 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            }
                        </div>
                        <div className="space-y-2 pt-2 border-t border-brand-accent/50 flex-grow flex flex-col min-h-0">
                            <h4 className="font-semibold text-gray-300">Predefinições Públicas</h4>
                            {isLoading === 'gallery' ? <p className="text-xs text-gray-500">Carregando...</p> : publicPresets.length === 0 ? <p className="text-xs text-gray-500 flex-grow flex items-center justify-center">Nenhuma predefinição pública disponível.</p> :
                            <div className="flex-grow overflow-y-auto pr-1 space-y-1">
                                {publicPresets.map(preset => (
                                    <div key={preset.id} className="flex items-center justify-between p-2 rounded-md hover:bg-brand-accent/50 group bg-brand-dark/50 border border-brand-accent/30">
                                        <button onClick={() => applyPreset(preset)} className="text-left flex-grow text-sm truncate">
                                            {preset.name.replace('.brmp', '').replace('.dng', '')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            }
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t border-brand-accent/50 space-y-3">
                    <p className="font-semibold text-gray-300">Edição com IA</p>
                    <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ex: 'Remover o relógio do braço esquerdo'..." className="w-full bg-brand-dark border border-brand-accent rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary resize-y" rows={2}/>
                    <Button onClick={handleAiEdit} disabled={!image || !aiPrompt || isLoading === 'ai'} className="w-full">
                        {isLoading === 'ai' ? 'A editar...' : <div className="flex items-center justify-center gap-2"><IconSparkles/> Editar com IA</div>}
                    </Button>
                </div>

                <div className="pt-4 mt-auto border-t border-brand-accent/50 space-y-3">
                    <Button onClick={handleSaveToGallery} disabled={!image || isLoading === 'gallery'} className="w-full">
                        {isLoading === 'gallery' ? 'A salvar...' : <div className="flex items-center justify-center gap-2"><IconImageIcon /> Salvar na Galeria</div>}
                    </Button>
                    <Button onClick={handleDownload} primary disabled={!image} className="w-full">
                        <div className="flex items-center justify-center gap-2"><IconDownload /> Baixar</div>
                    </Button>
                </div>

            </aside>
        </div>
      </>
    );
};

export default ProfessionalEditorView;
