import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import { toBase64, base64ToFile, blobToBase64 } from '../../utils/imageUtils.ts';
import { showGoogleDrivePicker } from '../../services/googleDriveService.ts';
import { getPublicAssets, uploadUserAsset, createSignedUrlForPath } from '../../services/databaseService.ts';
import UploadOptionsModal from '../UploadOptionsModal.tsx';
import GalleryPickerModal from '../GalleryPickerModal.tsx';
import Button from '../Button.tsx';
import { IconUpload, IconUndo, IconRedo, IconSave, IconSparkles, IconChevronDown, IconTrash, IconDownload, IconX, IconEdit } from '../Icons.tsx';
import { generateImageWithRetry } from '../../services/geminiService.ts';
import ErrorNotification from '../ErrorNotification.tsx';
import type { UploadedAsset, PublicAsset, Preset } from '../../types.ts';
import { parseDngPreset } from '../../utils/dngPresetParser.ts';
import SkeletonLoader from '../SkeletonLoader.tsx';
import { AssetContext } from '../../types.ts';
import EffectsToolbar from '../EffectsToolbar.tsx';
import { ENHANCER_CATEGORIES } from '../../constants.ts';


// Self-contained state for this view
type AdjustmentKey = keyof Adjustments;
interface Adjustments { exposure: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number; temperature: number; tint: number; vibrance: number; saturation: number; texture: number; clarity: number; dehaze: number; grain: number; vignette: number; sharpness: number; }
const DEFAULT_ADJUSTMENTS: Adjustments = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 0, vibrance: 0, texture: 0, clarity: 0, dehaze: 0, grain: 0, vignette: 0, sharpness: 0, };

interface HistorySnapshot {
    adjustments: Adjustments;
    imageSrc: string; // Now we track the image state as well
}

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

interface ControlsPanelContentProps {
    isMobile?: boolean;
    onClose?: () => void;
    history: { snapshots: HistorySnapshot[], currentIndex: number };
    undo: () => void;
    redo: () => void;
    activeTab: 'ajustes' | 'predefinicoes';
    setActiveTab: (tab: 'ajustes' | 'predefinicoes') => void;
    liveAdjustments: Adjustments;
    setLiveAdjustments: React.Dispatch<React.SetStateAction<Adjustments>>;
    pushHistory: () => void;
    presetFileInputRef: React.RefObject<HTMLInputElement>;
    isUploadingPreset: boolean;
    handlePresetFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    openPresetSections: Set<string>;
    togglePresetSection: (section: string) => void;
    userPresets: UploadedAsset[];
    handleApplyPreset: (asset: PublicAsset | UploadedAsset) => void;
    isLoadingPresets: boolean;
    publicPresets: PublicAsset[];
    aiEditPrompt: string;
    setAiEditPrompt: (prompt: string) => void;
    handleAiEdit: () => void;
    image: HTMLImageElement | null;
    isLoadingAI: string | null;
    handleSaveToGallery: () => void;
    handleDownload: () => void;
    openEnhancerSections: Set<string>;
    toggleEnhancerSection: (section: string) => void;
    selectedEnhancers: Set<string>;
    handleEnhancerChange: (term: string, isChecked: boolean) => void;
    onTriggerUpload: () => void;
    activePresetId: string | null;
}

