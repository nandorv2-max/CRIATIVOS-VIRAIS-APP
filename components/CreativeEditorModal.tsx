

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from './Button';
import CreativeEditorSidebar from './CreativeEditorSidebar';
import DownloadModal from './DownloadModal';
import LayersPanel from './LayersPanel';
import BackgroundRemoverModal from './BackgroundRemoverModal';
import { Layer, TextLayer, ImageLayer, ShapeLayer, LayerType, LayerUpdateProps, FrameLayer, FrameFill, VideoLayer, AudioTrack, UploadedAsset, FrameFillContent } from '../types';
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconBold, IconItalic, IconTrash, IconType, IconUnderline, IconLetterCase, IconBringForward, IconSendBackward, IconUndo, IconRedo, IconDuplicate, IconLine, IconArrow } from './Icons';
import { generateImageFromPrompt, generateImageWithRetry, AI_PROMPTS } from '../../services/geminiService';
import { toBase64 } from '../utils/imageUtils';
import { setItem, getItem, keyExists } from '../../utils/db';


interface CreativeEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
    onApply: (newImageUrl: string) => void;
    activeTemplate: string | null;
}

const SIZES = [
    { name: 'Universal', w: 1080, h: 1080 },
    { name: 'Feed', w: 1080, h: 1350 },
    { name: 'Stories', w: 1080, h: 1920 }
];

type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'ml' | 'bm' | 'mr' | 'rotate';
type InteractionType = 'move' | 'resize' | 'rotate' | 'panFrame';

interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
}

interface InteractionState {
    type: InteractionType | null;
    handle: Handle | null;
    startX: number;
    startY: number;
    originalLayer: Layer;
    originalCenter: { x: number; y: number };
    startAngle: number;
    originalFill?: FrameFill;
}

type SnapTarget = {
    value: number;
    start: number;
    end: number;
};

