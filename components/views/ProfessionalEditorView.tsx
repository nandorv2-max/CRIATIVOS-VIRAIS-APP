import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Button from '../../components/Button.tsx';
import SavePresetModal, { AdjustmentGroup } from '../../components/SavePresetModal.tsx';
import { IconUpload, IconSparkles, IconTrash, IconUndo, IconRedo, IconX } from '../../components/Icons.tsx';
import { toBase64 } from '../../utils/imageUtils.ts';
import { generateImageWithRetry } from '../../services/geminiService.ts';
import { parseDngPreset } from '../../utils/dngPresetParser.ts';

type AdjustmentPanel = 'Luz' | 'Cor' | 'Efeitos';
type AdjustmentKey = 'exposure' | 'contrast' | 'highlights' | 'shadows' | 'whites' | 'blacks' | 'temperature' | 'tint' | 'saturation' | 'vibrance' | 'texture' | 'clarity' | 'dehaze' | 'grain' | 'vignette' | 'sharpness';

type Adjustments = { [key in AdjustmentKey]: number };

interface UserPreset {
    id: string;
    name: string;
    adjustments: Partial<Adjustments>;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
    exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
    temperature: 0, tint: 0, saturation: 0, vibrance: 0,
    texture: 0, clarity: 0, dehaze: 0, grain: 0, vignette: 0, sharpness: 0,
};

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
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [history, setHistory] = useState<Adjustments[]>([DEFAULT_ADJUSTMENTS]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const adjustments = history[historyIndex];

    const [aiPrompt, setAiPrompt] = useState('');
    const [isLoading, setIsLoading] = useState<'upload' | 'ai' | 'upscale' | null>(null);
    const [activeTab, setActiveTab] = useState<'Ajustes' | 'Predefinições'>('Ajustes');
    const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
    const [userPresets, setUserPresets] = useState<UserPreset[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const presetInputRef = useRef<HTMLInputElement>(null);

    const setAdjustments = (updater: React.SetStateAction<Adjustments>) => {
        const newAdjustments = typeof updater === 'function' ? updater(history[historyIndex]) : updater;
        
        // Prevent adding a new history state if no changes were made
        if (JSON.stringify(history[historyIndex]) === JSON.stringify(newAdjustments)) return;

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newAdjustments);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
    };

    const redo = () => {
        if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
    };

    useEffect(() => {
        try {
            const savedPresets = window.localStorage.getItem('genia_user_presets');
            if (savedPresets) {
                setUserPresets(JSON.parse(savedPresets));
            }
        } catch (e) {
            console.error("Failed to load user presets from local storage", e);
        }
    }, []);

    const getCssFilter = useCallback(() => {
        const { exposure, contrast, saturation, temperature } = adjustments;
        const brightness = 1 + exposure / 100;
        const contrastVal = 1 + contrast / 100;
        const saturationVal = 1 + saturation / 100;
        // Simple approximation for temperature
        const sepia = temperature > 0 ? temperature / 100 : 0;
        // A more complex filter could be built, but this provides basic real-time feedback.
        return `brightness(${brightness}) contrast(${contrastVal}) saturate(${saturationVal}) sepia(${sepia})`;
    }, [adjustments]);

    const drawImage = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !image) return;

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        ctx.filter = getCssFilter();
        ctx.drawImage(image, 0, 0);
    }, [image, getCssFilter]);

    useEffect(() => {
        drawImage();
    }, [adjustments, image, drawImage]);


    const handleImageUpload = async (file: File) => {
        setIsLoading('upload');
        try {
            const base64 = await toBase64(file);
            const img = new Image();
            img.onload = () => {
                setImage(img);
                setHistory([DEFAULT_ADJUSTMENTS]);
                setHistoryIndex(0);
                setIsLoading(null);
            };
            img.src = base64;
        } catch (error) {
            console.error("Image upload failed", error);
            setIsLoading(null);
        }
    };
    
    const handleAdjustmentChange = (key: AdjustmentKey, value: number) => {
        const newAdjustments = { ...adjustments, [key]: value };
        // Replace current history state for smooth sliding without creating new history entries
        const updatedHistory = [...history];
        updatedHistory[historyIndex] = newAdjustments;
        setHistory(updatedHistory);
    };
    
    const commitAdjustment = () => {
        // This function will now create a new history state upon releasing the slider.
        setAdjustments(adjustments);
    };

    const handleAiEdit = async () => {
        if (!canvasRef.current || !aiPrompt) return;
        setIsLoading('ai');
        try {
            const adjustedImage = canvasRef.current.toDataURL('image/png');

            const newImageSrc = await generateImageWithRetry({
                prompt: `CRITICAL TASK: Apply the following edit to the image: "${aiPrompt}". Maintain photorealism.`,
                base64ImageData: adjustedImage
            });
            const newImage = new Image();
            newImage.onload = () => {
                setImage(newImage);
                setHistory([DEFAULT_ADJUSTMENTS]);
                setHistoryIndex(0);
                setAiPrompt('');
                setIsLoading(null);
            }
            newImage.src = newImageSrc;
        } catch (error) {
            console.error("AI edit failed", error);
            setIsLoading(null);
        }
    };
    
    const handleImportPreset = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                const presetAdjustments = parseDngPreset(content);
                if (presetAdjustments && Object.keys(presetAdjustments).length > 0) {
                    setAdjustments(prev => ({...DEFAULT_ADJUSTMENTS, ...presetAdjustments}));
                } else {
                    alert("Não foi possível encontrar predefinições válidas neste ficheiro DNG.");
                }
            }
        };
        reader.readAsText(file, 'latin1');
         if (e.target) e.target.value = '';
    };

    const handleSavePreset = (name: string, groups: AdjustmentGroup[]) => {
        const presetAdjustments: Partial<Adjustments> = {};
        groups.forEach(group => {
            ADJUSTMENT_CONFIG[group].forEach(key => {
                if (adjustments[key] !== DEFAULT_ADJUSTMENTS[key]) {
                    (presetAdjustments as any)[key] = adjustments[key];
                }
            });
        });

        if (Object.keys(presetAdjustments).length > 0) {
            const newPreset: UserPreset = {
                id: `preset_${Date.now()}`,
                name,
                adjustments: presetAdjustments,
            };
            const newPresets = [...userPresets, newPreset];
            setUserPresets(newPresets);
            window.localStorage.setItem('genia_user_presets', JSON.stringify(newPresets));
        } else {
            alert("Nenhum ajuste foi feito para salvar.");
        }
    };

    const applyPreset = (preset: UserPreset) => {
        setAdjustments({ ...DEFAULT_ADJUSTMENTS, ...preset.adjustments });
    };

    const deletePreset = (presetId: string) => {
        const newPresets = userPresets.filter(p => p.id !== presetId);
        setUserPresets(newPresets);
        window.localStorage.setItem('genia_user_presets', JSON.stringify(newPresets));
    };


    return (
      <div className="h-full w-full flex flex-col md:flex-row gap-6">
        <main className="flex-1 flex flex-col items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px] md:min-h-0">
          {image ? (
            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center text-gray-500">
                <IconUpload className="mx-auto" />
                <p className="mt-2">Carregue uma imagem para começar a editar</p>
                <Button onClick={() => fileInputRef.current?.click()} primary className="mt-4" disabled={isLoading === 'upload'}>
                    {isLoading === 'upload' ? 'A carregar...' : 'Carregar Imagem'}
                </Button>
                <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} accept="image/*" className="hidden" />
            </div>
          )}
        </main>
        
        <aside className="w-full md:w-80 flex-shrink-0 bg-brand-light/50 p-4 rounded-lg flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Editar</h3>
                <div className="flex items-center gap-2">
                    <button onClick={undo} disabled={historyIndex === 0} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Desfazer"><IconUndo/></button>
                    <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Refazer"><IconRedo/></button>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setActiveTab('Ajustes')} className={`w-full text-center py-2 rounded-md font-semibold text-sm ${activeTab === 'Ajustes' ? 'bg-brand-primary text-white' : 'bg-brand-accent'}`}>Ajustes</button>
                <button onClick={() => setActiveTab('Predefinições')} className={`w-full text-center py-2 rounded-md font-semibold text-sm ${activeTab === 'Predefinições' ? 'bg-brand-primary text-white' : 'bg-brand-accent'}`}>Predefinições</button>
            </div>

            {activeTab === 'Ajustes' && (
                <div className="space-y-4">
                    {Object.entries(ADJUSTMENT_CONFIG).map(([panel, keys]) => (
                        <div key={panel}>
                            <p className="font-semibold text-gray-300 mb-2">{panel}</p>
                            <div className="space-y-3 bg-brand-dark/50 p-3 rounded-lg">
                                {keys.map(key => <AdjustmentSlider key={key} name={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={adjustments[key]} onChange={(val) => handleAdjustmentChange(key, val)} onCommit={commitAdjustment} />)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {activeTab === 'Predefinições' && (
                <div className="space-y-4">
                     <Button onClick={() => setIsSavePresetModalOpen(true)} className="w-full" disabled={!image}>Salvar Predefinição Atual</Button>
                     <Button onClick={() => presetInputRef.current?.click()} className="w-full" disabled={!image}>Importar Predefinição (.dng)</Button>
                     <input type="file" ref={presetInputRef} onChange={handleImportPreset} accept=".dng" className="hidden" />
                     <div className="space-y-2 pt-2 border-t border-brand-accent/50">
                        <h4 className="font-semibold text-gray-300">Suas Predefinições</h4>
                        {userPresets.length === 0 ? <p className="text-xs text-gray-500">Nenhuma predefinição salva.</p> :
                         <div className="max-h-48 overflow-y-auto pr-1">
                            {userPresets.map(preset => (
                                <div key={preset.id} className="flex items-center justify-between p-2 rounded-md hover:bg-brand-accent/50 group">
                                    <button onClick={() => applyPreset(preset)} className="text-left flex-grow">{preset.name}</button>
                                    <button onClick={() => deletePreset(preset.id)} className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-4 h-4" /></button>
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

        </aside>
        <SavePresetModal isOpen={isSavePresetModalOpen} onClose={() => setIsSavePresetModalOpen(false)} onSave={handleSavePreset} />
      </div>
    );
};

export default ProfessionalEditorView;