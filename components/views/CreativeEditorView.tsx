import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import { useHotkeys } from 'react-hotkeys-hook';
// FIX: The default import for '@imgly/background-removal' was causing a type error where the imported module was not callable. Changed to a namespace import to robustly handle module interoperability and access the default export explicitly.
import * as remove from '@imgly/background-removal';
import CreativeEditorHeader from '../CreativeEditorHeader.tsx';
import CreativeEditorSidebar from '../CreativeEditorSidebar.tsx';
import PropertiesPanel from '../PropertiesPanel.tsx';
import LayersPanel from '../LayersPanel.tsx';
import Timeline from '../Timeline.tsx';
import DownloadModal, { DownloadOptions } from '../DownloadModal.tsx';
import ErrorNotification from '../ErrorNotification.tsx';
import BackgroundRemoverModal from '../BackgroundRemoverModal.tsx';
import ProjectBrowserModal from '../ProjectBrowserModal.tsx';
import { 
    ProjectState, Page, AnyLayer, TextLayer, ShapeLayer, ImageLayer, VideoLayer,
    UploadedAsset, PublicAsset, Project, UserProfile, AssetContext
} from '../../types.ts';
import { blobToBase64 } from '../../utils/imageUtils.ts';
import { setItem, getItem, removeItem } from '../../utils/db.ts';
import SelectionBox from '../SelectionBox.tsx';
import { uploadUserAsset, getPublicAssets, adminUploadPublicAsset } from '../../services/databaseService.ts';
import { generateImageFromPrompt } from '../../services/geminiService.ts';
import { IconMinus, IconPlus, IconMaximize } from '../Icons.tsx';
import type { User } from '@supabase/gotrue-js';


// Helper function to load media and return an HTML element
const loadMedia = (src: string, type: 'image' | 'video'): Promise<HTMLImageElement | HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
        if (type === 'image') {
            const element = new Image();
            element.crossOrigin = 'anonymous';
            element.onload = () => resolve(element);
            element.onerror = (err) => reject(new Error(`Failed to load media: ${src.substring(0, 100)}...`));
            element.src = src;
        } else { // video
            const element = document.createElement('video');
            element.crossOrigin = 'anonymous';
            element.muted = true;
            element.loop = true;
            element.playsInline = true;

            const onCanPlay = () => {
                element.removeEventListener('canplay', onCanPlay);
                // A quick play/pause can force the browser to load the first frame for drawing
                element.play().then(() => {
                    element.pause();
                    element.currentTime = 0; // Ensure it's at the start
                    resolve(element);
                }).catch(e => {
                    console.warn("Autoplay was prevented for video loading, but proceeding.", e);
                    // Even if autoplay fails, the video element is likely ready.
                    resolve(element);
                });
            };
            
            element.addEventListener('canplay', onCanPlay);
            element.onerror = (err) => reject(new Error(`Failed to load media: ${src.substring(0, 100)}...`));
            element.src = src;
            element.load();
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

const AUTOSAVE_KEY = 'autosave-creative-editor';


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
    userProfile: (User & UserProfile & { isAdmin: boolean; }) | null;
}