const findSnap = (point: number, targets: SnapTarget[], threshold: number): SnapTarget | null => {
    let bestSnap: SnapTarget | null = null;
    let min_dist = threshold;
    for (const target of targets) {
        const dist = Math.abs(point - target.value);
        if (dist < min_dist) {
            min_dist = dist;
            bestSnap = target;
        }
    }
    return bestSnap;
};

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const floorSeconds = Math.floor(seconds);
    const min = Math.floor(floorSeconds / 60);
    const sec = floorSeconds % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const BoundingBox: React.FC<{ selectedLayer: Layer | null; scale: number; isFrameEditing: boolean; }> = ({ selectedLayer, scale, isFrameEditing }) => {
    if (!selectedLayer) return null;
    const s = selectedLayer;
    const boxStyle: React.CSSProperties = {
        position: 'absolute', left: `${s.x * scale}px`, top: `${s.y * scale}px`,
        width: `${s.width * scale}px`, height: `${s.height * scale}px`,
        transform: `rotate(${s.rotation}deg)`, transformOrigin: 'center center',
        outline: isFrameEditing ? '2px dashed #fbbf24' : '2px solid #fbbf24', 
        pointerEvents: 'none',
        zIndex: 10,
    };
    const handleBaseStyle: React.CSSProperties = {
        position: 'absolute', width: '14px', height: '14px',
        background: 'white', border: '2px solid #fbbf24', borderRadius: '50%', pointerEvents: 'auto',
    };
    const lineStyle: React.CSSProperties = { position: 'absolute', background: '#fbbf24', pointerEvents: 'none' };
    
    if (isFrameEditing) {
        return <div style={boxStyle}></div>
    }

    return (
        <div style={boxStyle}>
            <div style={{...lineStyle, width: '2px', height: '20px', top: '-30px', left: '50%', transform: 'translateX(-50%)'}}></div>
            <div data-handle="tl" style={{ ...handleBaseStyle, top: '-7px', left: '-7px', cursor: 'nwse-resize' }}></div>
            <div data-handle="tr" style={{ ...handleBaseStyle, top: '-7px', right: '-7px', cursor: 'nesw-resize' }}></div>
            <div data-handle="bl" style={{ ...handleBaseStyle, bottom: '-7px', left: '-7px', cursor: 'nesw-resize' }}></div>
            <div data-handle="br" style={{ ...handleBaseStyle, bottom: '-7px', right: '-7px', cursor: 'nwse-resize' }}></div>
            <div data-handle="tm" style={{ ...handleBaseStyle, top: '-7px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }}></div>
            <div data-handle="bm" style={{ ...handleBaseStyle, bottom: '-7px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }}></div>
            <div data-handle="ml" style={{ ...handleBaseStyle, top: '50%', left: '-7px', transform: 'translateY(-50%)', cursor: 'ew-resize' }}></div>
            <div data-handle="mr" style={{ ...handleBaseStyle, top: '50%', right: '-7px', transform: 'translateY(-50%)', cursor: 'ew-resize' }}></div>
            <div data-handle="rotate" style={{ ...handleBaseStyle, top: '-35px', left: '50%', transform: 'translateX(-50%)', cursor: 'grab' }}></div>
        </div>
    );
};

const EditableTextArea = React.forwardRef<HTMLTextAreaElement, { layer: TextLayer; scale: number; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; onBlur: () => void; }>((props, ref) => {
    const { layer, scale, value, onChange, onBlur } = props;
    if (!layer) return null;
    const style: React.CSSProperties = {
        position: 'absolute', left: 0, top: 0,
        width: layer.width, height: layer.height,
        transform: `translate(${layer.x}px, ${layer.y}px) rotate(${layer.rotation}deg)`, transformOrigin: 'top left',
        font: `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}"`,
        color: layer.color, textAlign: layer.textAlign,
        backgroundColor: 'rgba(255,255,255,0.1)', border: '1px dashed #fbbf24',
        resize: 'none', outline: 'none', overflow: 'hidden', whiteSpace: 'pre-wrap', lineHeight: 1.2, zIndex: 10,
    };
    return <textarea ref={ref} value={value} onChange={onChange} onBlur={onBlur} style={{ ...style, width: layer.width * scale, height: layer.height * scale, fontSize: layer.fontSize * scale, transform: `translate(${layer.x * scale}px, ${layer.y * scale}px) rotate(${layer.rotation}deg)`}} />;
});

const VideoControls: React.FC<{
    layer: VideoLayer;
    scale: number;
    playbackState: { isPlaying: boolean; currentTime: number; duration: number; };
    onPlayPause: () => void;
    onSeek: (time: number) => void;
}> = ({ layer, scale, playbackState, onPlayPause, onSeek }) => {
    const { isPlaying, currentTime, duration } = playbackState;

    const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        onSeek(time);
    };

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${layer.x * scale}px`,
        top: `${layer.y * scale}px`,
        width: `${layer.width * scale}px`,
        height: `${layer.height * scale}px`,
        transform: `rotate(${layer.rotation}deg)`,
        transformOrigin: 'center center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
        zIndex: 11,
        color: 'white',
    };

    return (
        <div style={containerStyle}>
            <div className="bg-black/50 p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ pointerEvents: 'auto' }}>
                <div className="flex items-center gap-2">
                    <button onClick={onPlayPause} className="p-1">
                        {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        )}
                    </button>
                    <span className="text-xs font-mono">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={handleScrubberChange}
                        step="0.01"
                        className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none"
                    />
                    <span className="text-xs font-mono">{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
};

const CreativeEditorHeader: React.FC<{
    selectedLayer: Layer | null;
    customFonts: Record<string, string>;
    onUpdateSelectedLayer: (props: LayerUpdateProps, commit: boolean) => void;
    onTriggerFontUpload: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}> = ({ selectedLayer, customFonts, onUpdateSelectedLayer, onTriggerFontUpload, onUndo, onRedo, canUndo, canRedo }) => {
    const layer = selectedLayer as TextLayer | null;

    const handleUpdate = (props: LayerUpdateProps, commit: boolean = false) => {
        onUpdateSelectedLayer(props, commit);
    };

    const isTextLayer = layer && layer.type === 'text';

    const fonts = ['Inter', 'Caveat', 'Arial', 'Verdana', ...Object.keys(customFonts)];
    const nextCase: Record<TextLayer['letterCase'], TextLayer['letterCase']> = { normal: 'uppercase', uppercase: 'lowercase', lowercase: 'normal' };

    return (
        <div className="bg-gray-800/50 p-2 rounded-lg flex items-center justify-between gap-4 text-white text-sm z-10 w-full h-16">
            <div className="flex items-center gap-2">
                <button onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" className="p-2 bg-gray-700 rounded-md text-white hover:bg-gray-600 disabled:opacity-50"><IconUndo /></button>
                <button onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Y)" className="p-2 bg-gray-700 rounded-md text-white hover:bg-gray-600 disabled:opacity-50"><IconRedo /></button>
            </div>

            <AnimatePresence>
            {isTextLayer && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center flex-wrap gap-2"
                >
                    <select value={layer.fontFamily} onChange={(e) => handleUpdate({ fontFamily: e.target.value }, true)} className="bg-gray-700 rounded p-1 h-9">{fonts.map(f => <option key={f}>{f}</option>)}</select>
                    <button onClick={onTriggerFontUpload} className="p-2 h-9 rounded bg-gray-700"><IconType /></button>
                    <input type="number" value={layer.fontSize} onMouseUp={() => handleUpdate({}, true)} onChange={e => handleUpdate({ fontSize: parseInt(e.target.value, 10) || 0 })} className="w-16 bg-gray-700 rounded p-1 text-center h-9" />
                    <input type="color" value={layer.color} onMouseUp={() => handleUpdate({}, true)} onChange={e => handleUpdate({ color: e.target.value })} className="w-9 h-9 p-0 border-none bg-transparent cursor-pointer" />
                    <button onClick={() => handleUpdate({ fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold' }, true)} className={`p-2 h-9 rounded ${layer.fontWeight === 'bold' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}><IconBold /></button>
                    <button onClick={() => handleUpdate({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' }, true)} className={`p-2 h-9 rounded ${layer.fontStyle === 'italic' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}><IconItalic /></button>
                    <button onClick={() => handleUpdate({ textDecoration: layer.textDecoration === 'underline' ? 'none' : 'underline' }, true)} className={`p-2 h-9 rounded ${layer.textDecoration === 'underline' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}><IconUnderline /></button>
                    <button onClick={() => handleUpdate({ letterCase: nextCase[layer.letterCase] }, true)} className="p-2 h-9 rounded bg-gray-700"><IconLetterCase /></button>
                    <button onClick={() => handleUpdate({ textAlign: 'left' }, true)} className={`p-2 h-9 rounded ${layer.textAlign === 'left' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}><IconAlignLeft /></button>
                    <button onClick={() => handleUpdate({ textAlign: 'center' }, true)} className={`p-2 h-9 rounded ${layer.textAlign === 'center' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}><IconAlignCenter /></button>
                    <button onClick={() => handleUpdate({ textAlign: 'right' }, true)} className={`p-2 h-9 rounded ${layer.textAlign === 'right' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}><IconAlignRight /></button>
                </motion.div>
            )}
            </AnimatePresence>
            
            <div className="w-24"> {/* Placeholder to balance the layout */}
            </div>
        </div>
    );
};

const blobUrlToDataUrl = (blobUrl: string): Promise<string> => 
    fetch(blobUrl)
        .then(res => res.blob())
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }));

const CreativeEditorModal: React.FC<CreativeEditorModalProps> = ({ isOpen, onClose, imageUrl, onApply, activeTemplate }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const fontInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const replaceImageInputRef = useRef<HTMLInputElement>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const videoUploadRef = useRef<HTMLInputElement>(null);
    const audioUploadRef = useRef<HTMLInputElement>(null);
    
    const prevLayersRef = useRef<Layer[]>([]);
    const prevAudioTracksRef = useRef<AudioTrack[]>([]);
    const allMediaElementsRef = useRef<(HTMLVideoElement | HTMLAudioElement)[]>([]);
    const autoSaveInProgress = useRef(false);


    const isViralMode = activeTemplate === 'criativoViral';
    
    const [canvasSize, setCanvasSize] = useState({ w: SIZES[0].w, h: SIZES[0].h });
    const [backgroundColor, setBackgroundColor] = useState('#111827');
    const [layers, setLayers] = useState<Layer[]>([]);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [customFonts, setCustomFonts] = useState<Record<string, string>>({});
    const [interaction, setInteraction] = useState<InteractionState | null>(null);
    const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
    const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState('');
    const [scale, setScale] = useState(1);
    const [isLoadingAI, setIsLoadingAI] = useState<null | 'bg' | 'expand' | 'generate' | 'download' | 'project'>(null);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
    const [isBgRemoverOpen, setIsBgRemoverOpen] = useState(false);
    const [imageForBgRefinement, setImageForBgRefinement] = useState<{ current: string; original: string; layerId: string; } | null>(null);
    const [comparisonMode, setComparisonMode] = useState<'after' | 'before' | 'split'>('after');
    const [splitPosition, setSplitPosition] = useState(50);
    const [history, setHistory] = useState<(readonly [Layer[], AudioTrack[]])[]>( [ [[], []] ] );
    const [historyIndex, setHistoryIndex] = useState(0);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetLayer: Layer; } | null>(null);
    const [playbackState, setPlaybackState] = useState({ isPlaying: false, currentTime: 0, duration: 0 });
    const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
    const [editingLayerProps, setEditingLayerProps] = useState<LayerUpdateProps | null>(null);
    const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

    const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;
    const editingFrame = layers.find(l => l.id === editingFrameId) as FrameLayer | undefined;
    const hasVideoOrAudio = layers.some(l => l.type === 'video') || audioTracks.length > 0;

    const commitToHistory = useCallback((newLayers: Layer[], newAudioTracks: AudioTrack[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        const lastState = newHistory[newHistory.length - 1];
        if (lastState && JSON.stringify(lastState[0]) === JSON.stringify(newLayers) && JSON.stringify(lastState[1]) === JSON.stringify(newAudioTracks)) return;
        
        newHistory.push([newLayers, newAudioTracks]);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const updateLayerProps = useCallback((layerId: string, props: LayerUpdateProps, commit: boolean = true) => {
        setLayers(currentLayers => {
            const newLayers = currentLayers.map(l => {
                if (l.id === layerId) {
                    return { ...l, ...props as any };
                }
                return l;
            });
            if(commit) {
                commitToHistory(newLayers, audioTracks);
            }
            return newLayers;
        });
    }, [audioTracks, commitToHistory]);

    const updateSelectedLayer = useCallback((props: LayerUpdateProps, commit: boolean = false) => {
        if(selectedLayerId) {
            if (commit) {
                updateLayerProps(selectedLayerId, { ...editingLayerProps, ...props } as LayerUpdateProps, true);
                setEditingLayerProps(null);
            } else {
                const newProps = { ...editingLayerProps, ...props };
                setEditingLayerProps(newProps as LayerUpdateProps);
                updateLayerProps(selectedLayerId, newProps as LayerUpdateProps, false);
            }
        }
    }, [selectedLayerId, updateLayerProps, editingLayerProps]);
    
    const setLayersAndCommit = useCallback((updater: React.SetStateAction<Layer[]>) => {
        setLayers(currentLayers => {
            const newLayers = typeof updater === 'function' ? updater(currentLayers) : updater;
            commitToHistory(newLayers, audioTracks);
            return newLayers;
        });
    }, [commitToHistory, audioTracks]);

    const setAudioAndCommit = useCallback((updater: React.SetStateAction<AudioTrack[]>) => {
        setAudioTracks(currentAudio => {
            const newAudio = typeof updater === 'function' ? updater(currentAudio) : updater;
            commitToHistory(layers, newAudio);
            return newAudio;
        })
    }, [commitToHistory, layers]);

    const handleUndo = useCallback(() => { if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setLayers(history[newIndex][0] as Layer[]); setAudioTracks(history[newIndex][1] as AudioTrack[]); setSelectedLayerId(null); } }, [history, historyIndex]);
    const handleRedo = useCallback(() => { if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setLayers(history[newIndex][0] as Layer[]); setAudioTracks(history[newIndex][1] as AudioTrack[]); setSelectedLayerId(null); } }, [history, historyIndex]);

    const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                reject(new Error(`Image loaded but has zero dimensions. Src: ${src.substring(0, 100)}...`));
            } else {
                resolve(img);
            }
        };
        img.onerror = () => reject(new Error(`Failed to load image resource. It may be an invalid format, a broken link, or a CORS issue. Src: ${src.substring(0, 100)}...`));
        img.src = src;
    });
    const loadVideo = (src: string): Promise<HTMLVideoElement> => new Promise((resolve, reject) => { const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.onloadedmetadata = () => resolve(video); video.onerror = reject; video.src = src; video.playsInline = true; video.muted = false; return video; });
    const loadAudio = (src: string): Promise<HTMLAudioElement> => new Promise((resolve, reject) => { const audio = new Audio(src); audio.crossOrigin = 'anonymous'; audio.oncanplaythrough = () => resolve(audio); audio.onerror = reject; });
    
    const calculateScale = useCallback(() => {
        if (!canvasContainerRef.current) return 1;
        const { clientWidth, clientHeight } = canvasContainerRef.current;
        const scale = Math.min((clientWidth - 32) / canvasSize.w, (clientHeight - 32) / canvasSize.h) * 0.98;
        return scale > 0.1 ? scale : 0.1;
    }, [canvasSize]);

    useLayoutEffect(() => { const update = () => setScale(calculateScale()); update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, [calculateScale]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        layers.forEach(layer => {
            if (layer.id === editingTextLayerId) return;
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            const centerX = layer.x + layer.width / 2;
            const centerY = layer.y + layer.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(layer.rotation * Math.PI / 180);
            const drawX = -layer.width / 2;
            const drawY = -layer.height / 2;
            ctx.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
            
            if (layer.isLoading) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(drawX, drawY, layer.width, layer.height);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(drawX, drawY, layer.width, layer.height);
                ctx.setLineDash([]);
                
                ctx.font = `24px sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText('Loading...', 0, 0);

            } else {
                const renderContent = (contentLayer: Layer) => {
                    if (contentLayer.type === 'image') {
                        const imgLayer = contentLayer as ImageLayer;
                        const getCoverSourceRect = (frameW: number, frameH: number, imageW: number, imageH: number) => {
                            if (!imageW || !imageH) return { sx: 0, sy: 0, sWidth: 0, sHeight: 0 };
                            const frameRatio = frameW / frameH; const imageRatio = imageW / imageH;
                            let sx = 0, sy = 0, sWidth = imageW, sHeight = imageH;
                            if (imageRatio > frameRatio) { sWidth = sHeight * frameRatio; sx = (imageW - sWidth) / 2; } 
                            else { sHeight = sWidth / frameRatio; sy = (imageH - sHeight) / 2; }
                            return { sx, sy, sWidth, sHeight };
                        };
                        const imageToDraw = (imgLayer.id === selectedLayerId && imgLayer.originalImage && comparisonMode === 'before') ? imgLayer.originalImage : imgLayer.image;
                        if (imgLayer.id === selectedLayerId && imgLayer.originalImage && comparisonMode === 'split' && imgLayer.image?.complete) {
                            const clipWidth = contentLayer.width * (splitPosition / 100);
                            ctx.save(); ctx.beginPath(); ctx.rect(drawX, drawY, clipWidth, contentLayer.height); ctx.clip();
                            const { sx: sxOrig, sy: syOrig, sWidth: sWidthOrig, sHeight: sHeightOrig } = getCoverSourceRect(contentLayer.width, contentLayer.height, imgLayer.originalImage.naturalWidth, imgLayer.originalImage.naturalHeight);
                            ctx.drawImage(imgLayer.originalImage, sxOrig, syOrig, sWidthOrig, sHeightOrig, drawX, drawY, contentLayer.width, contentLayer.height);
                            ctx.restore();
                            ctx.save(); ctx.beginPath(); ctx.rect(drawX + clipWidth, drawY, contentLayer.width - clipWidth, contentLayer.height); ctx.clip();
                            const { sx, sy, sWidth, sHeight } = getCoverSourceRect(contentLayer.width, contentLayer.height, imgLayer.image.naturalWidth, imgLayer.image.naturalHeight);
                            ctx.drawImage(imgLayer.image, sx, sy, sWidth, sHeight, drawX, drawY, contentLayer.width, contentLayer.height);
                            ctx.restore();
                        } else if (imageToDraw?.complete) {
                            const { sx, sy, sWidth, sHeight } = getCoverSourceRect(contentLayer.width, contentLayer.height, imageToDraw.naturalWidth, imageToDraw.naturalHeight);
                            ctx.drawImage(imageToDraw, sx, sy, sWidth, sHeight, drawX, drawY, contentLayer.width, contentLayer.height);
                        }
                    } else if (contentLayer.type === 'video') {
                        const videoLayer = contentLayer as VideoLayer;
                        if (videoLayer.videoElement) {
                            const frameW = contentLayer.width, frameH = contentLayer.height;
                            const videoW = videoLayer.videoElement.videoWidth, videoH = videoLayer.videoElement.videoHeight;
                            const frameRatio = frameW / frameH; const videoRatio = videoW / videoH;
                            let sx = 0, sy = 0, sWidth = videoW, sHeight = videoH;
                            if(videoRatio > frameRatio) { sWidth = sHeight * frameRatio; sx = (videoW - sWidth) / 2;}
                            else { sHeight = sWidth / frameRatio; sy = (videoH - sHeight) / 2;}
                            ctx.drawImage(videoLayer.videoElement, sx, sy, sWidth, sHeight, drawX, drawY, frameW, frameH);
                        }
                    } else if (contentLayer.type === 'text') {
                        const textLayer = contentLayer as TextLayer;
                        ctx.font = `${textLayer.fontStyle} ${textLayer.fontWeight} ${textLayer.fontSize}px "${textLayer.fontFamily}"`; ctx.fillStyle = textLayer.color; ctx.textAlign = textLayer.textAlign; ctx.textBaseline = 'top';
                        let textX = drawX; if (textLayer.textAlign === 'center') textX += contentLayer.width / 2; if (textLayer.textAlign === 'right') textX += contentLayer.width;
                        let textToDraw = textLayer.text; if (textLayer.letterCase === 'uppercase') textToDraw = textToDraw.toUpperCase(); else if (textLayer.letterCase === 'lowercase') textToDraw = textToDraw.toLowerCase();
                        const lines = textToDraw.split('\n');
                        const lineHeight = textLayer.fontSize * 1.2;
                        lines.forEach((line, i) => {
                            ctx.fillText(line, textX, drawY + (i * lineHeight));
                        });
                    } else if (contentLayer.type === 'shape') {
                        const shapeLayer = contentLayer as ShapeLayer;
                        ctx.fillStyle = shapeLayer.fill; ctx.strokeStyle = shapeLayer.fill; ctx.lineWidth = shapeLayer.strokeWidth;
                        if (shapeLayer.shape === 'rectangle') { ctx.fillRect(drawX, drawY, contentLayer.width, contentLayer.height); if (shapeLayer.strokeWidth > 0) ctx.strokeRect(drawX, drawY, contentLayer.width, contentLayer.height); } 
                        else if (shapeLayer.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(0, 0, contentLayer.width / 2, contentLayer.height / 2, 0, 0, 2 * Math.PI); ctx.fill(); if (shapeLayer.strokeWidth > 0) ctx.stroke(); }
                        else if (shapeLayer.shape === 'line' || shapeLayer.shape === 'arrow') {
                            ctx.beginPath();
                            ctx.moveTo(drawX, drawY + contentLayer.height);
                            ctx.lineTo(drawX + contentLayer.width, drawY);
                            ctx.stroke();
                            if(shapeLayer.shape === 'arrow') {
                                const angle = Math.atan2(-contentLayer.height, contentLayer.width);
                                const headlen = Math.min(contentLayer.width, contentLayer.height) * 0.2;
                                ctx.beginPath();
                                ctx.moveTo(drawX + contentLayer.width, drawY);
                                ctx.lineTo(drawX + contentLayer.width - headlen * Math.cos(angle - Math.PI / 6), drawY - headlen * Math.sin(angle - Math.PI / 6));
                                ctx.moveTo(drawX + contentLayer.width, drawY);
                                ctx.lineTo(drawX + contentLayer.width - headlen * Math.cos(angle + Math.PI / 6), drawY - headlen * Math.sin(angle + Math.PI / 6));
                                ctx.stroke();
                            }
                        }
                    } else if (contentLayer.type === 'frame') {
                        const frameLayer = contentLayer as FrameLayer;
                        ctx.beginPath();
                        if(frameLayer.shape === 'ellipse') ctx.ellipse(0, 0, frameLayer.width / 2, frameLayer.height / 2, 0, 0, 2 * Math.PI);
                        else ctx.rect(drawX, drawY, frameLayer.width, frameLayer.height);
                        ctx.save();
                        ctx.clip();
                        if(frameLayer.fill) {
                            const { fill } = frameLayer;
                            const element = fill.type === 'image' ? fill.image : fill.videoElement;
                            const elementW = fill.type === 'image' ? fill.image.naturalWidth : fill.videoElement.videoWidth;
                            const elementH = fill.type === 'image' ? fill.image.naturalHeight : fill.videoElement.videoHeight;
                            
                            const frameW = frameLayer.width, frameH = frameLayer.height;
                            const frameRatio = frameW / frameH; const elementRatio = elementW / elementH;
                            
                            let baseW, baseH;
                            if (elementRatio > frameRatio) { baseH = frameH; baseW = frameH * elementRatio; } 
                            else { baseW = frameW; baseH = frameW / elementRatio; }
    
                            const finalDrawW = baseW * fill.scale;
                            const finalDrawH = baseH * fill.scale;
                            const finalDrawX = drawX + (frameW - finalDrawW) / 2 + fill.offsetX;
                            const finalDrawY = drawY + (frameH - finalDrawH) / 2 + fill.offsetY;
    
                            ctx.drawImage(element, finalDrawX, finalDrawY, finalDrawW, finalDrawH);
                        } else {
                            ctx.fillStyle = '#4b5563'; ctx.fill();
                            ctx.font = `30px sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                            ctx.fillText('🖼️', 0, 0);
                        }
                        ctx.restore();
                        ctx.strokeStyle = "rgba(150,150,150,0.5)"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke();
                    }
                };
                renderContent(layer);
            }
            ctx.restore();
        });
    }, [layers, editingTextLayerId, selectedLayerId, comparisonMode, splitPosition, backgroundColor]);

    useEffect(() => {
        let animationFrameId: number;
        const animate = () => {
            draw();
            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [draw]);

    useEffect(() => {
        const removedLayers = prevLayersRef.current.filter(l => !layers.some(cl => cl.id === l.id));
    
        removedLayers.forEach(layer => {
            if (layer.type === 'video') {
                const videoLayer = layer as VideoLayer;
                if (videoLayer.videoElement) {
                    videoLayer.videoElement.pause();
                    videoLayer.videoElement.removeAttribute('src'); 
                    videoLayer.videoElement.load();
                    if (videoLayer.src.startsWith('blob:')) {
                        URL.revokeObjectURL(videoLayer.src);
                    }
                }
            }
        });
    
        const removedAudioTracks = prevAudioTracksRef.current.filter(t => !audioTracks.some(ct => ct.id === t.id));
    
        removedAudioTracks.forEach(track => {
            if (track.audioElement) {
                track.audioElement.pause();
                track.audioElement.removeAttribute('src');
                track.audioElement.load();
                if (track.src.startsWith('blob:')) {
                    URL.revokeObjectURL(track.src);
                }
            }
        });
    
        prevLayersRef.current = layers;
        prevAudioTracksRef.current = audioTracks;
    
    }, [layers, audioTracks]);
    
    useEffect(() => { const layer = layers.find(l => l.id === selectedLayerId); if (!layer || layer.type !== 'image' || !(layer as ImageLayer).originalSrc) setComparisonMode('after'); }, [selectedLayerId, layers]);
    
    const addLayer = useCallback(async (type: LayerType, options: any = {}) => {
        const baseLayer = { 
            id: Date.now().toString(), 
            name: options.name || 'Nova Camada',
            x: options.x ?? (canvasSize.w / 2 - 100), 
            y: options.y ?? (canvasSize.h / 2 - 100), 
            width: 200, height: 200, rotation: 0, opacity: 1, flipH: false, flipV: false, isLoading: false 
        };
        let newLayer: Layer | null = null;
        if (type === 'text') newLayer = { ...baseLayer, name: 'Texto', type: 'text', text: options.text || 'Digite seu texto', fontFamily: 'Inter', fontSize: 48, color: '#FFFFFF', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', width: 400, height: 60, letterCase: 'normal' } as TextLayer;
        else if (type === 'shape') {
            const shapeType = options.shape || 'rectangle';
            const shapeDefaults = {
                'rectangle': { width: 150, height: 150, fill: '#CCCCCC' },
                'ellipse': { width: 150, height: 150, fill: '#CCCCCC' },
                'line': { width: 200, height: 5, fill: '#FFFFFF', rotation: -45 },
                'arrow': { width: 200, height: 5, fill: '#FFFFFF', rotation: -45 },
            };
            const defaults = shapeDefaults[shapeType as keyof typeof shapeDefaults] || {};
            newLayer = { ...baseLayer, name: `Forma ${shapeType}`, ...defaults, type: 'shape', shape: shapeType, stroke: 'transparent', strokeWidth: shapeType === 'line' || shapeType === 'arrow' ? 5 : 0 } as ShapeLayer;
        }
        else if (type === 'image') {
            try {
                if (!options.src || typeof options.src !== 'string') throw new Error("addLayer('image') called without a valid 'src' string in options.");
                const image = await loadImage(options.src); 
                const aspectRatio = image.naturalWidth / image.naturalHeight;
                if (aspectRatio <= 0 || !isFinite(aspectRatio)) throw new Error(`Invalid image dimensions resulted in a non-positive aspect ratio: ${aspectRatio}`);
                const width = Math.min(canvasSize.w * 0.5, 400);
                const layerX = options.x ? options.x - (width / 2) : baseLayer.x;
                const layerY = options.y ? options.y - ((width / aspectRatio) / 2) : baseLayer.y;
                newLayer = { ...baseLayer, name: 'Imagem', x: layerX, y: layerY, type: 'image', src: options.src, image, width, height: width / aspectRatio } as ImageLayer;
            } catch (error) { console.error(error); alert(`Could not load the image. Please try a different one. Error: ${error instanceof Error ? error.message : 'Unknown error'}`); }
        } else if (type === 'video') {
            const tempLayerId = Date.now().toString();
            try {
                const width = Math.min(canvasSize.w * 0.5, 400);
                const height = width / (16/9);
                const layerX = options.x ? options.x - (width / 2) : baseLayer.x;
                const layerY = options.y ? options.y - (height / 2) : baseLayer.y;
                const placeholderLayer: VideoLayer = { ...baseLayer, name: 'Vídeo', id: tempLayerId, x: layerX, y: layerY, width, height, type: 'video', src: '', duration: 0, isLoading: true };
                setLayers(prev => [...prev, placeholderLayer]);
                setSelectedLayerId(tempLayerId);
                const videoElement = await loadVideo(options.src);
                const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
                const finalLayer: VideoLayer = { ...placeholderLayer, src: options.src, videoElement, duration: videoElement.duration, height: width / aspectRatio, isLoading: false };
                setLayersAndCommit(prev => prev.map(l => l.id === tempLayerId ? finalLayer : l));
                setSelectedLayerId(finalLayer.id);
            } catch (err) {
                console.error("Failed to load video", err);
                setLayersAndCommit(prev => prev.filter(l => l.id !== tempLayerId));
            }
        }
        else if (type === 'frame') newLayer = { ...baseLayer, name: `Moldura ${options.shape || 'rectangle'}`, type: 'frame', shape: options.shape || 'rectangle', fill: null, width: 250, height: 250 } as FrameLayer;
        if (newLayer) { setLayersAndCommit(prev => [...prev, newLayer!]); setSelectedLayerId(newLayer!.id); }
    }, [canvasSize, setLayersAndCommit]);

    useEffect(() => {
        if (isOpen && imageUrl) {
            const size = SIZES[0]; setCanvasSize(size); setBackgroundColor('#111827');
            loadImage(imageUrl).then(image => {
                const canvasRatio = size.w / size.h; const imageRatio = image.naturalWidth / image.naturalHeight;
                let width, height, x, y;
                if (imageRatio > canvasRatio) { width = size.w; height = size.w / imageRatio; x = 0; y = (size.h - height) / 2; } 
                else { height = size.h; width = size.h * imageRatio; y = 0; x = (size.w - width) / 2; }
                const newLayer: ImageLayer = { id: 'background-image', name: 'Fundo', type: 'image', x, y, width, height, rotation: 0, opacity: 1, src: imageUrl, image, flipH: false, flipV: false };
                const initialLayers = [newLayer];
                setLayers(initialLayers); setHistory([ [[],[]], [initialLayers, []] ]); setHistoryIndex(1);
                const asset: UploadedAsset = { id: 'initial-image', projectId: 'default-project', type: 'image', src: imageUrl, thumbnail: imageUrl, name: 'Imagem Inicial' };
                setUploadedAssets([asset]);
            }).catch(err => console.error("Failed to load initial image:", err));
        } else if (!isOpen) { layers.forEach(l => { if(l.type === 'video') (l as VideoLayer).videoElement?.pause(); }); audioTracks.forEach(t => t.audioElement.pause()); setLayers([]); setAudioTracks([]); setUploadedAssets([]); setHistory([[[], []]]); setHistoryIndex(0); setSelectedLayerId(null); setCustomFonts({}); setEditingTextLayerId(null); setIsLayersPanelOpen(false); setContextMenu(null); }
    }, [isOpen, imageUrl]);

    useEffect(() => {
        if (!isOpen) return;
        setLayers(currentLayers => {
            const bgLayer = currentLayers.find(l => l.id === 'background-image') as ImageLayer | undefined;
            if (!bgLayer || !bgLayer.image) return currentLayers;
            return currentLayers.map(layer => {
                if (layer.id !== 'background-image') return layer;
                const newLayer = { ...layer } as ImageLayer; const imageRatio = newLayer.image!.naturalWidth / newLayer.image!.naturalHeight; const newCanvasRatio = canvasSize.w / canvasSize.h;
                if (imageRatio > newCanvasRatio) { newLayer.width = canvasSize.w; newLayer.height = canvasSize.w / imageRatio; newLayer.x = 0; newLayer.y = (canvasSize.h - newLayer.height) / 2; } 
                else { newLayer.height = canvasSize.h; newLayer.width = canvasSize.h * imageRatio; newLayer.y = 0; newLayer.x = (canvasSize.w - newLayer.width) / 2; }
                return newLayer;
            });
        });
    }, [isOpen, canvasSize.w, canvasSize.h]);

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0]; const fontName = file.name.split('.').slice(0, -1).join('.').replace(/\s/g, '-');
            try {
                const fontUrl = URL.createObjectURL(file); const fontFace = new FontFace(fontName, `url(${fontUrl})`);
                await fontFace.load(); (document.fonts as any).add(fontFace); setCustomFonts(prev => ({...prev, [fontName]: fontUrl }));
                if(selectedLayer?.type === 'text') updateSelectedLayer({fontFamily: fontName}, true);
            } catch(err) { console.error("Failed to load font:", err); }
        }
    };
    
    const deleteSelectedLayer = () => { if (selectedLayerId) { setLayersAndCommit(ls => ls.filter(l => l.id !== selectedLayerId)); setSelectedLayerId(null); setContextMenu(null); } };
    const bringForward = () => { if (!selectedLayerId) return; setLayersAndCommit(ls => { const i = ls.findIndex(l => l.id === selectedLayerId); if (i < ls.length - 1) { const n = [...ls]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; } return ls; }); };
    const sendBackward = () => { if (!selectedLayerId) return; setLayersAndCommit(ls => { const i = ls.findIndex(l => l.id === selectedLayerId); if (i > 0) { const n = [...ls]; [n[i], n[i - 1]] = [n[i - 1], n[i]]; return n; } return ls; }); };

    const handleReplaceLayerImage = async (layerId: string, newSrc: string) => {
        try {
            const image = await loadImage(newSrc);
            const updater = (prev: Layer[]) => prev.map(l => {
                if (l.id === layerId) {
                    if (l.type === 'image') {
                        const imgLayer = l as ImageLayer;
                        const aspectRatio = image.width / image.height;
                        const originalSrc = imgLayer.originalSrc || imgLayer.src;
                        const originalImage = imgLayer.originalImage || imgLayer.image;
                        return {...imgLayer, src: newSrc, image, height: imgLayer.width / aspectRatio, originalSrc, originalImage };
                    } else if (l.type === 'frame') {
                         const frameLayer = l as FrameLayer;
                         const newFill: FrameFill = { type: 'image' as const, src: newSrc, image, scale: 1, offsetX: 0, offsetY: 0 };
                         return { ...frameLayer, fill: newFill };
                    }
                }
                return l;
            });
            setLayersAndCommit(updater);
            setComparisonMode('after');
        } catch(e) { console.error("Failed to replace layer image", e); }
        finally { if (replaceImageInputRef.current) replaceImageInputRef.current.value = ''; }
    };
    
    const handleAITool = async (tool: 'bg' | 'expand') => {
        if (!selectedLayer || selectedLayer.type !== 'image') return alert("Por favor, selecione uma camada de imagem.");
        setIsLoadingAI(tool);
        try {
            const imageLayer = selectedLayer as ImageLayer;
            if (tool === 'bg') {
                const bgRemovalModule = await import('@imgly/background-removal');
                const removeBackground = (bgRemovalModule as any).default || bgRemovalModule;
                const imageForRemoval = imageLayer.originalImage || imageLayer.image;
                if (!imageForRemoval) { throw new Error("A imagem da camada não está carregada."); }
                const blob = await removeBackground(imageForRemoval.src);
                const url = URL.createObjectURL(blob);
                await handleReplaceLayerImage(selectedLayer.id, url);
            } else if (tool === 'expand') {
                const originalImageForTool = imageLayer.originalImage || imageLayer.image;
                if (!originalImageForTool || !originalImageForTool.complete) { throw new Error("A imagem da camada não está totalmente carregada."); }
                const tempCanvas = document.createElement('canvas'); tempCanvas.width = canvasSize.w; tempCanvas.height = canvasSize.h;
                const tempCtx = tempCanvas.getContext('2d'); if (!tempCtx) throw new Error("Could not create temp context");
                tempCtx.drawImage(originalImageForTool, imageLayer.x, imageLayer.y, imageLayer.width, imageLayer.height);
                const compositeImageB64 = tempCanvas.toDataURL('image/png');
                const expandedImageSrc = await generateImageWithRetry({ prompt: AI_PROMPTS.MAGIC_EXPAND, base64ImageData: compositeImageB64 });
                const expandedImage = await loadImage(expandedImageSrc);
                setLayersAndCommit(prev => prev.map(l => l.id === imageLayer.id ? { ...l, src: expandedImageSrc, image: expandedImage, originalSrc: imageLayer.src, originalImage: imageLayer.image, x: 0, y: 0, width: canvasSize.w, height: canvasSize.h } as ImageLayer : l));
            }
        } catch(err) { console.error(`AI tool '${tool}' failed:`, err); const userMessage = tool === 'bg' ? 'Ocorreu um erro ao remover o fundo. Por favor, verifique a sua ligação à Internet e tente novamente.' : 'Ocorreu um erro.'; alert(userMessage); } 
        finally { setIsLoadingAI(null); }
    };
    
    const handleOpenBgRemover = () => { const layer = selectedLayer as ImageLayer; if (layer && layer.type === 'image' && layer.originalSrc) { setImageForBgRefinement({ current: layer.src, original: layer.originalSrc, layerId: layer.id }); setIsBgRemoverOpen(true); } };
    const handleApplyBgRefinement = (newImageUrl: string) => {
        if (imageForBgRefinement) {
            loadImage(newImageUrl).then(image => {
                 setLayersAndCommit(prev => prev.map(l => {
                    if (l.id === imageForBgRefinement.layerId && l.type === 'image') {
                        const imgLayer = l as ImageLayer; const aspectRatio = image.width / image.height;
                        return { ...imgLayer, src: newImageUrl, image, height: imgLayer.width / aspectRatio };
                    } return l;
                }));
            });
        }
        setIsBgRemoverOpen(false); setImageForBgRefinement(null);
    };
    const handleGenerateAIImage = async (prompt: string) => { if(!prompt) return; setIsLoadingAI('generate'); try { const newImageSrc = await generateImageFromPrompt(prompt); addLayer('image', { src: newImageSrc }); } catch(err) { console.error(`AI image generation failed:`, err); alert(`Ocorreu um erro.`); } finally { setIsLoadingAI(null); } };
    const getCoords = useCallback((e: React.MouseEvent | MouseEvent | React.DragEvent): { x: number, y: number } => { if (!canvasRef.current) return {x: 0, y: 0}; const rect = canvasRef.current.getBoundingClientRect(); return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }; }, [scale]);
    
    const getLayerAtPoint = useCallback((x: number, y: number, layersToScan: Layer[], ignoreId?: string): Layer | undefined => {
        return [...layersToScan].reverse().find(layer => {
            if (layer.id === ignoreId) return false;
            const cx = layer.x + layer.width / 2, cy = layer.y + layer.height / 2; 
            const angle = -layer.rotation * Math.PI / 180; 
            const rotatedX = (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle); 
            const rotatedY = (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle); 
            return rotatedX >= -layer.width / 2 && rotatedX <= layer.width / 2 && rotatedY >= -layer.height / 2 && rotatedY <= layer.height / 2;
        });
    }, []);

    const handleDoubleClick = (e: React.MouseEvent) => {
        const { x, y } = getCoords(e);
        const clickedLayer = getLayerAtPoint(x, y, layers);
        if (clickedLayer?.type === 'text') {
            setEditingTextLayerId(clickedLayer.id);
            setEditingTextValue((clickedLayer as TextLayer).text);
            setSelectedLayerId(clickedLayer.id);
        } else if (clickedLayer?.type === 'frame' && (clickedLayer as FrameLayer).fill) {
            setEditingFrameId(clickedLayer.id);
            setSelectedLayerId(clickedLayer.id);
        }
    };

    useEffect(() => { if (editingTextLayerId && textInputRef.current) { textInputRef.current.focus(); textInputRef.current.select(); } }, [editingTextLayerId]);
    const handleTextEditBlur = () => { if (editingTextLayerId) { updateLayerProps(editingTextLayerId, { text: editingTextValue }, true); setEditingTextLayerId(null); } };
    
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 2) { // Right click
            const { x, y } = getCoords(e);
            const targetLayer = getLayerAtPoint(x,y, layers);
            if(targetLayer) {
                setSelectedLayerId(targetLayer.id);
                setContextMenu({ x: e.clientX, y: e.clientY, targetLayer });
            }
            return;
        }
        setContextMenu(null);

        if (editingTextLayerId) return;
        const { x, y } = getCoords(e);
        const handle = (e.target as HTMLElement).dataset.handle as Handle;

        if (editingFrameId) {
            const frame = layers.find(l => l.id === editingFrameId) as FrameLayer;
            const clickedLayer = getLayerAtPoint(x, y, layers);
            if (frame && frame.fill && clickedLayer && clickedLayer.id === editingFrameId) {
                setInteraction({ type: 'panFrame', handle: null, startX: e.clientX, startY: e.clientY, originalLayer: frame, originalFill: frame.fill, originalCenter: { x: 0, y: 0 }, startAngle: 0 });
                return;
            }
        }
        
        if (handle && selectedLayer) {
            const originalLayer = selectedLayer; const originalCenter = { x: originalLayer.x + originalLayer.width / 2, y: originalLayer.y + originalLayer.height / 2 };
            if (handle === 'rotate') { const startAngle = Math.atan2(y - originalCenter.y, x - originalCenter.x) * (180 / Math.PI) - originalLayer.rotation; setInteraction({ type: 'rotate', handle, startX: x, startY: y, originalLayer, originalCenter, startAngle }); } 
            else setInteraction({ type: 'resize', handle, startX: e.clientX, startY: e.clientY, originalLayer, originalCenter, startAngle: 0 });
        } else {
            const clickedLayer = getLayerAtPoint(x, y, layers);
            if (clickedLayer) {
                setSelectedLayerId(clickedLayer.id);
                if (editingFrameId && editingFrameId !== clickedLayer.id) setEditingFrameId(null);
                setInteraction({ type: 'move', handle: null, startX: x - clickedLayer.x, startY: y - clickedLayer.y, originalLayer: clickedLayer, originalCenter: {x:0,y:0}, startAngle: 0 });
            } else {
                setSelectedLayerId(null);
                setEditingFrameId(null);
            }
        }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!interaction?.type) return;
        const { type, handle, startX, startY, originalLayer, originalCenter, startAngle, originalFill } = interaction;
        const { x, y } = getCoords(e);

        if (type === 'move') {
            let newX = x - startX;
            let newY = y - startY;
            
            const activeGuides: AlignmentGuide[] = [];
            const snapThreshold = 5 / scale;
            const movingLayer = originalLayer;

            const movingBounds = {
                left: newX,
                right: newX + movingLayer.width,
                top: newY,
                bottom: newY + movingLayer.height,
                centerX: newX + movingLayer.width / 2,
                centerY: newY + movingLayer.height / 2,
            };

            const targetLayers = layers.filter(l => l.id !== movingLayer.id);

            // Vertical Snapping
            let snappedX = false;
            const movingPointsV = [movingBounds.left, movingBounds.centerX, movingBounds.right];

            const canvasCenterX = canvasSize.w / 2;
            for (const point of movingPointsV) {
                if (Math.abs(point - canvasCenterX) < snapThreshold) {
                    newX += canvasCenterX - point;
                    activeGuides.push({ type: 'vertical', position: canvasCenterX, start: 0, end: canvasSize.h });
                    snappedX = true;
                    break;
                }
            }

            if (!snappedX) {
                for (const target of targetLayers) {
                    const targetPointsV = [target.x, target.x + target.width / 2, target.x + target.width];
                    for (const movingPoint of movingPointsV) {
                        for (const targetPoint of targetPointsV) {
                            if (Math.abs(movingPoint - targetPoint) < snapThreshold) {
                                newX += targetPoint - movingPoint;
                                activeGuides.push({
                                    type: 'vertical',
                                    position: targetPoint,
                                    start: Math.min(movingBounds.top, target.y),
                                    end: Math.max(movingBounds.bottom, target.y + target.height),
                                });
                                snappedX = true;
                                break;
                            }
                        }
                        if (snappedX) break;
                    }
                    if (snappedX) break;
                }
            }

            // Horizontal Snapping - must re-calculate movingBounds with potentially snapped X
            const finalMovingBounds = { ...movingBounds, left: newX, right: newX + movingLayer.width, centerX: newX + movingLayer.width / 2 };
            let snappedY = false;
            const movingPointsH = [finalMovingBounds.top, finalMovingBounds.centerY, finalMovingBounds.bottom];

            const canvasCenterY = canvasSize.h / 2;
            for (const point of movingPointsH) {
                if (Math.abs(point - canvasCenterY) < snapThreshold) {
                    newY += canvasCenterY - point;
                    activeGuides.push({ type: 'horizontal', position: canvasCenterY, start: 0, end: canvasSize.w });
                    snappedY = true;
                    break;
                }
            }

            if (!snappedY) {
                for (const target of targetLayers) {
                    const targetPointsH = [target.y, target.y + target.height / 2, target.y + target.height];
                    for (const movingPoint of movingPointsH) {
                        for (const targetPoint of targetPointsH) {
                            if (Math.abs(movingPoint - targetPoint) < snapThreshold) {
                                newY += targetPoint - movingPoint;
                                activeGuides.push({
                                    type: 'horizontal',
                                    position: targetPoint,
                                    start: Math.min(finalMovingBounds.left, target.x),
                                    end: Math.max(finalMovingBounds.right, target.x + target.width),
                                });
                                snappedY = true;
                                break;
                            }
                        }
                        if (snappedY) break;
                    }
                    if (snappedY) break;
                }
            }
            
            setAlignmentGuides(activeGuides);
            updateLayerProps(originalLayer.id, { x: newX, y: newY }, false);

            if (originalLayer.type === 'image' || originalLayer.type === 'video') {
                const layerUnderCursor = getLayerAtPoint(x, y, layers, originalLayer.id);
                if (layerUnderCursor && layerUnderCursor.type === 'frame') {
                    setDropTargetId(layerUnderCursor.id);
                } else {
                    setDropTargetId(null);
                }
            }
        } 
        else if (type === 'rotate') { const currentAngle = Math.atan2(y - originalCenter.y, x - originalCenter.x) * (180 / Math.PI); updateLayerProps(originalLayer.id, { rotation: currentAngle - startAngle }, false) } 
        else if (type === 'panFrame' && originalFill) {
            const dx = (e.clientX - startX) / scale;
            const dy = (e.clientY - startY) / scale;
            const element = originalFill.type === 'image' ? originalFill.image : originalFill.videoElement;
            const elementW = 'naturalWidth' in element ? element.naturalWidth : (element as HTMLVideoElement).videoWidth;
            const elementH = 'naturalHeight' in element ? element.naturalHeight : (element as HTMLVideoElement).videoHeight;
            
            const { scale: zoomScale } = originalFill;
            const frameW = originalLayer.width; const frameH = originalLayer.height;
            const frameRatio = frameW / frameH; const elementRatio = elementW / elementH;
            let baseW, baseH;
            if (elementRatio > frameRatio) { baseH = frameH; baseW = frameH * elementRatio; } 
            else { baseW = frameW; baseH = frameW / elementRatio; }
            const drawW = baseW * zoomScale; const drawH = baseH * zoomScale;

            const maxPanX = Math.max(0, (drawW - frameW) / 2);
            const maxPanY = Math.max(0, (drawH - frameH) / 2);

            const newOffsetX = originalFill.offsetX + dx;
            const newOffsetY = originalFill.offsetY + dy;
            
            const constrainedOffsetX = Math.max(-maxPanX, Math.min(newOffsetX, maxPanX));
            const constrainedOffsetY = Math.max(-maxPanY, Math.min(newOffsetY, maxPanY));
            
            // FIX: Replaced ternary with an if/else block to help TypeScript correctly narrow the
            // discriminated union type of `originalFill` and prevent incorrect type widening.
            let newFill: FrameFill;
            if (originalFill.type === 'image') {
                newFill = { ...originalFill, offsetX: constrainedOffsetX, offsetY: constrainedOffsetY };
            } else {
                newFill = { ...originalFill, offsetX: constrainedOffsetX, offsetY: constrainedOffsetY };
            }
            updateLayerProps(originalLayer.id, { fill: newFill }, false);
        } else if (type === 'resize' && handle) {
            const { originalLayer } = interaction;
            const { x: originalX, y: originalY, width: originalW, height: originalH, rotation } = originalLayer;

            const dx = (e.clientX - interaction.startX) / scale;
            const dy = (e.clientY - interaction.startY) / scale;
            const rad = rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const rdx = dx * cos + dy * sin;
            const rdy = dy * cos - dx * sin;

            let newX = originalX;
            let newY = originalY;
            let newW = originalW;
            let newH = originalH;

            const minSize = 20;

            if (handle === 'tm' || handle === 'bm' || handle === 'ml' || handle === 'mr') {
                let dw_c = 0; let dh_c = 0;
                if (handle === 'mr') { newW = Math.max(minSize, originalW + rdx); dw_c = (newW - originalW) / 2; } 
                else if (handle === 'ml') { newW = Math.max(minSize, originalW - rdx); dw_c = -(newW - originalW) / 2; } 
                else if (handle === 'bm') { newH = Math.max(minSize, originalH + rdy); dh_c = (newH - originalH) / 2; } 
                else if (handle === 'tm') { newH = Math.max(minSize, originalH - rdy); dh_c = -(newH - originalH) / 2; }
                const newCenterX = originalCenter.x + dw_c * cos - dh_c * sin;
                const newCenterY = originalCenter.y + dw_c * sin + dh_c * cos;
                newX = newCenterX - newW / 2;
                newY = newCenterY - newH / 2;
            } else { 
                let potentialW = newW; let potentialH = newH;
                if (handle.includes('r')) potentialW = originalW + rdx;
                if (handle.includes('l')) potentialW = originalW - rdx;
                if (handle.includes('b')) potentialH = originalH + rdy;
                if (handle.includes('t')) potentialH = originalH - rdy;
                const ratio = (originalW > 0 && originalH > 0) ? originalW / originalH : 1;
                const widthChange = Math.abs(potentialW - originalW); const heightChange = Math.abs(potentialH - originalH);
                if (widthChange > heightChange) { newW = Math.max(minSize, potentialW); newH = (originalH > 0) ? newW / ratio : 0; } 
                else { const minHeight = (ratio > 0) ? minSize / ratio : minSize; newH = Math.max(minHeight, potentialH); newW = newH * ratio; }
                newX = originalCenter.x - newW / 2;
                newY = originalCenter.y - newH / 2;
            }
            
            // --- Resizing Snap Logic ---
            const snapThreshold = 5 / scale;
            const targetLayers = layers.filter(l => l.id !== originalLayer.id);
            const vTargets: SnapTarget[] = [{ value: canvasSize.w / 2, start: 0, end: canvasSize.h }];
            const hTargets: SnapTarget[] = [{ value: canvasSize.h / 2, start: 0, end: canvasSize.w }];
            targetLayers.forEach(target => {
                vTargets.push(
                    { value: target.x, start: target.y, end: target.y + target.height },
                    { value: target.x + target.width / 2, start: target.y, end: target.y + target.height },
                    { value: target.x + target.width, start: target.y, end: target.y + target.height }
                );
                hTargets.push(
                    { value: target.y, start: target.x, end: target.x + target.width },
                    { value: target.y + target.height / 2, start: target.x, end: target.x + target.width },
                    { value: target.y + target.height, start: target.x, end: target.x + target.width }
                );
            });

            let finalX = newX, finalY = newY, finalW = newW, finalH = newH;
            const activeGuides: AlignmentGuide[] = [];
            
            if (handle.includes('r')) {
                const snap = findSnap(newX + newW, vTargets, snapThreshold);
                if (snap) { finalW = snap.value - newX; activeGuides.push({ type: 'vertical', position: snap.value, start: Math.min(newY, snap.start), end: Math.max(newY + newH, snap.end) }); }
            } else if (handle.includes('l')) {
                const snap = findSnap(newX, vTargets, snapThreshold);
                if (snap) { const rightEdge = originalX + originalW; finalX = snap.value; finalW = rightEdge - finalX; activeGuides.push({ type: 'vertical', position: snap.value, start: Math.min(newY, snap.start), end: Math.max(newY + newH, snap.end) }); }
            }

            if (handle.includes('b')) {
                const snap = findSnap(newY + newH, hTargets, snapThreshold);
                if (snap) { finalH = snap.value - newY; activeGuides.push({ type: 'horizontal', position: snap.value, start: Math.min(finalX, snap.start), end: Math.max(finalX + finalW, snap.end) }); }
            } else if (handle.includes('t')) {
                const snap = findSnap(newY, hTargets, snapThreshold);
                if (snap) { const bottomEdge = originalY + originalH; finalY = snap.value; finalH = bottomEdge - finalY; activeGuides.push({ type: 'horizontal', position: snap.value, start: Math.min(finalX, snap.start), end: Math.max(finalX + finalW, snap.end) }); }
            }
            
            if (handle.length === 2) {
                const ratio = originalW / originalH;
                if (isFinite(ratio) && ratio !== 0) {
                     if (Math.abs(finalW - newW) > 0.1) { const oldH = finalH; finalH = finalW / ratio; if (handle.includes('t')) { finalY += oldH - finalH; } } 
                     else if (Math.abs(finalH - newH) > 0.1) { const oldW = finalW; finalW = finalH * ratio; if (handle.includes('l')) { finalX += oldW - finalW; } }
                }
            }
            
            setAlignmentGuides(activeGuides);
            updateLayerProps(originalLayer.id, { x: finalX, y: finalY, width: finalW, height: finalH }, false);
        }
    }, [interaction, scale, getCoords, layers, updateLayerProps, canvasSize]);

    const addPastedLayer = useCallback(async (layer: Layer) => {
        try {
            if (layer.type === 'image') {
                const imageLayer = layer as ImageLayer;
                imageLayer.image = await loadImage(imageLayer.src);
                if (imageLayer.originalSrc) imageLayer.originalImage = await loadImage(imageLayer.originalSrc);
            } else if (layer.type === 'video') {
                const videoLayer = layer as VideoLayer;
                videoLayer.videoElement = await loadVideo(videoLayer.src);
            } else if (layer.type === 'frame') {
                const frameLayer = layer as FrameLayer;
                if (frameLayer.fill) {
                    if (frameLayer.fill.type === 'image') {
                        frameLayer.fill.image = await loadImage(frameLayer.fill.src);
                    } else if (frameLayer.fill.type === 'video') {
                        frameLayer.fill.videoElement = await loadVideo(frameLayer.fill.src);
                    }
                }
            }
            setLayersAndCommit(prev => [...prev, layer]);
            setSelectedLayerId(layer.id);
        } catch (err) {
            console.error("Failed to reload media for pasted/duplicated layer:", err);
        }
    }, [setLayersAndCommit]);

    const handleDuplicateSelectedLayer = useCallback(() => {
        if (!selectedLayer) return;
        const newLayerData = {
            ...JSON.parse(JSON.stringify(selectedLayer)),
            id: Date.now().toString(),
            x: selectedLayer.x + 20,
            y: selectedLayer.y + 20,
        };
        addPastedLayer(newLayerData);
        setContextMenu(null);
    }, [selectedLayer, addPastedLayer]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const isModKey = e.ctrlKey || e.metaKey;
            if(e.altKey && e.key === '1') return;
            if (isModKey && e.key === '1' && e.altKey) { e.preventDefault(); setIsLayersPanelOpen(p => !p); }
            else if (isModKey) {
                if (e.key === 'z') { e.preventDefault(); handleUndo(); } 
                else if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); handleRedo(); } 
                else if (e.key === 'c' && selectedLayer) { 
                    e.preventDefault(); 
                    navigator.clipboard.writeText(JSON.stringify(selectedLayer)).catch(err => console.error('Failed to copy to clipboard', err));
                } 
                else if (e.key === 'v') {
                    e.preventDefault();
                    navigator.clipboard.readText().then(text => {
                        try {
                            const clipboard = JSON.parse(text);
                            const newLayerData = { ...clipboard, id: Date.now().toString(), x: clipboard.x + 20, y: clipboard.y + 20 };
                            addPastedLayer(newLayerData);
                        } catch(err) { console.warn("Clipboard content is not a valid layer object."); }
                    }).catch(err => console.error('Failed to read from clipboard', err));
                }
                 else if (e.key === 'd' && selectedLayer) {
                    e.preventDefault();
                    handleDuplicateSelectedLayer();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (editingFrameId) return;
                if (selectedLayerId) {
                    const layer = layers.find(l => l.id === selectedLayerId);
                    if (layer && layer.type === 'frame' && (layer as FrameLayer).fill) {
                        e.preventDefault();
                        updateLayerProps(selectedLayerId, { fill: null }, true);
                    } else {
                        deleteSelectedLayer();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLayer, handleUndo, handleRedo, setLayersAndCommit, deleteSelectedLayer, selectedLayerId, layers, editingFrameId, updateLayerProps, addPastedLayer, handleDuplicateSelectedLayer]);

    const handleMouseUp = useCallback(() => {
        setAlignmentGuides([]);
        if (interaction) {
            if (interaction.type === 'move' && (interaction.originalLayer.type === 'image' || interaction.originalLayer.type === 'video') && dropTargetId) {
                const mediaLayer = interaction.originalLayer as ImageLayer | VideoLayer;
                const targetFrameId = dropTargetId;
                
                const updateFrameWithFill = (fill: FrameFill) => {
                    setLayersAndCommit(currentLayers => {
                        return currentLayers
                            .map(l => {
                                if (l.id === targetFrameId && l.type === 'frame') {
                                    return { ...(l as FrameLayer), fill };
                                }
                                return l;
                            })
                            .filter(l => l.id !== mediaLayer.id);
                    });
                    setSelectedLayerId(targetFrameId);
                };
        
                if (mediaLayer.type === 'image' && mediaLayer.image) {
                    const fillContent: Extract<FrameFillContent, { type: 'image' }> = {
                        type: 'image',
                        src: mediaLayer.src,
                        assetId: mediaLayer.assetId,
                        image: mediaLayer.image,
                    };
                    const newFill: FrameFill = {
                        ...fillContent,
                        scale: 1,
                        offsetX: 0,
                        offsetY: 0,
                    };
                    updateFrameWithFill(newFill);
                } else if (mediaLayer.type === 'video' && mediaLayer.videoElement) {
                    const fillContent: Extract<FrameFillContent, { type: 'video' }> = {
                        type: 'video',
                        src: mediaLayer.src,
                        assetId: mediaLayer.assetId,
                        videoElement: mediaLayer.videoElement,
                    };
                    const newFill: FrameFill = {
                        ...fillContent,
                        scale: 1,
                        offsetX: 0,
                        offsetY: 0,
                    };
                    updateFrameWithFill(newFill);
                }
            } else {
                commitToHistory(layers, audioTracks);
            }
        }
        
        if (editingLayerProps) {
            commitToHistory(layers, audioTracks);
            setEditingLayerProps(null);
        }
    
        setInteraction(null);
        setDropTargetId(null);
    }, [interaction, layers, audioTracks, dropTargetId, setLayersAndCommit, commitToHistory, editingLayerProps]);
    
    useEffect(() => {
        const videoLayer = selectedLayer?.type === 'video' ? selectedLayer as VideoLayer : null;
        const videoElement = videoLayer?.videoElement;
    
        if (!videoElement) return;
    
        const updateState = () => {
            setPlaybackState({
                isPlaying: !videoElement.paused,
                currentTime: videoElement.currentTime,
                duration: videoElement.duration || 0,
            });
        };
    
        videoElement.addEventListener('play', updateState);
        videoElement.addEventListener('pause', updateState);
        videoElement.addEventListener('timeupdate', updateState);
        videoElement.addEventListener('loadedmetadata', updateState);
        updateState(); // Initial state
    
        return () => {
            videoElement.removeEventListener('play', updateState);
            videoElement.removeEventListener('pause', updateState);
            videoElement.removeEventListener('timeupdate', updateState);
            videoElement.removeEventListener('loadedmetadata', updateState);
        };
    }, [selectedLayer]);

    useEffect(() => { const move = (e: MouseEvent) => handleMouseMove(e); const up = () => handleMouseUp(); if(interaction) { window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); } return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }; }, [interaction, handleMouseMove, handleMouseUp]);
    
    const handleVideoPlayPause = () => {
        const videoLayer = selectedLayer as VideoLayer;
        if (videoLayer?.videoElement) {
            if (videoLayer.videoElement.paused) {
                videoLayer.videoElement.play();
            } else {
                videoLayer.videoElement.pause();
            }
        }
    };
    
    const handleVideoSeek = (time: number) => {
        const videoLayer = selectedLayer as VideoLayer;
        if (videoLayer?.videoElement) {
            videoLayer.videoElement.currentTime = time;
        }
    };

    const getBestSupportedMimeType = () => {
        const commonMimeTypes = [
            'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // H.264 Main + AAC LC for max compatibility (WhatsApp, iOS)
            'video/mp4; codecs="avc1.42E01E"',          // H.264 Main
            'video/mp4',
            'video/webm; codecs=vp9,opus',
            'video/webm; codecs=vp8,opus',
            'video/webm',
        ];
        for (const type of commonMimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        alert("O seu navegador não suporta a exportação de MP4. O ficheiro gerado será WebM, que pode não ser compatível com todas as plataformas. Tente usar o Chrome para obter os melhores resultados.")
        return 'video/webm'; // Fallback
    };
    
    const handleDownload = async (options: { format: 'png' | 'jpg' | 'mp4'; transparent: boolean }, onProgress: (p: number) => void) => {
        setSelectedLayerId(null);
        setEditingTextLayerId(null);
        setEditingFrameId(null);
        setComparisonMode('after');
        setContextMenu(null);
        onProgress(0);
        await new Promise(resolve => setTimeout(resolve, 100));
    
        if (options.format !== 'mp4') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvasSize.w;
            exportCanvas.height = canvasSize.h;
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) { onProgress(1); return; }
    
            if (!options.transparent) {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
            }
    
            const originalCanvas = canvasRef.current;
            (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = exportCanvas;
            draw();
            (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = originalCanvas;
    
            const finalImage = exportCanvas.toDataURL(options.format === 'jpg' ? 'image/jpeg' : 'image/png');
            const a = document.createElement('a'); a.href = finalImage; a.download = `design.${options.format}`; a.click();
            onProgress(1);
        } else {
            try {
                const mediaElements = allMediaElementsRef.current;
                if (mediaElements.length === 0) throw new Error("Não há conteúdo de vídeo/áudio para exportar.");
    
                const playbackStates = mediaElements.map(el => ({ paused: el.paused, time: el.currentTime }));

                mediaElements.forEach(el => { el.pause(); el.currentTime = 0; });
                await new Promise(resolve => setTimeout(resolve, 50));
    
                const maxDuration = Math.max(0, ...mediaElements.map(el => el.duration).filter(d => isFinite(d)));
                if (maxDuration <= 0 || !isFinite(maxDuration)) throw new Error("Duração do conteúdo inválida.");
    
                const stream = canvasRef.current!.captureStream(30);
                const audioContext = new AudioContext(); // Create a fresh context for export
                const destination = audioContext.createMediaStreamDestination();
                
                mediaElements.forEach(el => {
                    if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
                         try {
                            el.muted = false; el.volume = 1;
                            const sourceNode = audioContext.createMediaElementSource(el);
                            sourceNode.connect(destination);
                        } catch (e) { console.warn("Could not add audio track to context. This can happen if the element has already been used as an audio source in a previous export.", e); }
                    }
                });
    
                destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    
                const mimeType = getBestSupportedMimeType();
                const fileExtension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
                const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000, audioBitsPerSecond: 192000 });
                const chunks: Blob[] = [];
                recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `design.${fileExtension}`; a.click();
                    URL.revokeObjectURL(url);
                    
                    // Restore state instead of resetting
                    mediaElements.forEach((el, i) => {
                        el.currentTime = playbackStates[i].time;
                        if (!playbackStates[i].paused) el.play();
                    });
                    if (!isTimelinePlaying) { setIsTimelinePlaying(false); }


                    audioContext.close();
                    onProgress(1);
                };
    
                const renderLoop = (startTime: number) => {
                    const elapsed = (performance.now() - startTime) / 1000;
                    if (elapsed >= maxDuration) {
                        if (recorder.state === 'recording') recorder.stop();
                        return;
                    }
                    onProgress(elapsed / maxDuration);
                    requestAnimationFrame(() => renderLoop(startTime));
                };

                recorder.start();
                mediaElements.forEach(el => el.play().catch(e => console.warn("Playback for recording failed:", e)));
                requestAnimationFrame(() => renderLoop(performance.now()));
    
            } catch (err) {
                console.error("MP4 export failed:", err);
                alert(`MP4 export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                onProgress(1);
            }
        }
    };
    
    const handleSplitterMouseDown = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); const move = (me: MouseEvent) => { const p = canvasRef.current?.parentElement; if (!p) return; const r = p.getBoundingClientRect(); const x = me.clientX - r.left; let n = (x / r.width) * 100; setSplitPosition(Math.max(0, Math.min(100, n))); }; const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); const { x, y } = getCoords(e); const target = getLayerAtPoint(x,y, layers); if (target && target.type === 'frame') setDropTargetId(target.id); else setDropTargetId(null); };
    
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDropTargetId(null);
        
        const assetType = e.dataTransfer.getData('asset-type') as 'image' | 'video' | 'audio' | '';
        const assetSrc = e.dataTransfer.getData('asset-src');
        const { x, y } = getCoords(e);
        const targetLayer = getLayerAtPoint(x, y, layers);
    
        const processMedia = async (type: 'image' | 'video', src: string, target?: Layer) => {
            if (target && target.type === 'frame') {
                if (type === 'image') {
                    const element = await loadImage(src);
                    const newFill: FrameFill = { type: 'image' as const, src, image: element, scale: 1, offsetX: 0, offsetY: 0 };
                    updateLayerProps(target.id, { fill: newFill }, true);
                } else if (type === 'video') {
                    const element = await loadVideo(src);
                    const newFill: FrameFill = { type: 'video' as const, src, videoElement: element, scale: 1, offsetX: 0, offsetY: 0 };
                    updateLayerProps(target.id, { fill: newFill }, true);
                }
            } else {
                addLayer(type, { src, x, y });
            }
        };
    
        if (assetType && assetSrc) { // Internal drag
            if (assetType === 'audio') {
                const asset = uploadedAssets.find(a => a.src === assetSrc);
                if (asset) handleAssetClick(asset);
            } else {
                await processMedia(assetType, assetSrc, targetLayer);
            }
            return;
        }
    
        const file = e.dataTransfer.files?.[0]; // External file drag
        if (file) {
            const mediaSrc = await toBase64(file);
            const type = file.type.startsWith('video') ? 'video' : 'image';
            await processMedia(type, mediaSrc, targetLayer);
        }
    };

    const handleDetachImage = (frameLayer: FrameLayer) => {
        if (!frameLayer.fill) return;
        const { fill } = frameLayer;
        const element = fill.type === 'image' ? fill.image : fill.videoElement;
        const elementW = 'naturalWidth' in element ? element.naturalWidth : element.videoWidth;
        const elementH = 'naturalHeight' in element ? element.naturalHeight : element.videoHeight;
        
        const frameW = frameLayer.width, frameH = frameLayer.height;
        const frameRatio = frameW / frameH; const elementRatio = elementW / elementH;
        let baseW, baseH;
        if (elementRatio > frameRatio) { baseH = frameH; baseW = frameH * elementRatio; } 
        else { baseW = frameW; baseH = frameW / elementRatio; }

        const newMediaWidth = baseW * fill.scale;
        const newMediaHeight = baseH * fill.scale;

        let newMediaLayer: ImageLayer | VideoLayer;
        
        if (fill.type === 'image') {
            newMediaLayer = {
                id: Date.now().toString(), name: 'Imagem Desanexada', type: 'image', src: fill.src, image: element as HTMLImageElement,
                x: frameLayer.x + (frameLayer.width - newMediaWidth) / 2, y: frameLayer.y + (frameLayer.height - newMediaHeight) / 2,
                width: newMediaWidth, height: newMediaHeight,
                rotation: frameLayer.rotation, opacity: frameLayer.opacity, flipH: false, flipV: false,
            };
        } else if (fill.type === 'video') {
             const videoElement = fill.videoElement;
            newMediaLayer = {
                id: Date.now().toString(), name: 'Vídeo Desanexado', type: 'video', src: fill.src, videoElement, duration: videoElement.duration,
                x: frameLayer.x + (frameLayer.width - newMediaWidth) / 2, y: frameLayer.y + (frameLayer.height - newMediaHeight) / 2,
                width: newMediaWidth, height: newMediaHeight,
                rotation: frameLayer.rotation, opacity: frameLayer.opacity, flipH: false, flipV: false,
            };
        } else {
            return;
        }

        setLayersAndCommit(prev => [ ...prev.map(l => l.id === frameLayer.id ? { ...l, fill: null } : l), newMediaLayer ]);
        setSelectedLayerId(newMediaLayer.id);
        setContextMenu(null);
    };
    
    const handleAssetUpload = async (type: 'image' | 'video' | 'audio', file: File) => {
        const src = await toBase64(file);
        const id = Date.now().toString();
        let thumbnail = '';
        if (type === 'image') { thumbnail = src; }
        else if (type === 'video') {
            const videoThumb = document.createElement('video');
            videoThumb.src = src;
            await new Promise(res => videoThumb.onloadeddata = res);
            videoThumb.currentTime = 0.1;
            await new Promise(res => videoThumb.onseeked = res);
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 100;
            thumbCanvas.height = 100 * (videoThumb.videoHeight / videoThumb.videoWidth);
            thumbCanvas.getContext('2d')?.drawImage(videoThumb, 0, 0, thumbCanvas.width, thumbCanvas.height);
            thumbnail = thumbCanvas.toDataURL();
        } else {
            thumbnail = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZHRoPSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNCAxMXYyYTUgNSAwIDAgMCAxMCAwdi0yTTggM2g4YTUtMi41IDAgMCAxIDUgMi41VjhhNS0yLjUgMCAwIDEgLTUgMi41SDhBNS0yLjUgMCAwIDEgMyA4VjUuNUE1LTIuNSAwIDAgMSA4IDN6Ii8+PC9zdmc+';
        }
        const newAsset: UploadedAsset = { id, projectId: 'default-project', type, src, thumbnail, name: file.name };
        setUploadedAssets(prev => [...prev, newAsset]);
    };

    const handleAssetClick = (asset: UploadedAsset) => {
        if (asset.type === 'audio') {
            if(!audioTracks.find(t => t.id === asset.id)) {
                 loadAudio(asset.src).then(audioElement => {
                    const newAudioTrack: AudioTrack = { id: asset.id, assetId: asset.id, src: asset.src, audioElement, name: asset.name };
                    setAudioAndCommit(prev => [...prev, newAudioTrack]);
                });
            }
        } else {
            addLayer(asset.type, { src: asset.src });
        }
    }

    const handleTriggerUpload = (type: 'image' | 'video' | 'audio') => {
        if(type === 'image') imageUploadRef.current?.click();
        else if (type === 'video') videoUploadRef.current?.click();
        else if (type === 'audio') audioUploadRef.current?.click();
    };

    // --- Project Save/Load and Playback Logic ---

    useEffect(() => {
        allMediaElementsRef.current = [
            ...(layers.filter(l => l.type === 'video') as VideoLayer[]).map(l => l.videoElement!),
            ...audioTracks.map(t => t.audioElement)
        ].filter(Boolean);
    }, [layers, audioTracks]);

    const toggleTimelinePlayback = () => setIsTimelinePlaying(prev => !prev);
    
    useEffect(() => {
        const mediaElements = allMediaElementsRef.current;
        if (isTimelinePlaying) {
            mediaElements.forEach(el => el.play().catch(e => console.warn("Playback failed", e)));
        } else {
            mediaElements.forEach(el => el.pause());
        }
    }, [isTimelinePlaying]);

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (interaction || editingFrameId || editingTextLayerId || (e.target as HTMLElement).dataset.handle) return;
        if(hasVideoOrAudio) toggleTimelinePlayback();
    };

    const handleSaveProject = useCallback(async (isAutoSave = false) => {
        if (isAutoSave && autoSaveInProgress.current) {
            return;
        }
        if (isAutoSave) {
            autoSaveInProgress.current = true;
        }
        setIsLoadingAI('project');
        try {
            const serialize = async (item: { src: string }) => {
                if (item.src.startsWith('blob:')) {
                    return { ...item, src: await blobUrlToDataUrl(item.src) };
                }
                return item;
            };

            const serializableLayers = await Promise.all(layers.map(async (layer) => {
                const cleanLayer = { ...layer, image: undefined, videoElement: undefined, originalImage: undefined } as Layer;

                if (cleanLayer.type === 'image') {
                    const imgLayer = cleanLayer as ImageLayer;
                    if (imgLayer.src.startsWith('blob:')) imgLayer.src = await blobUrlToDataUrl(imgLayer.src);
                }
                else if (cleanLayer.type === 'video') {
                    const vidLayer = cleanLayer as VideoLayer;
                    if (vidLayer.src.startsWith('blob:')) vidLayer.src = await blobUrlToDataUrl(vidLayer.src);
                }
                else if (cleanLayer.type === 'frame') {
                    const frameLayer = cleanLayer as FrameLayer;
                    if (frameLayer.fill) {
                        const newFill: any = { ...frameLayer.fill };
                        if (newFill.src.startsWith('blob:')) newFill.src = await blobUrlToDataUrl(newFill.src);
                        delete newFill.image; delete newFill.videoElement; frameLayer.fill = newFill;
                    }
                }
                return cleanLayer;
            }));

            const serializableAudio = await Promise.all(audioTracks.map(async (track) => {
                const cleanTrack = { ...track, audioElement: undefined };
                if (cleanTrack.src.startsWith('blob:')) cleanTrack.src = await blobUrlToDataUrl(cleanTrack.src);
                return cleanTrack;
            }));

            const serializableAssets = await Promise.all(uploadedAssets.map(asset => serialize(asset)));
            
            const projectState = { layers: serializableLayers, audioTracks: serializableAudio, canvasSize, backgroundColor, uploadedAssets: serializableAssets };
            
            await setItem('viralCreativeProject', projectState);

            if (!isAutoSave) {
                 alert('Projeto salvo com sucesso!');
            }
           
        } catch (err) {
            console.error("Failed to save project:", err);
            if (!isAutoSave) {
                 alert("Falha ao salvar o projeto. O armazenamento do navegador pode estar cheio.");
            }
        } finally {
            setIsLoadingAI(null);
            if (isAutoSave) {
                autoSaveInProgress.current = false;
            }
        }
    }, [layers, audioTracks, canvasSize, backgroundColor, uploadedAssets]);

    const handleLoadProject = useCallback(async () => {
        const savedState = await getItem<any>('viralCreativeProject');
        if (!savedState) { alert('Nenhum projeto salvo foi encontrado.'); return; }
        setIsLoadingAI('project');
        try {
            setBackgroundColor(savedState.backgroundColor);
            setCanvasSize(savedState.canvasSize);
            setUploadedAssets(savedState.uploadedAssets || []);

            const loadedLayers = await Promise.all(savedState.layers.map(async (layer: Layer): Promise<Layer> => {
                if (layer.type === 'image') {
                    const imageLayer = layer as ImageLayer;
                    const image = await loadImage(imageLayer.src);
                    // FIX: Assign to a typed variable to avoid excess property checks on the return statement.
                    const newLayer: ImageLayer = { ...imageLayer, image };
                    return newLayer;
                } else if (layer.type === 'video') {
                    const videoLayer = layer as VideoLayer;
                    const videoElement = await loadVideo(videoLayer.src);
                    // FIX: Assign to a typed variable to avoid excess property checks on the return statement.
                    const newLayer: VideoLayer = { ...videoLayer, videoElement };
                    return newLayer;
                } else if (layer.type === 'frame') {
                    const frameLayer = layer as FrameLayer;
                    if (frameLayer.fill) {
                        if (frameLayer.fill.type === 'image') {
                            const image = await loadImage(frameLayer.fill.src);
                            const newFill: FrameFill = { ...frameLayer.fill, image };
                            // FIX: Assign to a typed variable to avoid excess property checks on the return statement.
                            const newLayer: FrameLayer = { ...frameLayer, fill: newFill };
                            return newLayer;
                        }
                        if (frameLayer.fill.type === 'video') {
                            const videoElement = await loadVideo(frameLayer.fill.src);
                            const newFill: FrameFill = { ...frameLayer.fill, videoElement };
                            // FIX: Assign to a typed variable to avoid excess property checks on the return statement.
                            const newLayer: FrameLayer = { ...frameLayer, fill: newFill };
                            return newLayer;
                        }
                    }
                }
                return layer;
            }));

            const loadedAudio = await Promise.all(savedState.audioTracks.map(async (track: AudioTrack) => {
                const audioElement = await loadAudio(track.src);
                return { ...track, audioElement };
            }));

            setLayers(loadedLayers);
            setAudioTracks(loadedAudio);
            setHistory([[[...initialState.layers], [...initialState.audioTracks]], [loadedLayers, loadedAudio]]);
            setHistoryIndex(1);
            alert('Projeto carregado com sucesso!');
        } catch (err) {
            console.error("Failed to load project:", err);
            alert("Falha ao carregar o projeto. O ficheiro guardado pode estar corrompido.");
        } finally {
            setIsLoadingAI(null);
        }
    }, []);

    const initialState = { layers: [], audioTracks: [] }; // Used for history reset on load
    useEffect(() => {
        if (!isViralMode) return;
        const autoSave = setInterval(() => handleSaveProject(true), 30000); // Auto-save every 30 seconds
        return () => clearInterval(autoSave);
    }, [isViralMode, handleSaveProject]);

    useEffect(() => {
      if (isOpen && isViralMode) {
        (async () => {
             const projectExists = await keyExists('viralCreativeProject');
             if (projectExists && confirm('Foi encontrado um projeto guardado. Deseja carregá-lo?')) {
                await handleLoadProject();
             }
        })();
      }
    }, [isOpen, isViralMode, handleLoadProject]);

    if (!isOpen) return null;

    const DropTargetHighlight: React.FC<{ layer: Layer; scale: number }> = ({ layer, scale }) => {
        if (!layer) return null;
        const s = layer;
        const style: React.CSSProperties = { position: 'absolute', left: `${s.x * scale}px`, top: `${s.y * scale}px`, width: `${s.width * scale}px`, height: `${s.height * scale}px`, transform: `rotate(${s.rotation}deg)`, transformOrigin: 'center center', outline: '4px solid #22c55e', backgroundColor: 'rgba(34, 197, 94, 0.2)', pointerEvents: 'none', zIndex: 99 };
        return <div style={style}></div>;
    };
    
    const FrameEditToolbar: React.FC<{ frame: FrameLayer; onUpdate: (props: LayerUpdateProps, commit: boolean) => void; onDone: () => void; }> = ({ frame, onUpdate, onDone }) => {
        if (!frame.fill) return null;
        const sliderRef = useRef<HTMLDivElement>(null);
        const minZoom = 1; const maxZoom = 3;
        const updateFill = (props: Partial<FrameFill>, commit: boolean) => { onUpdate({ fill: { ...frame.fill!, ...props } }, commit); };
        const handleSliderMouseDown = useCallback((mouseDownEvent: React.MouseEvent<HTMLDivElement>) => {
            mouseDownEvent.preventDefault(); const slider = sliderRef.current; if (!slider) return;
            const rect = slider.getBoundingClientRect();
            const handleMouseMove = (mouseMoveEvent: MouseEvent) => { const x = Math.max(0, Math.min(mouseMoveEvent.clientX - rect.left, rect.width)); const percentage = x / rect.width; const newValue = minZoom + percentage * (maxZoom - minZoom); updateFill({ scale: newValue }, false); };
            const handleMouseUp = () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); updateFill({}, true); };
            handleMouseMove(mouseDownEvent.nativeEvent); document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
        }, [minZoom, maxZoom, updateFill]);
        const currentScale = frame.fill.scale; const clampedScale = Math.max(minZoom, Math.min(currentScale, maxZoom)); const percentage = ((clampedScale - minZoom) / (maxZoom - minZoom)) * 100;
        return (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-[#2C2C3A] p-2 rounded-full flex items-center gap-4 shadow-lg text-white w-80">
                <span className="font-semibold text-sm ml-2">Zoom</span>
                <div ref={sliderRef} onMouseDown={handleSliderMouseDown} className="flex-grow h-2 rounded-full relative cursor-pointer py-2 group">
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-gray-500 rounded-full w-full"><div className="h-full rounded-full bg-white" style={{ width: `${percentage}%` }} /></div>
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-500 rounded-full shadow border-2 border-white pointer-events-none" style={{ left: `calc(${percentage}% - 8px)` }} />
                </div>
                <Button onClick={onDone} primary className="py-2 px-5 text-sm !rounded-full !font-bold">CONCLUÍDO</Button>
            </div>
        );
    };
    
    const ContextMenuComponent: React.FC<{ menuState: { x: number; y: number; targetLayer: Layer; } }> = ({ menuState }) => {
        const { x, y, targetLayer } = menuState;
        const isFrame = targetLayer.type === 'frame'; const isFilledFrame = isFrame && (targetLayer as FrameLayer).fill;
        return (
            <div style={{ top: y, left: x }} className="absolute z-50 bg-gray-800/80 backdrop-blur-md rounded-lg shadow-2xl text-white text-sm flex flex-col p-1 w-48 border border-gray-700">
                {isFilledFrame && (
                     <>
                        <button onClick={() => { setEditingFrameId(targetLayer.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md">Ajustar Imagem</button>
                        <button onClick={() => { handleDetachImage(targetLayer as FrameLayer); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md">Desanexar Imagem</button>
                        <button onClick={() => { replaceImageInputRef.current?.click(); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md">Substituir Imagem</button>
                        <div className="my-1 h-px bg-white/10"></div>
                     </>
                )}
                <button onClick={() => { handleDuplicateSelectedLayer(); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md flex items-center gap-2"><IconDuplicate />Duplicar</button>
                <div className="my-1 h-px bg-white/10"></div>
                <button onClick={() => { bringForward(); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md flex items-center gap-2"><IconBringForward />Trazer para Frente</button>
                <button onClick={() => { sendBackward(); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md flex items-center gap-2"><IconSendBackward />Enviar para Trás</button>
                <div className="my-1 h-px bg-white/10"></div>
                <button onClick={deleteSelectedLayer} className="w-full text-left px-3 py-2 hover:bg-red-500/20 rounded-md text-red-400 flex items-center gap-2"><IconTrash />Apagar</button>
            </div>
        )
    };

    return (
         <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4" onClick={(e) => { if(e.target === e.currentTarget) setContextMenu(null); }}>
            {contextMenu && <ContextMenuComponent menuState={contextMenu} />}
            <DownloadModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} onDownload={handleDownload} hasVideoOrAudio={hasVideoOrAudio} />
            <BackgroundRemoverModal isOpen={isBgRemoverOpen} onClose={() => setIsBgRemoverOpen(false)} imageWithTransparency={imageForBgRefinement?.current ?? null} originalImage={imageForBgRefinement?.original ?? null} onApply={handleApplyBgRefinement}/>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-900 rounded-2xl p-2 sm:p-6 border border-gray-700 shadow-2xl w-full h-full relative flex flex-col md:flex-row gap-4 sm:gap-6 overflow-hidden">
                <div className="w-full md:w-80 lg:w-96 flex-shrink-0"><CreativeEditorSidebar onAddLayer={addLayer} onUpdateSelectedLayer={updateSelectedLayer} selectedLayer={selectedLayer} onAITool={handleAITool} onGenerateAIImage={handleGenerateAIImage} isLoadingAI={isLoadingAI} onToggleLayersPanel={() => setIsLayersPanelOpen(p => !p)} onUpdateBackgroundColor={setBackgroundColor} backgroundColor={backgroundColor} onOpenBgRemover={handleOpenBgRemover} isViralMode={isViralMode} onTriggerUpload={handleTriggerUpload} uploadedAssets={uploadedAssets} onAssetClick={handleAssetClick} onSaveProject={() => handleSaveProject(false)} onLoadProject={handleLoadProject} /></div>
                <div className="flex-grow flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden relative min-w-0 min-h-0 md:flex-shrink-0" onDragOver={handleDragOver} onDrop={handleDrop} onDragLeave={() => setDropTargetId(null)}>
                    <CreativeEditorHeader 
                        selectedLayer={selectedLayer}
                        customFonts={customFonts}
                        onUpdateSelectedLayer={updateSelectedLayer}
                        onTriggerFontUpload={() => fontInputRef.current?.click()}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={historyIndex > 1}
                        canRedo={historyIndex < history.length - 1}
                    />
                    <div ref={canvasContainerRef} className="relative flex-grow w-full flex items-center justify-center group" onClick={handleCanvasClick}>
                        {isLoadingAI === 'project' && <div className="absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center text-white"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-400 mb-4"></div><p>A processar o projeto...</p></div>}
                        {editingFrame && <FrameEditToolbar frame={editingFrame} onUpdate={updateSelectedLayer} onDone={() => { setEditingFrameId(null); commitToHistory(layers, audioTracks); }} />}
                        <div className="relative" style={{ width: canvasSize.w * scale, height: canvasSize.h * scale, cursor: editingFrameId ? 'move' : (interaction?.type === 'move' ? 'grabbing' : 'default') }} onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()}>
                            <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h} style={{ width: '100%', height: '100%' }}></canvas>
                             <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                {alignmentGuides.map((guide, index) => {
                                    const style: React.CSSProperties = {
                                        position: 'absolute',
                                        backgroundColor: '#f472b6',
                                        zIndex: 999,
                                    };
                                    if (guide.type === 'vertical') {
                                        style.left = `${guide.position * scale}px`;
                                        style.top = `${guide.start * scale}px`;
                                        style.width = '1px';
                                        style.height = `${(guide.end - guide.start) * scale}px`;
                                    } else {
                                        style.top = `${guide.position * scale}px`;
                                        style.left = `${guide.start * scale}px`;
                                        style.height = '1px';
                                        style.width = `${(guide.end - guide.start) * scale}px`;
                                    }
                                    return <div key={index} style={style} />;
                                })}
                                <BoundingBox selectedLayer={selectedLayer} scale={scale} isFrameEditing={!!editingFrameId && selectedLayerId === editingFrameId} />
                                {selectedLayer?.type === 'video' && !selectedLayer.isLoading && (
                                    <VideoControls
                                        layer={selectedLayer as VideoLayer}
                                        scale={scale}
                                        playbackState={playbackState}
                                        onPlayPause={handleVideoPlayPause}
                                        onSeek={handleVideoSeek}
                                    />
                                )}
                            </div>
                            {dropTargetId && <DropTargetHighlight layer={layers.find(l => l.id === dropTargetId)!} scale={scale} />}
                            {editingTextLayerId && <EditableTextArea ref={textInputRef} layer={layers.find(l => l.id === editingTextLayerId) as TextLayer} scale={scale} value={editingTextValue} onChange={e => setEditingTextValue(e.target.value)} onBlur={handleTextEditBlur} />}
                             {comparisonMode === 'split' && selectedLayer?.type === 'image' && (selectedLayer as ImageLayer).originalSrc && (
                                <><div className="absolute top-2 left-2 z-20 bg-black/60 text-white px-2 py-1 rounded text-xs pointer-events-none" style={{transform: `scale(${1/scale})`, transformOrigin: 'top left'}}>Antes</div><div className="absolute top-2 right-2 z-20 bg-black/60 text-white px-2 py-1 rounded text-xs pointer-events-none" style={{transform: `scale(${1/scale})`, transformOrigin: 'top right'}}>Depois</div><div onMouseDown={handleSplitterMouseDown} className="absolute top-0 bottom-0 z-20 w-2.5 cursor-ew-resize" style={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}><div className="w-0.5 h-full bg-white mx-auto shadow-2xl"></div><div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg text-gray-800"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg></div></div></>
                             )}
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-auto flex md:flex-col justify-center items-center md:items-start gap-4 md:flex-shrink-0">
                     <div className="flex flex-row md:flex-col gap-4 bg-gray-800/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-300 hidden md:block">Tamanho da Tela</h4>
                        <div className="flex flex-row md:flex-col gap-2">{SIZES.map(s => (<button key={s.name} onClick={() => setCanvasSize({w: s.w, h: s.h})} className={`text-xs p-2 rounded-md transition-colors ${canvasSize.w === s.w && canvasSize.h === s.h ? 'bg-yellow-400 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>{s.name}</button>))}</div>
                     </div>
                     <div className="flex flex-row md:flex-col gap-4">
                        <Button onClick={onClose} className="w-full">Cancelar</Button>
                        <Button onClick={() => setIsDownloadModalOpen(true)} primary className="w-full">Baixar</Button>
                    </div>
                </div>
                <input type="file" ref={fontInputRef} onChange={handleFontUpload} accept=".otf, .ttf" className="hidden" />
                <input type="file" ref={replaceImageInputRef} onChange={(e) => { if(e.target.files?.[0] && contextMenu?.targetLayer) { toBase64(e.target.files[0]).then(src => handleReplaceLayerImage(contextMenu.targetLayer.id, src)); } }} accept="image/*" className="hidden" />
                <input type="file" ref={imageUploadRef} onChange={(e) => { if (e.target.files?.[0]) handleAssetUpload('image', e.target.files[0]); e.target.value = ''; }} accept="image/*" className="hidden" />
                <input type="file" ref={videoUploadRef} onChange={(e) => { if (e.target.files?.[0]) handleAssetUpload('video', e.target.files[0]); e.target.value = ''; }} accept="video/*" className="hidden" />
                <input type="file" ref={audioUploadRef} onChange={(e) => { if (e.target.files?.[0]) handleAssetUpload('audio', e.target.files[0]); e.target.value = ''; }} accept="audio/*" className="hidden" />
                <AnimatePresence><LayersPanel isOpen={isLayersPanelOpen} onClose={() => setIsLayersPanelOpen(false)} layers={layers} selectedLayerId={selectedLayerId} onSelectLayer={setSelectedLayerId} onReorderLayers={(reordered) => setLayersAndCommit(reordered)} /></AnimatePresence>
            </motion.div>
        </div>
    );
};

export default CreativeEditorModal;