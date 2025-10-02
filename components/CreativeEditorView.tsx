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
    ProjectState, Page, AnyLayer, TextLayer, ShapeLayer, ImageLayer, VideoLayer, AudioTrack,
    UploadedAsset, PublicAsset, Project, UserProfile, AssetContext, DownloadJob
} from '../../types.ts';
import { blobToBase64, toBase64 } from '../../utils/imageUtils.ts';
import { setItem, getItem, removeItem } from '../../utils/db.ts';
import SelectionBox from '../SelectionBox.tsx';
// FIX: Swapped adminUploadPublicAsset for the correct adminUploadPublicProject function.
import { uploadUserAsset, getPublicAssets, adminUploadPublicProject, createSignedUrlForPath } from '../../services/databaseService.ts';
// FIX: Corrected import path for geminiService to point to the correct file in the services directory.
import { generateImageFromPrompt } from '../services/geminiService.ts';
import { IconMinus, IconPlus, IconMaximize, IconDownload, IconLayers, IconEdit, IconImageIcon, IconEnterFocusMode, IconExitFocusMode } from '../Icons.tsx';
import type { User } from '@supabase/gotrue-js';
import JSZip from 'jszip';
import ExportProgressModal from '../ExportProgressModal.tsx';

// =========================================================================================
// INLINED WEB WORKERS TO PREVENT CORS ERRORS
// =========================================================================================

const AUDIO_WORKER_CODE = `
const ctx = self;

function postError(message, error) {
    console.error(message, error);
    ctx.postMessage({
        type: 'error',
        payload: { message: message + (error ? \`: \${error.message || String(error)}\` : '') }
    });
}

self.onerror = (event) => {
    postError('Erro não capturado no worker', event.error || event.message);
    event.preventDefault();
};

self.onunhandledrejection = (event) => {
    postError('Rejeição de promessa não tratada no worker', event.reason);
    event.preventDefault();
};

self.onmessage = async (e) => {
    const { type, payload } = e.data;
    if (type !== 'process') return;
    
    const { audioSources, maxDuration } = payload;
    
    try {
        if (typeof self.OfflineAudioContext === 'undefined' && typeof self.webkitOfflineAudioContext === 'undefined') {
            throw new Error('O seu navegador não suporta o processamento de áudio em segundo plano.');
        }

        if (!audioSources || audioSources.length === 0) {
             ctx.postMessage({ type: 'done', payload: null });
             return;
        }

        const SAMPLE_RATE = 48000;
        const AudioContext = self.OfflineAudioContext || self.webkitOfflineAudioContext;
        const offlineContext = new AudioContext(2, Math.ceil(maxDuration * SAMPLE_RATE), SAMPLE_RATE);

        let sourcesProcessed = 0;
        for (const src of audioSources) {
            try {
                const response = await fetch(src);
                if (!response.ok) {
                    console.warn(\`Failed to fetch audio source: \${src}, status: \${response.status}\`);
                    continue;
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(0);
                sourcesProcessed++;
            } catch (err) {
                 console.warn(\`Não foi possível processar ou decodificar o áudio para \${src}, a saltar.\`, err);
            }
        }
        
        if (sourcesProcessed === 0 && audioSources.length > 0) {
            throw new Error("Nenhuma das fontes de áudio pôde ser carregada ou decodificada.");
        }
        
        const renderedBuffer = await offlineContext.startRendering();
        
        const channels = [];
        for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
            channels.push(renderedBuffer.getChannelData(i));
        }

        const audioPayload = {
            sampleRate: renderedBuffer.sampleRate,
            numberOfChannels: renderedBuffer.numberOfChannels,
            channels,
        };
        
        ctx.postMessage({ type: 'done', payload: audioPayload }, channels.map(c => c.buffer));

    } catch (err) {
        postError('Falha durante o processamento de áudio', err);
    }
};
`;

