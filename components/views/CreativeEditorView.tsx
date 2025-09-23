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
    UploadedAsset, PublicAsset, Project, UserProfile, AssetContext, DownloadJob, AudioTrack
} from '../../types.ts';
import { blobToBase64, toBase64 } from '../../utils/imageUtils.ts';
import { setItem, getItem, removeItem } from '../../utils/db.ts';
import SelectionBox from '../SelectionBox.tsx';
import { uploadUserAsset, getPublicAssets, adminUploadPublicProject, createSignedUrlForPath } from '../../services/databaseService.ts';
import { generateImageFromPrompt } from '../../geminiService.ts';
import { IconMinus, IconPlus, IconMaximize } from '../Icons.tsx';
import type { User } from '@supabase/gotrue-js';
import JSZip from 'jszip';
import ExportProgressModal from '../ExportProgressModal.tsx';
import ContextMenu from '../ContextMenu.tsx';


// Helper function to load media and return an HTML element
const loadMedia = (src: string, type: 'image' | 'video'): Promise<HTMLImageElement | HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
        if (!src || typeof src !== 'string') {
            return reject(new Error('Fonte de mídia inválida ou ausente.'));
        }

        if (type === 'image') {
            const element = new Image();
            element.crossOrigin = 'anonymous';
            element.onload = () => resolve(element);
            element.onerror = (err) => reject(new Error(`Falha ao carregar a mídia: ${src.substring(0, 100)}...`));
            element.src = src;
        } else { // video
            const element = document.createElement('video');
            element.crossOrigin = 'anonymous';
            element.muted = true;
            element.loop = true;
            element.playsInline = true;

            const onCanPlay = () => {
                element.removeEventListener('canplay', onCanPlay);
                element.play().then(() => {
                    element.pause();
                    element.currentTime = 0; 
                    resolve(element);
                }).catch(e => {
                    console.warn("A reprodução automática foi impedida para o carregamento do vídeo, mas a continuar.", e);
                    resolve(element);
                });
            };
            
            element.addEventListener('canplay', onCanPlay);
            element.onerror = (err) => reject(new Error(`Falha ao carregar a mídia: ${src.substring(0, 100)}...`));
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
    centerX?: number;
    centerY?: number;
    startAngle?: number;
}

interface CreativeEditorViewProps {
    userProfile: (User & UserProfile & { isAdmin: boolean; }) | null;
}

const deepCloneWithElements = <T extends any>(obj: T, visited = new WeakMap()): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof HTMLElement) return obj;
    if (visited.has(obj)) return visited.get(obj);
    if (Array.isArray(obj)) {
        const newArr: any[] = [];
        visited.set(obj, newArr);
        obj.forEach(item => { newArr.push(deepCloneWithElements(item, visited)); });
        return newArr as any;
    }
    const newObj: { [key: string]: any } = {};
    visited.set(obj, newObj);
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = deepCloneWithElements((obj as any)[key], visited);
        }
    }
    return newObj as T;
};


