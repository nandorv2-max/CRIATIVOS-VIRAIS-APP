import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import { IconRotate, IconSparkles, IconUndo, IconRedo, IconX, IconTrash, IconArrowsHorizontal, IconUpload, IconCamera } from './Icons';
import { generateImageWithRetry } from '../services/geminiService';
import SavePresetModal, { AdjustmentGroup } from './SavePresetModal';
import UploadOptionsModal from './UploadOptionsModal';
import { showGoogleDriveDngPicker } from '../services/googleDriveService';
import { toBase64 } from '../utils/imageUtils';
import CameraModal from './CameraModal';

interface ProfessionalEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
    onApply: (newImageUrl: string) => void;
}

const SIZES = [
    { name: 'Feed', w: 1080, h: 1350 },
    { name: 'Stories', w: 1080, h: 1920 },
    { name: 'Universal', w: 1080, h: 1080 }
];

// Types for Presets
interface Adjustments {
    exposure: number; contrast: number; highlights: number; shadows: number;
    whites: number; blacks: number; temperature: number; hue: number;
    saturate: number; sharpen: number; grain: number; fade: number; vignette: number;
}
type AdjustmentKey = keyof Adjustments;

const ADJUSTMENT_GROUPS_MAP: Record<AdjustmentGroup, AdjustmentKey[]> = {
    'Luz': ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'],
    'Cor': ['temperature', 'hue', 'saturate'],
    'Efeitos': ['sharpen', 'grain', 'fade', 'vignette']
};

interface Preset {
  name: string;
  settings: Partial<Adjustments>;
}

// XMP to Adjustments mapping
const XMP_CRS_MAP: { [key: string]: { key: AdjustmentKey; scale: number } } = {
    'Exposure2012': { key: 'exposure', scale: 20 },
    'Contrast2012': { key: 'contrast', scale: 1 },
    'Highlights2012': { key: 'highlights', scale: 1 },
    'Shadows2012': { key: 'shadows', scale: 1 },
    'Whites2012': { key: 'whites', scale: 1 },
    'Blacks2012': { key: 'blacks', scale: 1 },
    'Temperature': { key: 'temperature', scale: 1 },
    'Tint': { key: 'hue', scale: 1 }, 
    'Saturation': { key: 'saturate', scale: 1 },
    'Sharpness': { key: 'sharpen', scale: 1 },
    'LuminanceNoiseReductionDetail': { key: 'grain', scale: 1 },
    'PostCropVignetteAmount': { key: 'vignette', scale: 1 }
};

interface AdjustmentSliderProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
}