const VIDEO_WORKER_CODE = `
// This code is executed in a separate thread.
// We have to re-import dependencies here.
import { Muxer, ArrayBufferTarget } from "https://aistudiocdn.com/mp4-muxer@^2.0.2";

let muxer = null;
let videoEncoder = null;
let audioEncoder = null;
const ctx = self;

const encodeFullAudio = async (channels, sampleRate, numberOfChannels) => {
    if (!audioEncoder) return;
    const totalSamples = channels[0].length;
    const samplesPerChunk = sampleRate;

    for (let i = 0; i < totalSamples; i += samplesPerChunk) {
        const chunkEnd = Math.min(i + samplesPerChunk, totalSamples);
        const chunkNumSamples = chunkEnd - i;
        
        const interleavedData = new Float32Array(chunkNumSamples * numberOfChannels);
        for (let chan = 0; chan < numberOfChannels; chan++) {
            const channelData = channels[chan];
            for (let j = 0; j < chunkNumSamples; j++) {
                interleavedData[j * numberOfChannels + chan] = channelData[i + j];
            }
        }
        
        const timestamp = (i / sampleRate) * 1_000_000;

        const audioDataChunk = new AudioData({
            format: 'f32',
            sampleRate: sampleRate,
            numberOfFrames: chunkNumSamples,
            numberOfChannels: numberOfChannels,
            timestamp: timestamp,
            data: interleavedData
        });
        audioEncoder.encode(audioDataChunk);
    }
};

ctx.onmessage = async (e) => {
  const { type, payload } = e.data;
  try {
    if (type === 'start') {
      const { exportWidth, exportHeight, options, audio } = payload;
      
      const videoCodecString =
        options.codec === 'hevc'
          ? 'hvc1.1.6.L120.90'
          : 'avc1.640028'; // H.264 High Profile, Level 4.0 - Much more compatible

      const videoEncoderConfig = {
        codec: videoCodecString,
        width: exportWidth,
        height: exportHeight,
        bitrate: options.bitrate * 1000,
        framerate: options.frameRate,
        latencyMode: 'quality',
      };

      const videoSupport = await VideoEncoder.isConfigSupported(videoEncoderConfig);
      if (!videoSupport.supported) {
        throw new Error(\`Configuração de vídeo não suportada: \${JSON.stringify(videoSupport.config)}\`);
      }

      muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: options.codec === 'hevc' ? 'hevc' : 'avc',
          width: exportWidth,
          height: exportHeight,
        },
        audio: audio ? {
            codec: 'aac',
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
        } : undefined,
        fastStart: 'in-memory',
      });

      videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (err) => ctx.postMessage({ type: 'error', payload: { message: \`Erro do VideoEncoder: \${err.message}\` }})
      });
      videoEncoder.configure(videoEncoderConfig);
      
      if (audio) {
        const audioEncoderConfig = {
            codec: 'mp4a.40.2',
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
            bitrate: 128_000,
        };
        const audioSupport = await AudioEncoder.isConfigSupported(audioEncoderConfig);
        if(!audioSupport.supported) {
            throw new Error(\`Configuração de áudio não suportada: \${JSON.stringify(audioSupport.config)}\`);
        }
        audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: (err) => ctx.postMessage({ type: 'error', payload: { message: \`Erro do AudioEncoder: \${err.message}\` }})
        });
        audioEncoder.configure(audioEncoderConfig);
        encodeFullAudio(audio.channels, audio.sampleRate, audio.numberOfChannels);
      }
      ctx.postMessage({ type: 'ready' });

    } else if (type === 'frame') {
      if (videoEncoder && videoEncoder.state === 'configured') videoEncoder.encode(payload.frame);
      payload.frame.close();

    } else if (type === 'finish') {
      if (!videoEncoder || !muxer) throw new Error('Finish called before encoder/muxer initialized.');
      await videoEncoder.flush();
      if(audioEncoder) await audioEncoder.flush();
      muxer.finalize();
      const { buffer } = muxer.target;
      if (!buffer || buffer.byteLength === 0) throw new Error('Buffer MP4 vazio.');
      ctx.postMessage({ type: 'done', payload: buffer }, [buffer]);
      videoEncoder = null;
      audioEncoder = null;
      muxer = null;
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', payload: { message: err instanceof Error ? \`Erro no worker de vídeo: \${err.message}\` : 'Erro desconhecido no worker.' }});
  }
};
`;

// =========================================================================================
// END OF INLINED WORKERS
// =========================================================================================


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

