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
    UploadedAsset, PublicAsset, Project, UserProfile, AssetContext, DownloadJob
} from '../../types.ts';
import { blobToBase64, toBase64 } from '../../utils/imageUtils.ts';
import { setItem, getItem, removeItem } from '../../utils/db.ts';
import SelectionBox from '../SelectionBox.tsx';
import { uploadUserAsset, getPublicAssets, adminUploadPublicAsset, createSignedUrlForPath } from '../../services/databaseService.ts';
import { generateImageFromPrompt } from '../../geminiService.ts';
import { IconMinus, IconPlus, IconMaximize } from '../Icons.tsx';
import type { User } from '@supabase/gotrue-js';
import DownloadManager from '../DownloadManager.tsx';
import JSZip from 'jszip';


// Helper function to load media and return an HTML element
const loadMedia = (src: string, type: 'image' | 'video'): Promise<HTMLImageElement | HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
        // FIX: Add a guard to prevent calling methods on a null or undefined src, which would crash the app.
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
                // A quick play/pause can force the browser to load the first frame for drawing
                element.play().then(() => {
                    element.pause();
                    element.currentTime = 0; // Ensure it's at the start
                    resolve(element);
                }).catch(e => {
                    console.warn("A reprodução automática foi impedida para o carregamento do vídeo, mas a continuar.", e);
                    // Even if autoplay fails, the video element is likely ready.
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
    // For rotation
    centerX?: number;
    centerY?: number;
    startAngle?: number;
}

interface CreativeEditorViewProps {
    userProfile: (User & UserProfile & { isAdmin: boolean; }) | null;
}

// Custom deep clone that preserves runtime elements (_imageElement, _videoElement) by reference
const deepCloneWithElements = <T extends any>(obj: T, visited = new WeakMap()): T => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    // Handle DOM elements by returning them directly (by reference)
    if (obj instanceof HTMLElement) {
        return obj;
    }

    // Handle circular references
    if (visited.has(obj)) {
        return visited.get(obj);
    }
    
    if (Array.isArray(obj)) {
        const newArr: any[] = [];
        visited.set(obj, newArr);
        obj.forEach(item => {
            newArr.push(deepCloneWithElements(item, visited));
        });
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
        return project.pages.some(p => p.layers.some(l => l.type === 'video')) || project.audioTracks.length > 0;
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
                    // FIX: Ensure _imageElement and _videoElement are preserved from the current state in the draft.
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
    useHotkeys('escape', () => { if (cropLayerId) onCancelCrop(); if(editingTextLayerId) textareaRef.current?.blur(); });
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
             // Logic for these types remains the same...
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
                setError('A funcionalidade de adicionar áudio ainda não foi implementada na tela.');
                return;
            }
        }
    
        let base64Src: string;
        try {
            // New Robust Pipeline:
            // 1. Get a fetchable URL.
            // 2. Fetch it to get a blob.
            // 3. Convert blob to base64.
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
    
            // Continue with the rest of the logic...
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
                scale: scaleToFit, offsetX: 0, offsetY: 0,
                crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight } 
            };
            
            if (type === 'video') {
                const newLayer: VideoLayer = { ...newLayerBase, type: 'video', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, startTime: 0, endTime: duration || 0, duration: duration || 0, volume: 1, isMuted: true, _videoElement: mediaElement as HTMLVideoElement };
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
            // FIX: Explicitly typed the `file` parameter in the `map` callback as `File` to resolve a type inference issue where it was being treated as `unknown`.
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
    
            // This check is critical. An invalid clone can make _videoElement a plain object.
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
                
                const { x: ox, y: oy, width: ow, height: oh } = initialLayer;
                
                const updates: Partial<AnyLayer & { scale: number, offsetX: number, offsetY: number }> = {};
                
                // Independent (non-proportional) resize logic for shapes and text layers
                if (initialLayer.type === 'shape' || initialLayer.type === 'text') {
                    let newX = ox;
                    let newY = oy;
                    let newW = ow;
                    let newH = oh;

                    if (handle.includes('r')) {
                        newW = Math.max(minSize, ow + rdx);
                    }
                    if (handle.includes('l')) {
                        newW = Math.max(minSize, ow - rdx);
                        const dx_world = rdx * cos;
                        const dy_world = rdx * sin;
                        newX += dx_world;
                        newY += dy_world;
                    }

                    if (handle.includes('b')) {
                        newH = Math.max(minSize, oh + rdy);
                    }
                    if (handle.includes('t')) {
                        newH = Math.max(minSize, oh - rdy);
                        const dx_world = -rdy * sin;
                        const dy_world = rdy * cos;
                        newX += dx_world;
                        newY += dy_world;
                    }
                    
                    updates.x = newX;
                    updates.y = newY;
                    updates.width = newW;
                    updates.height = newH;
                } 
                // Proportional and crop/pan resize for media layers
                else if (initialLayer.type === 'image' || initialLayer.type === 'video') {
                    if (['tl', 'tr', 'bl', 'br'].includes(handle)) { // Corner handles -> Proportional Scale
                        let newW = ow;
                        if (handle.includes('r')) newW = Math.max(minSize, ow + rdx);
                        if (handle.includes('l')) newW = Math.max(minSize, ow - rdx);

                        const aspectRatio = ow / oh;
                        const newH = newW / aspectRatio;
                        const dw = newW - ow;
                        const dh = newH - oh;
                        
                        let newX = ox, newY = oy;
                        if (handle.includes('l')) newX -= dw;
                        if (handle.includes('t')) newY -= dh;

                        const center_dx = (newX + newW/2) - (ox + ow/2);
                        const center_dy = (newY + newH/2) - (oy + oh/2);
                        
                        updates.x = (ox + ow/2) + (center_dx * cos - center_dy * sin) - newW / 2;
                        updates.y = (oy + oh/2) + (center_dx * sin + center_dy * cos) - newH / 2;
                        updates.width = newW;
                        updates.height = newH;
                        
                        const mediaLayer = initialLayer as ImageLayer | VideoLayer;
                        const newScale = newW / (mediaLayer.crop.width || mediaLayer.mediaNaturalWidth);
                        updates.scale = newScale;
                    } else { // Side handles for crop/reveal/scale
                        const mediaLayer = initialLayer as ImageLayer | VideoLayer;
                        const deltaX = handle === 'ml' ? -rdx : (handle === 'mr' ? rdx : 0);
                        const deltaY = handle === 'tm' ? -rdy : (handle === 'bm' ? rdy : 0);
                        
                        if (deltaX !== 0) { // Horizontal Drag
                            if (deltaX < 0) { // Crop
                                const cropAmount = Math.abs(deltaX);
                                updates.width = Math.max(minSize, ow - cropAmount);
                                const actualCrop = ow - updates.width;
                                if (handle === 'ml') {
                                    updates.x = ox + actualCrop * cos; updates.y = oy + actualCrop * sin;
                                    updates.offsetX = mediaLayer.offsetX + actualCrop;
                                }
                            } else { // Expand
                                const revealable = handle === 'ml' ? mediaLayer.offsetX : (mediaLayer.mediaNaturalWidth * mediaLayer.scale) - (mediaLayer.offsetX + ow);
                                const revealAmount = Math.min(deltaX, revealable);
                                const scaleAmount = deltaX - revealAmount;
                                
                                updates.width = ow + revealAmount;
                                if (handle === 'ml') {
                                    const dx_local = -revealAmount;
                                    updates.x = ox + dx_local * cos; updates.y = oy + dx_local * sin;
                                    updates.offsetX = mediaLayer.offsetX - revealAmount;
                                }
                                if (scaleAmount > 0) {
                                    const scaleFactor = (updates.width + scaleAmount) / updates.width;
                                    const finalW = updates.width * scaleFactor; const finalH = oh * scaleFactor;
                                    const total_dw = finalW - ow; const total_dh = finalH - oh;
                                    updates.width = finalW; updates.height = finalH;
                                    updates.scale = mediaLayer.scale * scaleFactor;
                                    updates.offsetX = (updates.offsetX ?? mediaLayer.offsetX) * scaleFactor;
                                    updates.offsetY = mediaLayer.offsetY * scaleFactor;
                                    if (handle === 'ml') {
                                        const local_dx = -total_dw; updates.x = ox + local_dx * cos; updates.y = oy + local_dx * sin;
                                        updates.y = oy + (local_dx * sin) - (total_dh / 2 * cos);
                                    } else {
                                        updates.y = oy - (total_dh / 2 * cos);
                                    }
                                }
                            }
                        } else if (deltaY !== 0) { // Vertical Drag
                                if (deltaY < 0) { // Crop
                                const cropAmount = Math.abs(deltaY);
                                updates.height = Math.max(minSize, oh - cropAmount);
                                const actualCrop = oh - updates.height;
                                if (handle === 'tm') {
                                    updates.x = ox - actualCrop * sin; updates.y = oy + actualCrop * cos;
                                    updates.offsetY = mediaLayer.offsetY + actualCrop;
                                }
                            } else { // Expand
                                const revealable = handle === 'tm' ? mediaLayer.offsetY : (mediaLayer.mediaNaturalHeight * mediaLayer.scale) - (mediaLayer.offsetY + oh);
                                const revealAmount = Math.min(deltaY, revealable);
                                const scaleAmount = deltaY - revealAmount;

                                updates.height = oh + revealAmount;
                                if (handle === 'tm') {
                                    const dy_local = -revealAmount;
                                    updates.x = ox - dy_local * sin; updates.y = oy + dy_local * cos;
                                    updates.offsetY = mediaLayer.offsetY - revealAmount;
                                }
                                if (scaleAmount > 0) {
                                    const scaleFactor = (updates.height + scaleAmount) / updates.height;
                                    const finalW = ow * scaleFactor; const finalH = updates.height * scaleFactor;
                                    const total_dw = finalW - ow; const total_dh = finalH - oh;
                                    updates.width = finalW; updates.height = finalH;
                                    updates.scale = mediaLayer.scale * scaleFactor;
                                    updates.offsetX = mediaLayer.offsetX * scaleFactor;
                                    updates.offsetY = (updates.offsetY ?? mediaLayer.offsetY) * scaleFactor;

                                    if (handle === 'tm') {
                                        const local_dy = -total_dh;
                                        updates.x = ox - (local_dy * sin) - (total_dw / 2 * cos);
                                        updates.y = oy + (local_dy * cos) - (total_dw / 2 * sin);
                                    } else {
                                            updates.x = ox - (total_dw / 2 * cos);
                                            updates.y = oy - (total_dw / 2 * sin);
                                    }
                                }
                            }
                        }
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

    const drawPageToCanvas = useCallback(async (page: Page, canvas: HTMLCanvasElement, options: { transparent: boolean, time?: number }) => {
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
             const drawX = -layer.width / 2;
             const drawY = -layer.height / 2;

            if (layer.type === 'image' || layer.type === 'video') {
                const mediaLayer = layer as ImageLayer | VideoLayer;
                // FIX: Type-check to correctly access _videoElement or _imageElement from the union type, resolving "Property does not exist on type" errors.
                let mediaElement = mediaLayer.type === 'video' ? mediaLayer._videoElement : mediaLayer._imageElement;
                if (!mediaElement) {
                    mediaElement = await loadMedia(mediaLayer.src, mediaLayer.type);
                }
                
                if (mediaElement instanceof HTMLVideoElement && options.time !== undefined) {
                    const videoTime = (options.time / 1000) % mediaElement.duration;
                    mediaElement.currentTime = videoTime;
                    await new Promise(res => setTimeout(res, 50)); // Give it a moment to seek
                }

                ctx.beginPath();
                ctx.rect(drawX, drawY, layer.width, layer.height);
                ctx.clip();
                
                const contentWidth = mediaLayer.mediaNaturalWidth * mediaLayer.scale;
                const contentHeight = mediaLayer.mediaNaturalHeight * mediaLayer.scale;
                
                ctx.drawImage(mediaElement, drawX - mediaLayer.offsetX, drawY - mediaLayer.offsetY, contentWidth, contentHeight);
            } else {
                 // Reuse existing drawing logic for non-media layers
                if (layer.type === 'text') {
                    ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}"`;
                    ctx.fillStyle = layer.color;
                    ctx.textAlign = layer.textAlign;
                    ctx.textBaseline = 'top';
                    ctx.letterSpacing = `${layer.letterSpacing || 0}px`;
                    
                    let textToDraw = layer.text;
                    if (layer.textTransform === 'uppercase') textToDraw = textToDraw.toUpperCase();
                    else if (layer.textTransform === 'lowercase') textToDraw = textToDraw.toLowerCase();

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
                        if (metrics.width > layer.width && n > 0) {
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
                }
            }
            ctx.restore();
        }
    }, []);

    const drawScene = useCallback(() => {
        if (!activePage || !canvasRef.current) return;
        drawPageToCanvas(activePage, canvasRef.current!, { transparent: false });
    }, [activePage, drawPageToCanvas]);

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
        
        // Handle sidebar drop
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

        try {
            const pagesToExport = options.pageIndexes.map(i => project.pages[i]);
            
            if (pagesToExport.length === 1) { // Single image download
                const page = pagesToExport[0];
                updateJob({ statusText: `Renderizando ${page.name}...` });
                await drawPageToCanvas(page, offscreenCanvas, { transparent: options.transparent });
                const blob = await new Promise<Blob | null>(resolve => offscreenCanvas.toBlob(resolve, `image/${options.format}`, 0.95));
                if (!blob) throw new Error("Falha ao criar blob da imagem.");
                const url = URL.createObjectURL(blob);
                updateJob({ status: 'done', resultUrl: url, progress: 100 });
            } else { // Multiple images -> ZIP
                const zip = new JSZip();
                for (let i = 0; i < pagesToExport.length; i++) {
                    const page = pagesToExport[i];
                    updateJob({ statusText: `Compactando ${page.name} (${i+1}/${pagesToExport.length})...`, progress: (i / pagesToExport.length) * 100 });
                    await drawPageToCanvas(page, offscreenCanvas, { transparent: options.transparent });
                    const blob = await new Promise<Blob | null>(resolve => offscreenCanvas.toBlob(resolve, `image/${options.format}`, 0.95));
                    if(blob) zip.file(`${page.name}.${options.format}`, blob);
                }
                updateJob({ statusText: 'Finalizando zip...', progress: 99 });
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(zipBlob);
                updateJob({ status: 'done', resultUrl: url, progress: 100, fileName: `${project.name}.zip` });
            }
        } catch (err) {
            console.error("Image export failed:", err);
            const message = err instanceof Error ? err.message : "Erro desconhecido.";
            updateJob({ status: 'error', error: `Falha na exportação: ${message}` });
        }
    }, [project.name, project.pages, drawPageToCanvas]);

    const exportVideo = useCallback(async (options: DownloadOptions, job: DownloadJob) => {
        const updateJob = (update: Partial<DownloadJob>) => setDownloadJobs(prev => prev.map(j => j.id === job.id ? {...j, ...update} : j));
        
        let audioWorker: Worker | null = null;
        let videoWorker: Worker | null = null;

        try {
             // 1. Prepare Audio
            updateJob({ statusText: 'Preparando áudio...' });
            const audioSources = project.audioTracks.map(t => t.src);
            const totalDuration = project.pages.reduce((acc, p) => acc + p.duration / 1000, 0);

            let mixedAudio: any = null;
            if (audioSources.length > 0) {
                 audioWorker = new Worker('/services/audio.worker.ts', { type: 'module' });
                 mixedAudio = await new Promise((resolve, reject) => {
                     audioWorker!.onmessage = e => {
                        if (e.data.type === 'done') resolve(e.data.payload);
                        else if (e.data.type === 'error') reject(new Error(e.data.payload.message));
                     };
                     audioWorker!.onerror = e => reject(e);
                     audioWorker!.postMessage({ type: 'process', payload: { audioSources, maxDuration: totalDuration } });
                 });
                 audioWorker.terminate();
            }
             updateJob({ status: 'rendering', statusText: 'Configurando codificador de vídeo...' });

             // 2. Prepare Video
             const exportWidth = activePage.width;
             const exportHeight = activePage.height;
             const offscreenCanvas = new OffscreenCanvas(exportWidth, exportHeight);

             videoWorker = new Worker('/services/videoRenderer.worker.ts', { type: 'module' });
             const finalBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                 videoWorker!.onmessage = async (e) => {
                    if (e.data.type === 'ready') {
                        const totalFrames = Math.ceil(totalDuration * options.frameRate);
                        let framesEncoded = 0;
                        let pageStartTime = 0;

                        for (const page of project.pages) {
                            const pageEndTime = pageStartTime + page.duration;
                            for (let time = pageStartTime; time < pageEndTime; time += 1000 / options.frameRate) {
                                await drawPageToCanvas(page, offscreenCanvas as any, { transparent: false, time });
                                const frame = new (window as any).VideoFrame(offscreenCanvas, { timestamp: time * 1000 });
                                videoWorker!.postMessage({ type: 'frame', payload: { frame } }, [frame]);
                                framesEncoded++;
                                updateJob({ progress: (framesEncoded / totalFrames) * 100, statusText: `Codificando frame ${framesEncoded} de ${totalFrames}` });
                            }
                            pageStartTime = pageEndTime;
                        }
                        videoWorker!.postMessage({ type: 'finish' });
                    } else if (e.data.type === 'done') {
                        resolve(e.data.payload);
                    } else if (e.data.type === 'error') {
                        reject(new Error(e.data.payload.message));
                    }
                 };
                videoWorker!.onerror = e => reject(e);
                videoWorker!.postMessage({ type: 'start', payload: { exportWidth, exportHeight, options, audio: mixedAudio } });
            });
            
            const blob = new Blob([finalBuffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            updateJob({ status: 'done', resultUrl: url, progress: 100 });
        
        } catch(err) {
            console.error("Video export failed:", err);
            const message = err instanceof Error ? err.message : "Erro desconhecido.";
            updateJob({ status: 'error', error: `Falha na exportação de vídeo: ${message}` });
        } finally {
            audioWorker?.terminate();
            videoWorker?.terminate();
        }
    }, [project.audioTracks, project.pages, activePage, drawPageToCanvas]);

    const handleExport = useCallback(async (options: DownloadOptions) => {
        const jobId = nanoid();
        const thumbnailCanvas = document.createElement('canvas');
        await drawPageToCanvas(activePage, thumbnailCanvas, { transparent: false });
        const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.5);

        const newJob: DownloadJob = {
            id: jobId,
            fileName: `${project.name}.${options.format}`,
            status: 'preparing',
            progress: 0,
            statusText: 'A iniciar...',
            thumbnail,
        };
        setDownloadJobs(prev => [...prev, newJob]);

        // Use a timeout to allow the UI to update before starting heavy work
        setTimeout(() => {
            if (options.format === 'mp4') {
                exportVideo(options, newJob);
            } else {
                exportImages(options, newJob);
            }
        }, 100);

    }, [project.name, activePage, drawPageToCanvas, exportImages, exportVideo]);

    return (
        <div className="h-full w-full flex flex-col bg-brand-accent text-white">
            <DownloadManager jobs={downloadJobs} setJobs={setDownloadJobs} />
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
// FIX: Corrected function name from 'onSaveProjectAsPublic' to 'handleSaveProjectAsPublic' to match the actual function defined in the component.
                    onSaveProjectAsPublic={handleSaveProjectAsPublic}
// FIX: Corrected function name from 'onSaveProjectToComputer' to 'handleSaveProjectToComputer' to match the actual function defined in the component.
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