const AdjustmentSlider: React.FC<AdjustmentSliderProps> = ({label, value, onChange, min, max, step = 1, disabled = false}) => {
    const sliderRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((mouseDownEvent: React.MouseEvent<HTMLDivElement>) => {
        if(disabled) return;
        mouseDownEvent.preventDefault();

        const slider = sliderRef.current;
        if (!slider) return;

        // FIX: Cast element to `any` to access properties in environments with incomplete DOM typings.
        const rect = (slider as any).getBoundingClientRect();

        const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
            // FIX: Cast event to `any` to access properties in environments with incomplete DOM typings.
            const x = Math.max(0, Math.min((mouseMoveEvent as any).clientX - rect.left, rect.width));
            const percentage = x / rect.width;
            const rawValue = min + (percentage * (max - min));
            const steppedValue = Math.round(rawValue / step) * step;
            onChange(steppedValue);
        };

        const handleMouseUp = () => {
            // FIX: Use window.document to access the DOM.
            // FIX: Property 'document' does not exist on type 'Window'.
            window.document.removeEventListener('mousemove', handleMouseMove as any);
            // FIX: Property 'document' does not exist on type 'Window'.
            window.document.removeEventListener('mouseup', handleMouseUp as any);
        };

        handleMouseMove(mouseDownEvent.nativeEvent as MouseEvent);

        // FIX: Use window.document to access the DOM.
        // FIX: Property 'document' does not exist on type 'Window'.
        window.document.addEventListener('mousemove', handleMouseMove as any);
        // FIX: Property 'document' does not exist on type 'Window'.
        window.document.addEventListener('mouseup', handleMouseUp as any);

    }, [min, max, step, onChange, disabled]);

    const displayValue = isNaN(value) ? 0 : Math.round(value);
    const percentage = ((displayValue - min) / (max - min)) * 100;
    
    return (
        <label className={`block text-sm ${disabled ? 'opacity-50' : ''}`}>
            <div className="flex justify-between text-gray-400"><span>{label}</span><span>{displayValue}</span></div>
            <div ref={sliderRef} onMouseDown={handleMouseDown} className={`w-full h-2 rounded-full relative mt-1 py-2 touch-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <div className="absolute top-1/2 -translate-y-1/2 left-0 h-2 bg-gray-600 rounded-full w-full">
                    <div className={`h-full rounded-full ${disabled ? 'bg-gray-500' : 'bg-yellow-400'}`} style={{ width: `${ isNaN(percentage) ? 0 : percentage }%` }} />
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow border border-gray-300 pointer-events-none" style={{ left: `calc(${ isNaN(percentage) ? 0 : percentage }% - 8px)` }} />
            </div>
        </label>
    );
};

const RadioPill: React.FC<{name: string, value: string | number, label: string, checked: boolean, onChange: (v: any) => void, disabled?: boolean}> = ({ name, value, label, checked, onChange, disabled }) => (
    <label className={`cursor-pointer px-3 py-1 text-xs rounded-full transition-colors font-semibold ${checked ? 'bg-yellow-400 text-black' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="hidden" disabled={disabled}/>
        {label}
    </label>
);

const UpscaleComparison: React.FC<{ before: string, after: string, onClose: () => void }> = ({ before, after, onClose }) => {
    const [position, setPosition] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const [aspectRatio, setAspectRatio] = useState('16 / 9');

    useEffect(() => {
        // FIX: Use `window.Image` to access the constructor.
        // FIX: Property 'Image' does not exist on type 'Window'.
        const img = new window.Image();
        img.onload = () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
            }
        };
        img.src = after;
    }, [after]);

    const updatePosition = (e: MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;
        // FIX: Cast element to `any` to access properties in environments with incomplete DOM typings.
        const rect = (containerRef.current as any).getBoundingClientRect();
        const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setPosition((x / rect.width) * 100);
    };

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
        isDraggingRef.current = true;
        updatePosition(e.nativeEvent as MouseEvent | TouchEvent);
    };

    const handleInteractionEnd = () => {
        isDraggingRef.current = false;
    };

    const handleInteractionMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDraggingRef.current) return;
        updatePosition(e.nativeEvent as MouseEvent | TouchEvent);
    };

    useEffect(() => {
        const handleMouseUp = () => handleInteractionEnd();
        const handleTouchEnd = () => handleInteractionEnd();
        
        // FIX: Use `window.addEventListener` for broader compatibility.
        // FIX: Property 'addEventListener' does not exist on type 'Window'.
        (window as any).addEventListener('mouseup', handleMouseUp as any);
        // FIX: Property 'addEventListener' does not exist on type 'Window'.
        (window as any).addEventListener('touchend', handleTouchEnd as any);
        
        return () => {
            // FIX: Use `window.removeEventListener` for broader compatibility.
            // FIX: Property 'removeEventListener' does not exist on type 'Window'.
            (window as any).removeEventListener('mouseup', handleMouseUp as any);
            // FIX: Property 'removeEventListener' does not exist on type 'Window'.
            (window as any).removeEventListener('touchend', handleTouchEnd as any);
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center p-4" onMouseUp={handleInteractionEnd}>
            <div className="absolute top-4 right-4 z-20">
                <Button onClick={onClose} primary>Concluído</Button>
            </div>
            <div 
                ref={containerRef}
                className="relative w-full max-w-7xl cursor-ew-resize select-none"
                style={{ aspectRatio }}
                onMouseDown={handleInteractionStart}
                onMouseMove={handleInteractionMove}
                onTouchStart={handleInteractionStart}
                onTouchMove={handleInteractionMove}
            >
                {/* After Image */}
                <img src={after} alt="Depois do Upscale" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                
                {/* Before Image (clipped) */}
                <div 
                    className="absolute inset-0 w-full h-full pointer-events-none" 
                    style={{ clipPath: `polygon(0 0, ${position}% 0, ${position}% 100%, 0 100%)` }}
                >
                    <img src={before} alt="Antes do Upscale" className="w-full h-full object-cover" />
                </div>
                
                {/* Divider */}
                <div 
                    className="absolute top-0 bottom-0 w-1 bg-white/80 pointer-events-none flex items-center" 
                    style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                >
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-black shadow-2xl -ml-[19px]">
                        <IconArrowsHorizontal />
                    </div>
                </div>

                 {/* Labels */}
                <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-md text-lg font-bold pointer-events-none backdrop-blur-sm">Antes</div>
                <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-md text-lg font-bold pointer-events-none backdrop-blur-sm">Depois</div>
            </div>
        </div>
    );
};


const ProfessionalEditorModal: React.FC<ProfessionalEditorModalProps> = ({ isOpen, onClose, imageUrl, onApply }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [internalImageUrl, setInternalImageUrl] = useState<string | null>(null);

    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const currentImageUrl = history[historyIndex] ?? null;

    const [rotation, setRotation] = useState(0);
    const [zoom, setZoom] = useState(1); // Zoom is now a multiplier, 1 = 100%
    const [minZoom, setMinZoom] = useState(1);
    const [outputSize, setOutputSize] = useState<{ w: number; h: number; name: string } | null>(null);
    const [imageNaturalSize, setImageNaturalSize] = useState({ w: 1, h: 1 });
    
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });

    const imageRef = useRef<HTMLImageElement>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const dngInputRef = useRef<HTMLInputElement>(null);
    const imageUploadInputRef = useRef<HTMLInputElement>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    
    // Advanced Adjustments State
    const [exposure, setExposure] = useState(0);
    const [contrast, setContrast] = useState(0);
    const [highlights, setHighlights] = useState(0);
    const [shadows, setShadows] = useState(0);
    const [whites, setWhites] = useState(0);
    const [blacks, setBlacks] = useState(0);
    const [temperature, setTemperature] = useState(0);
    const [hue, setHue] = useState(0);
    const [saturate, setSaturate] = useState(0);
    const [sharpen, setSharpen] = useState(0);
    const [grain, setGrain] = useState(0);
    const [fade, setFade] = useState(0);
    const [vignette, setVignette] = useState(0);

    // Upscale State
    const [isUpscaleAutomatic, setIsUpscaleAutomatic] = useState(true);
    const [upscaleFactor, setUpscaleFactor] = useState(2);
    const [upscaleCreativity, setUpscaleCreativity] = useState(10);
    const [upscaleHdr, setUpscaleHdr] = useState(50);
    const [upscaleResemblance, setUpscaleResemblance] = useState(80);
    const [upscaleFractality, setUpscaleFractality] = useState(50);
    const [upscaleEngine, setUpscaleEngine] = useState('Illusio');
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [comparisonImage, setComparisonImage] = useState<{ before: string; after: string } | null>(null);


    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<string>('');
    const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
    
    const resetVisualAdjustments = useCallback((keepHistory = false) => {
        setRotation(0); setZoom(1); setMinZoom(1); setPanOffset({ x: 0, y: 0 });
        setExposure(0); setContrast(0); setHighlights(0); setShadows(0);
        setWhites(0); setBlacks(0); setTemperature(0); setHue(0);
        setSaturate(0); setSharpen(0); setGrain(0); setFade(0); setVignette(0);
        if (!keepHistory) { setInternalImageUrl(null); setHistory([]); setHistoryIndex(-1); }
    }, []);
    
    useEffect(() => {
        try {
            // FIX: Prefix `localStorage` with `window.` to ensure it is available.
            const savedPresets = (window as any).localStorage.getItem('photoEditorPresets');
            if (savedPresets) { setPresets(JSON.parse(savedPresets)); }
        } catch (e) { console.error("Failed to load presets from localStorage", e); }
    }, []);

    const savePresetsToStorage = (updatedPresets: Preset[]) => {
        try {
            // FIX: Prefix `localStorage` with `window.` to ensure it is available.
            (window as any).localStorage.setItem('photoEditorPresets', JSON.stringify(updatedPresets));
        } catch(e) { console.error("Failed to save presets to localStorage", e); }
    };

    useEffect(() => {
        if (isOpen) {
            resetVisualAdjustments();
            setPrompt(''); setError(null); setIsLoading(false);
            if (imageUrl) {
                setInternalImageUrl(imageUrl);
                setHistory([imageUrl]);
                setHistoryIndex(0);
            }
            setOutputSize(null);
        }
    }, [isOpen, imageUrl, resetVisualAdjustments]);
    
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        // FIX: Cast element to `any` to access properties in environments with incomplete DOM typings.
        const newSize = { w: (img as any).naturalWidth, h: (img as any).naturalHeight };
        setImageNaturalSize(newSize);
        handleSetOutputSize(outputSize, newSize); // Recalculate zoom based on new image
    };

    const handleLocalImageUpload = async (file: File) => {
        if (!file) return;
        setIsLoading(true);
        try {
            const base64 = await toBase64(file);
            setInternalImageUrl(base64);
            setHistory([base64]);
            setHistoryIndex(0);
        } catch (e) {
            setError("Falha ao carregar a imagem.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSetOutputSize = (size: { w: number; h: number; name: string } | null, naturalSize?: { w: number; h: number }) => {
        setOutputSize(size);
        setPanOffset({ x: 0, y: 0 });
        const imgNaturalSize = naturalSize || imageNaturalSize;

        if (size && imgNaturalSize.w > 1 && imageContainerRef.current) {
            const container = imageContainerRef.current;
            // FIX: Cast element to `any` to access properties in environments with incomplete DOM typings.
            const containerRect = (container as any).getBoundingClientRect();
            
            const targetRatio = size.w / size.h;
            let cropBoxW = containerRect.width;
            let cropBoxH = cropBoxW / targetRatio;
            
            if (cropBoxH > containerRect.height) {
                cropBoxH = containerRect.height;
                cropBoxW = cropBoxH * targetRatio;
            }
            
            const imageRatio = imgNaturalSize.w / imgNaturalSize.h;
            let initialZoom = 1;
            if (imageRatio > targetRatio) { // Image is wider than crop box
                initialZoom = cropBoxH / (cropBoxW / imageRatio);
            } else { // Image is taller than or same ratio as crop box
                initialZoom = 1; // It will already cover horizontally
            }
            setZoom(initialZoom);
            setMinZoom(initialZoom);
        } else {
            setZoom(1);
            setMinZoom(1);
        }
    };
    
    const getCssFilter = () => {
        const filters = [
            `brightness(${1 + (exposure / 100)})`,
            `contrast(${1 + (contrast / 100)})`,
            `saturate(${1 + (saturate / 100)})`,
            `sepia(${temperature > 0 ? temperature / 100 : 0})`,
            `hue-rotate(${hue}deg)`,
        ];
        return filters.join(' ');
    };

    const handleAIGenerate = async () => {
        if (!prompt || !currentImageUrl) return;
        setIsLoading(true); setError(null);
        const instruction = `PRIORIDADE MÁXIMA - EDIÇÃO FOTOGRÁFICA DE PRECISÃO CIRÚRGICA. Sua tarefa é executar uma alteração mínima e localizada na imagem, com base na instrução do usuário. **Instrução:** "${prompt}". **PROCESSO OBRIGATÓRIO:** 1. IDENTIFICAR O ALVO EXATO. 2. EXECUTAR A MUDANÇA MÍNIMA. 3. PRESERVAR 99% DA IMAGEM. O resultado deve ser a foto original com uma única e sutil alteração. A saída deve ser APENAS a imagem.`;
        try {
            const newImageUrl = await generateImageWithRetry({ prompt: instruction, base64ImageData: currentImageUrl });
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(newImageUrl);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        } catch (err) {
            console.error("AI editing failed:", err);
            setError("Falha na edição com IA. Por favor, tente novamente.");
        } finally { setIsLoading(false); }
    };

    const handleUpscale = async () => {
        if (!currentImageUrl) return;
        setIsUpscaling(true);
        setError(null);

        let upscalePrompt = '';
        if (isUpscaleAutomatic) {
            upscalePrompt = `PRIORIDADE MÁXIMA - MODO AUTOMÁTICO DE UPSCALE FOTOGRÁFICO. Sua tarefa é realizar um "super-resolution" na imagem fornecida com a maior qualidade fotorrealista possível. Analise o conteúdo da imagem (retrato, paisagem, etc.) e aplique a combinação ideal de nitidez, aprimoramento de detalhes, redução de ruído e reconstrução de textura para produzir um resultado profissional e de alta resolução. O objetivo é um aprimoramento natural, limpo e detalhado, que pareça uma foto tirada com uma câmera muito superior. NÃO altere as dimensões da imagem. A saída deve ser APENAS a imagem aprimorada.`;
        } else {
            upscalePrompt = `
PRIORIDADE MÁXIMA - UPSCALE FOTOGRÁFICO AVANÇADO E CONTROLADO.

Sua tarefa é realizar um "super-resolution" na imagem fornecida, agindo como um motor de aprimoramento de imagem de ponta. Você deve reconstruir e aprimorar meticulosamente os detalhes, adicionando textura e clareza fotorrealistas. NÃO altere as dimensões da imagem. Interprete os seguintes parâmetros descritivos para guiar sua reconstrução:

1.  **Semelhança com o Original (Nível: ${upscaleResemblance}/100):** Esta é a regra mais importante. Um valor alto (próximo de 100) exige que você se atenha estritamente à estrutura, composição e cores da imagem original. Suas melhorias devem se concentrar apenas na textura e clareza dos pixels existentes. Um valor mais baixo lhe dá mais liberdade para reinterpretar levemente as formas e detalhes para um resultado mais estilizado.

2.  **Criatividade / Alucinação de Detalhes (Nível: ${upscaleCreativity}/100):** Este parâmetro controla sua liberdade artística para "alucinar" ou inventar detalhes finos que não estão visíveis no original. Um valor baixo significa que você não deve adicionar nenhuma informação nova. Um valor alto o incentiva a adicionar detalhes plausíveis e de alta frequência (como poros da pele, fios de cabelo individuais, texturas de tecido, detalhes arquitetônicos finos) para aumentar o realismo percebido.

3.  **Intensidade de HDR (Nível: ${upscaleHdr}/100):** Isso controla o contraste local e a faixa dinâmica. Um valor mais alto deve fazer com que os detalhes nas sombras e nos destaques se tornem mais pronunciados, aumentando a nitidez e a "presença" geral da imagem. Tenha cuidado para não criar uma aparência excessivamente artificial ou " grungy", a menos que o valor seja extremamente alto.

4.  **Complexidade Fractal (Nível: ${upscaleFractality}/100):** Isso controla a complexidade e a granulação dos detalhes que você adiciona. Um valor mais baixo deve resultar em texturas mais naturais e orgânicas. Um valor mais alto o instrui a introduzir padrões intrincados e finos dentro de formas maiores, quase como um fractal (por exemplo, padrões de folhas minúsculas dentro de uma folha maior). Use para fins artísticos ou para imagens com muitos detalhes finos.

5.  **Estilo do Motor de Renderização (Estilo: ${upscaleEngine}):** Isso dita a estética geral do resultado.
    *   **Illusio:** Produza um resultado mais suave e limpo. Ótimo para remover artefatos de compressão e para um acabamento liso, quase como uma ilustração digital.
    *   **Sharpy:** Busque a máxima nitidez e detalhes nítidos. O resultado deve parecer uma fotografia comercial de alta qualidade e pode até mesmo realçar o grão ou a textura existentes.
    *   **Sparkle:** Encontre um equilíbrio entre os dois. O resultado deve ser nítido, mas limpo e realista, sem a suavidade do Illusio ou a agressividade do Sharpy.

**SAÍDA OBRIGATÓRIA:** A saída deve ser APENAS a imagem aprimorada. Não inclua texto, bordas ou qualquer outra coisa.
            `;
        }


        try {
            const beforeImage = history[historyIndex];
            const newImageUrl = await generateImageWithRetry({ prompt: upscalePrompt, base64ImageData: currentImageUrl });
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(newImageUrl);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setComparisonImage({ before: beforeImage, after: newImageUrl });
        } catch (err) {
            console.error("AI upscale failed:", err);
            setError("Falha no upscale com IA. Por favor, tente novamente.");
        } finally {
            setIsUpscaling(false);
        }
    };
    
    const handleApplyChanges = async () => {
        if (!currentImageUrl) return;
        setIsLoading(true);
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                // FIX: Use `window.Image` to access the constructor.
                // FIX: Property 'Image' does not exist on type 'Window'.
                const image = new window.Image();
                image.crossOrigin = "anonymous";
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = currentImageUrl;
            });

            // FIX: Use `window.document` to access the DOM.
            // FIX: Property 'document' does not exist on type 'Window'.
            const canvas = window.document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error("Could not get canvas context");
            
            const finalW = outputSize?.w ?? (img as any).naturalWidth;
            const finalH = outputSize?.h ?? (img as any).naturalHeight;
            canvas.width = finalW; canvas.height = finalH;
            
            // Calculate source rect from original image based on pan, zoom, and crop
            const finalRatio = finalW / finalH;
            
            let sourceW, sourceH;
            if ((img as any).naturalWidth / (img as any).naturalHeight > finalRatio) {
                sourceH = (img as any).naturalHeight;
                sourceW = sourceH * finalRatio;
            } else {
                sourceW = (img as any).naturalWidth;
                sourceH = sourceW / finalRatio;
            }
            
            sourceW /= zoom;
            sourceH /= zoom;

            const maxPanX = ((img as any).naturalWidth / zoom - sourceW) / 2;
            const maxPanY = ((img as any).naturalHeight / zoom - sourceH) / 2;
            
            const currentPanX = (panOffset.x / ((imageContainerRef.current as any)?.clientWidth ?? 1)) * ((img as any).naturalWidth / zoom);
            const currentPanY = (panOffset.y / ((imageContainerRef.current as any)?.clientHeight ?? 1)) * ((img as any).naturalHeight / zoom);
            
            const sourceX = ((img as any).naturalWidth - sourceW * zoom) / 2 - currentPanX + (sourceW * zoom - sourceW) / 2;
            const sourceY = ((img as any).naturalHeight - sourceH * zoom) / 2 - currentPanY + (sourceH * zoom - sourceH) / 2;
            
            ctx.save();
            ctx.translate(finalW / 2, finalH / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-finalW / 2, -finalH / 2);

            ctx.filter = getCssFilter();
            ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, finalW, finalH);
            ctx.restore();

            // Applying effects that are not simple filters
            if (vignette !== 0) {
                ctx.filter = 'none'; // reset filter for gradient
                const vignetteAmount = Math.abs(vignette) / 100;
                const gradient = ctx.createRadialGradient(finalW / 2, finalH / 2, finalW * 0.2, finalW / 2, finalH / 2, finalW * 0.7);
                const color = vignette > 0 ? `rgba(255,255,255,${vignetteAmount})` : `rgba(0,0,0,${vignetteAmount})`;
                gradient.addColorStop(0, 'rgba(0,0,0,0)');
                gradient.addColorStop(1, color);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, finalW, finalH);
            }

            onApply(canvas.toDataURL('image/png'));
        } catch (error) {
            console.error("Failed to apply changes", error);
            setError("Não foi possível processar a imagem final.");
        } finally { setIsLoading(false); }
    };
    
    const handleUndo = () => { if (historyIndex > 0) setHistoryIndex(historyIndex - 1); };
    const handleRedo = () => { if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1); };
    
    const handlePanStart = (e: React.MouseEvent) => {
        e.preventDefault(); setIsPanning(true);
        panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    };

    const handlePanMove = (e: React.MouseEvent) => {
        if (!isPanning || !imageContainerRef.current) return;
        e.preventDefault();
        
        // FIX: Cast element to `any` to access properties in environments with incomplete DOM typings.
        const containerRect = (imageContainerRef.current as any).getBoundingClientRect();
        
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;

        const imgDisplayW = containerRect.width * zoom;
        const imgDisplayH = (containerRect.width / imageNaturalSize.w) * imageNaturalSize.h * zoom;
        
        const maxX = Math.max(0, (imgDisplayW - containerRect.width) / 2);
        const maxY = Math.max(0, (imgDisplayH - containerRect.height) / 2);
        
        setPanOffset({ x: Math.max(-maxX, Math.min(dx, maxX)), y: Math.max(-maxY, Math.min(dy, maxY)) });
    };

    const handlePanEnd = (e: React.MouseEvent) => { e.preventDefault(); setIsPanning(false); };

    const getCurrentSettings = (): Adjustments => ({
        exposure, contrast, highlights, shadows, whites, blacks,
        temperature, hue, saturate, sharpen, grain, fade, vignette
    });

    const applyPreset = (presetName: string) => {
        setSelectedPreset(presetName);
        const preset = presets.find(p => p.name === presetName);
        if (!preset) {
            resetVisualAdjustments(true);
            return;
        };
        const s = preset.settings;
        resetVisualAdjustments(true); // Reset all before applying
        setExposure(s.exposure ?? 0); setContrast(s.contrast ?? 0);
        setHighlights(s.highlights ?? 0); 
        const shadowsValue = s.shadows ?? 0;
        setShadows(isNaN(shadowsValue) ? 0 : shadowsValue);
        setWhites(s.whites ?? 0); setBlacks(s.blacks ?? 0);
        setTemperature(s.temperature ?? 0); setHue(s.hue ?? 0);
        setSaturate(s.saturate ?? 0); setSharpen(s.sharpen ?? 0);
        setGrain(s.grain ?? 0); setFade(s.fade ?? 0); setVignette(s.vignette ?? 0);
    };

    const handleSavePreset = (name: string, groups: AdjustmentGroup[]) => {
        const currentSettings = getCurrentSettings();
        const settingsToSave: Partial<Adjustments> = {};
        groups.forEach(groupName => {
            ADJUSTMENT_GROUPS_MAP[groupName].forEach(key => {
                if(currentSettings[key] !== 0) settingsToSave[key] = currentSettings[key];
            });
        });
        const newPreset: Preset = { name, settings: settingsToSave };
        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        savePresetsToStorage(updatedPresets);
    };

    const handleDeletePreset = () => {
        if (!selectedPreset) return;
        const updatedPresets = presets.filter(p => p.name !== selectedPreset);
        setPresets(updatedPresets);
        savePresetsToStorage(updatedPresets);
        setSelectedPreset('');
        resetVisualAdjustments(true);
    };

    const parseAndSaveDngPreset = (fileContent: string, fileName: string) => {
        const xmpStart = fileContent.indexOf('<x:xmpmeta');
        const xmpEnd = fileContent.indexOf('</x:xmpmeta>');
        if (xmpStart === -1 || xmpEnd === -1) throw new Error("Metadados XMP não encontrados no arquivo DNG.");
        
        const xmpString = fileContent.substring(xmpStart, xmpEnd + 12);
        // FIX: Use `window.DOMParser` to access the constructor.
        const parser = new (window as any).DOMParser();
        const xmlDoc = parser.parseFromString(xmpString, "application/xml");
        const descriptionNode = xmlDoc.getElementsByTagName('rdf:Description')[0];
        if (!descriptionNode) throw new Error("Nenhuma tag rdf:Description encontrada no XMP.");

        const importedSettings: Partial<Adjustments> = {};
        for (const attr of Array.from(descriptionNode.attributes as any)) {
            const [prefix, name] = (attr as any).name.split(':');
            if (prefix === 'crs' && XMP_CRS_MAP[name]) {
                const { key, scale } = XMP_CRS_MAP[name];
                const parsedValue = parseFloat((attr as any).value);
                if (!isNaN(parsedValue)) importedSettings[key] = parsedValue * scale;
            }
        }

        if (Object.keys(importedSettings).length === 0) throw new Error("Nenhum ajuste compatível encontrado no arquivo DNG.");
        
        const baseName = fileName.replace(/\.(dng|DNG)$/, '');
        let finalName = baseName;
        let counter = 2;
        while (presets.some(p => p.name === finalName)) {
            finalName = `${baseName} (${counter})`;
            counter++;
        }
        
        const newPreset: Preset = { name: finalName, settings: importedSettings };
        setPresets(prev => {
            const updated = [...prev, newPreset];
            savePresetsToStorage(updated);
            return updated;
        });
    };

    const handleDngImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
        const file = (event.target as any).files?.[0];
        if (!file) return;
        
        setError(null);
        try {
            const fileContent = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsText(file, 'latin1');
            });
            parseAndSaveDngPreset(fileContent, file.name);
        } catch (err: any) {
            console.error("Failed to import DNG preset:", err);
            setError(`Erro ao importar: ${err.message}`);
        } finally {
            // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
            if(event.target) ((event.target as any) as HTMLInputElement).value = ''; // Reset file input
        }
    };

    const handleGoogleDriveDngImport = async () => {
        setError(null);
        try {
            const dngFiles = await showGoogleDriveDngPicker();
            if (dngFiles.length === 0) return;

            dngFiles.forEach(file => {
                try {
                    parseAndSaveDngPreset(file.content, file.name);
                } catch (err: any) {
                     console.error(`Failed to parse DNG from GDrive (${file.name}):`, err);
                     // Set error for the last failed file
                     setError(`Erro ao importar ${file.name}: ${err.message}`);
                }
            });

        } catch (err: any) {
            console.error("Failed to import DNG from Google Drive:", err);
            setError(`Erro ao importar do Google Drive: ${err.message}`);
        }
    };

    const cropBoxStyle = useMemo(() => {
        if (!outputSize || !imageContainerRef.current) return { display: 'none' };
        
        // FIX: Cast element to `any` to access properties in environments with incomplete DOM typings.
        const containerRect = (imageContainerRef.current as any).getBoundingClientRect();
        const targetRatio = outputSize.w / outputSize.h;
        
        let width = containerRect.width;
        let height = width / targetRatio;
        
        if (height > containerRect.height) {
            height = containerRect.height;
            width = height * targetRatio;
        }
        
        const top = (containerRect.height - height) / 2;
        const left = (containerRect.width - width) / 2;
        
        return {
            position: 'absolute' as const,
            top: `${top}px`,
            left: `${left}px`,
            width: `${width}px`,
            height: `${height}px`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
            pointerEvents: 'none' as const,
        };
    }, [outputSize, imageNaturalSize]);
    

    if (!isOpen) return null;

    return (
        <>
            {/* FIX: Correctly handle camera capture by setting image state directly. */}
            <CameraModal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)} onCapture={(img) => { setInternalImageUrl(img); setHistory([img]); setHistoryIndex(0); }} />
            <UploadOptionsModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onLocalUpload={() => { (dngInputRef.current as any)?.click(); setIsUploadModalOpen(false); }}
                onGoogleDriveUpload={() => { handleGoogleDriveDngImport(); setIsUploadModalOpen(false); }}
            />
            <SavePresetModal isOpen={isSavePresetModalOpen} onClose={() => setIsSavePresetModalOpen(false)} onSave={handleSavePreset} />
            {comparisonImage && <UpscaleComparison before={comparisonImage.before} after={comparisonImage.after} onClose={() => setComparisonImage(null)} />}
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="bg-gray-900 rounded-2xl p-2 md:p-6 border border-gray-700 shadow-2xl w-full max-w-7xl relative flex flex-col md:flex-row gap-6 h-[90vh] md:h-auto md:max-h-[90vh]">
                    <div ref={imageContainerRef} className="h-3/5 md:h-auto flex-shrink-0 md:flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden relative cursor-grab active:cursor-grabbing" onMouseDown={handlePanStart} onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}>
                        {!internalImageUrl ? (
                            <div className="flex flex-col items-center gap-4 text-gray-400">
                                <IconUpload className="w-16 h-16" />
                                <h3 className="text-xl font-semibold">Carregar uma Foto para Editar</h3>
                                <p>Comece por carregar uma imagem do seu computador.</p>
                                <Button primary onClick={() => (imageUploadInputRef.current as any)?.click()}>Carregar do Computador</Button>
                                {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                <input type="file" ref={imageUploadInputRef} onChange={(e) => (e.target as any).files?.[0] && handleLocalImageUpload((e.target as any).files![0])} accept="image/*" className="hidden" />
                            </div>
                        ) : (
                            <>
                                <img
                                    ref={imageRef}
                                    key={currentImageUrl}
                                    crossOrigin="anonymous"
                                    src={currentImageUrl!}
                                    alt="Imagem para editar"
                                    className="select-none max-w-full max-h-full"
                                    style={{
                                        filter: getCssFilter(),
                                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                                        transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                                        pointerEvents: 'none'
                                    }}
                                    draggable={false}
                                    onLoad={handleImageLoad}
                                />
                                <div style={cropBoxStyle}>
                                    <div className="w-full h-full border-2 border-white/50 pointer-events-none">
                                        <div className="absolute top-0 bottom-0 left-1/3 -ml-px w-px bg-white/40"></div>
                                        <div className="absolute top-0 bottom-0 left-2/3 -ml-px w-px bg-white/40"></div>
                                        <div className="absolute left-0 right-0 top-1/3 -mt-px h-px bg-white/40"></div>
                                        <div className="absolute left-0 right-0 top-2/3 -mt-px h-px bg-white/40"></div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex-1 md:flex-initial min-h-0 md:w-80 lg:w-96 bg-gray-800/50 p-4 rounded-lg flex flex-col gap-4 overflow-y-auto">
                        <h3 className="text-xl font-semibold text-white text-center">Editor</h3>
                        {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                        <div>
                            <div className='flex justify-between items-center mb-2'><h4 className="font-semibold text-gray-300">Edição com IA</h4><div className="flex items-center gap-2"><button onClick={handleUndo} disabled={historyIndex <= 0} className="disabled:opacity-40"><IconUndo /></button><button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="disabled:opacity-40"><IconRedo /></button></div></div>
                            <textarea
                                value={prompt}
                                // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
                                onChange={(e) => setPrompt((e.target as any).value)}
                                placeholder="Ex: 'Remover o relógio do braço esquerdo'..."
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 resize-none"
                                rows={2}
                            />
                            <Button onClick={handleAIGenerate} primary disabled={isLoading || !prompt || isUpscaling || !internalImageUrl} className="w-full mt-2 text-sm">
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></div>
                                        <span>A gerar...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2"><IconSparkles /><span>Editar com IA</span></div>
                                )}
                            </Button>
                        </div>
                        
                        <details className="space-y-3" open>
                            <summary className="font-semibold text-gray-300 cursor-pointer">Magnific Upscale</summary>
                             <div className="flex items-center justify-between p-2">
                                <span className="text-sm font-medium text-gray-300">Automático</span>
                                <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" className="sr-only peer" checked={isUpscaleAutomatic} onChange={() => setIsUpscaleAutomatic(prev => !prev)} />
                                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-yellow-400 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                                </label>
                            </div>
                            <div className="text-sm space-y-2">
                                <h5 className="font-medium text-gray-400">Fator de Escala</h5>
                                <div className="flex flex-wrap gap-2">
                                    {[2, 4, 8, 16].map(factor => <RadioPill key={factor} name="scale" value={factor} label={`${factor}X`} checked={upscaleFactor === factor} onChange={(e) => setUpscaleFactor(Number((e.target as any).value))} />)}
                                </div>
                            </div>
                            <fieldset disabled={isUpscaleAutomatic || !internalImageUrl} className="space-y-3 disabled:opacity-60">
                                 <AdjustmentSlider label="Criatividade" value={upscaleCreativity} onChange={setUpscaleCreativity} min={0} max={100} disabled={isUpscaleAutomatic} />
                                 <AdjustmentSlider label="HDR" value={upscaleHdr} onChange={setUpscaleHdr} min={0} max={100} disabled={isUpscaleAutomatic} />
                                 <AdjustmentSlider label="Semelhança" value={upscaleResemblance} onChange={setUpscaleResemblance} min={0} max={100} disabled={isUpscaleAutomatic} />
                                 <AdjustmentSlider label="Fractalidade" value={upscaleFractality} onChange={setUpscaleFractality} min={0} max={100} disabled={isUpscaleAutomatic} />
                                <div className="text-sm space-y-2">
                                    <h5 className="font-medium text-gray-400">Motor</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {['Illusio', 'Sharpy', 'Sparkle'].map(engine => <RadioPill key={engine} name="engine" value={engine} label={engine} checked={upscaleEngine === engine} onChange={(e) => setUpscaleEngine((e.target as any).value)} disabled={isUpscaleAutomatic}/>)}
                                    </div>
                                </div>
                            </fieldset>
                             <Button onClick={handleUpscale} primary disabled={isUpscaling || isLoading || !internalImageUrl} className="w-full mt-2 text-sm">
                                {isUpscaling ? (
                                    <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></div><span>A processar...</span></div>
                                ) : (
                                    <span>Upscale</span>
                                )}
                            </Button>
                        </details>

                        <div className="space-y-3">
                             <h4 className="font-semibold text-gray-300">Ajustes</h4>
                             <fieldset disabled={!internalImageUrl} className="disabled:opacity-60 space-y-3">
                                <div>
                                    <h4 className="font-semibold text-gray-300 mb-2">Tamanho da Foto</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => handleSetOutputSize(null)} className={`text-xs p-2 rounded-md transition-colors ${!outputSize ? 'bg-yellow-400 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>Original</button>
                                        {SIZES.map(s => (
                                            <button key={s.name} onClick={() => handleSetOutputSize(s)} className={`text-xs p-2 rounded-md transition-colors ${outputSize?.name === s.name ? 'bg-yellow-400 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>{s.name}</button>
                                        ))}
                                    </div>
                                </div>
                                <AdjustmentSlider label="Zoom" value={zoom * 100} onChange={(v) => setZoom(v / 100)} min={minZoom * 100} max={400} />
                             </fieldset>
                        </div>

                        <details className="space-y-3">
                            <summary className="font-semibold text-gray-300 cursor-pointer">Luz</summary>
                            <fieldset disabled={!internalImageUrl} className="disabled:opacity-60 space-y-3">
                                <AdjustmentSlider label="Exposição" value={exposure} onChange={setExposure} min={-100} max={100} />
                                <AdjustmentSlider label="Contraste" value={contrast} onChange={setContrast} min={-100} max={100} />
                                <AdjustmentSlider label="Destaques" value={highlights} onChange={setHighlights} min={-100} max={100} />
                                <AdjustmentSlider label="Sombras" value={shadows} onChange={setShadows} min={-100} max={100} />
                                <AdjustmentSlider label="Brancos" value={whites} onChange={setWhites} min={-100} max={100} />
                                <AdjustmentSlider label="Pretos" value={blacks} onChange={setBlacks} min={-100} max={100} />
                            </fieldset>
                        </details>

                        <details className="space-y-3">
                            <summary className="font-semibold text-gray-300 cursor-pointer">Cor</summary>
                             <fieldset disabled={!internalImageUrl} className="disabled:opacity-60 space-y-3">
                                <AdjustmentSlider label="Temperatura" value={temperature} onChange={setTemperature} min={-100} max={100} />
                                <AdjustmentSlider label="Matiz" value={hue} onChange={setHue} min={-100} max={100} />
                                <AdjustmentSlider label="Saturação" value={saturate} onChange={setSaturate} min={-100} max={100} />
                            </fieldset>
                        </details>

                        <details className="space-y-3">
                            <summary className="font-semibold text-gray-300 cursor-pointer">Efeitos</summary>
                             <fieldset disabled={!internalImageUrl} className="disabled:opacity-60 space-y-3">
                                <AdjustmentSlider label="Nitidez" value={sharpen} onChange={setSharpen} min={0} max={100} />
                                <AdjustmentSlider label="Partículas" value={grain} onChange={setGrain} min={0} max={100} />
                                <AdjustmentSlider label="Fade" value={fade} onChange={setFade} min={0} max={100} />
                                <AdjustmentSlider label="Vinheta" value={vignette} onChange={setVignette} min={-100} max={100} />
                            </fieldset>
                        </details>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-gray-300">Predefinições</h4>
                            <div className="flex gap-2 items-center">
                                {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                {/* FIX: Property 'value' does not exist on type 'HTMLInputElement'. */}
                                <select value={selectedPreset} onChange={e => applyPreset((e.target as any).value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-white text-sm" disabled={!internalImageUrl}>
                                    <option value="">Selecionar predefinição...</option>
                                    {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                </select>
                                <button onClick={handleDeletePreset} disabled={!selectedPreset || !internalImageUrl} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <IconTrash />
                                </button>
                            </div>
                            <Button onClick={() => setIsSavePresetModalOpen(true)} className="w-full text-sm" disabled={!internalImageUrl}>Criar Predefinição</Button>
                            <Button onClick={() => setIsUploadModalOpen(true)} className="w-full text-sm">Importar Predefinição</Button>
                            <input type="file" ref={dngInputRef} onChange={handleDngImport} accept=".dng,image/x-adobe-dng" className="hidden" />
                        </div>

                        <div className="mt-auto pt-4 border-t border-gray-700 flex justify-center gap-4">
                            <Button onClick={onClose} disabled={isLoading || isUpscaling}>Cancelar</Button>
                            <Button onClick={handleApplyChanges} primary disabled={isLoading || isUpscaling || !internalImageUrl}>
                                {isLoading ? 'A aplicar...' : 'Aplicar'}
                            </Button>
                        </div>
                    </div>

                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-gray-800/70 text-white hover:bg-gray-700 transition-colors" disabled={isLoading || isUpscaling}>
                        <IconX className="w-6 h-6" />
                    </button>
                </motion.div>
            </div>
        </>
    );
};

export default ProfessionalEditorModal;