const processAudioOnMainThread = async (audioSources: string[], maxDuration: number): Promise<any | null> => {
    const AudioContext = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!AudioContext) {
         throw new Error('O seu navegador não suporta a API de áudio necessária para exportação (OfflineAudioContext).');
    }

    if (!audioSources || audioSources.length === 0) {
        return null;
    }

    const SAMPLE_RATE = 48000;
    const offlineContext = new AudioContext(2, Math.ceil(maxDuration * SAMPLE_RATE), SAMPLE_RATE);

    let sourcesProcessed = 0;
    for (const src of audioSources) {
        try {
            const response = await fetch(src);
            if (!response.ok) {
                console.warn(`Failed to fetch audio source: ${src}, status: ${response.status}`);
                continue;
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start(0);
            sourcesProcessed++;
        } catch (err) {
            console.warn(`Não foi possível processar ou decodificar o áudio para ${src}, a saltar.`, err);
        }
    }

    if (sourcesProcessed === 0 && audioSources.length > 0) {
        throw new Error("Nenhuma das fontes de áudio pôde ser carregada ou decodificada. Verifique se os ficheiros não estão corrompidos.");
    }
    
    if (sourcesProcessed === 0) return null;

    const renderedBuffer = await offlineContext.startRendering();
    
    const channels = [];
    for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
        channels.push(renderedBuffer.getChannelData(i));
    }

    return {
        sampleRate: renderedBuffer.sampleRate,
        numberOfChannels: renderedBuffer.numberOfChannels,
        channels,
    };
};


