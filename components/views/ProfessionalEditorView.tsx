import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { nanoid } from 'nanoid';
import { toBase64, base64ToFile, blobToBase64 } from '../../utils/imageUtils.ts';
import { showGoogleDrivePicker } from '../../services/googleDriveService.ts';
import { getPublicAssets, uploadUserAsset, createSignedUrlForPath } from '../../services/databaseService.ts';
import UploadOptionsModal from '../UploadOptionsModal.tsx';
import GalleryPickerModal from '../GalleryPickerModal.tsx';
import Button from '../Button.tsx';
import { IconUpload, IconUndo, IconRedo, IconSave, IconSparkles, IconChevronDown, IconTrash, IconDownload } from '../Icons.tsx';
import { generateImageWithRetry } from '../../geminiService.ts';
import ErrorNotification from '../ErrorNotification.tsx';
import type { UploadedAsset, PublicAsset, Preset } from '../../types.ts';
import { parseDngPreset } from '../../utils/dngPresetParser.ts';
import SkeletonLoader from '../SkeletonLoader.tsx';
import { AssetContext } from '../../types.ts';


// Self-contained state for this view
type AdjustmentKey = keyof Adjustments;
interface Adjustments { exposure: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number; temperature: number; tint: number; vibrance: number; saturation: number; texture: number; clarity: number; dehaze: number; grain: number; vignette: number; sharpness: number; }
const DEFAULT_ADJUSTMENTS: Adjustments = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 0, vibrance: 0, texture: 0, clarity: 0, dehaze: 0, grain: 0, vignette: 0, sharpness: 0, };

const ADJUSTMENT_GROUPS: { name: string, adjustments: AdjustmentKey[] }[] = [
    { name: 'Luz', adjustments: ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'] },
    { name: 'Cor', adjustments: ['temperature', 'tint', 'vibrance', 'saturation'] },
    { name: 'Efeitos', adjustments: ['texture', 'clarity', 'dehaze', 'grain', 'vignette', 'sharpness'] },
];

const AdjustmentSlider: React.FC<{ label: string; value: number; onChange: (value: number) => void; onAfterChange: () => void; min?: number; max?: number; step?: number; }> = ({ label, value, onChange, onAfterChange, min = -100, max = 100, step = 1 }) => (
    <div>
        <div className="flex justify-between items-center text-xs text-gray-300 mb-1">
            <label>{label}</label>
            <span className={`${value === 0 ? 'text-gray-500' : 'text-white'}`}>{value.toFixed(0)}</span>
        </div>
        <div className="flex items-center gap-2">
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} onMouseUp={onAfterChange} onTouchEnd={onAfterChange} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm" />
        </div>
    </div>
);