const calculateRequiredHeight = (ctx: CanvasRenderingContext2D, text: string, fontSize: number, layerWidth: number, fontFamily: string, fontWeight: 'normal' | 'bold', lineHeightMultiplier: number): number => {
    if (!text || fontSize <= 0) return 0;
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
    const words = text.split(' ');
    let currentLine = '';
    let lineCount = 1;

    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine.length > 0 ? currentLine + ' ' + words[i] : words[i];
        
        if (ctx.measureText(testLine).width > layerWidth && i > 0 && currentLine.length > 0) {
            lineCount++;
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    return lineCount * fontSize * lineHeightMultiplier;
};

const findOptimalFontSize = (
    ctx: CanvasRenderingContext2D, 
    text: string, 
    layer: Omit<TextLayer, 'id' | 'name' | 'type' | 'x' | 'y' | 'rotation' | 'opacity' | 'isLocked' | 'isVisible'>
): number => {
    let minFont = 1;
    let maxFont = Math.max(layer.height, 300);
    let bestSize = 8; // A default minimum

    while (minFont <= maxFont) {
        let midFont = Math.floor((minFont + maxFont) / 2);
        if (midFont <= 0) return 1;
        
        const requiredHeight = calculateRequiredHeight(ctx, text, midFont, layer.width, layer.fontFamily, layer.fontWeight, layer.lineHeight);
        
        if (requiredHeight <= layer.height && requiredHeight > 0) {
            bestSize = midFont;
            minFont = midFont + 1;
        } else {
            maxFont = midFont - 1;
        }
    }
    return bestSize;
};

const CreativeEditorView: React.FC<CreativeEditorViewProps> = ({ userProfile }) => {
    const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(true);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLoadProjectModalOpen, setIsLoadProjectModalOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [isLoadingAI, setIsLoadingAI] = useState<'remove-bg' | false>(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [interaction, setInteraction] = useState<InteractionState | null>(null);
    const [history, setHistory] = useState<ProjectState[]>([INITIAL_PROJECT]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [publicFonts, setPublicFonts] = useState<PublicAsset[]>([]);
    const [customFonts, setCustomFonts] = useState<string[]>([]);
    const [cropLayerId, setCropLayerId] = useState<string | null>(null);
    const [initialCropState, setInitialCropState] = useState<AnyLayer | null>(null);
    const [playingVideoIds, setPlayingVideoIds] = useState<Set<string>>(new Set());
    const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [bgRemoverState, setBgRemoverState] = useState<{ isOpen: boolean; imageWithTransparency: string | null; originalImage: string | null; layerId: string | null; }>({ isOpen: false, imageWithTransparency: null, originalImage: null, layerId: null });


    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const fileUploadRef = useRef<HTMLInputElement>(null);
    const fontUploadRef = useRef<HTMLInputElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceTimer = useRef<number | null>(null);
    const isInitialMount = useRef(true);


    const assetContext = useContext(AssetContext);
    const activePage = project.pages[activePageIndex];
    const selectedLayers = activePage ? activePage.layers.filter(l => selectedLayerIds.includes(l.id)) : [];
    
    useEffect(() => {
        getPublicAssets().then(assets => {
            const fonts = assets.filter(a => a.asset_type === 'font');
            setPublicFonts(fonts);
            
            const styleId = 'genia-public-fonts';
            let styleEl = document.getElementById(styleId) as HTMLStyleElement;
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            
            let css = '';
            fonts.forEach(font => {
                const fontName = font.name.replace(/\.[^/.]+$/, "");
                css += `@font-face { font-family: '${fontName}'; src: url('${font.asset_url}'); }\n`;
            });
            styleEl.innerHTML = css;
        });
    }, []);
    
    const getSerializableProject = useCallback((name: string): [ProjectState, string] => {
        const projectName = name.trim();
        const projectToSave: ProjectState = {
            ...project,
            name: projectName,
            pages: project.pages.map(page => ({
                ...page,
                layers: page.layers.map(layer => {
                    const { _imageElement, _videoElement, ...rest } = layer as any;
                    return rest;
                })
            }))
        };
        return [projectToSave, projectName];
    }, [project]);

    // Auto-saving logic
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        
        debounceTimer.current = window.setTimeout(() => {
            if (JSON.stringify(project) !== JSON.stringify(INITIAL_PROJECT)) {
                const [serializableProject] = getSerializableProject(project.name);
                setItem(AUTOSAVE_KEY, serializableProject);
            }
        }, 1000);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [project, getSerializableProject]);

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

    const loadProjectState = useCallback(async (newState: ProjectState, isAutoSave = false) => {
        setIsLoadProjectModalOpen(false);
        const pagesToLoad = newState.pages || [];
        
        const loadedPages = await Promise.all(pagesToLoad.map(async (page: Page) => {
          const loadedLayers = await Promise.all(page.layers.map(async (layer: AnyLayer) => {
            if ((layer.type === 'image' || layer.type === 'video') && layer.src) {
              try {
                const mediaElement = await loadMedia(layer.src, layer.type);
                if (layer.type === 'image') (layer as ImageLayer)._imageElement = mediaElement as HTMLImageElement;
                else if (layer.type === 'video') (layer as VideoLayer)._videoElement = mediaElement as HTMLVideoElement;
              } catch (e) { 
                  console.error(`Failed to load media for layer ${layer.id}`, e);
                  setError(`Falha ao carregar mídia para a camada: ${layer.name}`);
              }
            }
            return layer;
          }));
          return { ...page, layers: loadedLayers };
        }));
        
        let finalState = { ...newState, pages: loadedPages };
  
        if (finalState.pages.length === 0) {
            finalState.pages = [JSON.parse(JSON.stringify(DEFAULT_PAGE))];
        }
        
        setProject(finalState);
        setHistory([finalState]);
        setHistoryIndex(0);
        setSelectedLayerIds([]);
        setActivePageIndex(0);

        if (!isAutoSave) {
            await removeItem(AUTOSAVE_KEY);
        }

    }, [setError]);

    // Load auto-saved project on mount
    useEffect(() => {
        const loadAutoSavedProject = async () => {
            const savedState = await getItem<ProjectState>(AUTOSAVE_KEY);
            if (savedState) {
                console.log("Restoring auto-saved project...");
                await loadProjectState(savedState, true);
            }
        };
        loadAutoSavedProject();
    }, [loadProjectState]);

    const handleNewProject = () => {
        if (window.confirm("Tem certeza que deseja limpar a tela e iniciar um novo projeto? Seu trabalho salvo automaticamente será removido.")) {
            loadProjectState(JSON.parse(JSON.stringify(INITIAL_PROJECT)), false);
        }
    };

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

    const onStartCrop = () => {
        if (selectedLayers.length === 1) {
            const layer = selectedLayers[0];
            setInitialCropState(JSON.parse(JSON.stringify(layer)));
            setCropLayerId(layer.id);
        }
    };

    const onApplyCrop = () => {
        setCropLayerId(null);
        setInitialCropState(null);
        commitToHistory(project);
    };

    const onCancelCrop = () => {
        if (initialCropState) {
            updateProject(draft => {
                const page = draft.pages[activePageIndex];
                const layerIndex = page.layers.findIndex(l => l.id === initialCropState.id);
                if (layerIndex !== -1) {
                    const originalLayer = page.layers[layerIndex];
                    const runtimeElements: { _imageElement?: HTMLImageElement; _videoElement?: HTMLVideoElement } = {};
                    if (originalLayer.type === 'image' && initialCropState.type === 'image') {
                        runtimeElements._imageElement = originalLayer._imageElement;
                    } else if (originalLayer.type === 'video' && initialCropState.type === 'video') {
                        runtimeElements._videoElement = originalLayer._videoElement;
                    }
                    page.layers[layerIndex] = { ...initialCropState, ...runtimeElements };
                }
            }, false); 
        }
        setCropLayerId(null);
        setInitialCropState(null);
    };
    
    useHotkeys('ctrl+z, meta+z', (event) => { event.preventDefault(); handleUndo(); }, { enableOnContentEditable: true });
    useHotkeys('ctrl+y, meta+y, ctrl+shift+z, meta+shift+z', (event) => { event.preventDefault(); handleRedo(); }, { enableOnContentEditable: true });
    useHotkeys('backspace, delete', () => { if (!cropLayerId && !editingTextLayerId) deleteSelectedLayers(); });
    useHotkeys('escape', () => { if (cropLayerId) onCancelCrop(); if(editingTextLayerId) textareaRef.current?.blur(); });
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
        const isPublic = 'asset_type' in asset;
        const type = isPublic ? asset.asset_type : asset.type;
        const url = isPublic ? asset.asset_url : asset.url;
        
        if (type === 'font') {
            const fontName = asset.name.replace(/\.[^/.]+$/, "");
            if (selectedLayers.length > 0 && selectedLayers.every(l => l.type === 'text')) {
                updateSelectedLayers({ fontFamily: fontName }, true);
            }
            return;
        }

        if (type === 'brmp') {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error("Failed to fetch project file.");
                const projectJson = await response.json();
                await loadProjectState(projectJson);
            } catch (err) {
                console.error("Failed to load project:", err);
                setError("Não foi possível carregar o ficheiro do projeto.");
            }
            return;
        }

        try {
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
                const newLayer: VideoLayer = { ...newLayerBase, type: 'video', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, startTime: 0, endTime: duration || 0, duration: duration || 0, volume: 1, isMuted: true, _videoElement: mediaElement as HTMLVideoElement };
                addLayer(newLayer);
            } else {
                 const newLayer: ImageLayer = { ...newLayerBase, type: 'image', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, _imageElement: mediaElement as HTMLImageElement };
                 addLayer(newLayer);
            }
        } catch (e) { console.error("Failed to load asset media", e); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !assetContext) return;
        const filesToUpload = Array.from(e.target.files);
        if (filesToUpload.length === 0) return;

        try {
            await Promise.all(filesToUpload.map(file => uploadUserAsset(file, null)));
            await assetContext.refetchAssets();
        } catch (err) {
            console.error("Upload failed:", err);
            setError('Falha no upload do ficheiro.');
        } finally {
            if (e.target) e.target.value = '';
        }
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
        setError(null);

        try {
            const resultBlob = await (remove as any).default(targetLayer.src, {
                publicPath: 'https://unpkg.com/@imgly/background-removal@1.0.4/dist/'
            });
            const resultB64 = await blobToBase64(resultBlob);
            const newImageElement = await loadMedia(resultB64, 'image') as HTMLImageElement;

            updateProject(draft => {
                const page = draft.pages[activePageIndex];
                const layerToUpdate = page.layers.find(l => l.id === targetLayer.id) as ImageLayer;
                if (layerToUpdate) {
                    layerToUpdate.originalSrc = targetLayer.src;
                    layerToUpdate.src = resultB64;
                    layerToUpdate._imageElement = newImageElement;
                    layerToUpdate.mediaNaturalWidth = newImageElement.naturalWidth;
                    layerToUpdate.mediaNaturalHeight = newImageElement.naturalHeight;
                    const aspectRatio = newImageElement.naturalWidth / newImageElement.naturalHeight;
                    layerToUpdate.height = layerToUpdate.width / aspectRatio;
                    layerToUpdate.crop = { x: 0, y: 0, width: newImageElement.naturalWidth, height: newImageElement.naturalHeight };
                    layerToUpdate.scale = layerToUpdate.width / newImageElement.naturalWidth;
                    layerToUpdate.offsetX = 0;
                    layerToUpdate.offsetY = 0;
                }
            }, true);
        } catch (e) {
            console.error("BG Removal Failed:", e);
            const message = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
            setError(`A remoção do fundo falhou. Tente novamente. Detalhes: ${message}`);
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleGenerateImage = async (prompt: string) => {
        setIsGeneratingImage(true);
        setError(null);
        try {
            const base64Image = await generateImageFromPrompt(prompt);
            const tempAsset: PublicAsset = {
                id: nanoid(),
                name: prompt.substring(0, 30),
                asset_type: 'image',
                asset_url: base64Image,
                storage_path: '',
                visibility: 'Public',
                created_at: new Date().toISOString(),
                owner_id: '',
                category_id: null,
                public_asset_categories: null,
            };
            await handleAddAssetToCanvas(tempAsset);
        } catch (e) {
            console.error("Image generation failed:", e);
            const message = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
            setError(`A geração da imagem falhou. Detalhes: ${message}`);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleApplyBgRemoval = async (newImageUrl: string) => {
        if (!bgRemoverState.layerId) return;

        const newImageElement = await loadMedia(newImageUrl, 'image') as HTMLImageElement;

        updateProject(draft => {
            const page = draft.pages[activePageIndex];
            const layerToUpdate = page.layers.find(l => l.id === bgRemoverState.layerId) as ImageLayer;

            if (layerToUpdate) {
                layerToUpdate.src = newImageUrl;
                layerToUpdate._imageElement = newImageElement;
                layerToUpdate.mediaNaturalWidth = newImageElement.naturalWidth;
                layerToUpdate.mediaNaturalHeight = newImageElement.naturalHeight;
                const aspectRatio = newImageElement.naturalWidth / newImageElement.naturalHeight;
                layerToUpdate.height = layerToUpdate.width / aspectRatio;
                layerToUpdate.crop = { x: 0, y: 0, width: newImageElement.naturalWidth, height: newImageElement.naturalHeight };
                layerToUpdate.scale = layerToUpdate.width / newImageElement.naturalWidth;
                layerToUpdate.offsetX = 0;
                layerToUpdate.offsetY = 0;
            }
        }, true);
        setBgRemoverState({ isOpen: false, imageWithTransparency: null, originalImage: null, layerId: null });
    };
    
    const toggleVideoPlayback = useCallback((layerId: string) => {
        if (!activePage) return;
        setPlayingVideoIds(prev => {
            const newSet = new Set<string>();
            const layerToToggle = activePage.layers.find(l => l.id === layerId) as VideoLayer;
    
            if (!layerToToggle?._videoElement) {
                return prev;
            }
    
            prev.forEach(id => {
                const oldLayer = activePage.layers.find(l => l.id === id) as VideoLayer;
                if (oldLayer?._videoElement) {
                    oldLayer._videoElement.pause();
                }
            });
            
            if (!prev.has(layerId)) {
                newSet.add(layerId);
                layerToToggle._videoElement.muted = false; 
                layerToToggle._videoElement.play().catch(e => console.error("Video play failed:", e));
            }
            
            return newSet;
        });
    }, [activePage]);

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

        if (clickedLayer?.type === 'image' && (clickedLayer as ImageLayer).originalSrc) {
            const imageLayer = clickedLayer as ImageLayer;
            setBgRemoverState({
                isOpen: true,
                imageWithTransparency: imageLayer.src,
                originalImage: imageLayer.originalSrc!,
                layerId: imageLayer.id
            });
            return;
        }

        if (clickedLayer?.type === 'text') {
            setEditingTextLayerId(clickedLayer.id);
            setCropLayerId(null);
            return;
        }
        
        if (clickedLayer && (clickedLayer.type === 'image' || clickedLayer.type === 'video')) {
            onStartCrop();
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (editingTextLayerId || !activePage) return;
        
        const handle = (e.target as HTMLElement).dataset.handle as Handle;
        const { x, y } = getCoords(e);
        
        if (cropLayerId) {
            const layer = selectedLayers[0];
            const initialLayerStates = new Map<string, AnyLayer>([[layer.id, {...layer}]]);
            if (!handle) {
                setInteraction({ type: 'pan', layerIds: [layer.id], startX: e.clientX, startY: e.clientY, initialLayerStates });
                return;
            }
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
             if (cropLayerId && cropLayerId !== clickedLayer.id) onCancelCrop();
            const isSelected = selectedLayerIds.includes(clickedLayer.id);
            const newSelectedIds = e.shiftKey ? (isSelected ? selectedLayerIds.filter(id => id !== clickedLayer.id) : [...selectedLayerIds, clickedLayer.id]) : (isSelected && selectedLayerIds.length > 1 ? selectedLayerIds : [clickedLayer.id]);
            setSelectedLayerIds(newSelectedIds);
            const initialLayerStates = new Map<string, AnyLayer>();
            project.pages[activePageIndex].layers.forEach(l => { if (newSelectedIds.includes(l.id)) initialLayerStates.set(l.id, {...l}); });
            setInteraction({ type: 'move', layerIds: newSelectedIds, startX: x, startY: y, initialLayerStates });
        } else {
            if (cropLayerId) onCancelCrop();
            setSelectedLayerIds([]);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!interaction || !activePage) return;
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

                const rad = initialLayer.rotation * Math.PI / 180;
                const cos = Math.cos(rad); const sin = Math.sin(rad);
                const dx = (e.clientX - startX) / zoom;
                const dy = (e.clientY - startY) / zoom;
                const rdx = dx * cos + dy * sin;
                const rdy = -dx * sin + dy * cos;
                const minSize = 20;
                
                let { x: ox, y: oy, width: ow, height: oh } = initialLayer;
                let newX = ox, newY = oy, newW = ow, newH = oh;

                if (handle.includes('r')) newW = Math.max(minSize, ow + rdx);
                if (handle.includes('l')) newW = Math.max(minSize, ow - rdx);
                if (handle.includes('b')) newH = Math.max(minSize, oh + rdy);
                if (handle.includes('t')) newH = Math.max(minSize, oh - rdy);
                
                if (e.shiftKey || !handle.includes('m')) { // Corner handles or shift key
                    const originalAspectRatio = ow / oh;
                    if (handle.includes('l') || handle.includes('r')) {
                        newH = newW / originalAspectRatio;
                    } else {
                        newW = newH * originalAspectRatio;
                    }
                }

                const dw = newW - ow; const dh = newH - oh;
                const d_center_local_x = (handle.includes('l') ? -dw / 2 : dw / 2);
                const d_center_local_y = (handle.includes('t') ? -dh / 2 : dh / 2);
                const d_center_x = d_center_local_x * cos - d_center_local_y * sin;
                const d_center_y = d_center_local_x * sin + d_center_local_y * cos;

                const old_center_x = ox + ow / 2; const old_center_y = oy + oh / 2;
                newX = old_center_x + d_center_x - newW / 2;
                newY = old_center_y + d_center_y - newH / 2;

                const updates: any = { x: newX, y: newY, width: newW, height: newH };

                if (initialLayer.type === 'text') {
                     const ctx = canvasRef.current?.getContext('2d');
                     if(ctx) updates.fontSize = findOptimalFontSize(ctx, initialLayer.text, { ...initialLayer, width: newW, height: newH });
                } else if (initialLayer.type === 'image' || initialLayer.type === 'video') {
                    const mediaLayer = initialLayer as ImageLayer | VideoLayer;
                    if (cropLayerId === mediaLayer.id) {
                        const dx_layer = newX - ox; const dy_layer = newY - oy;
                        const unrotated_dx = dx_layer * cos + dy_layer * sin; const unrotated_dy = -dx_layer * sin + dy_layer * cos;
                        updates.scale = mediaLayer.scale;
                        updates.offsetX = mediaLayer.offsetX - unrotated_dx;
                        updates.offsetY = mediaLayer.offsetY - unrotated_dy;
                    } else {
                        const newScale = newW / mediaLayer.mediaNaturalWidth;
                        updates.scale = newScale;
                        updates.offsetX = (newW - mediaLayer.mediaNaturalWidth * newScale) / 2;
                        updates.offsetY = (newH - mediaLayer.mediaNaturalHeight * newScale) / 2;
                    }
                }
                
                updateProject(draft => {
                    const l = draft.pages[activePageIndex].layers.find(l => l.id === initialLayer.id);
                    if (l && !l.isLocked) Object.assign(l, updates);
                }, false);
            }
        };
        const handleMouseUp = () => {
             if (interaction) {
                if(interaction.type !== 'resize' || cropLayerId === null) {
                    commitToHistory(project);
                }
             }
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
    }, [interaction, updateProject, commitToHistory, zoom, activePageIndex, project, getCoords, cropLayerId, onCancelCrop, activePage]);

    const editingLayer = useMemo(() => {
        if (!editingTextLayerId || !activePage) return null;
        return activePage.layers.find(l => l.id === editingTextLayerId) as TextLayer | undefined;
    }, [editingTextLayerId, activePage]);

    useEffect(() => {
        if (editingLayer && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [editingTextLayerId, editingLayer]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateProject(draft => {
            const layer = draft.pages[activePageIndex].layers.find(l => l.id === editingTextLayerId) as TextLayer;
            if (layer) {
                layer.text = e.target.value;
            }
        });
    };
    
    const handleTextBlur = () => {
        if (editingTextLayerId) {
            commitToHistory(project);
            setEditingTextLayerId(null);
        }
    };

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

            if (layer.id === editingTextLayerId) return;
    
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
                ctx.letterSpacing = `${layer.letterSpacing || 0}px`;
                
                let textToDraw = layer.text;
                if (layer.textTransform === 'uppercase') {
                    textToDraw = textToDraw.toUpperCase();
                } else if (layer.textTransform === 'lowercase') {
                    textToDraw = textToDraw.toLowerCase();
                }

                let textDrawX = drawX;
                if (layer.textAlign === 'center') textDrawX += layer.width / 2;
                else if (layer.textAlign === 'right') textDrawX += layer.width;

                const words = textToDraw.split(' ');
                let line = '';
                let currentY = drawY;
                const lineHeight = layer.fontSize * layer.lineHeight;

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;
                    if (testWidth > layer.width && n > 0) {
                        ctx.fillText(line, textDrawX, currentY);
                        line = words[n] + ' ';
                        currentY += lineHeight;
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line, textDrawX, currentY);

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
    }, [project, activePageIndex, editingTextLayerId]);
    
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
        playingVideoIds.forEach(id => {
            project.pages.forEach(p => {
                const layer = p.layers.find(l => l.id === id) as VideoLayer;
                if (layer?._videoElement) {
                    layer._videoElement.pause();
                    layer._videoElement.currentTime = 0;
                }
            });
        });
        setPlayingVideoIds(new Set());
    }, [activePageIndex, project.pages]);


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
    
    const calculateFitZoom = useCallback(() => {
        if (canvasContainerRef.current && activePage) {
            const padding = 64; // px
            const container = canvasContainerRef.current;
            const availableWidth = container.clientWidth - padding;
            const availableHeight = container.clientHeight - padding;
    
            const scaleX = availableWidth / activePage.width;
            const scaleY = availableHeight / activePage.height;
            
            setZoom(Math.min(scaleX, scaleY));
        }
    }, [activePage]);
    
    useEffect(() => {
        calculateFitZoom();
        const container = canvasContainerRef.current;
        if (!container) return;
        const resizeObserver = new ResizeObserver(() => calculateFitZoom());
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [calculateFitZoom]);

    const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 3));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.1));

    const handleSaveProject = useCallback(async () => {
        const name = prompt("Digite o nome do projeto:", project.name);
        if (!name) return;
        const [projectToSave, projectName] = getSerializableProject(name);
        const projectJson = JSON.stringify(projectToSave);
        const file = new File([projectJson], `${projectName}.brmp`, { type: 'application/json' });

        try {
            await uploadUserAsset(file, null);
            alert('Projeto salvo com sucesso nos seus recursos!');
            assetContext?.refetchAssets();
        } catch (err) {
            console.error(err);
            setError('Falha ao salvar o projeto.');
        }
    }, [assetContext, getSerializableProject, project.name]);
    
    const handleSaveProjectToComputer = () => {
        const [projectToSave, projectName] = getSerializableProject(project.name || 'Projeto sem Título');
        const projectJson = JSON.stringify(projectToSave, null, 2);
        const blob = new Blob([projectJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}.brmp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSaveProjectAsPublic = async () => {
        if (!userProfile?.isAdmin) {
            setError("Apenas administradores podem salvar modelos públicos.");
            return;
        }
        const name = prompt("Digite o nome do modelo público:", project.name);
        if (!name) return;

        const [projectToSave, projectName] = getSerializableProject(name);
        const projectJson = JSON.stringify(projectToSave);
        const file = new File([projectJson], `${projectName}.brmp`, { type: 'application/json' });
        
        try {
            await adminUploadPublicAsset(file, 'Public', null);
            alert('Modelo de projeto salvo publicamente com sucesso!');
        } catch (err) {
            console.error(err);
            setError('Falha ao salvar o modelo público.');
        }
    };
    
    const handleDeletePage = (index: number) => {
        if (project.pages.length <= 1) {
            alert("Não é possível apagar a última página.");
            return;
        }
        updateProject(draft => {
            draft.pages.splice(index, 1);
        }, true);
        setActivePageIndex(prev => Math.max(0, Math.min(prev, project.pages.length - 2)));
    };
    
    const handleDuplicatePage = (index: number) => {
        updateProject(draft => {
            const pageToDuplicate = draft.pages[index];
            if (pageToDuplicate) {
                const newPage: Page = {
                    ...JSON.parse(JSON.stringify(pageToDuplicate)),
                    id: nanoid(),
                    name: `${pageToDuplicate.name} Cópia`,
                };
                draft.pages.splice(index + 1, 0, newPage);
                setActivePageIndex(index + 1);
            }
        }, true);
    };

    return (
        <div className="h-full w-full flex flex-col bg-brand-accent text-white">
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <BackgroundRemoverModal
                isOpen={bgRemoverState.isOpen}
                onClose={() => setBgRemoverState({ isOpen: false, imageWithTransparency: null, originalImage: null, layerId: null })}
                imageWithTransparency={bgRemoverState.imageWithTransparency}
                originalImage={bgRemoverState.originalImage}
                onApply={handleApplyBgRemoval}
            />
            <ProjectBrowserModal
                isOpen={isLoadProjectModalOpen}
                onClose={() => setIsLoadProjectModalOpen(false)}
                onLoadProject={(p) => loadProjectState(p, false)}
            />
            <CreativeEditorHeader
                projectName={project.name}
                onProjectNameChange={name => updateProject(draft => { draft.name = name; }, false)}
                onUndo={handleUndo} onRedo={handleRedo} canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1}
                selectedLayers={selectedLayers}
                onUpdateSelectedLayers={(update) => updateSelectedLayers(update, false)}
                onCommitHistory={() => commitToHistory(project)}
                onDeleteLayers={deleteSelectedLayers} onDuplicateLayers={onDuplicateLayers} onReorderLayers={onReorderLayers}
                backgroundColor={activePage?.backgroundColor || '#FFFFFF'}
                onBackgroundColorChange={color => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.backgroundColor = color; }, false)}
                customFonts={customFonts}
                publicFonts={publicFonts.map(f => f.name.replace(/\.[^/.]+$/, ""))}
                onTriggerFontUpload={() => fontUploadRef.current?.click()}
            />
            <div className="flex-grow flex min-h-0">
                <CreativeEditorSidebar
                    onAddTextLayer={handleAddTextLayer} onAddShapeLayer={handleAddShapeLayer}
                    onTriggerUpload={() => fileUploadRef.current?.click()}
                    uploadedAssets={assetContext?.assets || []}
                    onAddAssetToCanvas={handleAddAssetToCanvas}
                    onToggleLayersPanel={() => setIsLayersPanelOpen(p => !p)}
                    onSaveProject={handleSaveProject} 
                    onLoadProject={() => setIsLoadProjectModalOpen(true)} 
                    onAITool={handleAITool}
                    isLoadingAI={isLoadingAI} selectedLayers={selectedLayers}
                    onGenerateImage={handleGenerateImage}
                    isGeneratingImage={isGeneratingImage}
                />
                <main ref={canvasContainerRef} className="flex-grow flex items-center justify-center p-8 bg-gray-800 relative overflow-hidden">
                    {activePage && (
                        <div className="relative shadow-2xl" style={{ width: activePage.width, height: activePage.height, transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                            <canvas ref={canvasRef} />
                            <div className="absolute top-0 left-0 w-full h-full" onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick}>
                               <SelectionBox 
                                    layers={selectedLayers} 
                                    zoom={zoom} 
                                    cropLayerId={cropLayerId}
                                    playingVideoIds={playingVideoIds}
                                    onToggleVideoPlayback={toggleVideoPlayback}
                                />
                                 {editingLayer && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: editingLayer.x,
                                            top: editingLayer.y,
                                            width: editingLayer.width,
                                            height: editingLayer.height,
                                            transform: `rotate(${editingLayer.rotation}deg)`,
                                            transformOrigin: 'center center',
                                        }}
                                    >
                                        <textarea
                                            ref={textareaRef}
                                            value={editingLayer.text}
                                            onChange={handleTextChange}
                                            onBlur={handleTextBlur}
                                            onMouseDown={e => e.stopPropagation()}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                background: 'transparent',
                                                border: '1px dashed rgba(255, 255, 255, 0.7)',
                                                outline: 'none',
                                                resize: 'none',
                                                overflow: 'hidden',
                                                padding: 0,
                                                color: editingLayer.color,
                                                fontFamily: `"${editingLayer.fontFamily}"`,
                                                fontSize: editingLayer.fontSize,
                                                fontWeight: editingLayer.fontWeight,
                                                fontStyle: editingLayer.fontStyle,
                                                textAlign: editingLayer.textAlign,
                                                lineHeight: editingLayer.lineHeight,
                                                letterSpacing: `${editingLayer.letterSpacing}px`,
                                                textTransform: editingLayer.textTransform,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                     <div className="absolute bottom-4 right-4 z-10 bg-brand-dark/80 backdrop-blur-sm rounded-lg text-white flex items-center p-1 shadow-lg">
                        <button onClick={handleZoomOut} className="p-2 hover:bg-brand-light rounded-md" title="Diminuir zoom"><IconMinus className="w-5 h-5"/></button>
                        <button onClick={() => setZoom(1)} className="px-3 text-sm font-semibold" title="Redefinir para 100%">{Math.round(zoom * 100)}%</button>
                        <button onClick={handleZoomIn} className="p-2 hover:bg-brand-light rounded-md" title="Aumentar zoom"><IconPlus className="w-5 h-5"/></button>
                        <div className="w-px h-5 bg-brand-accent/50 mx-1"></div>
                        <button onClick={calculateFitZoom} className="p-2 hover:bg-brand-light rounded-md" title="Ajustar à tela"><IconMaximize className="w-5 h-5"/></button>
                    </div>
                </main>
                <PropertiesPanel
                    selectedLayers={selectedLayers}
                    onUpdateLayers={(update) => updateSelectedLayers(update, false)}
                    onCommitHistory={() => commitToHistory(project)}
                    canvasWidth={activePage?.width || 1080}
                    canvasHeight={activePage?.height || 1080}
                    onCanvasSizeChange={(w, h) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) {p.width = w; p.height = h;} }, true)}
                    onSaveProject={handleSaveProject}
                    onLoadProject={() => setIsLoadProjectModalOpen(true)}
                    onDownload={() => setIsDownloadModalOpen(true)}
                    cropLayerId={cropLayerId}
                    onStartCrop={onStartCrop}
                    onApplyCrop={onApplyCrop}
                    onCancelCrop={onCancelCrop}
                    userProfile={userProfile}
                    onSaveProjectAsPublic={handleSaveProjectAsPublic}
                    onSaveProjectToComputer={handleSaveProjectToComputer}
                    onNewProject={handleNewProject}
                />
                <AnimatePresence>
                    {isLayersPanelOpen && activePage && (
                        <LayersPanel
                            isOpen={isLayersPanelOpen} onClose={() => setIsLayersPanelOpen(false)} layers={activePage.layers} selectedLayerIds={selectedLayerIds}
                            onSelectLayer={(id, shiftKey) => setSelectedLayerIds(prev => shiftKey ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : [id])}
                            onReorderLayers={(reordered) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers = reordered; }, true)}
                            onToggleLayerLock={(id) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers.forEach(l => { if(l.id === id) l.isLocked = !l.isLocked; }); }, true)}
                        />
                    )}
                </AnimatePresence>
            </div>
            <Timeline 
                pages={project.pages} 
                activePageIndex={activePageIndex} 
                onSelectPage={setActivePageIndex} 
                onAddPage={() => updateProject(draft => {
                    const newPage: Page = {
                        id: nanoid(), name: `Página ${draft.pages.length + 1}`, layers: [], duration: 5000,
                        backgroundColor: '#FFFFFF', width: 1080, height: 1080,
                    };
                    draft.pages.push(newPage);
                    setActivePageIndex(draft.pages.length - 1);
                }, true)} 
                onDeletePage={handleDeletePage} 
                onDuplicatePage={handleDuplicatePage} 
                onReorderPages={(pages) => updateProject(draft => { draft.pages = pages; }, true)}
                onPageDurationChange={(index, duration) => updateProject(draft => { const p = draft.pages[index]; if(p) p.duration = duration; }, false)} 
                projectTime={0} 
                isPlaying={false} 
                onPlayPause={() => {}} 
            />
            <input type="file" ref={fileUploadRef} onChange={handleFileUpload} multiple className="hidden" accept="image/*,video/*"/>
            <input type="file" ref={fontUploadRef} onChange={handleFontUpload} className="hidden" accept=".otf,.ttf,.woff,.woff2"/>
        </div>
    );
};

export default CreativeEditorView;