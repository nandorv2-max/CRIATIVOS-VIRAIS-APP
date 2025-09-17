import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from './Button';
import CreativeEditorSidebar from './CreativeEditorSidebar';
import DownloadModal, { DownloadOptions } from './DownloadModal';
import LayersPanel from './LayersPanel';
import BackgroundRemoverModal from './BackgroundRemoverModal';
import ColorPicker from './ColorPicker';
import { Layer, TextLayer, ImageLayer, ShapeLayer, LayerType, LayerUpdateProps, FrameLayer, FrameFill, VideoLayer, AudioTrack, UploadedAsset, FrameFillContent, DownloadJob } from '../types';
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconBold, IconItalic, IconTrash, IconType, IconUnderline, IconLetterCase, IconBringForward, IconSendBackward, IconUndo, IconRedo, IconDuplicate, IconLine, IconArrow } from './Icons';
import { generateImageFromPrompt, generateImageWithRetry, AI_PROMPTS } from '../../services/geminiService';
import { blobToBase64 } from '../../utils/imageUtils';
import { setItem, getItem, keyExists } from '../../utils/db';


interface CreativeEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
    onApply: (newImageUrl: string) => void;
    setDownloads: React.Dispatch<React.SetStateAction<DownloadJob[]>>;
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
        <div className="bg-gray-900 p-2 rounded-lg flex items-center justify-between gap-4 text-white text-sm z-10 w-full h-16 shadow-md">
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
                    <ColorPicker
                        color={layer.color}
                        onChange={newColor => handleUpdate({ color: newColor }, false)}
                        onInteractionEnd={() => handleUpdate({}, true)}
                    />
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
            reader.onerror = () => reject(reader.error || new Error('FileReader error'));
            reader.readAsDataURL(blob);
        }));

