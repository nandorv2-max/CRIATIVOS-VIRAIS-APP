import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import { useHotkeys } from 'react-hotkeys-hook';
import CreativeEditorHeader from '../CreativeEditorHeader.tsx';
import CreativeEditorSidebar from '../CreativeEditorSidebar.tsx';
import PropertiesPanel from '../PropertiesPanel.tsx';
import LayersPanel from '../LayersPanel.tsx';
import Timeline from '../Timeline.tsx';
import DownloadModal, { DownloadOptions } from '../DownloadModal.tsx';
import { AssetContext } from '../MainDashboard.tsx';
import { 
    ProjectState, Page, AnyLayer, TextLayer, ShapeLayer, ImageLayer, VideoLayer,
    UploadedAsset, PublicAsset, Project
} from '../../types.ts';
import { removeBackground } from '../../geminiService.ts';
import { blobToBase64 } from '../../utils/imageUtils.ts';
import SelectionBox from '../SelectionBox.tsx';

// Helper function to load media and return an HTML element
const loadMedia = (src: string, type: 'image' | 'video'): Promise<HTMLImageElement | HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
        const element = type === 'image' ? new Image() : document.createElement('video');
        element.crossOrigin = 'anonymous';
        const eventToListen = type === 'image' ? 'onload' : 'onloadedmetadata';
        (element as any)[eventToListen] = () => resolve(element);
        element.onerror = (err) => reject(new Error(`Failed to load media: ${src.substring(0, 100)}...`));
        element.src = src;
        if (type === 'video') {
            (element as HTMLVideoElement).load();
        }
    });
};

type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'ml' | 'bm' | 'mr' | 'rotate';
type InteractionType = 'move' | 'resize' | 'pan' | 'rotate';

const DEFAULT_PAGE: Page = {
    id: nanoid(), name: 'Página 1', layers: [], duration: 5000,
    backgroundColor: '#FFFFFF', width: 1080, height: 1080,
};

const INITIAL_PROJECT: ProjectState = {
    name: 'Projeto sem Título', pages: [DEFAULT_PAGE], audioTracks: [],
};

interface InteractionState {
    type: InteractionType;
    layerIds: string[];
    startX: number;
    startY: number;
    initialLayerStates: Map<string, AnyLayer>;
    handle?: Handle;
    // For rotation
    centerX?: number;
    centerY?: number;
    startAngle?: number;
}

interface CreativeEditorViewProps {
    setSaveProjectTrigger: React.Dispatch<React.SetStateAction<{ trigger: () => void; }>>;
    setLoadProjectTrigger: React.Dispatch<React.SetStateAction<{ trigger: (project: Project) => void; }>>;
}