const ProfessionalEditorView: React.FC = () => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [liveAdjustments, setLiveAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
    const [history, setHistory] = useState({ snapshots: [DEFAULT_ADJUSTMENTS], currentIndex: 0 });
    
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
    
    const [error, setError] = useState<string | null>(null);
    const [isLoadingAI, setIsLoadingAI] = useState<string | null>(null);
    const [aiEditPrompt, setAiEditPrompt] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const presetFileInputRef = useRef<HTMLInputElement>(null);

    // State for the restored presets tab
    const [activeTab, setActiveTab] = useState<'ajustes' | 'predefinicoes'>('ajustes');
    const [publicPresets, setPublicPresets] = useState<PublicAsset[]>([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(false);
    const [isUploadingPreset, setIsUploadingPreset] = useState(false);
    
    const assetContext = useContext(AssetContext);
    const userPresets = assetContext?.assets.filter(a => a.type === 'dng') || [];

    useEffect(() => {
        if (activeTab === 'predefinicoes' && publicPresets.length === 0) {
            setIsLoadingPresets(true);
            getPublicAssets()
                .then(assets => {
                    setPublicPresets(assets.filter(a => a.asset_type === 'dng'));
                })
                .catch(err => {
                    console.error("Failed to fetch public presets:", err);
                    setError("Não foi possível carregar as predefinições públicas.");
                })
                .finally(() => setIsLoadingPresets(false));
        }
    }, [activeTab, publicPresets.length]);


    const pushHistory = useCallback((newState: Adjustments) => {
        setHistory(prevHistory => {
            const { snapshots, currentIndex } = prevHistory;
            const lastCommittedState = snapshots[currentIndex];
            if (JSON.stringify(lastCommittedState) === JSON.stringify(newState)) return prevHistory;
            const newSnapshots = snapshots.slice(0, currentIndex + 1);
            newSnapshots.push(newState);
            return { snapshots: newSnapshots.length > 50 ? newSnapshots.slice(newSnapshots.length - 50) : newSnapshots, currentIndex: newSnapshots.length - 1 };
        });
    }, []);

    const resetHistory = useCallback((adjustments = DEFAULT_ADJUSTMENTS) => {
        setHistory({ snapshots: [adjustments], currentIndex: 0 });
        setLiveAdjustments(adjustments);
    }, []);

    const setImageAndReset = useCallback((newImage: HTMLImageElement | null) => {
        setImage(newImage);
        resetHistory();
    }, [resetHistory]);

    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.currentIndex > 0) {
                const newIndex = prev.currentIndex - 1;
                setLiveAdjustments(prev.snapshots[newIndex]);
                return { ...prev, currentIndex: newIndex };
            }
            return prev;
        });
    }, []);

    const redo = useCallback(() => {
        setHistory(prev => {
            if (prev.currentIndex < prev.snapshots.length - 1) {
                const newIndex = prev.currentIndex + 1;
                setLiveAdjustments(prev.snapshots[newIndex]);
                return { ...prev, currentIndex: newIndex };
            }
            return prev;
        });
    }, []);

    const handleImageUpload = useCallback(async (file: File) => {
        try {
            const base64 = await toBase64(file);
            const img = new Image();
            img.onload = () => setImageAndReset(img);
            img.src = base64;
        } catch (err) { setError("Falha ao carregar a imagem."); }
    }, [setImageAndReset]);

    const handleSelectFromGallery = async (asset: UploadedAsset) => {
        setIsGalleryModalOpen(false);
        setError(null);
        try {
            if (!asset.storage_path) throw new Error("O caminho de armazenamento do recurso está ausente.");
            const signedUrl = await createSignedUrlForPath(asset.storage_path);
            const response = await fetch(signedUrl);
            if (!response.ok) throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
            const blob = await response.blob();
            const base64Image = await blobToBase64(blob);
            const img = new Image();
            img.onload = () => setImageAndReset(img);
            img.src = base64Image;
        } catch (err) {
            console.error("Error loading image from gallery:", err);
            setError("Não foi possível carregar a imagem da galeria.");
        }
    };
    
    const handleGoogleDriveUpload = async () => {
        setIsUploadModalOpen(false);
        try {
            const images = await showGoogleDrivePicker();
            if (images.length > 0) {
                const img = new Image();
                img.onload = () => setImageAndReset(img);
                img.src = images[0];
            }
        } catch (err) { setError(`Falha ao importar do Google Drive.`); }
    };

    const generateCssFilters = useCallback(() => {
        const filters = [];
        if (liveAdjustments.exposure !== 0) filters.push(`brightness(${1 + liveAdjustments.exposure / 100})`);
        if (liveAdjustments.contrast !== 0) filters.push(`contrast(${1 + liveAdjustments.contrast / 100})`);
        if (liveAdjustments.saturation !== 0) filters.push(`saturate(${1 + liveAdjustments.saturation / 100})`);
        // Note: More complex adjustments require canvas rendering, not simple CSS filters.
        return filters.join(' ');
    }, [liveAdjustments]);

    const applyAdjustmentsToCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !image) return;
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        ctx.filter = generateCssFilters(); // This is a simplification
        // TODO: Implement full canvas-based adjustments for accurate export
        ctx.drawImage(image, 0, 0);
    }, [image, generateCssFilters]);

    const handleDownload = () => {
        applyAdjustmentsToCanvas();
        const canvas = canvasRef.current;
        if (canvas) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'GenIA-Edited-Image.png';
            link.click();
        }
    };

    const handleSaveToGallery = async () => {
        applyAdjustmentsToCanvas();
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const dataUrl = canvas.toDataURL('image/png');
        try {
            const file = base64ToFile(dataUrl, `GenIA-Edited-${nanoid(6)}.png`);
            await uploadUserAsset(file);
            alert('Imagem salva na galeria!');
        } catch(err) {
            setError('Falha ao salvar na galeria.');
        }
    };

    const handleAiEdit = useCallback(async () => {
        if (!image || !aiEditPrompt.trim()) return;
        setIsLoadingAI('ai-edit');
        setError(null);
        try {
            const resultBase64 = await generateImageWithRetry({
                prompt: aiEditPrompt,
                base64ImageData: image.src,
            });
            const img = new Image();
            img.onload = () => {
                setImageAndReset(img);
                setAiEditPrompt('');
            };
            img.src = resultBase64;
        } catch (err) {
            setError(err instanceof Error ? `Falha na edição com IA: ${err.message}` : "Falha na edição com IA.");
        } finally {
            setIsLoadingAI(null);
        }
    }, [image, aiEditPrompt, setImageAndReset]);

    const handleApplyPreset = async (asset: PublicAsset | UploadedAsset) => {
        let url: string;
        try {
            if ('asset_url' in asset) { // PublicAsset
                url = asset.asset_url;
            } else { // UploadedAsset
                url = await createSignedUrlForPath(asset.storage_path);
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Could not fetch DNG file.");
            
            const dngContent = await response.text();
            const adjustments = parseDngPreset(dngContent);

            if (adjustments) {
                const newAdjustmentsState = { ...DEFAULT_ADJUSTMENTS, ...adjustments };
                setLiveAdjustments(newAdjustmentsState);
                pushHistory(newAdjustmentsState);
            } else {
                setError("Não foi possível ler os ajustes desta predefinição.");
            }
        } catch (err) {
            console.error("Failed to apply preset", err);
            setError("Falha ao aplicar a predefinição.");
        }
    };
    
    const handlePresetFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !assetContext) return;

        setIsUploadingPreset(true);
        setError(null);
        try {
            await uploadUserAsset(file);
            await assetContext.refetchAssets();
        } catch (err) {
            console.error("Failed to upload preset:", err);
            setError("Falha ao importar a predefinição.");
        } finally {
            setIsUploadingPreset(false);
            if (event.target) event.target.value = ''; // Reset file input
        }
    };

    return (
        <>
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="h-full flex flex-row bg-brand-dark">
                <main className="flex-1 flex flex-col p-6 items-center justify-center">
                    {!image ? (
                         <div className="text-center">
                             <IconUpload className="mx-auto" />
                            <h1 className="text-2xl font-bold text-white mt-4">Carregue uma imagem para começar a editar</h1>
                             <div className="mt-8">
                                <Button onClick={() => setIsUploadModalOpen(true)} primary className="text-lg px-8 py-3">Carregar Imagem</Button>
                             </div>
                         </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
                             <img src={image.src} alt="Em edição" className="max-w-full max-h-full object-contain" style={{ filter: generateCssFilters() }}/>
                        </div>
                    )}
                </main>

                <aside className="w-80 h-full bg-brand-light flex-shrink-0 p-4 flex flex-col gap-4 overflow-y-auto">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold">Editar</h2>
                         <div className="flex items-center gap-2">
                             <button onClick={undo} disabled={history.currentIndex <= 0} className="p-1 disabled:opacity-50"><IconUndo/></button>
                             <button onClick={redo} disabled={history.currentIndex >= history.snapshots.length - 1} className="p-1 disabled:opacity-50"><IconRedo/></button>
                         </div>
                    </div>
                    
                    <div className="flex bg-brand-dark/50 rounded-lg p-1">
                        <button onClick={() => setActiveTab('ajustes')} className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${activeTab === 'ajustes' ? 'bg-brand-primary' : 'text-gray-400 hover:bg-brand-accent'}`}>Ajustes</button>
                        <button onClick={() => setActiveTab('predefinicoes')} className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${activeTab === 'predefinicoes' ? 'bg-brand-primary' : 'text-gray-400 hover:bg-brand-accent'}`}>Predefinições</button>
                    </div>

                    {activeTab === 'ajustes' && (
                        <div className="space-y-3 flex-grow">
                            {ADJUSTMENT_GROUPS.map(group => (
                                <details key={group.name} open className="space-y-3">
                                    <summary className="font-semibold cursor-pointer list-none text-gray-200">{group.name}</summary>
                                    <div className="pl-2 space-y-3">
                                        {group.adjustments.map(key => (
                                            <AdjustmentSlider key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={liveAdjustments[key]}
                                                onChange={(v) => setLiveAdjustments(prev => ({ ...prev, [key]: v }))}
                                                onAfterChange={() => pushHistory(liveAdjustments)} />
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}

                    {activeTab === 'predefinicoes' && (
                        <div className="flex-grow flex flex-col gap-4">
                             <Button onClick={() => presetFileInputRef.current?.click()} disabled={isUploadingPreset} className="w-full border-2 border-dashed border-brand-accent hover:border-brand-primary">
                                {isUploadingPreset ? 'A importar...' : 'Importar Predefinição (.DNG)'}
                             </Button>
                             <input type="file" ref={presetFileInputRef} onChange={handlePresetFileChange} accept=".dng" className="hidden" />
                             
                             <div className="space-y-2">
                                <h4 className="font-semibold text-gray-300">Suas Predefinições</h4>
                                {userPresets.length > 0 ? (
                                    userPresets.map(preset => (
                                        <button key={preset.id} onClick={() => handleApplyPreset(preset)} className="w-full text-left p-2 rounded-md hover:bg-brand-accent/50">
                                            {preset.name.replace('.dng', '')}
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-xs text-gray-500">Nenhuma predefinição pessoal encontrada.</p>
                                )}
                             </div>

                             <div className="space-y-2">
                                <h4 className="font-semibold text-gray-300">Predefinições Públicas</h4>
                                {isLoadingPresets ? (
                                    <p className="text-xs text-gray-500">A carregar...</p>
                                ) : publicPresets.length > 0 ? (
                                    publicPresets.map(preset => (
                                        <button key={preset.id} onClick={() => handleApplyPreset(preset)} className="w-full text-left p-2 rounded-md hover:bg-brand-accent/50">
                                            {preset.name.replace('.dng', '')}
                                        </button>
                                    ))
                                ) : (
                                     <p className="text-xs text-gray-500">Nenhuma predefinição pública encontrada.</p>
                                )}
                             </div>
                        </div>
                    )}
                    
                    <div className="flex-shrink-0 space-y-2 pt-4 border-t border-brand-accent/50">
                        <h3 className="text-lg font-semibold">Edição com IA</h3>
                         <textarea value={aiEditPrompt} onChange={e => setAiEditPrompt(e.target.value)} placeholder="Ex: 'Remover o relógio do braço esquerdo...'" className="w-full bg-brand-dark border border-brand-accent rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary resize-y" rows={2}/>
                         <Button onClick={handleAiEdit} disabled={!image || !!isLoadingAI} className="w-full"><div className="flex items-center justify-center gap-2"><IconSparkles/> Editar com IA</div></Button>
                         <Button onClick={handleSaveToGallery} disabled={!image} className="w-full">Salvar na Galeria</Button>
                         <Button onClick={handleDownload} primary disabled={!image} className="w-full">Baixar</Button>
                    </div>
                </aside>

                 <UploadOptionsModal 
                    isOpen={isUploadModalOpen} 
                    onClose={() => setIsUploadModalOpen(false)} 
                    onLocalUpload={() => { setIsUploadModalOpen(false); fileInputRef.current?.click(); }}
                    onGalleryUpload={() => { setIsUploadModalOpen(false); setIsGalleryModalOpen(true); }}
                    onGoogleDriveUpload={handleGoogleDriveUpload}
                    galleryEnabled={true} 
                />
                <GalleryPickerModal isOpen={isGalleryModalOpen} onClose={() => setIsGalleryModalOpen(false)} onSelectAsset={handleSelectFromGallery} assetTypeFilter="image" />
                <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} accept="image/*" className="hidden" />
            </div>
        </>
    );
};

export default ProfessionalEditorView;