const CreativeEditorView: React.FC<CreativeEditorViewProps> = ({ userProfile }) => {
    const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(true);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLoadProjectModalOpen, setIsLoadProjectModalOpen] = useState(false);
    
    const [activeDownloadJob, setActiveDownloadJob] = useState<DownloadJob | null>(null);

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
    
    // State for mobile UI
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'properties' | 'layers' | null>(null);
    const [isUiVisible, setIsUiVisible] = useState(true);


    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const fileUploadRef = useRef<HTMLInputElement>(null);
    const fontUploadRef = useRef<HTMLInputElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceTimer = useRef<number | null>(null);
    const isInitialMount = useRef(true);

    // Effect for screen size detection
    useEffect(() => {
        const checkSize = () => {
            const mobile = window.innerWidth < 768;
            if (mobile !== isMobileView) {
                setIsMobileView(mobile);
                if (!mobile) { // If switching to desktop, close mobile panels
                    setMobilePanel(null);
                }
            }
        };
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, [isMobileView]);


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

    const addLayer = useCallback((layerData: { newLayer: Partial<AnyLayer>, videoDurationMs?: number }) => {
        const { newLayer, videoDurationMs } = layerData;
        const layerDefaults = { id: nanoid(), name: 'Nova Camada', x: 50, y: 50, rotation: 0, opacity: 1, isLocked: false, isVisible: true, width: 200, height: 200 };
        const finalLayer = { ...layerDefaults, ...newLayer } as AnyLayer;
        
        updateProject(draft => {
            const pageToUpdate = draft.pages[activePageIndex];
            pageToUpdate.layers.push(finalLayer);
            if (videoDurationMs && pageToUpdate.duration < videoDurationMs) {
                pageToUpdate.duration = videoDurationMs;
            }
        }, true);

        setSelectedLayerIds([finalLayer.id]);
    }, [activePageIndex, updateProject]);

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
        addLayer({ newLayer: { type: 'text', name: 'Texto', ...styles[preset], fontFamily: 'Inter', color: '#000000', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, textTransform: 'none' } as Partial<TextLayer>});
    };

    const handleAddShapeLayer = (shape: 'rectangle' | 'ellipse') => {
        addLayer({ newLayer: { type: 'shape', name: shape === 'rectangle' ? 'Retângulo' : 'Elipse', shape, fill: '#CCCCCC', stroke: '#000000', strokeWidth: 0 } as Partial<ShapeLayer>});
    };
    
    const handleAddAssetToCanvas = useCallback(async (asset: UploadedAsset | PublicAsset, dropCoords?: { x: number, y: number }) => {
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
            let mediaUrlToFetch: string;
    
            if ('asset_type' in asset) {
                if (!asset.asset_url) throw new Error("O URL do recurso público está ausente.");
                mediaUrlToFetch = asset.asset_url;
            } else {
                const userAsset = asset as UploadedAsset;
                if (!userAsset.storage_path) throw new Error("O caminho de armazenamento para o recurso do utilizador está ausente.");
                mediaUrlToFetch = await createSignedUrlForPath(userAsset.storage_path);
            }
    
            if (!mediaUrlToFetch) throw new Error("URL do recurso é inválido ou está ausente.");
    
            const response = await fetch(mediaUrlToFetch);
            if (!response.ok) throw new Error(`Falha ao buscar o recurso (status: ${response.status}). O URL pode ter expirado ou ser inválido.`);
            
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
                scale: scaleToFit, offsetX: 0, offsetY: 0,
                crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight } 
            };
            
            if (type === 'video') {
                const videoDurationMs = (duration || 0) * 1000;
                const newLayer: VideoLayer = { ...newLayerBase, type: 'video', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, startTime: 0, endTime: videoDurationMs, duration: videoDurationMs, volume: 1, isMuted: false, _videoElement: mediaElement as HTMLVideoElement };
                addLayer({newLayer, videoDurationMs});
            } else {
                 const newLayer: ImageLayer = { ...newLayerBase, type: 'image', id: nanoid(), rotation: 0, opacity: 1, isLocked: false, isVisible: true, _imageElement: mediaElement as HTMLImageElement };
                 addLayer({newLayer});
            }
        } catch (e) {
            console.error("Falha ao carregar a mídia do recurso", e);
            const message = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
            setError(`Não foi possível carregar o recurso '${asset.name}'. Detalhes: ${message}`);
        }
    }, [activePageIndex, activePage, addLayer, loadProjectState, setError, updateSelectedLayers]);

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
        e.stopPropagation();
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
    
    const handleCanvasAreaMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
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
        if (editingTextLayerId && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [editingTextLayerId]);

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

    const drawPageToCanvas = useCallback(async (page: Page, canvas: HTMLCanvasElement, options: { transparent: boolean, time?: number, currentlyEditingTextId?: string | null }) => {
        const { transparent, time, currentlyEditingTextId = null } = options;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context for export.");

        canvas.width = page.width;
        canvas.height = page.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!transparent) {
            ctx.fillStyle = page.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        for (const layer of page.layers) {
            if (!layer.isVisible) continue;
            
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
            ctx.rotate(layer.rotation * Math.PI / 180);

            if (layer.flipH) {
                ctx.scale(-1, 1);
            }
            if (layer.flipV) {
                ctx.scale(1, -1);
            }

            const drawX = -layer.width / 2;
            const drawY = -layer.height / 2;

            // Don't draw the layer's content if it's currently being edited in the textarea
            if (layer.id !== currentlyEditingTextId) {
                if (layer.type === 'image' || layer.type === 'video') {
                    const mediaLayer = layer as ImageLayer | VideoLayer;
                    // FIX: Type-check to correctly access _videoElement or _imageElement from the union type, resolving "Property does not exist on type" errors.
                    let mediaElement = mediaLayer.type === 'video' ? mediaLayer._videoElement : mediaLayer._imageElement;
                    if (!mediaElement) {
                        mediaElement = await loadMedia(mediaLayer.src, mediaLayer.type);
                    }
                    
                    if (mediaElement instanceof HTMLVideoElement && time !== undefined) {
                        // Precise seeking for accurate frame rendering
                        const videoTime = (time / 1000); // time in seconds
                        if (Math.abs(mediaElement.currentTime - videoTime) > 0.1) {
                            mediaElement.currentTime = videoTime;
                            await new Promise((resolve, reject) => {
                                const onSeeked = () => {
                                    mediaElement.removeEventListener('seeked', onSeeked);
                                    mediaElement.removeEventListener('error', onError);
                                    resolve(true);
                                };
                                const onError = (e: any) => {
                                    mediaElement.removeEventListener('seeked', onSeeked);
                                    mediaElement.removeEventListener('error', onError);
                                    reject(new Error("Erro ao procurar o frame do vídeo."));
                                };
                                mediaElement.addEventListener('seeked', onSeeked, { once: true });
                                mediaElement.addEventListener('error', onError, { once: true });
                            });
                        }
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
            }
            ctx.restore();
        }
    }, []);

    const drawScene = useCallback(() => {
        if (!activePage || !canvasRef.current) return;
        drawPageToCanvas(activePage, canvasRef.current!, { transparent: false, currentlyEditingTextId: editingTextLayerId });
    }, [activePage, drawPageToCanvas, editingTextLayerId]);

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
            // FIX: The call to adminUploadPublicProject was missing the 'projectName' argument and using the wrong function.
            await adminUploadPublicProject(file, projectName, 'Public', null);
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
    
    const exportImages = useCallback(async (options: DownloadOptions) => {
        const updateJob = (update: Partial<DownloadJob>) => setActiveDownloadJob(prev => prev ? { ...prev, ...update } : null);

        const offscreenCanvas = document.createElement('canvas');

        try {
            const pagesToExport = options.pageIndexes.map(i => project.pages[i]);
            
            if (pagesToExport.length === 1) { // Single image download
                const page = pagesToExport[0];
                updateJob({ statusText: `Renderizando ${page.name}...` });
                await drawPageToCanvas(page, offscreenCanvas, { transparent: options.transparent, time: 0, currentlyEditingTextId: null });
                const blob = await new Promise<Blob | null>(resolve => offscreenCanvas.toBlob(resolve, `image/${options.format}`, 0.95));
                if (!blob) throw new Error("Falha ao criar blob da imagem.");
                const url = URL.createObjectURL(blob);
                updateJob({ status: 'done', resultUrl: url, progress: 100 });
            } else { // Multiple images -> ZIP
                const zip = new JSZip();
                for (let i = 0; i < pagesToExport.length; i++) {
                    const page = pagesToExport[i];
                    updateJob({ statusText: `Compactando ${page.name} (${i+1}/${pagesToExport.length})...`, progress: (i / pagesToExport.length) * 100 });
                    await drawPageToCanvas(page, offscreenCanvas, { transparent: options.transparent, time: 0, currentlyEditingTextId: null });
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

    const exportVideo = useCallback(async (options: DownloadOptions) => {
        const updateJob = (update: Partial<DownloadJob>) => setActiveDownloadJob(prev => prev ? { ...prev, ...update } : null);
        
        let audioWorker: Worker | null = null;
        let videoWorker: Worker | null = null;
        let audioWorkerUrl: string | null = null;
        let videoWorkerUrl: string | null = null;

        try {
            updateJob({ statusText: 'A preparar áudio...' });

            const pagesToExport = options.pageIndexes.map(i => project.pages[i]).filter(Boolean);
            if (pagesToExport.length === 0) throw new Error("Nenhuma página selecionada para exportação.");
            
            const totalDuration = pagesToExport.reduce((acc, p) => acc + p.duration / 1000, 0);

            const videoLayerAudioSources = pagesToExport.flatMap(p => 
                p.layers.filter(l => l.type === 'video' && !(l as VideoLayer).isMuted).map(l => (l as VideoLayer).src)
            );
            const allAudioSources = [...project.audioTracks.map(t => t.src), ...videoLayerAudioSources];
            const uniqueAudioSources = [...new Set(allAudioSources)];

            let mixedAudio: any = null;
            if (uniqueAudioSources.length > 0) {
                 try {
                     if (typeof Worker === 'undefined') {
                         throw new Error('Web Workers não são suportados neste navegador.');
                     }
                     const audioBlob = new Blob([AUDIO_WORKER_CODE], { type: 'application/javascript' });
                     audioWorkerUrl = URL.createObjectURL(audioBlob);
                     audioWorker = new Worker(audioWorkerUrl, { type: 'module' });
                     mixedAudio = await new Promise((resolve, reject) => {
                         const timeout = setTimeout(() => reject(new Error('O processamento de áudio demorou demasiado tempo.')), 60000);
                         audioWorker!.onmessage = e => {
                            clearTimeout(timeout);
                            if (e.data.type === 'done') resolve(e.data.payload);
                            else if (e.data.type === 'error') reject(new Error(e.data.payload.message));
                         };
                         audioWorker!.onerror = e => {
                             clearTimeout(timeout);
                             reject(new Error(`Erro no worker de áudio: ${e.message}`));
                         };
                         audioWorker!.postMessage({ type: 'process', payload: { audioSources: uniqueAudioSources, maxDuration: totalDuration } });
                     });
                 } catch (workerError: any) {
                     console.warn('O worker de áudio falhou, a recorrer ao processamento na thread principal.', workerError);
                     updateJob({ statusText: 'A processar áudio (pode bloquear a UI)...' });
                     try {
                         mixedAudio = await processAudioOnMainThread(uniqueAudioSources, totalDuration);
                         if (mixedAudio === null && uniqueAudioSources.length > 0) {
                             console.warn("O processamento de áudio na thread principal não resultou em áudio.");
                         }
                     } catch (mainThreadError: any) {
                         console.error('O processamento de áudio na thread principal também falhou.', mainThreadError);
                         setError(`Falha ao processar áudio: ${mainThreadError.message}. O vídeo será exportado sem som.`);
                         mixedAudio = null;
                     }
                 } finally {
                     if (audioWorker) {
                         audioWorker.terminate();
                         if (audioWorkerUrl) URL.revokeObjectURL(audioWorkerUrl);
                     }
                 }
            }
             updateJob({ status: 'rendering', statusText: 'A configurar codificador de vídeo...' });

             const exportWidth = pagesToExport[0].width;
             const exportHeight = pagesToExport[0].height;
             const offscreenCanvas = new OffscreenCanvas(exportWidth, exportHeight);
             
             const videoBlob = new Blob([VIDEO_WORKER_CODE], { type: 'application/javascript' });
             videoWorkerUrl = URL.createObjectURL(videoBlob);
             videoWorker = new Worker(videoWorkerUrl, { type: 'module' });

             const finalBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                 videoWorker!.onmessage = async (e) => {
                    if (e.data.type === 'ready') {
                        const totalFrames = Math.ceil(totalDuration * options.frameRate);
                        let framesEncoded = 0;
                        let pageStartTime = 0;
                        updateJob({ statusText: 'A codificar frames...', progress: 0 });

                        for (const page of pagesToExport) {
                            const pageEndTime = pageStartTime + page.duration;
                            for (let time = pageStartTime; time < pageEndTime; time += 1000 / options.frameRate) {
                                await drawPageToCanvas(page, offscreenCanvas as any, { transparent: false, time, currentlyEditingTextId: null });
                                const frame = new (window as any).VideoFrame(offscreenCanvas, { timestamp: time * 1000 });
                                videoWorker!.postMessage({ type: 'frame', payload: { frame } }, [frame]);
                                framesEncoded++;
                                updateJob({ progress: (framesEncoded / totalFrames) * 100, statusText: `A codificar frame ${framesEncoded} de ${totalFrames}` });
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
                videoWorker!.onerror = e => reject(new Error(`Erro no worker de vídeo: ${e.message}`));
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
            if (audioWorkerUrl) URL.revokeObjectURL(audioWorkerUrl);
            if (videoWorkerUrl) URL.revokeObjectURL(videoWorkerUrl);
        }
    }, [project, drawPageToCanvas, setError]);

    const handleExport = useCallback(async (options: DownloadOptions) => {
        const jobId = nanoid();
        const thumbnailCanvas = document.createElement('canvas');
        await drawPageToCanvas(activePage, thumbnailCanvas, { transparent: false, time: 0, currentlyEditingTextId: null });
        const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.5);

        const newJob: DownloadJob = {
            id: jobId,
            fileName: `${project.name}.${options.format}`,
            status: 'preparing',
            progress: 0,
            statusText: 'A iniciar...',
            thumbnail,
        };
        setActiveDownloadJob(newJob);

        setTimeout(() => {
            if (options.format === 'mp4') {
                exportVideo(options);
            } else {
                exportImages(options);
            }
        }, 100);

    }, [project.name, activePage, drawPageToCanvas, exportImages, exportVideo]);

    return (
        <div className="h-full w-full flex flex-col bg-brand-dark text-white overflow-hidden">
            <ExportProgressModal 
                isOpen={!!activeDownloadJob}
                job={activeDownloadJob}
                onClose={() => setActiveDownloadJob(null)}
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
            <div className="flex-grow flex min-h-0 relative">
                {/* Desktop Sidebar */}
                <AnimatePresence>
                    {isUiVisible && (
                         <motion.div 
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="hidden md:flex flex-shrink-0 overflow-hidden"
                         >
                            <CreativeEditorSidebar
                                onAddTextLayer={handleAddTextLayer} onAddShapeLayer={handleAddShapeLayer}
                                onTriggerUpload={() => fileUploadRef.current?.click()}
                                uploadedAssets={assetContext?.assets || []}
                                onAddAssetToCanvas={handleAddAssetToCanvas}
                                onToggleLayersPanel={() => setIsLayersPanelOpen(p => !p)}
                                onAITool={handleAITool}
                                isLoadingAI={isLoadingAI} selectedLayers={selectedLayers}
                                onGenerateImage={handleGenerateImage}
                                isGeneratingImage={isGeneratingImage}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <main 
                    ref={canvasContainerRef} 
                    className="flex-grow flex items-center justify-center p-4 md:p-8 bg-brand-accent relative overflow-hidden"
                    onClick={(e) => {
                        // FIX: Add a click handler to the main canvas area to deselect all layers, resolving an issue where it was impossible to access screen properties when the canvas was fully covered by other layers.
                        if (!interaction && !editingTextLayerId && selectedLayerIds.length > 0) {
                            if (cropLayerId) onCancelCrop();
                            setSelectedLayerIds([]);
                        }
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {activePage && (
                        <div 
                            className="relative shadow-2xl" 
                            style={{ width: activePage.width, height: activePage.height, transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                            onClick={(e) => e.stopPropagation()} // Prevent this from triggering the main container's deselect
                            onMouseDown={handleCanvasAreaMouseDown}
                            onDoubleClick={handleDoubleClick}
                        >
                            <canvas ref={canvasRef} />
                            <div className="absolute top-0 left-0 w-full h-full">
                               <SelectionBox 
                                    layers={selectedLayers} 
                                    zoom={zoom} 
                                    cropLayerId={cropLayerId}
                                    playingVideoIds={playingVideoIds}
                                    onToggleVideoPlayback={toggleVideoPlayback}
                                />
                                 {editingLayer && (
                                    <div
                                        onMouseDown={e => e.stopPropagation()}
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
                        <div className="w-px h-5 bg-brand-accent/50 mx-1 hidden md:block"></div>
                        <button onClick={() => setIsUiVisible(p => !p)} className="p-2 hover:bg-brand-light rounded-md hidden md:block" title={isUiVisible ? "Ocultar Painéis" : "Mostrar Painéis"}>
                            {isUiVisible ? <IconEnterFocusMode className="w-5 h-5"/> : <IconExitFocusMode className="w-5 h-5"/>}
                        </button>
                    </div>
                </main>
                
                {/* Desktop Properties & Layers Panels */}
                <AnimatePresence>
                    {isUiVisible && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="hidden md:flex flex-shrink-0 overflow-hidden"
                        >
                            <PropertiesPanel
                                selectedLayers={selectedLayers} onUpdateLayers={(update) => updateSelectedLayers(update, false)} onCommitHistory={() => commitToHistory(project)}
                                canvasWidth={activePage?.width || 1080} canvasHeight={activePage?.height || 1080} onCanvasSizeChange={(w, h) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) {p.width = w; p.height = h;} }, true)}
                                onSaveProject={handleSaveProject} onLoadProject={() => setIsLoadProjectModalOpen(true)} onDownload={() => setIsDownloadModalOpen(true)}
                                cropLayerId={cropLayerId} onStartCrop={onStartCrop} onApplyCrop={onApplyCrop} onCancelCrop={onCancelCrop}
                                userProfile={userProfile} onSaveProjectAsPublic={handleSaveProjectAsPublic} onSaveProjectToComputer={handleSaveProjectToComputer} onNewProject={handleNewProject}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {isUiVisible && isLayersPanelOpen && !isMobileView && activePage && (
                         <LayersPanel
                            isOpen={isLayersPanelOpen} onClose={() => setIsLayersPanelOpen(false)} layers={activePage.layers} selectedLayerIds={selectedLayerIds}
                            onSelectLayer={(id, shiftKey) => setSelectedLayerIds(prev => shiftKey ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : [id])}
                            onReorderLayers={(reordered) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers = reordered; }, true)}
                            onToggleLayerLock={(id) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers.forEach(l => { if(l.id === id) l.isLocked = !l.isLocked; }); }, true)}
                        />
                    )}
                </AnimatePresence>

                 {/* MOBILE OVERLAYS */}
                <div className="md:hidden">
                    <AnimatePresence>
                        {mobilePanel && <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setMobilePanel(null)} />}
                        {mobilePanel === 'sidebar' && (
                            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="fixed top-0 left-0 h-full z-40">
                                {/* FIX: Corrected shorthand prop names by passing the correctly named handler functions from the parent component. */}
                                <CreativeEditorSidebar 
                                    isMobileView 
                                    onClose={() => setMobilePanel(null)} 
                                    onToggleLayersPanel={() => setMobilePanel('layers')} 
                                    onAddTextLayer={handleAddTextLayer}
                                    onAddShapeLayer={handleAddShapeLayer}
                                    onTriggerUpload={() => fileUploadRef.current?.click()}
                                    uploadedAssets={assetContext?.assets || []}
                                    onAddAssetToCanvas={handleAddAssetToCanvas}
                                    onAITool={handleAITool}
                                    isLoadingAI={isLoadingAI}
                                    selectedLayers={selectedLayers}
                                    onGenerateImage={handleGenerateImage}
                                    isGeneratingImage={isGeneratingImage}
                                />
                            </motion.div>
                        )}
                        {mobilePanel === 'properties' && (
                             <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="fixed top-0 right-0 h-full z-40">
                                {/* FIX: Corrected shorthand prop names by passing the correctly named handler functions from the parent component. */}
                                <PropertiesPanel 
                                    isMobileView 
                                    onClose={() => setMobilePanel(null)} 
                                    selectedLayers={selectedLayers} 
                                    onUpdateLayers={updateSelectedLayers} 
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
                            </motion.div>
                        )}
                         {mobilePanel === 'layers' && activePage && (
                             <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="fixed top-0 right-0 h-full z-40">
                                <LayersPanel
                                    isOpen={true} onClose={() => setMobilePanel(null)} layers={activePage.layers} selectedLayerIds={selectedLayerIds}
                                    onSelectLayer={(id, shiftKey) => setSelectedLayerIds(prev => shiftKey ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : [id])}
                                    onReorderLayers={(reordered) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers = reordered; }, true)}
                                    onToggleLayerLock={(id) => updateProject(draft => { const p = draft.pages[activePageIndex]; if(p) p.layers.forEach(l => { if(l.id === id) l.isLocked = !l.isLocked; }); }, true)}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            
            {/* Desktop Timeline */}
            <AnimatePresence>
                {isUiVisible && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="hidden md:block overflow-hidden"
                    >
                        <Timeline 
                            pages={project.pages} activePageIndex={activePageIndex} onSelectPage={setActivePageIndex} onAddPage={() => updateProject(draft => { const newPage: Page = { id: nanoid(), name: `Página ${draft.pages.length + 1}`, layers: [], duration: 5000, backgroundColor: '#FFFFFF', width: 1080, height: 1080 }; draft.pages.push(newPage); setActivePageIndex(draft.pages.length - 1); }, true)} 
                            onDeletePage={handleDeletePage} onDuplicatePage={handleDuplicatePage} onReorderPages={(pages) => updateProject(draft => { draft.pages = pages; }, true)}
                            onPageDurationChange={(index, duration) => updateProject(draft => { const p = draft.pages[index]; if(p) p.duration = duration; }, false)} 
                            projectTime={0} isPlaying={false} onPlayPause={() => {}} 
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* MOBILE BOTTOM TOOLBAR */}
            {isMobileView && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-brand-dark border-t border-brand-accent flex items-center justify-around z-30 shadow-lg px-2 pb-2">
                    <button onClick={() => setMobilePanel('sidebar')} className="flex flex-col items-center justify-center gap-1 text-xs text-gray-300 hover:text-white p-2">
                        <IconImageIcon className="w-6 h-6" />
                        <span>Design</span>
                    </button>
                    <button onClick={() => setMobilePanel('properties')} className="flex flex-col items-center justify-center gap-1 text-xs text-gray-300 hover:text-white p-2">
                        <IconEdit className="w-6 h-6" />
                        <span>Propriedades</span>
                    </button>
                    <button onClick={() => setMobilePanel('layers')} className="flex flex-col items-center justify-center gap-1 text-xs text-gray-300 hover:text-white p-2">
                        <IconLayers className="w-6 h-6" />
                        <span>Camadas</span>
                    </button>
                     <button onClick={() => setIsDownloadModalOpen(true)} className="flex flex-col items-center justify-center gap-1 text-xs text-gray-300 hover:text-white p-2">
                        <IconDownload className="w-6 h-6" />
                        <span>Download</span>
                    </button>
                </div>
            )}

            <input type="file" ref={fileUploadRef} onChange={handleFileUpload} multiple className="hidden" accept="image/*,video/*"/>
            <input type="file" ref={fontUploadRef} onChange={handleFontUpload} className="hidden" accept=".otf,.ttf,.woff,.woff2"/>
        </div>
    );
};

export default CreativeEditorView;