const CreativeEditorView: React.FC<CreativeEditorViewProps> = ({ setSaveProjectTrigger, setLoadProjectTrigger }) => {
    const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(true);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [zoom, setZoom] = useState(0.75);
    const [isLoadingAI, setIsLoadingAI] = useState<'remove-bg' | false>(false);
    const [interaction, setInteraction] = useState<InteractionState | null>(null);
    const [history, setHistory] = useState<ProjectState[]>([INITIAL_PROJECT]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [customFonts, setCustomFonts] = useState<string[]>([]);
    const [cropLayerId, setCropLayerId] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const fileUploadRef = useRef<HTMLInputElement>(null);
    const fontUploadRef = useRef<HTMLInputElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    const assetContext = useContext(AssetContext);
    const activePage = project.pages[activePageIndex];
    const selectedLayers = activePage.layers.filter(l => selectedLayerIds.includes(l.id));
    
    const commitToHistory = useCallback((newState: ProjectState) => {
        const newHistory = history.slice(0, historyIndex + 1);
        if (newHistory.length > 0 && JSON.stringify(newHistory[newHistory.length - 1]) === JSON.stringify(newState)) {
            return;
        }
        newHistory.push(newState);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const updateProject = useCallback((updater: (draft: ProjectState) => void, commit = false) => {
        setProject(currentProject => {
            const draft = JSON.parse(JSON.stringify(currentProject));

            draft.pages.forEach((page: Page, pageIndex: number) => {
                page.layers.forEach((layer: AnyLayer, layerIndex: number) => {
                    const originalLayer = currentProject.pages[pageIndex]?.layers[layerIndex];
                    if (originalLayer && originalLayer.id === layer.id) {
                        if (layer.type === 'image' && originalLayer.type === 'image') {
                            layer._imageElement = originalLayer._imageElement;
                        } else if (layer.type === 'video' && originalLayer.type === 'video') {
                            layer._videoElement = originalLayer._videoElement;
                        }
                    }
                });
            });

            updater(draft);

            if (commit) {
                commitToHistory(draft);
            }
            return draft;
        });
    }, [commitToHistory]);


    const handleUndo = useCallback(() => { if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setProject(history[newIndex]); }}, [history, historyIndex]);
    const handleRedo = useCallback(() => { if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setProject(history[newIndex]); }}, [history, historyIndex]);

    const deleteSelectedLayers = () => {
        if (selectedLayerIds.length === 0) return;
        updateProject(draft => {
            const pageToUpdate = draft.pages[activePageIndex];
            pageToUpdate.layers = pageToUpdate.layers.filter(l => !selectedLayerIds.includes(l.id));
        }, true);
        setSelectedLayerIds([]);
    };
    
    const onDuplicateLayers = useCallback(() => {
        if (selectedLayerIds.length === 0) return;
        updateProject(draft => {
            const pageToUpdate = draft.pages[activePageIndex];
            const layersToDuplicate = pageToUpdate.layers.filter(l => selectedLayerIds.includes(l.id));
            const newLayers = layersToDuplicate.map(layer => {
                const newLayer = JSON.parse(JSON.stringify(layer));
                return { ...newLayer, id: nanoid(), name: `${layer.name} Cópia`, x: layer.x + 20, y: layer.y + 20 };
            });
            pageToUpdate.layers.push(...newLayers);
            setSelectedLayerIds(newLayers.map(l => l.id));
        }, true);
    }, [selectedLayerIds, updateProject, activePageIndex]);
    
    const onReorderLayers = useCallback((direction: 'forward' | 'backward') => {
        if (selectedLayerIds.length !== 1) return;
        const layerId = selectedLayerIds[0];
        updateProject(draft => {
            const pageToUpdate = draft.pages[activePageIndex];
            const currentIndex = pageToUpdate.layers.findIndex(l => l.id === layerId);
            if (currentIndex === -1) return;
            const newLayers = [...pageToUpdate.layers];
            const [layerToMove] = newLayers.splice(currentIndex, 1);
            const newIndex = direction === 'forward' ? Math.min(currentIndex + 1, newLayers.length) : Math.max(currentIndex - 1, 0);
            newLayers.splice(newIndex, 0, layerToMove);
            pageToUpdate.layers = newLayers;
        }, true);
    }, [selectedLayerIds, updateProject, activePageIndex]);
    
    useHotkeys('ctrl+z, meta+z', (event) => { event.preventDefault(); handleUndo(); }, { enableOnContentEditable: true });
    useHotkeys('ctrl+y, meta+y, ctrl+shift+z, meta+shift+z', (event) => { event.preventDefault(); handleRedo(); }, { enableOnContentEditable: true });
    useHotkeys('backspace, delete', () => { if (!cropLayerId) deleteSelectedLayers(); });
    useHotkeys('escape', () => { if (cropLayerId) setCropLayerId(null); });
    useHotkeys('ctrl+d, meta+d', (event) => { event.preventDefault(); onDuplicateLayers(); });

    const addLayer = useCallback((newLayer: Partial<AnyLayer>) => {
        const layerDefaults = { id: nanoid(), name: 'Nova Camada', x: 50, y: 50, rotation: 0, opacity: 1, isLocked: false, isVisible: true, width: 200, height: 200 };
        const finalLayer = { ...layerDefaults, ...newLayer } as AnyLayer;
        updateProject(draft => {
            draft.pages[activePageIndex].layers.push(finalLayer);
        }, true);
        setSelectedLayerIds([finalLayer.id]);
    }, [updateProject, activePageIndex]);

    const updateSelectedLayers = (update: Partial<AnyLayer>, commit: boolean = false) => {
         updateProject(draft => {
            const pageToUpdate = draft.pages[activePageIndex];
            pageToUpdate.layers.forEach(l => {
                if (selectedLayerIds.includes(l.id)) Object.assign(l, update);
            });
        }, commit);
    };

    const handleAddTextLayer = (preset: 'heading' | 'subheading' | 'body') => {
        const styles = { heading: { text: 'Título', fontSize: 72, fontWeight: 'bold' as const }, subheading: { text: 'Subtítulo', fontSize: 48, fontWeight: 'normal' as const }, body: { text: 'Parágrafo', fontSize: 24, fontWeight: 'normal' as const } };
        addLayer({ type: 'text', name: 'Texto', ...styles[preset], fontFamily: 'Inter', color: '#000000', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, textTransform: 'none' } as Partial<TextLayer>);
    };

    const handleAddShapeLayer = (shape: 'rectangle' | 'ellipse') => {
        addLayer({ type: 'shape', name: shape === 'rectangle' ? 'Retângulo' : 'Elipse', shape, fill: '#CCCCCC', stroke: '#000000', strokeWidth: 0 } as Partial<ShapeLayer>);
    };
    
    const handleAddAssetToCanvas = async (asset: UploadedAsset | PublicAsset) => {
        try {
            const isPublic = 'asset_type' in asset;
            const url = isPublic ? asset.asset_url : asset.url;
            const type = isPublic ? asset.asset_type : asset.type;
            const mediaElement = await loadMedia(url, type === 'video' ? 'video' : 'image');
            
            let naturalWidth: number, naturalHeight: number, duration: number | undefined;
            if (mediaElement instanceof HTMLVideoElement) {
                naturalWidth = mediaElement.videoWidth;
                naturalHeight = mediaElement.videoHeight;
                duration = mediaElement.duration;
            } else if (mediaElement instanceof HTMLImageElement) {
                naturalWidth = mediaElement.naturalWidth;
                naturalHeight = mediaElement.naturalHeight;
            } else {
                return;
            }

            const canvasWidth = activePage.width;
            const canvasHeight = activePage.height;
            
            let scaleToFit = 1;
            if (naturalWidth > canvasWidth || naturalHeight > canvasHeight) {
                const widthRatio = canvasWidth / naturalWidth;
                const heightRatio = canvasHeight / naturalHeight;
                scaleToFit = Math.min(widthRatio, heightRatio) * 0.9; // Add some padding
            }

            const layerWidth = naturalWidth * scaleToFit;
            const layerHeight = naturalHeight * scaleToFit;
            
            const newLayerBase = { 
                name: asset.name, 
                src: mediaElement.src, 
                x: (canvasWidth - layerWidth) / 2,
                y: (canvasHeight - layerHeight) / 2,
                width: layerWidth, 
                height: layerHeight, 
                mediaNaturalWidth: naturalWidth, 
                mediaNaturalHeight: naturalHeight, 
                scale: scaleToFit,
                offsetX: 0, 
                offsetY: 0, 
                crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight } 
            };
            
            if (type === 'video') {
                const newLayer: VideoLayer = { ...newLayerBase, type: 'video', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, startTime: 0, endTime: duration || 0, duration: duration || 0, volume: 1, isMuted: false, _videoElement: mediaElement as HTMLVideoElement };
                addLayer(newLayer);
            } else {
                 const newLayer: ImageLayer = { ...newLayerBase, type: 'image', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, _imageElement: mediaElement as HTMLImageElement };
                 addLayer(newLayer);
            }
        } catch (e) { console.error("Failed to load asset media", e); }
    };

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fontName = file.name.replace(/\.[^/.]+$/, "");
        try {
            const fontUrl = URL.createObjectURL(file);
            const fontFace = new FontFace(fontName, `url(${fontUrl})`);
            await fontFace.load();
            (document.fonts as any).add(fontFace);
            setCustomFonts(prev => [...prev, fontName]);
            if (selectedLayers.length > 0 && selectedLayers[0].type === 'text') {
                updateSelectedLayers({ fontFamily: fontName }, true);
            }
        } catch (err) { console.error("Failed to load font:", err); }
    };

    const handleAITool = async (tool: 'remove-bg') => {
        const targetLayer = selectedLayers[0] as ImageLayer;
        if (!targetLayer || targetLayer.type !== 'image') return;
        setIsLoadingAI('remove-bg');
        try {
            const response = await fetch(targetLayer.src);
            if (!response.ok) throw new Error(`Failed to fetch image for AI tool: ${response.statusText}`);
            const blob = await response.blob();
            const base64Image = await blobToBase64(blob);
            const resultB64 = await removeBackground(base64Image);
            const newImage = await loadMedia(resultB64, 'image') as HTMLImageElement;
            const aspectRatio = newImage.naturalWidth / newImage.naturalHeight;
            updateProject(draft => {
                const pageToUpdate = draft.pages[activePageIndex];
                const layerToUpdate = pageToUpdate.layers.find(l => l.id === targetLayer.id) as ImageLayer;
                if (layerToUpdate) {
                    layerToUpdate.src = resultB64;
                    layerToUpdate.height = layerToUpdate.width / aspectRatio;
                    layerToUpdate.mediaNaturalWidth = newImage.naturalWidth;
                    layerToUpdate.mediaNaturalHeight = newImage.naturalHeight;
                    layerToUpdate._imageElement = newImage;
                }
            }, true);
        } catch (e) { console.error("BG Removal Failed", e); } finally { setIsLoadingAI(false); }
    };

    const getCoords = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent): { x: number, y: number } => {
        const canvasWrapper = canvasContainerRef.current?.querySelector('.relative.shadow-2xl');
        if (!canvasWrapper) return { x: 0, y: 0 };
        const rect = canvasWrapper.getBoundingClientRect();
        return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    }, [zoom]);

    const getLayerAtPoint = useCallback((x: number, y: number): AnyLayer | null => {
        const layers = project.pages[activePageIndex]?.layers || [];
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            if (layer.isLocked || !layer.isVisible) continue;
            const cx = layer.x + layer.width / 2; const cy = layer.y + layer.height / 2;
            const angleRad = -layer.rotation * (Math.PI / 180);
            const cos = Math.cos(angleRad); const sin = Math.sin(angleRad);
            const rotatedX = (x - cx) * cos - (y - cy) * sin; const rotatedY = (x - cx) * sin + (y - cy) * cos;
            if (Math.abs(rotatedX) < layer.width / 2 && Math.abs(rotatedY) < layer.height / 2) return layer;
        }
        return null;
    }, [project, activePageIndex]);
    
    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const { x, y } = getCoords(e);
        const clickedLayer = getLayerAtPoint(x, y);
        if (clickedLayer && (clickedLayer.type === 'image' || clickedLayer.type === 'video')) {
            setCropLayerId(clickedLayer.id);
            setSelectedLayerIds([clickedLayer.id]);
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const handle = (e.target as HTMLElement).dataset.handle as Handle;
        const { x, y } = getCoords(e);
        
        if (cropLayerId) {
            const layer = selectedLayers[0];
            const initialLayerStates = new Map<string, AnyLayer>([[layer.id, {...layer}]]);
            setInteraction({ type: 'pan', layerIds: [layer.id], startX: e.clientX, startY: e.clientY, initialLayerStates });
            return;
        }

        if (handle === 'rotate' && selectedLayers.length === 1) {
            e.stopPropagation();
            const layer = selectedLayers[0];
            const centerX = layer.x + layer.width / 2;
            const centerY = layer.y + layer.height / 2;
            const startAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
            const initialLayerStates = new Map<string, AnyLayer>([[layer.id, { ...layer }]]);
            setInteraction({ type: 'rotate', layerIds: [layer.id], startX: e.clientX, startY: e.clientY, initialLayerStates, centerX, centerY, startAngle: startAngle - layer.rotation });
            return;
        }

        if (handle && selectedLayers.length === 1) {
            e.stopPropagation();
            const layer = selectedLayers[0];
            const initialLayerStates = new Map<string, AnyLayer>([[layer.id, {...layer}]]);
            setInteraction({ type: 'resize', handle, layerIds: [layer.id], startX: e.clientX, startY: e.clientY, initialLayerStates });
            return;
        }

        const clickedLayer = getLayerAtPoint(x, y);
        if (clickedLayer) {
             if (cropLayerId && cropLayerId !== clickedLayer.id) setCropLayerId(null);
            const isSelected = selectedLayerIds.includes(clickedLayer.id);
            const newSelectedIds = e.shiftKey ? (isSelected ? selectedLayerIds.filter(id => id !== clickedLayer.id) : [...selectedLayerIds, clickedLayer.id]) : (isSelected && selectedLayerIds.length > 1 ? selectedLayerIds : [clickedLayer.id]);
            setSelectedLayerIds(newSelectedIds);
            const initialLayerStates = new Map<string, AnyLayer>();
            project.pages[activePageIndex].layers.forEach(l => { if (newSelectedIds.includes(l.id)) initialLayerStates.set(l.id, {...l}); });
            setInteraction({ type: 'move', layerIds: newSelectedIds, startX: x, startY: y, initialLayerStates });
        } else {
             if (cropLayerId) setCropLayerId(null);
            setSelectedLayerIds([]);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!interaction) return;
            e.preventDefault();
            
            if (interaction.type === 'move') {
                const { x, y } = getCoords(e);
                const dx = x - interaction.startX; const dy = y - interaction.startY;
                updateProject(draft => {
                    draft.pages[activePageIndex].layers.forEach(l => {
                        if (interaction.layerIds.includes(l.id) && !l.isLocked) {
                            const initial = interaction.initialLayerStates.get(l.id);
                            if (initial) { l.x = initial.x + dx; l.y = initial.y + dy; }
                        }
                    });
                }, false);
            } else if (interaction.type === 'rotate') {
                const { centerX, centerY, startAngle } = interaction;
                if (centerX === undefined || centerY === undefined || startAngle === undefined) return;
                const { x, y } = getCoords(e);
                const currentAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
                let newRotation = currentAngle - startAngle;
                if (e.shiftKey) newRotation = Math.round(newRotation / 15) * 15;
                updateProject(draft => {
                    const layer = draft.pages[activePageIndex].layers.find(l => l.id === interaction.layerIds[0]);
                    if (layer) layer.rotation = newRotation;
                }, false);
            } else if (interaction.type === 'resize' && interaction.handle && interaction.layerIds.length === 1) {
                const { handle, startX, startY, initialLayerStates } = interaction;
                const initialLayer = initialLayerStates.get(interaction.layerIds[0]);
                if (!initialLayer) return;

                const { x: ox, y: oy, width: ow, height: oh, rotation } = initialLayer;
                const rad = rotation * Math.PI / 180;
                const cos = Math.cos(rad); const sin = Math.sin(rad);
                const dx = (e.clientX - startX) / zoom;
                const dy = (e.clientY - startY) / zoom;
                const minSize = 20;
                
                if (handle.includes('m')) { // Side handles (cropping/expanding)
                    const rdx = dx * cos + dy * sin;
                    const rdy = -dx * sin + dy * cos;
                    
                    let newW = ow;
                    let newH = oh;

                    if (handle === 'mr') newW = Math.max(minSize, ow + rdx);
                    if (handle === 'ml') newW = Math.max(minSize, ow - rdx);
                    if (handle === 'bm') newH = Math.max(minSize, oh + rdy);
                    if (handle === 'tm') newH = Math.max(minSize, oh - rdy);

                    const dw = newW - ow;
                    const dh = newH - oh;

                    const updates: any = { width: newW, height: newH };
                    const mediaLayer = initialLayer as ImageLayer | VideoLayer;
                    updates.offsetX = mediaLayer.offsetX;
                    updates.offsetY = mediaLayer.offsetY;
                    
                    let d_center_x = 0;
                    let d_center_y = 0;

                    if (dw !== 0) { // Horizontal resize
                        const d_center_local_x = (handle === 'ml' ? -dw / 2 : dw / 2);
                        d_center_x = d_center_local_x * cos;
                        d_center_y = d_center_local_x * sin;
                        if (handle === 'ml') updates.offsetX = mediaLayer.offsetX + dw;
                    } else if (dh !== 0) { // Vertical resize
                        const d_center_local_y = (handle === 'tm' ? -dh / 2 : dh / 2);
                        const local_y_axis_x = -sin;
                        const local_y_axis_y = cos;
                        d_center_x = d_center_local_y * local_y_axis_x;
                        d_center_y = d_center_local_y * local_y_axis_y;
                        if (handle === 'tm') updates.offsetY = mediaLayer.offsetY + dh;
                    }

                    const old_center_x = ox + ow / 2;
                    const old_center_y = oy + oh / 2;
                    
                    const new_center_x = old_center_x + d_center_x;
                    const new_center_y = old_center_y + d_center_y;

                    updates.x = new_center_x - newW / 2;
                    updates.y = new_center_y - newH / 2;
                    
                    updateProject(draft => {
                        const l = draft.pages[activePageIndex].layers.find(l => l.id === initialLayer.id);
                        if (l && !l.isLocked) Object.assign(l, updates);
                    }, false);

                } else { // Corner handles (scaling)
                    let {x: newX, y: newY, width: newW, height: newH} = initialLayer;
                    const rdx = dx * cos + dy * sin;
                    const rdy = -dx * sin + dy * cos;
                    const isShift = e.shiftKey;
                    const aspectRatio = ow / oh;
                    let potentialW, potentialH;

                    if (handle.includes('r')) potentialW = ow + rdx; else potentialW = ow - rdx;
                    if (handle.includes('b')) potentialH = oh + rdy; else potentialH = oh - rdy;

                    if (isShift) { // Free transform
                        newW = potentialW;
                        newH = potentialH;
                    } else { // Proportional transform
                        if (Math.abs(potentialW - ow) > Math.abs(potentialH - oh) * aspectRatio) {
                            newW = potentialW; newH = potentialW / aspectRatio;
                        } else {
                            newH = potentialH; newW = newH * aspectRatio;
                        }
                    }

                    newW = Math.max(minSize, newW);
                    newH = Math.max(minSize, newH);
                    const center = { x: ox + ow / 2, y: oy + oh / 2 };
                    newX = center.x - newW / 2;
                    newY = center.y - newH / 2;
                    
                    updateProject(draft => {
                        const l = draft.pages[activePageIndex].layers.find(l => l.id === initialLayer.id);
                        if (l && !l.isLocked) { l.x = newX; l.y = newY; l.width = newW; l.height = newH; }
                    }, false);
                }
            }
        };
        const handleMouseUp = () => {
             if (interaction) commitToHistory(project);
            setInteraction(null);
        };

        if (interaction) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [interaction, updateProject, commitToHistory, zoom, activePageIndex, project, getCoords]);

    const drawScene = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const currentPage = project.pages[activePageIndex];
        if (!ctx || !canvas || !currentPage) return;
    
        canvas.width = currentPage.width;
        canvas.height = currentPage.height;
        ctx.fillStyle = currentPage.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        currentPage.layers.forEach(layer => {
            if (!layer.isVisible) return;
    
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
            ctx.rotate(layer.rotation * Math.PI / 180);
            
            const drawX = -layer.width / 2;
            const drawY = -layer.height / 2;
            
            if (layer.type === 'text') {
                ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}"`;
                ctx.fillStyle = layer.color;
                ctx.textAlign = layer.textAlign;
                ctx.textBaseline = 'top';
                let textDrawX = drawX;
                if (layer.textAlign === 'center') textDrawX += layer.width / 2;
                else if (layer.textAlign === 'right') textDrawX += layer.width;
                ctx.fillText(layer.text, textDrawX, drawY);
            } else if (layer.type === 'shape') {
                ctx.fillStyle = layer.fill;
                if(layer.shape === 'rectangle') ctx.fillRect(drawX, drawY, layer.width, layer.height);
                else { ctx.beginPath(); ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, 2 * Math.PI); ctx.fill(); }
            } else if (layer.type === 'image' || layer.type === 'video') {
                const mediaLayer = layer as ImageLayer | VideoLayer;
                const mediaElement = mediaLayer.type === 'image' ? mediaLayer._imageElement : mediaLayer._videoElement;
    
                let isReady = false;
    
                if (mediaElement) {
                    if (mediaElement instanceof HTMLImageElement) {
                        isReady = mediaElement.complete && mediaElement.naturalWidth > 0;
                    } else if (mediaElement instanceof HTMLVideoElement) {
                        isReady = mediaElement.readyState >= 2;
                    }
                }
    
                if (isReady) {
                    ctx.beginPath();
                    ctx.rect(drawX, drawY, layer.width, layer.height);
                    ctx.clip();
                    
                    const contentWidth = mediaLayer.mediaNaturalWidth * mediaLayer.scale;
                    const contentHeight = mediaLayer.mediaNaturalHeight * mediaLayer.scale;
                    
                    ctx.drawImage(mediaElement, drawX + mediaLayer.offsetX, drawY + mediaLayer.offsetY, contentWidth, contentHeight);
                }
            }
            ctx.restore();
        });
    }, [project, activePageIndex]);
    
    useEffect(() => {
        const renderLoop = () => {
            drawScene();
            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };
        renderLoop();
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [drawScene]);

    useEffect(() => {
        activePage?.layers.forEach(layer => {
            if (layer.type === 'image' && (!layer._imageElement || layer._imageElement.src !== layer.src)) {
                loadMedia(layer.src, 'image').then(img => {
                    updateProject(draft => {
                        const l = draft.pages[activePageIndex]?.layers.find(l => l.id === layer.id);
                        if (l && l.type === 'image') {
                           l._imageElement = img as HTMLImageElement;
                           l.mediaNaturalWidth = (img as HTMLImageElement).naturalWidth;
                           l.mediaNaturalHeight = (img as HTMLImageElement).naturalHeight;
                        }
                    }, false)
                });
            } else if (layer.type === 'video' && (!layer._videoElement || layer._videoElement.src !== layer.src)) {
                loadMedia(layer.src, 'video').then(vid => {
                    updateProject(draft => {
                        const l = draft.pages[activePageIndex]?.layers.find(l => l.id === layer.id);
                        if (l && l.type === 'video') {
                            l._videoElement = vid as HTMLVideoElement;
                            l.mediaNaturalWidth = (vid as HTMLVideoElement).videoWidth;
                            l.mediaNaturalHeight = (vid as HTMLVideoElement).videoHeight;
                        }
                    }, false)
                });
            }
        })
    }, [activePage?.layers, updateProject, activePageIndex]);

    return (
        <div className="h-full w-full flex flex-col bg-brand-accent text-white">
            <CreativeEditorHeader
                projectName={project.name}
                onProjectNameChange={name => updateProject(draft => { draft.name = name; }, false)}
                onDownload={() => setIsDownloadModalOpen(true)}
                onUndo={handleUndo} onRedo={handleRedo} canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1}
                selectedLayers={selectedLayers}
                onUpdateSelectedLayers={(update) => updateSelectedLayers(update, false)}
                onCommitHistory={() => commitToHistory(project)}
                onDeleteLayers={deleteSelectedLayers} onDuplicateLayers={onDuplicateLayers} onReorderLayers={onReorderLayers}
                backgroundColor={activePage.backgroundColor}
                onBackgroundColorChange={color => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.backgroundColor = color; }, false)}
                customFonts={customFonts}
                onTriggerFontUpload={() => fontUploadRef.current?.click()}
            />
            <div className="flex-grow flex min-h-0">
                <CreativeEditorSidebar
                    onAddTextLayer={handleAddTextLayer} onAddShapeLayer={handleAddShapeLayer}
                    onTriggerUpload={() => fileUploadRef.current?.click()}
                    uploadedAssets={assetContext?.assets || []}
                    onAddAssetToCanvas={handleAddAssetToCanvas}
                    onToggleLayersPanel={() => setIsLayersPanelOpen(p => !p)}
                    onSaveProject={() => {}} onLoadProject={() => {}} onAITool={handleAITool}
                    isLoadingAI={isLoadingAI} selectedLayers={selectedLayers}
                />
                <main ref={canvasContainerRef} className="flex-grow flex items-center justify-center p-8 bg-gray-800 relative overflow-hidden">
                    <div className="relative shadow-2xl" style={{ width: activePage.width, height: activePage.height, transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                        <canvas ref={canvasRef} />
                        <div className="absolute top-0 left-0 w-full h-full" onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick}>
                           <SelectionBox layers={selectedLayers} zoom={zoom} cropLayerId={cropLayerId} />
                        </div>
                    </div>
                </main>
                <PropertiesPanel
                    selectedLayers={selectedLayers}
                    onUpdateLayers={(update) => updateSelectedLayers(update, false)} onCommitHistory={() => commitToHistory(project)}
                    canvasWidth={activePage.width} canvasHeight={activePage.height}
                    onCanvasSizeChange={(w, h) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) {p.width = w; p.height = h;} }, true)}
                    backgroundColor={activePage.backgroundColor}
                    onBackgroundColorChange={color => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.backgroundColor = color; }, false)}
                    onDownload={() => {}} onPublish={() => {}}
                />
                <AnimatePresence>
                    {isLayersPanelOpen && (
                        <LayersPanel
                            isOpen={isLayersPanelOpen} onClose={() => setIsLayersPanelOpen(false)} layers={activePage.layers} selectedLayerIds={selectedLayerIds}
                            onSelectLayer={(id, shiftKey) => setSelectedLayerIds(prev => shiftKey ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : [id])}
                            onReorderLayers={(reordered) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers = reordered; }, true)}
                            onToggleLayerLock={(id) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers.forEach(l => { if(l.id === id) l.isLocked = !l.isLocked; }); }, true)}
                        />
                    )}
                </AnimatePresence>
            </div>
            <Timeline pages={project.pages} activePageIndex={activePageIndex} onSelectPage={setActivePageIndex} onAddPage={() => {}} onDeletePage={() => {}} onDuplicatePage={() => {}} onReorderPages={() => {}} onPageDurationChange={() => {}} projectTime={0} isPlaying={false} onPlayPause={() => {}} />
            <input type="file" ref={fileUploadRef} onChange={(e) => { if (e.target.files) console.log("Files ready to be uploaded"); e.target.value = ''; }} multiple className="hidden" accept="image/*,video/*"/>
            <input type="file" ref={fontUploadRef} onChange={handleFontUpload} className="hidden" accept=".otf,.ttf,.woff,.woff2"/>
        </div>
    );
};

export default CreativeEditorView;