const CreativeEditorModal: React.FC<CreativeEditorModalProps> = ({ isOpen, onClose, imageUrl, onApply, setDownloads }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const fontInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const replaceImageInputRef = useRef<HTMLInputElement>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const videoUploadRef = useRef<HTMLInputElement>(null);
    const audioUploadRef = useRef<HTMLInputElement>(null);
    const projectLoadInputRef = useRef<HTMLInputElement>(null);
    const animationFrameId = useRef<number>();
    
    const prevLayersRef = useRef<Layer[]>([]);
    const prevAudioTracksRef = useRef<AudioTrack[]>([]);
    const allMediaElementsRef = useRef<(HTMLVideoElement | HTMLAudioElement)[]>([]);
    const autoSaveInProgress = useRef(false);

    
    const [canvasSize, setCanvasSize] = useState({ w: SIZES[0].w, h: SIZES[0].h });
    const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
    const [layers, setLayers] = useState<Layer[]>([]);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [customFonts, setCustomFonts] = useState<Record<string, string>>({});
    const [interaction, setInteraction] = useState<InteractionState | null>(null);
    const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
    const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState('');
    const [fitScale, setFitScale] = useState(1);
    const [userZoom, setUserZoom] = useState(1);
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

    const finalScale = fitScale * userZoom;
    const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;
    const editingFrame = layers.find(l => l.id === editingFrameId) as FrameLayer | undefined;
    const hasVideoOrAudio = layers.some(l => l.type === 'video') || audioTracks.length > 0;
    const initialState = { layers: [], audioTracks: [] };

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
    const loadVideo = (src: string): Promise<HTMLVideoElement> => new Promise((resolve, reject) => { const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.onloadedmetadata = () => resolve(video); video.onerror = () => reject(new Error('Failed to load video')); video.src = src; video.playsInline = true; video.muted = false; });
    // FIX: Updated the 'onerror' handler for 'loadAudio' to accept the event parameter, resolving the "Expected 1 arguments, but got 0" error.
    const loadAudio = (src: string): Promise<HTMLAudioElement> => new Promise((resolve, reject) => { const audio = new Audio(src); audio.crossOrigin = 'anonymous'; audio.oncanplaythrough = () => resolve(audio); audio.onerror = (e) => reject(new Error('Failed to load audio')); });
    
    const calculateScale = useCallback(() => {
        if (!canvasContainerRef.current) return 1;
        const { clientWidth, clientHeight } = canvasContainerRef.current;
        const padding = 64; // Corresponds to p-8
        const scale = Math.min(
            (clientWidth - padding) / canvasSize.w, 
            (clientHeight - padding) / canvasSize.h
        );
        return scale > 0.1 ? scale : 0.1;
    }, [canvasSize]);

    useLayoutEffect(() => { const update = () => setFitScale(calculateScale()); update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, [calculateScale]);

    const drawSceneToContext = useCallback((ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, currentLayers: Layer[], currentBgColor: string) => {
        ctx.fillStyle = currentBgColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        currentLayers.forEach(layer => {
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
            } else {
                 if (layer.type === 'image' || layer.type === 'video') {
                    const mediaElement = layer.type === 'image' ? (layer as ImageLayer).image : (layer as VideoLayer).videoElement;
                    if (!mediaElement) {
                        ctx.restore();
                        return;
                    }
            
                    const mediaWidth = layer.type === 'image' ? (mediaElement as HTMLImageElement).naturalWidth : (mediaElement as HTMLVideoElement).videoWidth;
                    const mediaHeight = layer.type === 'image' ? (mediaElement as HTMLImageElement).naturalHeight : (mediaElement as HTMLVideoElement).videoHeight;
                    
                    const isReady = layer.type === 'image' ? (mediaElement as HTMLImageElement).complete : (mediaElement as HTMLVideoElement).readyState >= 2;
                    
                    if (isReady && mediaWidth > 0 && mediaHeight > 0) {
                        const destX = -layer.width / 2;
                        const destY = -layer.height / 2;
                        const destWidth = layer.width;
                        const destHeight = layer.height;

                        const mediaRatio = mediaWidth / mediaHeight;
                        const destRatio = destWidth / destHeight;

                        let sx = 0, sy = 0, sWidth = mediaWidth, sHeight = mediaHeight;
                        
                        if (mediaRatio > destRatio) {
                            sWidth = sHeight * destRatio;
                            sx = (mediaWidth - sWidth) / 2;
                        } else {
                            sHeight = sWidth / destRatio;
                            sy = (mediaHeight - sHeight) / 2;
                        }
                        
                        ctx.drawImage(mediaElement, sx, sy, sWidth, sHeight, destX, destY, destWidth, destHeight);
                    }
                } else if (layer.type === 'text') {
                    const textLayer = layer as TextLayer;
                    ctx.font = `${textLayer.fontStyle} ${textLayer.fontWeight} ${textLayer.fontSize}px "${textLayer.fontFamily}"`; ctx.fillStyle = textLayer.color; ctx.textAlign = textLayer.textAlign; ctx.textBaseline = 'top';
                    let textX = drawX; if (textLayer.textAlign === 'center') textX += layer.width / 2; if (textLayer.textAlign === 'right') textX += layer.width;
                    let textToDraw = textLayer.text; if (textLayer.letterCase === 'uppercase') textToDraw = textToDraw.toUpperCase(); else if (textLayer.letterCase === 'lowercase') textToDraw = textToDraw.toLowerCase();
                    const lines = textToDraw.split('\n');
                    const lineHeight = textLayer.fontSize * 1.2;
                    lines.forEach((line, i) => ctx.fillText(line, textX, drawY + (i * lineHeight)));
                } else if (layer.type === 'shape') {
                    const shapeLayer = layer as ShapeLayer;
                    ctx.fillStyle = shapeLayer.fill;
                    ctx.strokeStyle = shapeLayer.stroke;
                    ctx.lineWidth = shapeLayer.strokeWidth;
                
                    if (shapeLayer.shape === 'rectangle') {
                        if (shapeLayer.fill && shapeLayer.fill !== 'transparent') {
                            ctx.fillRect(drawX, drawY, shapeLayer.width, shapeLayer.height);
                        }
                        if (shapeLayer.stroke && shapeLayer.stroke !== 'transparent' && shapeLayer.strokeWidth > 0) {
                            ctx.strokeRect(drawX, drawY, shapeLayer.width, shapeLayer.height);
                        }
                    } else if (shapeLayer.shape === 'ellipse') {
                        ctx.beginPath();
                        ctx.ellipse(drawX + shapeLayer.width / 2, drawY + shapeLayer.height / 2, shapeLayer.width / 2, shapeLayer.height / 2, 0, 0, 2 * Math.PI);
                        if (shapeLayer.fill && shapeLayer.fill !== 'transparent') {
                            ctx.fill();
                        }
                        if (shapeLayer.stroke && shapeLayer.stroke !== 'transparent' && shapeLayer.strokeWidth > 0) {
                            ctx.stroke();
                        }
                    } else if (shapeLayer.shape === 'line' || shapeLayer.shape === 'arrow') {
                        const lineY = drawY + layer.height / 2;
                        
                        ctx.strokeStyle = shapeLayer.fill;
                        ctx.lineWidth = layer.height;
                        ctx.lineCap = 'round';
                        
                        ctx.beginPath();
                        ctx.moveTo(drawX, lineY);
                        ctx.lineTo(drawX + layer.width, lineY);
                        ctx.stroke();
                
                        if (shapeLayer.shape === 'arrow') {
                            const headlen = Math.max(10, layer.height * 3);
                            ctx.beginPath();
                            ctx.moveTo(drawX + layer.width, lineY);
                            ctx.lineTo(drawX + layer.width - headlen, lineY - headlen / 2);
                            ctx.lineTo(drawX + layer.width - headlen, lineY + headlen / 2);
                            ctx.closePath();
                            ctx.fillStyle = shapeLayer.fill;
                            ctx.fill();
                        }
                    }
                } else if (layer.type === 'frame') {
                    const frameLayer = layer as FrameLayer;
                    
                    ctx.save();
                    ctx.beginPath();
                    if (frameLayer.shape === 'rectangle') {
                        ctx.rect(drawX, drawY, frameLayer.width, frameLayer.height);
                    } else {
                        ctx.ellipse(drawX + frameLayer.width / 2, drawY + frameLayer.height / 2, frameLayer.width / 2, frameLayer.height / 2, 0, 0, 2 * Math.PI);
                    }
                    (ctx as any).clip();
                
                    if (frameLayer.fill) {
                        const fill = frameLayer.fill;
                        const element = fill.type === 'image' ? fill.image : fill.videoElement;
                        const elementW = (fill.type === 'image' ? (element as HTMLImageElement).naturalWidth : (element as HTMLVideoElement).videoWidth) || 0;
                        const elementH = (fill.type === 'image' ? (element as HTMLImageElement).naturalHeight : (element as HTMLVideoElement).videoHeight) || 0;
                
                        if (elementW > 0 && elementH > 0) {
                            const frameRatio = frameLayer.width / frameLayer.height;
                            const elementRatio = elementW / elementH;
                            let baseW, baseH;
                            if (elementRatio > frameRatio) {
                                baseH = frameLayer.height;
                                baseW = baseH * elementRatio;
                            } else {
                                baseW = frameLayer.width;
                                baseH = baseW / elementRatio;
                            }
                
                            const drawW = baseW * fill.scale;
                            const drawH = baseH * fill.scale;
                            const dX = drawX + (frameLayer.width - drawW) / 2 + fill.offsetX;
                            const dY = drawY + (frameLayer.height - drawH) / 2 + fill.offsetY;
                            ctx.drawImage(element, dX, dY, drawW, drawH);
                        }
                    } else {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                        if (frameLayer.shape === 'rectangle') {
                            ctx.fillRect(drawX, drawY, frameLayer.width, frameLayer.height);
                        } else {
                            ctx.beginPath();
                            ctx.ellipse(drawX + frameLayer.width / 2, drawY + frameLayer.height / 2, frameLayer.width / 2, frameLayer.height / 2, 0, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([10, 10]);
                        if (frameLayer.shape === 'rectangle') {
                            ctx.strokeRect(drawX, drawY, frameLayer.width, frameLayer.height);
                        } else {
                            ctx.beginPath();
                            ctx.ellipse(drawX + frameLayer.width / 2, drawY + frameLayer.height / 2, frameLayer.width / 2, frameLayer.height / 2, 0, 0, 2 * Math.PI);
                            ctx.stroke();
                        }
                        ctx.setLineDash([]);
                    }
                    ctx.restore();
                }
            }
            ctx.restore();
        });
    }, [editingTextLayerId]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        drawSceneToContext(ctx, layers, backgroundColor);
    }, [layers, backgroundColor, drawSceneToContext]);

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
        if (type === 'text') newLayer = { ...baseLayer, name: 'Texto', type: 'text', text: options.text || 'Digite seu texto', fontFamily: 'Inter', fontSize: 48, color: '#000000', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', width: 400, height: 60, letterCase: 'normal' } as TextLayer;
        else if (type === 'shape') {
            const shapeType = options.shape || 'rectangle';
            const shapeDefaults = {
                'rectangle': { width: 150, height: 150, fill: '#CCCCCC' },
                'ellipse': { width: 150, height: 150, fill: '#CCCCCC' },
                'line': { width: 200, height: 5, fill: '#000000', rotation: -45 },
                'arrow': { width: 200, height: 5, fill: '#000000', rotation: -45 },
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
            const size = SIZES[0]; setCanvasSize(size); setBackgroundColor('#FFFFFF');
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

    const handleReplaceLayerMedia = async (layerId: string, newSrc: string, type: 'image' | 'video') => {
        try {
            const targetLayer = layers.find(l => l.id === layerId);
            if (!targetLayer) return;
    
            let updatedLayer: Layer | null = null;
    
            if (targetLayer.type === 'image' && type === 'image') {
                const image = await loadImage(newSrc);
                const imgLayer = targetLayer as ImageLayer;
                const aspectRatio = image.naturalWidth / image.naturalHeight;
                const originalSrc = imgLayer.originalSrc || imgLayer.src;
                const originalImage = imgLayer.originalImage || imgLayer.image;
                const newImageLayer: ImageLayer = { ...imgLayer, src: newSrc, image, height: imgLayer.width / aspectRatio, originalSrc, originalImage };
                updatedLayer = newImageLayer;
            } else if (targetLayer.type === 'frame') {
                const frameLayer = targetLayer as FrameLayer;
                let newFill: FrameFill | null = null;
                if (type === 'image') {
                    const image = await loadImage(newSrc);
                    newFill = { type: 'image' as const, src: newSrc, image, scale: 1, offsetX: 0, offsetY: 0 };
                } else if (type === 'video') {
                    const videoElement = await loadVideo(newSrc);
                    videoElement.loop = true;
                    videoElement.muted = true;
                    newFill = { type: 'video' as const, src: newSrc, videoElement, scale: 1, offsetX: 0, offsetY: 0 };
                }
                if (newFill) {
                    const newFrameLayer: FrameLayer = { ...frameLayer, fill: newFill };
                    updatedLayer = newFrameLayer;
                }
            }
    
            if (updatedLayer) {
                const finalUpdatedLayer = updatedLayer; // for closure
                setLayersAndCommit(layers.map(l => l.id === layerId ? finalUpdatedLayer : l));
                if (type === 'image') {
                    setComparisonMode('after');
                }
            }
        } catch (e) {
            console.error("Failed to replace layer media", e);
        } finally {
            if (replaceImageInputRef.current) {
                replaceImageInputRef.current.value = '';
            }
        }
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
                const dataUrl = await blobToBase64(blob);
                const image = await loadImage(dataUrl);
                const updater = (prev: Layer[]) => prev.map(l => {
                    if (l.id === selectedLayer.id) {
                        const imgLayer = l as ImageLayer;
                        const aspectRatio = image.naturalWidth / image.naturalHeight;
                        return {...imgLayer, src: dataUrl, image, height: imgLayer.width / aspectRatio, originalSrc: imgLayer.src, originalImage: imgLayer.image };
                    }
                    return l;
                });
                setLayersAndCommit(updater);
                setComparisonMode('after');
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
    const handleApplyBgRefinement = async (newImageUrl: string) => {
        if (imageForBgRefinement) {
            const image = await loadImage(newImageUrl);
            setLayersAndCommit(prev => prev.map(l => {
                if (l.id === imageForBgRefinement.layerId && l.type === 'image') {
                    const imgLayer = l as ImageLayer; const aspectRatio = image.naturalWidth / image.naturalHeight;
                    return { ...imgLayer, src: newImageUrl, image, height: imgLayer.width / aspectRatio };
                } return l;
            }));
        }
        setIsBgRemoverOpen(false); setImageForBgRefinement(null);
    };
    const handleGenerateAIImage = async (prompt: string) => { if(!prompt) return; setIsLoadingAI('generate'); try { const newImageSrc = await generateImageFromPrompt(prompt); addLayer('image', { src: newImageSrc }); } catch(err) { console.error(`AI image generation failed:`, err); alert(`Ocorreu um erro.`); } finally { setIsLoadingAI(null); } };
    const getCoords = useCallback((e: React.MouseEvent | MouseEvent | React.DragEvent): { x: number, y: number } => { if (!canvasRef.current) return {x: 0, y: 0}; const rect = canvasRef.current.getBoundingClientRect(); return { x: (e.clientX - rect.left) / finalScale, y: (e.clientY - rect.top) / finalScale }; }, [finalScale]);
    
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
            const snapThreshold = 5 / finalScale;
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

            // Horizontal Snapping
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
            const dx = (e.clientX - startX) / finalScale;
            const dy = (e.clientY - startY) / finalScale;
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
            
            let newFill: FrameFill;
            if (originalFill.type === 'image') {
                newFill = {
                    type: 'image',
                    src: originalFill.src,
                    assetId: originalFill.assetId,
                    image: originalFill.image,
                    scale: originalFill.scale,
                    offsetX: constrainedOffsetX,
                    offsetY: constrainedOffsetY,
                };
            } else {
                newFill = {
                    type: 'video',
                    src: originalFill.src,
                    assetId: originalFill.assetId,
                    videoElement: originalFill.videoElement,
                    scale: originalFill.scale,
                    offsetX: constrainedOffsetX,
                    offsetY: constrainedOffsetY,
                };
            }
            updateLayerProps(originalLayer.id, { fill: newFill }, false);
        } else if (type === 'resize' && handle) {
            const { originalLayer } = interaction;
            const { x: originalX, y: originalY, width: originalW, height: originalH, rotation } = originalLayer;

            const dx = (e.clientX - interaction.startX) / finalScale;
            const dy = (e.clientY - interaction.startY) / finalScale;
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

            updateLayerProps(originalLayer.id, { x: newX, y: newY, width: newW, height: newH }, false);
        }
    }, [interaction, finalScale, getCoords, layers, updateLayerProps, canvasSize]);

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
                        (frameLayer.fill as any).image = await loadImage(frameLayer.fill.src);
                    } else if (frameLayer.fill.type === 'video') {
                        (frameLayer.fill as any).videoElement = await loadVideo(frameLayer.fill.src);
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
                    const imageLayer = mediaLayer;
                    // FIX: Type error on FrameFill assignment. Explicitly creating an object that matches the 'image' part of the FrameFill union type.
                    const newFill: FrameFill = {
                        type: 'image' as const,
                        src: imageLayer.src,
                        assetId: imageLayer.assetId,
                        image: imageLayer.image,
                        scale: 1,
                        offsetX: 0,
                        offsetY: 0,
                    };
                    updateFrameWithFill(newFill);
                } else if (mediaLayer.type === 'video' && mediaLayer.videoElement) {
                    const videoLayer = mediaLayer;
                    // FIX: Corrected a complex type inference issue by explicitly creating an object that matches the 'video' part of the FrameFill union type. This helps the TypeScript compiler correctly discriminate the type.
                    const newFill: FrameFill = {
                        type: 'video' as const,
                        src: videoLayer.src,
                        assetId: videoLayer.assetId,
                        videoElement: videoLayer.videoElement,
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
    
const handleDownload = async (options: DownloadOptions) => {
    setIsDownloadModalOpen(false);

    const jobId = `download-${Date.now()}`;
    const tempThumbCanvas = document.createElement('canvas');
    tempThumbCanvas.width = 128;
    tempThumbCanvas.height = 128 * (canvasSize.h / canvasSize.w);
    const thumbCtx = tempThumbCanvas.getContext('2d');
    if (thumbCtx) {
       drawSceneToContext(thumbCtx, layers, backgroundColor);
    }
    const job: DownloadJob = {
        id: jobId,
        fileName: `design-${Date.now()}.${options.format}`,
        status: 'preparing',
        progress: 0,
        thumbnail: tempThumbCanvas.toDataURL('image/jpeg', 0.5),
    };
    setDownloads(prev => [...prev, job]);

    if (options.format === 'mp4' && (typeof (window as any).VideoEncoder === 'undefined' || typeof (window as any).VideoFrame === 'undefined')) {
        setDownloads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error', error: 'Seu navegador não suporta a exportação de vídeo. Tente o Chrome ou Edge.' } : j));
        return;
    }

    try {
        if (options.format !== 'mp4') {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasSize.w;
            tempCanvas.height = canvasSize.h;
            const tempCtx = tempCanvas.getContext('2d');
            if(tempCtx) {
                drawSceneToContext(tempCtx, layers, options.transparent ? 'transparent' : backgroundColor);
            }
            const blob = await new Promise<Blob | null>(resolve => tempCanvas.toBlob(resolve, `image/${options.format}`));
            if(blob) {
                const url = URL.createObjectURL(blob);
                setDownloads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'done', resultUrl: url } : j));
            } else {
                throw new Error('Failed to create image blob.');
            }
            return;
        }
        
        const worker = new Worker('/services/videoRenderer.worker.ts', { type: 'module' });
        
        let audioStreams: ReadableStream[] = [];
        let firstAudioTrackSettings: MediaTrackSettings | null = null;

        if (typeof (window as any).MediaStreamTrackProcessor === 'function') {
            const audioTracksFromMedia = allMediaElementsRef.current
                .flatMap(mediaElement => {
                    const stream = (mediaElement as any).captureStream ? (mediaElement as any).captureStream() : new MediaStream();
                    return stream.getAudioTracks();
                }).filter(track => track.readyState === 'live');
            
            audioStreams = audioTracksFromMedia.map(track => {
                const processor = new (window as any).MediaStreamTrackProcessor({ track });
                return processor.readable;
            });
            firstAudioTrackSettings = audioTracksFromMedia.length > 0 ? audioTracksFromMedia[0].getSettings() : null;
        } else {
            console.warn("MediaStreamTrackProcessor API not supported. Video will be exported without audio.");
        }
    
        worker.postMessage({
            type: 'start',
            payload: { canvasSize, options, audioStreams, firstAudioTrackSettings }
        }, audioStreams);
    
        let renderLoopCancelled = false;
        let totalFrames = 0;
        let recordedChunks: BlobPart[] = [];
        
        const startRenderLoop = async () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasSize.w;
            tempCanvas.height = canvasSize.h;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            if(!tempCtx) return;
    
            const maxDuration = Math.max(0, ...allMediaElementsRef.current.map(el => el.duration).filter(d => isFinite(d)));
            if (maxDuration === 0) {
                 setDownloads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error', error: 'Sem duração de vídeo/áudio.' } : j));
                 worker.terminate();
                 return;
            }
    
            const frameRate = options.frameRate;
            totalFrames = Math.ceil(maxDuration * frameRate);
            let frameCount = 0;
    
            allMediaElementsRef.current.forEach(el => { el.muted = true; el.pause(); });
    
            const renderFrame = async () => {
                if (frameCount > totalFrames || renderLoopCancelled) {
                    worker.postMessage({ type: 'finish' });
                    allMediaElementsRef.current.forEach(el => { el.muted = false; });
                    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                    return;
                }
    
                const currentTime = frameCount / frameRate;
    
                const seekPromises = allMediaElementsRef.current.map(el => new Promise<void>(res => {
                    const onSeeked = () => { el.onseeked = null; res(); };
                    if (el.readyState >= 2) {
                        if(el.seekable.length > 0 && Math.abs(el.currentTime - Math.min(currentTime, el.duration)) > 0.01) {
                            el.onseeked = onSeeked;
                            el.currentTime = Math.min(currentTime, el.duration);
                        } else {
                            res();
                        }
                    } else {
                        el.onloadeddata = () => {
                            el.onseeked = onSeeked;
                            el.currentTime = Math.min(currentTime, el.duration);
                        };
                    }
                }));
    
                await Promise.all(seekPromises);
    
                drawSceneToContext(tempCtx, layers, backgroundColor);
                const frame = new VideoFrame(tempCanvas, { timestamp: currentTime * 1_000_000 });
                worker.postMessage({ type: 'frame', payload: { frame } }, [frame]);
                frameCount++;
                animationFrameId.current = requestAnimationFrame(renderFrame);
            };
            animationFrameId.current = requestAnimationFrame(renderFrame);
        };
    
        worker.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'ready') {
                startRenderLoop();
            } else if (type === 'chunk') {
                recordedChunks.push(payload.chunk);
            } else if (type === 'progress') {
                 const progress = (payload.frames / totalFrames) * 100;
                 setDownloads(prev => prev.map(j => j.id === jobId ? { ...j, progress, status: 'rendering' } : j));
            } else if (type === 'done') {
                const blob = new Blob(recordedChunks, { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);
                setDownloads(prev => prev.map(j => j.id === jobId ? { ...j, progress: 100, status: 'done', resultUrl: url } : j));
                worker.terminate();
                recordedChunks = [];
            } else if (type === 'error') {
                renderLoopCancelled = true;
                setDownloads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error', error: payload.message } : j));
                worker.terminate();
            }
        };
    } catch (err) {
        console.error("Video export failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao iniciar exportação.";
        setDownloads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error', error: errorMessage } : j));
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
                    element.loop = true;
                    element.muted = true;
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
            const mediaSrc = await blobToBase64(new Blob([file], {type: file.type}));
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
             videoElement.loop = false;
             videoElement.muted = false;
            newMediaLayer = {
                id: Date.now().toString(), name: 'Vídeo Desanexado', type: 'video', src: fill.src, videoElement, duration: videoElement.duration,
                x: frameLayer.x + (frameLayer.width - newMediaWidth) / 2, y: frameLayer.y + (frameLayer.height - newMediaHeight) / 2,
                width: newMediaWidth, height: newMediaHeight,
                rotation: frameLayer.rotation, opacity: frameLayer.opacity, flipH: false, flipV: false,
            };
        } else {
            return;
        }

        setLayersAndCommit(prev => [ ...prev.map(l => l.id === frameLayer.id ? { ...(l as FrameLayer), fill: null } : l), newMediaLayer ]);
        setSelectedLayerId(newMediaLayer.id);
        setContextMenu(null);
    };
    
    const handleAssetUpload = async (type: 'image' | 'video' | 'audio', file: File) => {
        const src = await blobToBase64(new Blob([file], {type: file.type}));
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
            thumbnail = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZHRoPSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNCAxMXYyYTUgNSAwIDAgMCAxMCAwdi0yTTggM2g4YTUtMi45IDAgMCAxIDUgMi41VjhhNS0yLjUgMCAwIDEgLTUgMi41SDhBNS0yLjUgMCAwIDEgMyA4VjUuNUE1LTIuNSAwIDAgMSA4IDN6Ii8+PC9zdmc+';
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

    useEffect(() => {
        const videoElementsFromLayers = (layers.filter(l => l.type === 'video') as VideoLayer[]).map(l => l.videoElement!);
        const videoElementsFromFrames = (layers.filter(l => l.type === 'frame') as FrameLayer[])
            .filter(l => l.fill && l.fill.type === 'video')
            .map(l => (l.fill as FrameFillContent & {type: 'video'}).videoElement);

        allMediaElementsRef.current = [
            ...videoElementsFromLayers,
            ...videoElementsFromFrames,
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
    
    const handleSaveProjectToFile = async () => {
        setIsLoadingAI('project');
        try {
            const serialize = async (item: { src: string }) => {
                if (item.src.startsWith('blob:')) return { ...item, src: await blobUrlToDataUrl(item.src) };
                return item;
            };

            const serializableLayers = await Promise.all(layers.map(async (layer) => {
                const cleanLayer = { ...layer, image: undefined, videoElement: undefined, originalImage: undefined } as Layer;
                if (cleanLayer.type === 'image' && (cleanLayer as ImageLayer).src.startsWith('blob:')) (cleanLayer as ImageLayer).src = await blobUrlToDataUrl((cleanLayer as ImageLayer).src);
                else if (cleanLayer.type === 'video' && (cleanLayer as VideoLayer).src.startsWith('blob:')) (cleanLayer as VideoLayer).src = await blobUrlToDataUrl((cleanLayer as VideoLayer).src);
                else if (cleanLayer.type === 'frame') {
                    const frameLayer = cleanLayer as FrameLayer;
                    if (frameLayer.fill?.src.startsWith('blob:')) (frameLayer.fill as any).src = await blobUrlToDataUrl(frameLayer.fill.src);
                    delete (frameLayer.fill as any)?.image; delete (frameLayer.fill as any)?.videoElement;
                }
                return cleanLayer;
            }));

            const serializableAudio = await Promise.all(audioTracks.map(async (track) => {
                const cleanTrack = { ...track, audioElement: undefined };
                if (cleanTrack.src.startsWith('blob:')) cleanTrack.src = await blobUrlToDataUrl(cleanTrack.src);
                return cleanTrack;
            }));
            const serializableAssets = await Promise.all(uploadedAssets.map(asset => serialize(asset)));
            const projectState = { version: 1, layers: serializableLayers, audioTracks: serializableAudio, canvasSize, backgroundColor, uploadedAssets: serializableAssets };
            const projectJson = JSON.stringify(projectState, null, 2);
            const blob = new Blob([projectJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'projeto-criativo.brmp';
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to save project:", err);
            alert("Falha ao salvar o projeto.");
        } finally {
            setIsLoadingAI(null);
        }
    };

    const triggerLoadProjectFromFile = () => {
        projectLoadInputRef.current?.click();
    };

    const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsLoadingAI('project');
        try {
            const text = await file.text();
            const savedState = JSON.parse(text);
            
            if (savedState.version !== 1 || !Array.isArray(savedState.layers)) {
                throw new Error("Formato de ficheiro de projeto inválido ou incompatível.");
            }

            setBackgroundColor(savedState.backgroundColor);
            setCanvasSize(savedState.canvasSize);
            setUploadedAssets(savedState.uploadedAssets || []);

            const loadedLayers = await Promise.all(savedState.layers.map(async (layer: Layer): Promise<Layer> => {
                 if (layer.type === 'image') {
                    const imageLayer = layer as ImageLayer;
                    imageLayer.image = await loadImage(imageLayer.src);
                    if (imageLayer.originalSrc) imageLayer.originalImage = await loadImage(imageLayer.originalSrc);
                } else if (layer.type === 'video') {
                    const videoLayer = layer as VideoLayer;
                    videoLayer.videoElement = await loadVideo(videoLayer.src);
                } else if (layer.type === 'frame' && (layer as FrameLayer).fill) {
                    const frameLayer = layer as FrameLayer;
                    if (frameLayer.fill!.type === 'image') (frameLayer.fill as any).image = await loadImage(frameLayer.fill!.src);
                    else if (frameLayer.fill!.type === 'video') (frameLayer.fill as any).videoElement = await loadVideo(frameLayer.fill!.src);
                }
                return layer;
            }));

            const loadedAudio = await Promise.all((savedState.audioTracks || []).map(async (track: AudioTrack) => {
                track.audioElement = await loadAudio(track.src);
                return track;
            }));

            setLayers(loadedLayers);
            setAudioTracks(loadedAudio);
            setHistory([[[...initialState.layers], [...initialState.audioTracks]], [loadedLayers, loadedAudio]]);
            setHistoryIndex(1);
            
        } catch (err) {
            console.error("Failed to load project:", err);
            alert(`Falha ao carregar o projeto: ${err instanceof Error ? err.message : 'Erro desconhecido.'}`);
        } finally {
            setIsLoadingAI(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleReplaceFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const layerId = contextMenu?.targetLayer?.id;
    
        if (file && layerId) {
            const type = file.type.startsWith('video') ? 'video' : 'image';
            blobToBase64(file).then(src => handleReplaceLayerMedia(layerId, src, type));
        }
    };

    
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
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full shadow border-2 border-white pointer-events-none" style={{ left: `calc(${percentage}% - 8px)` }} />
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
                        <button onClick={() => { setEditingFrameId(targetLayer.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md">Ajustar Mídia</button>
                        <button onClick={() => { handleDetachImage(targetLayer as FrameLayer); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md">Desanexar Mídia</button>
                        <button onClick={() => { replaceImageInputRef.current?.click(); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md">Substituir Mídia</button>
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
         <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-0" onClick={(e) => { if(e.target === e.currentTarget) setContextMenu(null); }}>
            {contextMenu && <ContextMenuComponent menuState={contextMenu} />}
            <DownloadModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} onDownload={handleDownload} hasVideoOrAudio={hasVideoOrAudio} />
            <BackgroundRemoverModal isOpen={isBgRemoverOpen} onClose={() => setIsBgRemoverOpen(false)} imageWithTransparency={imageForBgRefinement?.current ?? null} originalImage={imageForBgRefinement?.original ?? null} onApply={handleApplyBgRefinement}/>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-900 w-full h-full relative flex flex-row overflow-hidden">
                <div className="w-full md:w-80 lg:w-96 flex-shrink-0 h-full">
                    <CreativeEditorSidebar 
                        onAddLayer={addLayer} 
                        onUpdateSelectedLayer={updateSelectedLayer} 
                        selectedLayer={selectedLayer} 
                        onAITool={handleAITool} 
                        onGenerateAIImage={handleGenerateAIImage} 
                        isLoadingAI={isLoadingAI}
                        onToggleLayersPanel={() => setIsLayersPanelOpen(p => !p)}
                        onUpdateBackgroundColor={setBackgroundColor} 
                        backgroundColor={backgroundColor}
                        onOpenBgRemover={handleOpenBgRemover}
                        onTriggerUpload={handleTriggerUpload}
                        uploadedAssets={uploadedAssets}
                        onAssetClick={handleAssetClick}
                        onSaveProject={handleSaveProjectToFile}
                        onLoadProject={triggerLoadProjectFromFile}
                        canvasSize={canvasSize}
                        onSetCanvasSize={setCanvasSize}
                    />
                </div>
                <div className="flex-grow flex flex-col items-stretch bg-gray-800 relative min-w-0 h-full" onDragOver={handleDragOver} onDrop={handleDrop} onDragLeave={() => setDropTargetId(null)}>
                    <div className="flex-shrink-0 z-10 p-4">
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
                    </div>
                    <div ref={canvasContainerRef} className="flex-grow relative flex items-center justify-center p-8 overflow-auto group" onClick={handleCanvasClick}>
                        {isLoadingAI === 'project' && <div className="absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center text-white"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-400 mb-4"></div><p>A processar o projeto...</p></div>}
                        {editingFrame && <FrameEditToolbar frame={editingFrame} onUpdate={updateSelectedLayer} onDone={() => { setEditingFrameId(null); commitToHistory(layers, audioTracks); }} />}
                        
                        <div 
                            className="relative shadow-lg"
                             style={{
                                width: canvasSize.w,
                                height: canvasSize.h,
                                transform: `scale(${finalScale})`,
                                transformOrigin: 'center center',
                                backgroundColor: backgroundColor,
                             }}
                        >
                            <div className="absolute inset-0"
                                onMouseDown={handleMouseDown}
                                onDoubleClick={handleDoubleClick}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    cursor: editingFrameId ? 'move' : (interaction?.type === 'move' ? 'grabbing' : 'default')
                                }}
                            >
                                <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h} className="w-full h-full"></canvas>
                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                    {alignmentGuides.map((guide, index) => {
                                        const style: React.CSSProperties = {
                                            position: 'absolute',
                                            backgroundColor: '#f472b6',
                                            zIndex: 999,
                                        };
                                        if (guide.type === 'vertical') {
                                            style.left = `${guide.position}px`;
                                            style.top = `${guide.start}px`;
                                            style.width = '1px';
                                            style.height = `${(guide.end - guide.start)}px`;
                                        } else {
                                            style.top = `${guide.position}px`;
                                            style.left = `${guide.start}px`;
                                            style.height = '1px';
                                            style.width = `${(guide.end - guide.start)}px`;
                                        }
                                        return <div key={index} style={style} />;
                                    })}
                                    <BoundingBox selectedLayer={selectedLayer} scale={1} isFrameEditing={!!editingFrameId && selectedLayerId === editingFrameId} />
                                    {selectedLayer?.type === 'video' && !selectedLayer.isLoading && (
                                        <VideoControls
                                            layer={selectedLayer as VideoLayer}
                                            scale={1}
                                            playbackState={playbackState}
                                            onPlayPause={handleVideoPlayPause}
                                            onSeek={handleVideoSeek}
                                        />
                                    )}
                                </div>
                                {dropTargetId && <DropTargetHighlight layer={layers.find(l => l.id === dropTargetId)!} scale={1} />}
                                {editingTextLayerId && <EditableTextArea ref={textInputRef} layer={layers.find(l => l.id === editingTextLayerId) as TextLayer} scale={1} value={editingTextValue} onChange={e => setEditingTextValue(e.target.value)} onBlur={handleTextEditBlur} />}
                                {comparisonMode === 'split' && selectedLayer?.type === 'image' && (selectedLayer as ImageLayer).originalSrc && (
                                    <><div className="absolute top-2 left-2 z-20 bg-black/60 text-white px-2 py-1 rounded text-xs pointer-events-none" style={{transform: `scale(${1/finalScale})`, transformOrigin: 'top left'}}>Antes</div><div className="absolute top-2 right-2 z-20 bg-black/60 text-white px-2 py-1 rounded text-xs pointer-events-none" style={{transform: `scale(${1/finalScale})`, transformOrigin: 'top right'}}>Depois</div><div onMouseDown={handleSplitterMouseDown} className="absolute top-0 bottom-0 z-20 w-2.5 cursor-ew-resize" style={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}><div className="w-0.5 h-full bg-white mx-auto shadow-2xl"></div><div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg text-gray-800"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg></div></div></>
                                 )}
                            </div>
                        </div>
                    </div>
                    <div className="flex-shrink-0 z-10 p-2 bg-gray-900/50 flex items-center justify-between">
                        <Button onClick={onClose}>Sair</Button>
                         <div className="flex items-center gap-2 bg-gray-800/80 p-1 rounded-lg text-gray-200">
                            <button onClick={() => setUserZoom(z => Math.max(0.25, z - 0.25))} className="px-3 py-1 text-lg font-bold rounded-md hover:bg-gray-700">-</button>
                            <span className="w-16 text-center text-sm font-semibold">{Math.round(userZoom * 100)}%</span>
                            <button onClick={() => setUserZoom(z => Math.min(4, z + 0.25))} className="px-3 py-1 text-lg font-bold rounded-md hover:bg-gray-700">+</button>
                        </div>
                        <Button onClick={() => setIsDownloadModalOpen(true)} primary>Baixar</Button>
                    </div>
                </div>

                <input type="file" ref={fontInputRef} onChange={handleFontUpload} accept=".otf, .ttf" className="hidden" />
                <input type="file" ref={replaceImageInputRef} onChange={handleReplaceFileInputChange} accept="image/*,video/*" className="hidden" />
                <input type="file" ref={imageUploadRef} onChange={(e) => { if (e.target.files?.[0]) handleAssetUpload('image', e.target.files[0]); e.target.value = ''; }} accept="image/*" className="hidden" />
                <input type="file" ref={videoUploadRef} onChange={(e) => { if (e.target.files?.[0]) handleAssetUpload('video', e.target.files[0]); e.target.value = ''; }} accept="video/*" className="hidden" />
                <input type="file" ref={audioUploadRef} onChange={(e) => { if (e.target.files?.[0]) handleAssetUpload('audio', e.target.files[0]); e.target.value = ''; }} accept="audio/*" className="hidden" />
                <input type="file" ref={projectLoadInputRef} onChange={handleProjectFileChange} accept=".brmp,application/json" className="hidden" />
                <AnimatePresence><LayersPanel isOpen={isLayersPanelOpen} onClose={() => setIsLayersPanelOpen(false)} layers={layers} selectedLayerId={selectedLayerId} onSelectLayer={setSelectedLayerId} onReorderLayers={(reordered) => setLayersAndCommit(reordered)} /></AnimatePresence>
            </motion.div>
        </div>
    );
};

export default CreativeEditorModal;