const ControlsPanelContent: React.FC<ControlsPanelContentProps> = React.memo(({
    isMobile, onClose, history, undo, redo, activeTab, setActiveTab, liveAdjustments,
    setLiveAdjustments, pushHistory, presetFileInputRef, isUploadingPreset, handlePresetFileChange,
    openPresetSections, togglePresetSection, userPresets, handleApplyPreset, isLoadingPresets,
    publicPresets, aiEditPrompt, setAiEditPrompt, handleAiEdit, image, isLoadingAI,
    handleSaveToGallery, handleDownload,
    openEnhancerSections, toggleEnhancerSection, selectedEnhancers, handleEnhancerChange,
    onTriggerUpload, activePresetId
}) => (
    <>
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{isMobile ? "Ajustes e Ferramentas" : "Editar"}</h2>
            <div className="flex items-center gap-2">
                {isMobile && <button onClick={onClose} className="p-2 rounded-full hover:bg-brand-accent"><IconX className="w-5 h-5"/></button>}
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
                                    onAfterChange={pushHistory} />
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
                    <button onClick={() => togglePresetSection('Suas Predefinições')} className="w-full flex justify-between items-center font-semibold text-gray-300" aria-expanded={openPresetSections.has('Suas Predefinições')}>
                        Suas Predefinições
                        <IconChevronDown className={`w-5 h-5 transition-transform ${openPresetSections.has('Suas Predefinições') ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {openPresetSections.has('Suas Predefinições') && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="pt-1 pl-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                                    {userPresets.length > 0 ? (
                                        userPresets.map(preset => (
                                            <button key={preset.id} onClick={() => handleApplyPreset(preset)} 
                                                className={`w-full text-left p-2 rounded-md text-sm ${activePresetId === preset.id ? 'bg-brand-primary text-white' : 'hover:bg-brand-accent/50'}`}>
                                                {preset.name.replace('.dng', '')}
                                            </button>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-500 px-2 py-1">Nenhuma predefinição pessoal encontrada.</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                 </div>

                 <div className="space-y-2">
                    <button onClick={() => togglePresetSection('Predefinições Públicas')} className="w-full flex justify-between items-center font-semibold text-gray-300" aria-expanded={openPresetSections.has('Predefinições Públicas')}>
                        Predefinições Públicas
                        <IconChevronDown className={`w-5 h-5 transition-transform ${openPresetSections.has('Predefinições Públicas') ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {openPresetSections.has('Predefinições Públicas') && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="pt-1 pl-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                                    {isLoadingPresets ? (
                                        <p className="text-xs text-gray-500 px-2 py-1">A carregar...</p>
                                    ) : publicPresets.length > 0 ? (
                                        publicPresets.map(preset => (
                                            <button key={preset.id} onClick={() => handleApplyPreset(preset)} 
                                                className={`w-full text-left p-2 rounded-md text-sm ${activePresetId === preset.id ? 'bg-brand-primary text-white' : 'hover:bg-brand-accent/50'}`}>
                                                {preset.name.replace('.dng', '')}
                                            </button>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-500 px-2 py-1">Nenhuma predefinição pública encontrada.</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                 </div>
            </div>
        )}
        
        <div className="flex-shrink-0 space-y-2 pt-4 border-t border-brand-accent/50">
            <h3 className="text-lg font-semibold">Edição com IA</h3>
             <textarea value={aiEditPrompt} onChange={e => setAiEditPrompt(e.target.value)} placeholder="Ex: 'Remover o relógio do braço esquerdo...'" className="w-full bg-brand-dark border border-brand-accent rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary resize-y" rows={2}/>
             <div className="space-y-1 pt-2">
                <h4 className="text-xs font-semibold text-gray-400">Potenciadores (Opcional)</h4>
                {ENHANCER_CATEGORIES.map(category => (
                    <div key={category.name} className="bg-brand-dark/50 rounded-md border border-brand-accent/30 overflow-hidden text-sm">
                        <button
                            onClick={() => toggleEnhancerSection(category.name)}
                            className="w-full flex justify-between items-center p-2 text-left font-semibold text-gray-300"
                        >
                            <span>{category.name}</span>
                            <IconChevronDown className={`w-4 h-4 transition-transform ${openEnhancerSections.has(category.name) ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {openEnhancerSections.has(category.name) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-2 border-t border-brand-accent/30 space-y-1 max-h-32 overflow-y-auto">
                                        {category.options.map(option => (
                                            <label key={option.term} className="flex items-center gap-2 cursor-pointer text-xs p-1 rounded hover:bg-brand-accent/50">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEnhancers.has(option.term)}
                                                    onChange={(e) => handleEnhancerChange(option.term, e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded-sm bg-brand-dark border-brand-accent text-brand-primary focus:ring-brand-secondary"
                                                />
                                                <span className="text-gray-300">{option.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
             <Button onClick={handleAiEdit} disabled={!image || !!isLoadingAI} className="w-full mt-2 !py-1.5"><div className="flex items-center justify-center gap-2"><IconSparkles className="w-5 h-5"/> Editar com IA</div></Button>
             <Button onClick={onTriggerUpload} className="w-full mt-2">Mudar Imagem</Button>
             <Button onClick={handleSaveToGallery} disabled={!image} className="w-full">Salvar na Galeria</Button>
             <Button onClick={handleDownload} primary disabled={!image} className="w-full">Baixar</Button>
        </div>
    </>
));


const ProfessionalEditorView: React.FC = () => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [liveAdjustments, setLiveAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
    const [history, setHistory] = useState<{ snapshots: HistorySnapshot[], currentIndex: number }>({ snapshots: [], currentIndex: -1 });
    
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
    const [openPresetSections, setOpenPresetSections] = useState<Set<string>>(new Set(['Suas Predefinições']));
    const [openEnhancerSections, setOpenEnhancerSections] = useState<Set<string>>(new Set());
    const [selectedEnhancers, setSelectedEnhancers] = useState<Set<string>>(new Set());
    const [activePresetId, setActivePresetId] = useState<string | null>(null);
    
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    
    const [effectsPreviewStyle, setEffectsPreviewStyle] = useState<React.CSSProperties>({});

    const assetContext = useContext(AssetContext);
    const userPresets = assetContext?.assets.filter(a => a.type === 'dng') || [];

    const togglePresetSection = (sectionName: string) => {
        setOpenPresetSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionName)) {
                newSet.delete(sectionName);
            } else {
                newSet.add(sectionName);
            }
            return newSet;
        });
    };

    const toggleEnhancerSection = (sectionName: string) => {
        setOpenEnhancerSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionName)) {
                newSet.delete(sectionName);
            } else {
                newSet.add(sectionName);
            }
            return newSet;
        });
    };

    const handleEnhancerChange = (term: string, isChecked: boolean) => {
        setSelectedEnhancers(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(term);
            } else {
                newSet.delete(term);
            }
            return newSet;
        });
    };

    useEffect(() => {
        const checkSize = () => {
            const mobile = window.innerWidth < 768;
            if (mobile !== isMobileView) {
                setIsMobileView(mobile);
                if (!mobile) {
                    setIsPanelOpen(false);
                }
            }
        };
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, [isMobileView]);

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


    const pushHistory = useCallback(() => {
        if (!image) return;
        setHistory(prevHistory => {
            const newSnapshot: HistorySnapshot = { adjustments: liveAdjustments, imageSrc: image.src };
            const { snapshots, currentIndex } = prevHistory;
            const lastCommittedState = snapshots[currentIndex];
            if (lastCommittedState && JSON.stringify(lastCommittedState.adjustments) === JSON.stringify(newSnapshot.adjustments) && lastCommittedState.imageSrc === newSnapshot.imageSrc) {
                return prevHistory;
            }
            const newSnapshots = snapshots.slice(0, currentIndex + 1);
            newSnapshots.push(newSnapshot);
            const finalSnapshots = newSnapshots.length > 50 ? newSnapshots.slice(newSnapshots.length - 50) : newSnapshots;
            return { snapshots: finalSnapshots, currentIndex: finalSnapshots.length - 1 };
        });
    }, [liveAdjustments, image]);

    const setImageAndPushHistory = useCallback((newImage: HTMLImageElement, adjustments: Adjustments = DEFAULT_ADJUSTMENTS) => {
        setImage(newImage);
        setLiveAdjustments(adjustments);
        setActivePresetId(null);
        setHistory(prev => {
            const newSnapshot: HistorySnapshot = { adjustments, imageSrc: newImage.src };
            const newSnapshots = prev.snapshots.slice(0, prev.currentIndex + 1);
            newSnapshots.push(newSnapshot);
            const finalSnapshots = newSnapshots.length > 50 ? newSnapshots.slice(newSnapshots.length - 50) : newSnapshots;
            return { snapshots: finalSnapshots, currentIndex: finalSnapshots.length - 1 };
        });
    }, []);

    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.currentIndex > 0) {
                const newIndex = prev.currentIndex - 1;
                const snapshot = prev.snapshots[newIndex];
                setLiveAdjustments(snapshot.adjustments);
                setActivePresetId(null); // Deselect preset on undo
                if (image?.src !== snapshot.imageSrc) {
                    const newImage = new Image();
                    newImage.crossOrigin = 'anonymous';
                    newImage.onload = () => setImage(newImage);
                    newImage.src = snapshot.imageSrc;
                }
                return { ...prev, currentIndex: newIndex };
            }
            return prev;
        });
    }, [image]);

    const redo = useCallback(() => {
        setHistory(prev => {
            if (prev.currentIndex < prev.snapshots.length - 1) {
                const newIndex = prev.currentIndex + 1;
                const snapshot = prev.snapshots[newIndex];
                setLiveAdjustments(snapshot.adjustments);
                setActivePresetId(null); // Deselect preset on redo
                if (image?.src !== snapshot.imageSrc) {
                    const newImage = new Image();
                    newImage.crossOrigin = 'anonymous';
                    newImage.onload = () => setImage(newImage);
                    newImage.src = snapshot.imageSrc;
                }
                return { ...prev, currentIndex: newIndex };
            }
            return prev;
        });
    }, [image]);

    const handleImageUpload = useCallback(async (file: File) => {
        try {
            const base64 = await toBase64(file);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => setImageAndPushHistory(img);
            img.src = base64;
        } catch (err) { setError("Falha ao carregar a imagem."); }
    }, [setImageAndPushHistory]);

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
            img.crossOrigin = 'anonymous';
            img.onload = () => setImageAndPushHistory(img);
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
                img.crossOrigin = 'anonymous';
                img.onload = () => setImageAndPushHistory(img);
                img.src = images[0];
            }
        } catch (err) { setError(`Falha ao importar do Google Drive.`); }
    };
    
    const generateCssFilters = useCallback(() => {
        const filters = [];
        if (liveAdjustments.exposure !== 0) filters.push(`brightness(${1 + liveAdjustments.exposure / 100})`);
        if (liveAdjustments.contrast !== 0) filters.push(`contrast(${1 + liveAdjustments.contrast / 100})`);
        if (liveAdjustments.saturation !== 0) filters.push(`saturate(${1 + liveAdjustments.saturation / 100})`);
        if (liveAdjustments.sharpness > 0) filters.push(`url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><filter id="sharpness"><feGaussianBlur stdDeviation="${1 - (liveAdjustments.sharpness / 100)}" /></filter></svg>#sharpness')`); // Simplified sharpness
        if (liveAdjustments.clarity > 0) filters.push(`contrast(${1 + liveAdjustments.clarity / 200})`); // Simplified clarity
        return filters.join(' ');
    }, [liveAdjustments]);

    useEffect(() => {
        const { vignette, grain } = liveAdjustments;
        const styles: React.CSSProperties = {};
        const gradients = [];

        if (vignette < 0) {
            const amount = Math.abs(vignette);
            const start = 100 - amount * 0.6;
            gradients.push(`radial-gradient(ellipse at center, rgba(0,0,0,0) ${start}%, rgba(0,0,0,${amount/150}) 100%)`);
        } else if (vignette > 0) {
            const amount = vignette;
            const start = 100 - amount * 0.6;
            gradients.push(`radial-gradient(ellipse at center, rgba(255,255,255,0) ${start}%, rgba(255,255,255,${amount/200}) 100%)`);
        }

        if (grain > 0) {
             styles.backgroundImage = gradients.join(', ');
             styles.opacity = grain / 100;
             styles.backgroundSize = '512px 512px';
             // This is a complex property to animate smoothly, so we just set it.
             styles['--grain-bg'] = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noise)"/></svg>')`;
        } else {
             styles.backgroundImage = gradients.join(', ');
        }
        
        setEffectsPreviewStyle(styles);
    }, [liveAdjustments.vignette, liveAdjustments.grain]);

    const applyAdjustmentsToCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !image) return;
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        ctx.filter = generateCssFilters();
        ctx.drawImage(image, 0, 0);
        // TODO: Implement full canvas-based adjustments for accurate export
        // For now, vignette and grain are preview-only.
    }, [image, generateCssFilters]);

    const handleDownload = () => {
        applyAdjustmentsToCanvas();
        const canvas = canvasRef.current;
        if (canvas) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'AuraStudio-Edited-Image.png';
            link.click();
        }
    };

    const handleSaveToGallery = async () => {
        applyAdjustmentsToCanvas();
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const dataUrl = canvas.toDataURL('image/png');
        try {
            const file = base64ToFile(dataUrl, `AuraStudio-Edited-${nanoid(6)}.png`);
            await uploadUserAsset(file);
            alert('Imagem salva na galeria!');
        } catch(err) {
            setError('Falha ao salvar na galeria.');
        }
    };
    
    const handleBackgroundBlur = async () => {
        if (!image) return;
        setIsLoadingAI('bgBlur');
        setError(null);
        try {
            // Dynamically import the heavy library only when needed
            const remove = await import('@imgly/background-removal');
            
            // 1. Get foreground cutout
            const foregroundBlob = await remove.default(image.src, { publicPath: 'https://unpkg.com/@imgly/background-removal@1.0.4/dist/' });
            const foregroundUrl = URL.createObjectURL(foregroundBlob);
            const foregroundImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = foregroundUrl;
            });
    
            // 2. Prepare canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
    
            // 3. Draw original image and apply blur to the whole thing
            ctx.filter = 'blur(8px)';
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            ctx.filter = 'none';
    
            // 4. Draw the sharp, isolated foreground on top of the blurred background
            ctx.drawImage(foregroundImg, 0, 0, canvas.width, canvas.height);
    
            URL.revokeObjectURL(foregroundUrl);
    
            // 5. Update state with the final composited image
            const resultBase64 = canvas.toDataURL('image/png');
            const newImage = new Image();
            newImage.crossOrigin = 'anonymous';
            newImage.onload = () => setImageAndPushHistory(newImage, DEFAULT_ADJUSTMENTS);
            newImage.src = resultBase64;
    
        } catch (err) {
            setError(err instanceof Error ? `Falha ao desfocar o fundo: ${err.message}` : "Falha ao desfocar o fundo.");
        } finally {
            setIsLoadingAI(null);
        }
    };

    const handleApplyAiEffect = async (effect: 'grain' | 'rays' | 'vibrantColor' | 'magicFocus' | 'longExposure') => {
        if (!image) return;
        setIsLoadingAI(effect);
        setError(null);
        
        let prompt = '';
        switch(effect) {
            case 'grain':
                prompt = "Recreate this image with realistic, cinematic 35mm film grain. Maintain all details and colors of the original photo, but add a beautiful, subtle film grain texture throughout the image. The result must be photorealistic.";
                break;
            case 'rays':
                prompt = "Add dramatic, volumetric light rays (crepuscular rays) to this image. The light should look natural for the scene, streaming down from the brightest part of the image (like the sky or a window). The effect should be beautiful and photorealistic.";
                break;
            case 'vibrantColor':
                prompt = "Enhance the colors of this photo to be extremely vibrant and saturated, like a frame from a colorful cinematic film. Make the colors pop without looking unnatural. Improve the dynamic range.";
                break;
             case 'magicFocus':
                 prompt = "Apply a soft focus or 'dreamy glow' effect to this image, while keeping the main subject's eyes and key facial features relatively sharp. The effect should be subtle and beautiful, similar to a high-end portrait lens with a diffusion filter.";
                 break;
             case 'longExposure':
                prompt = "Recreate this photo as if it were taken with a long exposure camera technique. Water should be silky smooth, clouds should show motion streaks, and light trails from moving objects should be visible. Stationary objects must remain perfectly sharp. The final image must be photorealistic and beautiful.";
                break;
        }
    
        try {
            const resultBase64 = await generateImageWithRetry({
                prompt: prompt,
                base64ImageData: image.src,
            });
            const newImage = new Image();
            newImage.crossOrigin = 'anonymous';
            newImage.onload = () => {
                setImageAndPushHistory(newImage, DEFAULT_ADJUSTMENTS);
            };
            newImage.src = resultBase64;
        } catch (err) {
            setError(err instanceof Error ? `Falha na edição com IA: ${err.message}` : "Falha na edição com IA.");
        } finally {
            setIsLoadingAI(null);
        }
    };

    const handleAiEdit = useCallback(async () => {
        if (!image || !aiEditPrompt.trim()) return;
        setIsLoadingAI('ai-edit');
        setError(null);
        try {
            const finalPrompt = [aiEditPrompt.trim(), ...Array.from(selectedEnhancers)].join(', ');
            const resultBase64 = await generateImageWithRetry({
                prompt: finalPrompt,
                base64ImageData: image.src,
            });
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                setImageAndPushHistory(img, DEFAULT_ADJUSTMENTS);
                setAiEditPrompt('');
                setSelectedEnhancers(new Set());
            };
            img.src = resultBase64;
        } catch (err) {
            setError(err instanceof Error ? `Falha na edição com IA: ${err.message}` : "Falha na edição com IA.");
        } finally {
            setIsLoadingAI(null);
        }
    }, [image, aiEditPrompt, selectedEnhancers, setImageAndPushHistory]);

    const handleApplyPreset = async (asset: PublicAsset | UploadedAsset) => {
        if (activePresetId === asset.id) {
            setActivePresetId(null);
            setLiveAdjustments(DEFAULT_ADJUSTMENTS);
            pushHistory();
            return;
        }
        let url: string;
        try {
            url = 'asset_url' in asset ? asset.asset_url : await createSignedUrlForPath(asset.storage_path);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Could not fetch DNG file.");
            const dngContent = await response.text();
            const adjustments = parseDngPreset(dngContent);
            if (adjustments) {
                setLiveAdjustments({ ...DEFAULT_ADJUSTMENTS, ...adjustments });
                setActivePresetId(asset.id);
                pushHistory();
            } else {
                setError("Não foi possível ler os ajustes desta predefinição.");
            }
        } catch (err) { setError("Falha ao aplicar a predefinição."); }
    };
    
    const handlePresetFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !assetContext) return;
        setIsUploadingPreset(true);
        try {
            await uploadUserAsset(file);
            await assetContext.refetchAssets();
        } catch (err) { setError("Falha ao importar a predefinição.");
        } finally {
            setIsUploadingPreset(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleEffectRequest = (effectId: string) => {
        if (effectId === 'bgBlur') {
            handleBackgroundBlur();
        } else {
            handleApplyAiEffect(effectId as any);
        }
    };

    const controlsPanelProps: ControlsPanelContentProps = {
        history, undo, redo, activeTab, setActiveTab, liveAdjustments, setLiveAdjustments, pushHistory,
        presetFileInputRef, isUploadingPreset, handlePresetFileChange, openPresetSections, togglePresetSection,
        userPresets, handleApplyPreset, isLoadingPresets, publicPresets, aiEditPrompt, setAiEditPrompt,
        handleAiEdit, image, isLoadingAI, handleSaveToGallery, handleDownload,
        openEnhancerSections, toggleEnhancerSection, selectedEnhancers, handleEnhancerChange,
        onTriggerUpload: () => setIsUploadModalOpen(true),
        activePresetId,
    };

    return (
        <>
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="h-full flex flex-col md:flex-row bg-brand-dark">
                <main className="flex-1 flex flex-col p-4 md:p-6 items-center justify-center relative min-h-0 overflow-hidden">
                    {!image ? (
                         <div className="text-center">
                             <IconUpload className="mx-auto" />
                            <h1 className="text-2xl font-bold text-white mt-4">Carregue uma imagem para começar a editar</h1>
                             <div className="mt-8">
                                <Button onClick={() => setIsUploadModalOpen(true)} primary className="text-lg px-8 py-3">Carregar Imagem</Button>
                             </div>
                         </div>
                    ) : (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <div className="relative inline-block">
                                <img 
                                    src={image.src} 
                                    alt="Em edição" 
                                    className="block object-contain rounded-lg" 
                                    style={{ 
                                        filter: generateCssFilters(),
                                        maxHeight: 'calc(100vh - 10rem)',
                                        maxWidth: '100%',
                                    }}
                                />
                                <div className="absolute inset-0 pointer-events-none rounded-lg" style={{...effectsPreviewStyle, backgroundImage: effectsPreviewStyle.backgroundImage ? `${effectsPreviewStyle.backgroundImage}, ${effectsPreviewStyle['--grain-bg']}`: effectsPreviewStyle['--grain-bg']}}></div>
                                {isLoadingAI && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 text-white rounded-lg">
                                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-primary"></div>
                                        <p className="font-semibold">{isLoadingAI === 'bgBlur' ? 'A aplicar desfoque de fundo...' : 'A aplicar edição de IA...'}</p>
                                    </div>
                                )}
                                <AnimatePresence>
                                    {image && (
                                        <EffectsToolbar 
                                            onApplyEffect={handleEffectRequest}
                                            isLoadingAI={!!isLoadingAI}
                                        />
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                    {isMobileView && image && (
                        <div className="absolute bottom-6 right-6 z-10">
                            <Button onClick={() => setIsPanelOpen(true)} primary className="!rounded-full !px-4 !py-3 shadow-lg flex items-center gap-2">
                                <IconEdit className="w-5 h-5"/>
                                Ajustes e Ferramentas
                            </Button>
                        </div>
                    )}
                </main>

                <aside className="hidden md:flex w-80 h-full bg-brand-light flex-shrink-0 p-4 flex-col gap-4 overflow-y-auto">
                    <ControlsPanelContent {...controlsPanelProps} />
                </aside>

                <AnimatePresence>
                    {isMobileView && isPanelOpen && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-30" onClick={() => setIsPanelOpen(false)} />
                            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="fixed top-0 right-0 h-full w-[85vw] max-w-sm bg-brand-light z-40 p-4 flex flex-col gap-4 overflow-y-auto">
                                <ControlsPanelContent {...controlsPanelProps} isMobile={true} onClose={() => setIsPanelOpen(false)} />
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

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