const CreativeEditorView: React.FC<CreativeEditorViewProps> = ({ userProfile }) => {
    const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(true);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLoadProjectModalOpen, setIsLoadProjectModalOpen] = useState(false);
    const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
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
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);
    const [liveEditText, setLiveEditText] = useState('');

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
    
    const hasVideoOrAudio = useMemo(() => {
        const hasVideo = project.pages.some(p => p.layers.some(l => l.type === 'video'));
        const hasAudio = project.audioTracks.length > 0;
        const videoLayersWithAudio = project.pages.flatMap(p => p.layers)
            .some(l => l.type === 'video' && (l as VideoLayer).volume > 0 && !(l as VideoLayer).isMuted);
        return hasVideo || hasAudio || videoLayersWithAudio;
    }, [project]);
    
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
                    const { _imageElement, _videoElement, originalImage, ...rest } = layer as any;
                    return rest;
                })
            }))
        };
        return [projectToSave, projectName];
    }, [project]);

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
            const draft = deepCloneWithElements(currentProject);
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
            finalState.pages = [deepCloneWithElements(DEFAULT_PAGE)];
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

    useEffect(() => {
        getItem<ProjectState>(AUTOSAVE_KEY).then(savedState => {
            if (savedState) {
                console.log("Restoring auto-saved project...");
                loadProjectState(savedState, true);
            }
        });
    }, [loadProjectState]);

    const handleNewProject = () => {
        if (window.confirm("Tem certeza que deseja limpar a tela e iniciar um novo projeto? Seu trabalho salvo automaticamente será removido.")) {
            loadProjectState(deepCloneWithElements(INITIAL_PROJECT), false);
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
                const newLayer = deepCloneWithElements(layer);
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
            setInitialCropState(deepCloneWithElements(layer));
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
                    if (originalLayer.type === 'image' && 'src' in originalLayer) {
                        runtimeElements._imageElement = (originalLayer as ImageLayer)._imageElement;
                    } else if (originalLayer.type === 'video' && 'src' in originalLayer) {
                        runtimeElements._videoElement = (originalLayer as VideoLayer)._videoElement;
                    }
                    page.layers[layerIndex] = { ...deepCloneWithElements(initialCropState), ...runtimeElements };
                }
            }, false); 
        }
        setCropLayerId(null);
        setInitialCropState(null);
    };
    
    useHotkeys('ctrl+z, meta+z', (event) => { event.preventDefault(); handleUndo(); }, { enableOnContentEditable: true });
    useHotkeys('ctrl+y, meta+y, ctrl+shift+z, meta+shift+z', (event) => { event.preventDefault(); handleRedo(); }, { enableOnContentEditable: true });
    useHotkeys('backspace, delete', () => { if (!cropLayerId && !editingTextLayerId) deleteSelectedLayers(); });
    useHotkeys('escape', () => { if (cropLayerId) onCancelCrop(); if(editingTextLayerId) textareaRef.current?.blur(); if(contextMenu) setContextMenu(null); });
    useHotkeys('ctrl+d, meta+d', (event) => { event.preventDefault(); onDuplicateLayers(); });

    const addLayer = useCallback((newLayer: Partial<AnyLayer>) => {
        const layerDefaults = { id: nanoid(), name: 'Nova Camada', x: 50, y: 50, rotation: 0, opacity: 1, isLocked: false, isVisible: true, width: 200, height: 200 };
        const finalLayer = { ...layerDefaults, ...newLayer } as AnyLayer;
        
        setProject(currentProject => {
            const newProject = deepCloneWithElements(currentProject);
            const newPages = [...newProject.pages];
            const newLayers = [...newPages[activePageIndex].layers, finalLayer];
            newPages[activePageIndex] = { ...newPages[activePageIndex], layers: newLayers };
            const finalState = { ...newProject, pages: newPages };
            commitToHistory(finalState);
            return finalState;
        });

        setSelectedLayerIds([finalLayer.id]);
    }, [activePageIndex, commitToHistory]);

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
    
    const handleAddAssetToCanvas = async (asset: UploadedAsset | PublicAsset, dropCoords?: { x: number, y: number }) => {
        const isPublic = 'asset_type' in asset;
        const type = isPublic ? asset.asset_type : asset.type;
    
        if (type === 'font' || type === 'brmp' || type === 'audio') {
            if (type === 'font') {
                const fontName = asset.name.replace(/\.[^/.]+$/, "");
                if (selectedLayers.length > 0 && selectedLayers.every(l => l.type === 'text')) {
                    updateSelectedLayers({ fontFamily: fontName }, true);
                }
                return;
            }
            if (type === 'brmp') {
                const url = isPublic ? asset.asset_url : asset.storage_path;
                try {
                    if (!url || typeof url !== 'string') throw new Error("URL do projeto inválido.");
                    let projectUrl = isPublic ? url : await createSignedUrlForPath(url);
                    const response = await fetch(projectUrl);
                    if (!response.ok) throw new Error("Falha ao buscar o arquivo do projeto.");
                    const projectJson = await response.json();
                    await loadProjectState(projectJson);
                } catch (err) {
                    console.error("Failed to load project:", err);
                    setError("Não foi possível carregar o ficheiro do projeto.");
                }
                return;
            }
            if (type === 'audio') {
                 const newTrack: AudioTrack = {
                    id: nanoid(),
                    name: asset.name,
                    src: 'asset_url' in asset ? asset.asset_url : asset.url,
                    startTime: 0,
                    volume: 1,
                    assetId: asset.id,
                };
                updateProject(draft => {
                    draft.audioTracks.push(newTrack);
                }, true);
                return;
            }
        }
    
        let base64Src: string;
        try {
            let mediaUrlToFetch: string;
    
            if ('asset_type' in asset) { // Public Asset
                if (!asset.asset_url) throw new Error("O URL do recurso público está ausente.");
                mediaUrlToFetch = asset.asset_url;
            } else { // User Asset
                const userAsset = asset as UploadedAsset;
                if (!userAsset.storage_path) throw new Error("O caminho de armazenamento para o recurso do utilizador está ausente.");
                mediaUrlToFetch = await createSignedUrlForPath(userAsset.storage_path);
            }
    
            if (!mediaUrlToFetch) {
                throw new Error("URL do recurso é inválido ou está ausente.");
            }
    
            const response = await fetch(mediaUrlToFetch);
            if (!response.ok) {
                throw new Error(`Falha ao buscar o recurso (status: ${response.status}). O URL pode ter expirado ou ser inválido.`);
            }
            const blob = await response.blob();
            base64Src = await blobToBase64(blob);
    
            const mediaElement = await loadMedia(base64Src, type === 'video' ? 'video' : 'image');
            
            let naturalWidth: number, naturalHeight: number, duration: number | undefined;
            if (mediaElement instanceof HTMLVideoElement) {
                naturalWidth = mediaElement.videoWidth;
                naturalHeight = mediaElement.videoHeight;
                duration = mediaElement.duration;
            } else {
                naturalWidth = mediaElement.naturalWidth;
                naturalHeight = mediaElement.naturalHeight;
            }
    
            const canvasWidth = activePage.width;
            const canvasHeight = activePage.height;
            let scaleToFit = Math.min(canvasWidth / naturalWidth, canvasHeight / naturalHeight) * 0.9;
            if (scaleToFit > 1) scaleToFit = 1;
    
            const layerWidth = naturalWidth * scaleToFit;
            const layerHeight = naturalHeight * scaleToFit;
            
            const newLayerBase = { 
                name: asset.name, src: base64Src, assetId: asset.id,
                x: dropCoords ? dropCoords.x - layerWidth / 2 : (canvasWidth - layerWidth) / 2,
                y: dropCoords ? dropCoords.y - layerHeight / 2 : (canvasHeight - layerHeight) / 2,
                width: layerWidth, height: layerHeight, 
                mediaNaturalWidth: naturalWidth, mediaNaturalHeight: naturalHeight, 
                scale: 1, offsetX: 0, offsetY: 0,
                crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight } 
            };
            
            if (type === 'video') {
                const newLayer: VideoLayer = { ...newLayerBase, type: 'video', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, startTime: 0, endTime: duration || 0, duration: duration || 0, volume: 1, isMuted: false, _videoElement: mediaElement as HTMLVideoElement };
                addLayer(newLayer);
            } else {
                 const newLayer: ImageLayer = { ...newLayerBase, type: 'image', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, _imageElement: mediaElement as HTMLImageElement };
                 addLayer(newLayer);
            }
        } catch (e) {
            console.error("Falha ao carregar a mídia do recurso", e);
            const message = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
            setError(`Não foi possível carregar o recurso '${asset.name}'. Detalhes: ${message}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !assetContext) return;
        const filesToUpload = Array.from(e.target.files);
        if (filesToUpload.length === 0) return;

        try {
            await Promise.all(filesToUpload.map((file: File) => uploadUserAsset(file, null)));
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
            const resultBlob = await remove.default(targetLayer.src, {
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
                    layerToUpdate.scale = 1;
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
                layerToUpdate.scale = 1;
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
    
            if (!layerToToggle?._videoElement || typeof layerToToggle._videoElement.play !== 'function') {
                console.error("Tentativa de reproduzir um elemento de vídeo inválido. Verifique o estado do projeto.");
                return prev;
            }
    
            prev.forEach(id => {
                const oldLayer = activePage.layers.find(l => l.id === id) as VideoLayer;
                if (oldLayer?._videoElement && typeof oldLayer._videoElement.pause === 'function') {
                    oldLayer._videoElement.pause();
                }
            });
            
            if (!prev.has(layerId)) {
                newSet.add(layerId);
                layerToToggle._videoElement.muted = false; 
                layerToToggle._videoElement.play().catch(e => console.error("A reprodução do vídeo falhou:", e));
            }
            
            return newSet;
        });
    }, [activePage]);

    const getCoords = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent | React.DragEvent<HTMLDivElement>): { x: number, y: number } => {
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

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const { x, y } = getCoords(e);
        const clickedLayer = getLayerAtPoint(x, y);
        if (clickedLayer) {
            if (!selectedLayerIds.includes(clickedLayer.id)) {
                setSelectedLayerIds([clickedLayer.id]);
            }
            setContextMenu({ x: e.clientX, y: e.clientY, layerId: clickedLayer.id });
        } else {
            setContextMenu(null);
        }
    };
    
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

        if (clickedLayer?.type === 'text' && !editingTextLayerId) {
            setEditingTextLayerId(clickedLayer.id);
            setLiveEditText((clickedLayer as TextLayer).text);
            setCropLayerId(null);
            return;
        }
        
        if (clickedLayer && (clickedLayer.type === 'image' || clickedLayer.type === 'video')) {
            onStartCrop();
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button === 2) return; 
        if (contextMenu) setContextMenu(null);

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

                const rad = -initialLayer.rotation * Math.PI / 180;
                const cos = Math.cos(rad); const sin = Math.sin(rad);
                const dx_mouse = (e.clientX - startX) / zoom;
                const dy_mouse = (e.clientY - startY) / zoom;
                
                const rdx = dx_mouse * cos + dy_mouse * sin;
                const rdy = -dx_mouse * sin + dy_mouse * cos;

                const minSize = 20;
                
                let { x: ox, y: oy, width: ow, height: oh } = initialLayer;
                
                const updates: Partial<AnyLayer> = {};
                
                let newW = ow, newH = oh, newX = ox, newY = oy;

                if (handle.includes('r')) newW = Math.max(minSize, ow + rdx);
                if (handle.includes('l')) newW = Math.max(minSize, ow - rdx);
                if (handle.includes('b')) newH = Math.max(minSize, oh + rdy);
                if (handle.includes('t')) newH = Math.max(minSize, oh - rdy);
                
                const dw = newW - ow;
                const dh = newH - oh;
                
                if (handle.includes('l')) {
                    const dx_world = dw * cos;
                    const dy_world = dw * sin;
                    newX -= dx_world;
                    newY -= dy_world;
                }
                if (handle.includes('t')) {
                    const dx_world = -dh * sin;
                    const dy_world = dh * cos;
                    newX -= dx_world;
                    newY -= dy_world;
                }
                
                updates.x = newX;
                updates.y = newY;
                updates.width = newW;
                updates.height = newH;
                
                if (initialLayer.type === 'image' || initialLayer.type === 'video') {
                    // Side handles no longer adjust scale to prevent distortion. They only "crop".
                } else if (initialLayer.type === 'text') {
                    const widthScaleFactor = newW / ow;
                    (updates as TextLayer).fontSize = Math.max(8, (initialLayer as TextLayer).fontSize * widthScaleFactor);
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
            const textarea = textareaRef.current;
            textarea.value = liveEditText; 
            textarea.style.height = 'auto'; 
            textarea.style.height = `${textarea.scrollHeight}px`; 
            textarea.focus();
            textarea.select();
        }
    }, [editingLayer, liveEditText]);

    const handleLiveTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLiveEditText(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };
    
    const handleTextBlur = () => {
        if (editingTextLayerId) {
            updateProject(draft => {
                const layer = draft.pages[activePageIndex].layers.find(l => l.id === editingTextLayerId) as TextLayer;
                if (layer && layer.text !== liveEditText) {
                    layer.text = liveEditText;
                }
            }, true);
            setEditingTextLayerId(null);
        }
    };
    
    const drawLiveCanvas = useCallback(() => {
        if (!activePage || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
    
        canvas.width = activePage.width;
        canvas.height = activePage.height;
    
        ctx.fillStyle = activePage.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        for (const layer of activePage.layers) {
            if (!layer.isVisible) continue;
            
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
            ctx.rotate(layer.rotation * Math.PI / 180);

            if (layer.flipH) ctx.scale(-1, 1);
            if (layer.flipV) ctx.scale(1, -1);
            
            const drawX = -layer.width / 2;
            const drawY = -layer.height / 2;
    
            if ((layer.type === 'image' || layer.type === 'video')) {
                const mediaLayer = layer as ImageLayer | VideoLayer;
                const mediaElement = mediaLayer.type === 'video' ? mediaLayer._videoElement : mediaLayer._imageElement;
                
                if (mediaElement && (('naturalWidth' in mediaElement && mediaElement.naturalWidth > 0) || ('videoWidth' in mediaElement && mediaElement.videoWidth > 0))) {
                    ctx.beginPath();
                    ctx.rect(drawX, drawY, layer.width, layer.height);
                    ctx.clip();
                    
                    const croppedWidth = mediaLayer.crop.width;
                    const croppedHeight = mediaLayer.crop.height;

                    const scaleX = layer.width / croppedWidth;
                    const scaleY = layer.height / croppedHeight;
                    const scale = Math.max(scaleX, scaleY);
                    
                    const contentWidth = mediaLayer.mediaNaturalWidth * scale;
                    const contentHeight = mediaLayer.mediaNaturalHeight * scale;
                    
                    ctx.drawImage(mediaElement, drawX - mediaLayer.offsetX, drawY - mediaLayer.offsetY, contentWidth, contentHeight);
                }
            } else if (layer.type === 'text' && layer.id !== editingTextLayerId) {
                 const textLayer = layer as TextLayer;
                 ctx.font = `${textLayer.fontStyle} ${textLayer.fontWeight} ${textLayer.fontSize}px "${textLayer.fontFamily}"`;
                 ctx.fillStyle = textLayer.color;
                 ctx.textAlign = textLayer.textAlign;
                 ctx.textBaseline = 'top';
                 
                 let textDrawX = drawX;
                 if (textLayer.textAlign === 'center') textDrawX += textLayer.width / 2;
                 else if (textLayer.textAlign === 'right') textDrawX += textLayer.width;
 
                 const lines = textLayer.text.split('\n');
                 lines.forEach((line, index) => {
                     ctx.fillText(line, textDrawX, drawY + index * textLayer.fontSize * textLayer.lineHeight);
                 });
            } else if (layer.type === 'shape') {
                const shapeLayer = layer as ShapeLayer;
                ctx.fillStyle = shapeLayer.fill;
                if(shapeLayer.shape === 'rectangle') ctx.fillRect(drawX, drawY, layer.width, layer.height);
                else { ctx.beginPath(); ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, 2 * Math.PI); ctx.fill(); }
            }
            ctx.restore();
        }
    }, [activePage, editingTextLayerId]);

    const drawPageToCanvasForExport = useCallback(async (
        page: Page, 
        canvas: HTMLCanvasElement | OffscreenCanvas, 
        options: { transparent: boolean, time?: number },
        preloadedMedia: Map<string, HTMLImageElement | HTMLVideoElement>
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context for export.");

        canvas.width = page.width;
        canvas.height = page.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!options.transparent) {
            ctx.fillStyle = page.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        for (const layer of page.layers) {
             if (!layer.isVisible) continue;
             
             ctx.save();
             ctx.globalAlpha = layer.opacity;
             ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
             ctx.rotate(layer.rotation * Math.PI / 180);
             if (layer.flipH) ctx.scale(-1, 1);
             if (layer.flipV) ctx.scale(1, -1);
             const drawX = -layer.width / 2;
             const drawY = -layer.height / 2;

            if (layer.type === 'image' || layer.type === 'video') {
                const mediaLayer = layer as ImageLayer | VideoLayer;
                const mediaElement = preloadedMedia.get(mediaLayer.src);

                if (!mediaElement) {
                    console.warn(`Media source not found in preloaded map for layer ${mediaLayer.name}. Skipping render.`);
                    ctx.restore();
                    continue;
                }
                
                if (mediaLayer.type === 'video' && mediaElement instanceof HTMLVideoElement && options.time !== undefined) {
                    const pagesForExport = project.pages.map(page => {
                        const videoLayers = page.layers.filter(l => l.type === 'video') as VideoLayer[];
                        const maxLayerDuration = videoLayers.length > 0 ? Math.max(...videoLayers.map(l => l.duration * 1000)) : 0;
                        return { ...page, duration: Math.max(page.duration, maxLayerDuration) };
                    });
                    const pageIndex = pagesForExport.findIndex(p => p.id === page.id);
                    const timeBeforePage = pagesForExport.slice(0, pageIndex).reduce((acc, d) => acc + d.duration, 0);
                    
                    const timeOnPage = options.time - timeBeforePage;
                    const videoTime = (timeOnPage / 1000) - mediaLayer.startTime;
                    
                    if (videoTime >= 0 && videoTime <= mediaLayer.duration) {
                        mediaElement.pause();
                        mediaElement.currentTime = videoTime;
                        await new Promise<void>((resolve, reject) => {
                            const onSeeked = () => {
                                mediaElement.removeEventListener('seeked', onSeeked);
                                mediaElement.removeEventListener('error', onError);
                                resolve();
                            };
                            const onError = (e: Event) => {
                                mediaElement.removeEventListener('seeked', onSeeked);
                                mediaElement.removeEventListener('error', onError);
                                reject(new Error('Video seek failed'));
                            };
                            mediaElement.addEventListener('seeked', onSeeked);
                            mediaElement.addEventListener('error', onError);
                        });
                    }
                }

                ctx.beginPath();
                ctx.rect(drawX, drawY, layer.width, layer.height);
                ctx.clip();
                
                const contentWidth = mediaLayer.mediaNaturalWidth * mediaLayer.scale;
                const contentHeight = mediaLayer.mediaNaturalHeight * mediaLayer.scale;
                
                ctx.drawImage(mediaElement, drawX - mediaLayer.offsetX, drawY - mediaLayer.offsetY, contentWidth, contentHeight);
            } else if (layer.type === 'text') {
                const textLayer = layer as TextLayer;
                ctx.font = `${textLayer.fontStyle} ${textLayer.fontWeight} ${textLayer.fontSize}px "${textLayer.fontFamily}"`;
                ctx.fillStyle = textLayer.color;
                ctx.textAlign = textLayer.textAlign;
                ctx.textBaseline = 'top';
                
                let textDrawX = drawX;
                if (textLayer.textAlign === 'center') textDrawX += textLayer.width / 2;
                else if (textLayer.textAlign === 'right') textDrawX += textLayer.width;

                const lines = textLayer.text.split('\n');
                lines.forEach((line, index) => {
                    ctx.fillText(line, textDrawX, drawY + index * textLayer.fontSize * textLayer.lineHeight);
                });
            } else if (layer.type === 'shape') {
                const shapeLayer = layer as ShapeLayer;
                ctx.fillStyle = shapeLayer.fill;
                if(shapeLayer.shape === 'rectangle') ctx.fillRect(drawX, drawY, layer.width, layer.height);
                else { ctx.beginPath(); ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, 2 * Math.PI); ctx.fill(); }
            }
            ctx.restore();
        }
    }, [project.pages]);

    useEffect(() => {
        const renderLoop = () => {
            drawLiveCanvas();
            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };
        renderLoop();
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [drawLiveCanvas]);
    
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
            if (layer.type === 'image' && layer.src && (!layer._imageElement || layer._imageElement.src !== layer.src)) {
                loadMedia(layer.src, 'image').then(img => {
                    updateProject(draft => {
                        const l = draft.pages[activePageIndex]?.layers.find(l => l.id === layer.id);
                        if (l && l.type === 'image') {
                           l._imageElement = img as HTMLImageElement;
                           l.mediaNaturalWidth = (img as HTMLImageElement).naturalWidth;
                           l.mediaNaturalHeight = (img as HTMLImageElement).naturalHeight;
                        }
                    }, false)
                }).catch(err => console.error(`Failed to lazy-load image for layer ${layer.id}:`, err));
            } else if (layer.type === 'video' && layer.src && (!layer._videoElement || layer._videoElement.src !== layer.src)) {
                loadMedia(layer.src, 'video').then(vid => {
                    updateProject(draft => {
                        const l = draft.pages[activePageIndex]?.layers.find(l => l.id === layer.id);
                        if (l && l.type === 'video') {
                            l._videoElement = vid as HTMLVideoElement;
                            l.mediaNaturalWidth = (vid as HTMLVideoElement).videoWidth;
                            l.mediaNaturalHeight = (vid as HTMLVideoElement).videoHeight;
                        }
                    }, false)
                }).catch(err => console.error(`Failed to lazy-load video for layer ${layer.id}:`, err));
            }
        })
    }, [activePage?.layers, updateProject, activePageIndex]);
    
    const calculateFitZoom = useCallback(() => {
        if (canvasContainerRef.current && activePage) {
            const padding = 64;
            const container = canvasContainerRef.current;
            const availableWidth = container.clientWidth - padding;
            const availableHeight = container.clientHeight - padding;
    
            const scaleX = availableWidth / activePage.width;
            const scaleY = availableHeight / activePage.height;
            
            setZoom(Math.min(scaleX, scaleY, 3));
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
        URL.revokeObjectURL(a.href);
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
            await adminUploadPublicProject(file, 'Public', null);
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
                    ...deepCloneWithElements(pageToDuplicate),
                    id: nanoid(),
                    name: `${pageToDuplicate.name} Cópia`,
                };
                draft.pages.splice(index + 1, 0, newPage);
                setActivePageIndex(index + 1);
            }
        }, true);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('application/json')) {
            e.dataTransfer.dropEffect = 'copy';
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    
        const dropCoords = getCoords(e);
        
        const assetJson = e.dataTransfer.getData('application/json');
        if (assetJson) {
            try {
                const asset = JSON.parse(assetJson);
                handleAddAssetToCanvas(asset, dropCoords);
            } catch (error) {
                console.error("Failed to parse dropped asset data:", error);
                setError("Falha ao adicionar o recurso arrastado.");
            }
            return;
        }
    };
    
    const exportImages = useCallback(async (options: DownloadOptions, job: DownloadJob) => {
        const offscreenCanvas = document.createElement('canvas');
        const updateJob = (update: Partial<DownloadJob>) => setDownloadJobs(prev => prev.map(j => j.id === job.id ? {...j, ...update} : j));
        const preloadedMedia = new Map<string, HTMLImageElement | HTMLVideoElement>();
        
        try {
            const pagesToExport = options.pageIndexes.map(i => project.pages[i]);
            
            const allSources = new Set<string>();
            pagesToExport.forEach(page => page.layers.forEach(layer => {
                if ((layer.type === 'image' || layer.type === 'video') && layer.src) allSources.add(layer.src);
            }));
            await Promise.all(Array.from(allSources).map(async src => {
                const type = src.startsWith('data:video') ? 'video' : 'image';
                preloadedMedia.set(src, await loadMedia(src, type));
            }));

            if (pagesToExport.length === 1) {
                const page = pagesToExport[0];
                updateJob({ statusText: `Renderizando ${page.name}...` });
                await drawPageToCanvasForExport(page, offscreenCanvas, { transparent: options.transparent, time: 0 }, preloadedMedia);
                const blob = await new Promise<Blob | null>(resolve => offscreenCanvas.toBlob(resolve, `image/${options.format}`, 0.95));
                if (!blob || blob.size === 0) throw new Error("Falha ao criar blob da imagem.");
                
                updateJob({ status: 'done', progress: 100, statusText: 'Pronto para baixar!', resultUrl: URL.createObjectURL(blob) });
            } else {
                const zip = new JSZip();
                for (let i = 0; i < pagesToExport.length; i++) {
                    const page = pagesToExport[i];
                    updateJob({ statusText: `Compactando ${page.name} (${i+1}/${pagesToExport.length})...`, progress: (i / pagesToExport.length) * 100 });
                    await drawPageToCanvasForExport(page, offscreenCanvas, { transparent: options.transparent, time: 0 }, preloadedMedia);
                    const blob = await new Promise<Blob | null>(resolve => offscreenCanvas.toBlob(resolve, `image/${options.format}`, 0.95));
                    if(blob) zip.file(`${page.name}.${options.format}`, blob);
                }
                updateJob({ statusText: 'Finalizando zip...', progress: 99 });
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                updateJob({ status: 'done', progress: 100, statusText: 'Pronto para baixar!', resultUrl: URL.createObjectURL(zipBlob), fileName: `${project.name}.zip` });
            }
        } catch (err) {
            console.error("Image export failed:", err);
            const message = err instanceof Error ? err.message : "Erro desconhecido.";
            updateJob({ status: 'error', error: `Falha na exportação: ${message}` });
        }
    }, [project.name, project.pages, drawPageToCanvasForExport]);

    const exportVideo = useCallback(async (options: DownloadOptions, job: DownloadJob) => {
        const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
        const updateJob = (update: Partial<DownloadJob>) => setDownloadJobs(prev => prev.map(j => j.id === job.id ? {...j, ...update} : j));
    
        const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
            const parts = base64.split(',');
            if (parts.length !== 2) {
                console.warn("URL de dados base64 inválido para áudio, a saltar.");
                return new ArrayBuffer(0);
            }
            try {
                const binary_string = window.atob(parts[1]);
                const len = binary_string.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binary_string.charCodeAt(i);
                }
                return bytes.buffer;
            } catch (e) {
                console.error("Erro ao descodificar string base64:", e);
                return new ArrayBuffer(0);
            }
        };

        try {
            const pagesForExport = project.pages.map(page => {
                 const videoLayers = page.layers.filter(l => l.type === 'video') as VideoLayer[];
                 const maxLayerDuration = videoLayers.length > 0 ? Math.max(...videoLayers.map(l => l.duration * 1000)) : 0;
                 return { ...page, duration: Math.max(page.duration, maxLayerDuration) };
            });
            const totalDurationMs = pagesForExport.reduce((acc, p) => acc + p.duration, 0);
            const totalDurationSec = totalDurationMs / 1000;
    
            updateJob({ statusText: 'Pré-carregando mídias...' });
            const preloadedMedia = new Map<string, HTMLImageElement | HTMLVideoElement>();
            const allSources: Set<string> = new Set();
            project.pages.forEach(p => p.layers.forEach(l => { if ((l.type === 'image' || l.type === 'video') && l.src) allSources.add(l.src)}));
            project.audioTracks.forEach(t => allSources.add(t.src));
            await Promise.all(Array.from(allSources).map(async (src) => {
                if (!src) return;
                const typeGuess = src.startsWith('data:video') || src.endsWith('.mp4') || src.endsWith('.webm') ? 'video' : src.startsWith('data:audio') ? 'audio' : 'image';
                if (typeGuess !== 'audio') {
                    preloadedMedia.set(src, await loadMedia(src, typeGuess as 'image' | 'video'));
                }
            }));
    
            updateJob({ statusText: 'Processando áudio...' });
            const SAMPLE_RATE = 48000;
            const audioContext = new OfflineAudioContext(2, Math.ceil(totalDurationSec * SAMPLE_RATE), SAMPLE_RATE);
            const allAudioSources = [
                ...project.pages.flatMap((p, pageIndex) => 
                    (p.layers.filter(l => l.type === 'video' && (l as VideoLayer).volume > 0 && !(l as VideoLayer).isMuted) as VideoLayer[])
                    .map(l => ({ ...l, __pageIndex: pageIndex }))
                ),
                ...project.audioTracks.map(t => ({ ...t, __pageIndex: -1 }))
            ];
            
            let audioSourcesProcessed = 0;
            await Promise.all(allAudioSources.map(async (source) => {
                try {
                    let arrayBuffer: ArrayBuffer;
                    if (source.src.startsWith('data:')) {
                        arrayBuffer = base64ToArrayBuffer(source.src);
                    } else {
                        const response = await fetch(source.src);
                        if (!response.ok) throw new Error(`Falha ao buscar áudio de ${source.name}`);
                        arrayBuffer = await response.arrayBuffer();
                    }
                    if (arrayBuffer.byteLength === 0) return;

                    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const bufferSource = audioContext.createBufferSource();
                    bufferSource.buffer = decodedBuffer;
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = source.volume;
                    bufferSource.connect(gainNode).connect(audioContext.destination);

                    let startTimeSec = 0;
                    if ('__pageIndex' in source && source.__pageIndex !== -1) {
                         const timeBeforePageMs = pagesForExport.slice(0, source.__pageIndex).reduce((acc, p) => acc + p.duration, 0);
                         startTimeSec = (timeBeforePageMs + source.startTime) / 1000;
                    } else { startTimeSec = source.startTime / 1000; }
                    bufferSource.start(startTimeSec);
                    audioSourcesProcessed++;
                } catch (e) { console.warn(`Não foi possível decodificar ou processar áudio para ${source.name}`, e); }
            }));
            
            const mixedAudioBuffer = audioSourcesProcessed > 0 ? await audioContext.startRendering() : null;
    
            const muxer = new Muxer({
                target: new ArrayBufferTarget(),
                video: { codec: 'avc', width: activePage.width, height: activePage.height },
                audio: mixedAudioBuffer ? { codec: 'aac', sampleRate: SAMPLE_RATE, numberOfChannels: 2 } : undefined,
                fastStart: 'in-memory',
            });
            const videoEncoder = new (window as any).VideoEncoder({
                output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
                error: (e: any) => { throw e; }
            });
            videoEncoder.configure({ codec: 'avc1.4d002a', width: activePage.width, height: activePage.height, bitrate: options.bitrate * 1000, framerate: options.frameRate });
            
            let audioEncoder: any = null;
            if (mixedAudioBuffer) {
                audioEncoder = new (window as any).AudioEncoder({
                    output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
                    error: (e: any) => { throw e; }
                });
                audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 128000 });
            }
    
            const totalFrames = Math.ceil(totalDurationSec * options.frameRate);
            const offscreenCanvas = new OffscreenCanvas(activePage.width, activePage.height);
            let frameCount = 0;

            if (mixedAudioBuffer && audioEncoder) {
                const numSamplesPerChunk = 1024;
                const channelL = mixedAudioBuffer.getChannelData(0);
                const channelR = mixedAudioBuffer.getChannelData(1);
                const numChannels = mixedAudioBuffer.numberOfChannels;

                for (let i = 0; i < mixedAudioBuffer.length; i += numSamplesPerChunk) {
                    const chunkEnd = Math.min(i + numSamplesPerChunk, mixedAudioBuffer.length);
                    const numFramesInChunk = chunkEnd - i;
                    if (numFramesInChunk <= 0) break;

                    const interleavedChunk = new Float32Array(numFramesInChunk * numChannels);
                    for (let frame = 0; frame < numFramesInChunk; frame++) {
                        interleavedChunk[frame * numChannels] = channelL[i + frame];
                        if (numChannels > 1) {
                            interleavedChunk[frame * numChannels + 1] = channelR[i + frame];
                        }
                    }
                    
                    const timestamp = (i / SAMPLE_RATE) * 1_000_000;
                    audioEncoder.encode(new (window as any).AudioData({
                       format: 'f32',
                       sampleRate: SAMPLE_RATE, 
                       numberOfFrames: numFramesInChunk,
                       numberOfChannels: numChannels, 
                       timestamp: timestamp, 
                       data: interleavedChunk.buffer
                    }));
                }
            }


            let accumulatedTimeMs = 0;
            for (const page of pagesForExport) {
                const pageEndTimeMs = accumulatedTimeMs + page.duration;
                for (let timeMs = accumulatedTimeMs; timeMs < pageEndTimeMs; timeMs += 1000 / options.frameRate) {
                    if (frameCount >= totalFrames) break;
                    
                    await drawPageToCanvasForExport(page, offscreenCanvas as any, { transparent: false, time: timeMs }, preloadedMedia);
                    const frame = new (window as any).VideoFrame(offscreenCanvas, { timestamp: timeMs * 1000 });
                    videoEncoder.encode(frame);
                    frame.close();
                    
                    frameCount++;
                    updateJob({ progress: (frameCount / totalFrames) * 95, statusText: `Renderizando frame ${frameCount} de ${totalFrames}` });
                }
                if (frameCount >= totalFrames) break;
                accumulatedTimeMs = pageEndTimeMs;
            }
    
            await videoEncoder.flush();
            if (audioEncoder) await audioEncoder.flush();
            updateJob({ statusText: 'Finalizando...', progress: 100 });
            muxer.finalize();
            const { buffer } = muxer.target;
            
            if (!buffer || buffer.byteLength === 0) throw new Error('O buffer de vídeo final gerado estava vazio.');
            
            updateJob({ status: 'done', progress: 100, statusText: 'Pronto para baixar!', resultUrl: URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' })) });
    
        } catch (err) {
            console.error("Video export failed:", err);
            const message = err instanceof Error ? err.message : "Erro desconhecido.";
            updateJob({ status: 'error', error: `Falha na exportação de vídeo: ${message}` });
        }
    }, [project, activePage, drawPageToCanvasForExport]);
    
    const handleExport = useCallback(async (options: DownloadOptions) => {
        const jobId = nanoid();
        const thumbnailCanvas = document.createElement('canvas');
        const preloadedMediaForThumb = new Map<string, HTMLImageElement | HTMLVideoElement>();
        await drawPageToCanvasForExport(activePage, thumbnailCanvas, { transparent: false, time: 0 }, preloadedMediaForThumb);
        const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.5);

        const newJob: DownloadJob = {
            id: jobId,
            fileName: `${project.name}.${options.format}`,
            status: 'preparing',
            progress: 0,
            statusText: 'A iniciar...',
            thumbnail,
        };
        setDownloadJobs(prev => [newJob, ...prev.filter(j => j.status !== 'done' && j.status !== 'error')]);
        
        setTimeout(() => {
            if (options.format === 'mp4') {
                exportVideo(options, newJob);
            } else {
                exportImages(options, newJob);
            }
        }, 100);

    }, [project.name, activePage, drawPageToCanvasForExport, exportImages, exportVideo]);

    const activeJob = downloadJobs.length > 0 ? downloadJobs.find(j => j.status !== 'done' && j.status !== 'error') || downloadJobs[0] : null;

    const handleCloseExportModal = () => {
        setDownloadJobs(prev => {
            const jobsToKeep = prev.filter(j => j.id !== activeJob?.id);
            if(activeJob?.resultUrl) {
                URL.revokeObjectURL(activeJob.resultUrl);
            }
            return jobsToKeep;
        });
    };

    return (
        <div className="h-full w-full flex flex-col bg-brand-accent text-white">
            <ExportProgressModal 
                isOpen={!!activeJob} 
                job={activeJob}
                onClose={handleCloseExportModal}
            />
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
                userProfile={userProfile}
            />
             <DownloadModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                onDownload={handleExport}
                hasVideoOrAudio={hasVideoOrAudio}
                pageCount={project.pages.length}
            />
             {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onDuplicate={onDuplicateLayers}
                    onDelete={deleteSelectedLayers}
                    onBringForward={() => onReorderLayers('forward')}
                    onSendBackward={() => onReorderLayers('backward')}
                />
            )}
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
                <main ref={canvasContainerRef} className="flex-grow flex items-center justify-center p-8 bg-gray-800 relative overflow-hidden"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {activePage && (
                        <div className="relative shadow-2xl" style={{ width: activePage.width, height: activePage.height, transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                            <canvas ref={canvasRef} />
                            <div className="absolute top-0 left-0 w-full h-full" onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}>
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
                                            height: 'auto',
                                            transform: `rotate(${editingLayer.rotation}deg)`,
                                            transformOrigin: 'top left',
                                            pointerEvents: 'auto',
                                        }}
                                        onMouseDown={e => e.stopPropagation()}
                                    >
                                        <textarea
                                            ref={textareaRef}
                                            value={liveEditText}
                                            onChange={handleLiveTextChange}
                                            onBlur={handleTextBlur}
                                            className="w-full h-full bg-transparent border border-dashed border-blue-400 outline-none resize-none overflow-hidden p-0"
                                            style={{
                                                color: editingLayer.color,
                                                fontFamily: `"${editingLayer.fontFamily}"`,
                                                fontSize: editingLayer.fontSize,
                                                fontWeight: editingLayer.fontWeight,
                                                fontStyle: editingLayer.fontStyle,
                                                textAlign: editingLayer.textAlign,
                                                lineHeight: editingLayer.lineHeight,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <AnimatePresence>
                    {isDraggingOver && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-brand-primary/20 border-4 border-dashed border-brand-primary rounded-lg pointer-events-none z-50 flex items-center justify-center"
                        >
                            <p className="text-white text-2xl font-bold">Solte aqui para adicionar</p>
                        </motion.div>
                    )}
                    </AnimatePresence>
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
            <input type="file" ref={fileUploadRef} onChange={handleFileUpload} multiple className="hidden" accept="image/*,video/*,.dng,.brmp"/>
            <input type="file" ref={fontUploadRef} onChange={handleFontUpload} className="hidden" accept=".otf,.ttf,.woff,.woff2"/>
        </div>
    );
};

export default CreativeEditorView;