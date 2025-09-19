import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { nanoid } from 'nanoid';
import JSZip from 'jszip';
import CreativeEditorSidebar from '../CreativeEditorSidebar.tsx';
import PropertiesPanel from '../PropertiesPanel.tsx';
import LayersPanel from '../LayersPanel.tsx';
import PagesManager from '../Timeline.tsx';
import DownloadManager from '../DownloadManager.tsx';
import BackgroundRemoverModal from '../BackgroundRemoverModal.tsx';
import MagicCaptureModal from '../MagicCaptureModal.tsx';
import DownloadModal from '../DownloadModal.tsx';
import { removeBackground, magicCapture, magicExpand } from '../../services/geminiService.ts';
import { saveProject } from '../../utils/db.ts';
import type { 
    AnyLayer, UploadedAsset, DownloadJob, ImageLayer, VideoLayer, TextLayer, ShapeLayer, UploadedAssetType,
    Page, ProjectState, AudioTrack, Project, PublicAsset 
} from '../../types.ts';


const MAX_HISTORY_LENGTH = 50;

const createNewPage = (): Page => ({
    id: `page_${nanoid()}`,
    name: 'Página',
    layers: [],
    duration: 5,
    backgroundColor: '#FFFFFF',
    width: 1080,
    height: 1080,
});

const DEFAULT_PROJECT_STATE: ProjectState = {
    name: 'Projeto Sem Título',
    pages: [createNewPage()],
    audioTracks: [],
};

const degreesToRadians = (degrees: number) => degrees * (Math.PI / 180);
const rotatePoint = (point: { x: number; y: number }, center: { x: number; y: number }, angle: number) => {
    const angleRad = degreesToRadians(angle);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
};

type Interaction = {
    type: 'moving' | 'resizing' | 'rotating' | 'panning';
    initialLayers: Map<string, AnyLayer>;
    startPoint: { x: number; y: number; };
    handle?: string;
    initialPanOffset?: { x: number; y: number; };
};

interface CreativeEditorViewProps {
    setSaveProjectTrigger: React.Dispatch<React.SetStateAction<{ trigger: () => void }>>;
    setLoadProjectTrigger: React.Dispatch<React.SetStateAction<{ trigger: (project: Project) => void }>>;
}

const CreativeEditorView: React.FC<CreativeEditorViewProps> = ({ setSaveProjectTrigger, setLoadProjectTrigger }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [history, setHistory] = useState<ProjectState[]>([DEFAULT_PROJECT_STATE]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
    const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
    const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLoadingAI, setIsLoadingAI] = useState<'remove-bg' | 'magic-expand' | 'magic-capture' | 'download' | 'project' | false>(false);
    
    const [zoom, setZoom] = useState(0.5);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [interaction, setInteraction] = useState<Interaction | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const fontInputRef = useRef<HTMLInputElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const mediaDimensionsCache = useRef(new Map<string, {width: number, height: number}>());

    const projectState = project || DEFAULT_PROJECT_STATE;
    const activePage = projectState.pages[activePageIndex];
    const selectedLayers = activePage?.layers.filter(l => selectedLayerIds.includes(l.id)) || [];

    // History and State Management
    const updateProjectState = useCallback((updater: (prevState: ProjectState) => ProjectState, skipHistory = false) => {
        const updaterWrapper = (p: Project | null): Project => {
            const currentProjectState = p || DEFAULT_PROJECT_STATE;
            const newProjectState = updater(currentProjectState);
    
            if (!skipHistory) {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(newProjectState);
                if (newHistory.length > MAX_HISTORY_LENGTH) newHistory.shift();
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            }
    
            if (p) {
                return { ...p, ...newProjectState, lastModified: Date.now() };
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const newProject: Project = {
                    ...DEFAULT_PROJECT_STATE,
                    ...newProjectState,
                    id: `proj_${nanoid()}`,
                    thumbnail: canvas.toDataURL('image/jpeg', 0.5),
                    lastModified: Date.now(),
                };
                return newProject;
            }
        };
        setProject(updaterWrapper);
    }, [history, historyIndex]);

    const handleSave = useCallback(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const thumbnail = canvas.toDataURL('image/jpeg', 0.5);

        const projectToSave: Project = {
            ...projectState,
            id: project?.id || `proj_${nanoid()}`,
            thumbnail,
            lastModified: Date.now(),
        };
        await saveProject(projectToSave);
        setProject(projectToSave);
        alert('Projeto Salvo!');
    }, [project, projectState]);

    const handleLoad = useCallback((projectToLoad: Project) => {
        setProject(projectToLoad);
        setActivePageIndex(0);
        setSelectedLayerIds([]);
        setHistory([projectToLoad]);
        setHistoryIndex(0);
    }, []);

    useEffect(() => {
        setSaveProjectTrigger({ trigger: handleSave });
        setLoadProjectTrigger({ trigger: handleLoad });
    }, [handleSave, handleLoad, setSaveProjectTrigger, setLoadProjectTrigger]);

    // Layer manipulation
    const updateLayers = (updatedLayers: AnyLayer[], skipHistory = false) => {
        updateProjectState(prev => ({
            ...prev,
            pages: prev.pages.map((page, index) =>
                index === activePageIndex
                    ? { ...page, layers: updatedLayers }
                    : page
            ),
        }), skipHistory);
    };
    
    const updateLayerProps = (layerId: string, props: Partial<AnyLayer>, skipHistory = false) => {
        // FIX: Cast the result of spreading layer properties to `AnyLayer` to resolve a TypeScript error where the inferred type was too broad for a discriminated union.
        const newLayers = activePage.layers.map(l => l.id === layerId ? { ...l, ...props } as AnyLayer : l);
        updateLayers(newLayers, skipHistory);
    }
    
    const addLayer = (newLayer: AnyLayer) => {
         updateProjectState(prev => ({
            ...prev,
            pages: prev.pages.map((p, i) => i === activePageIndex ? {...p, layers: [...p.layers, newLayer] } : p)
        }));
        setSelectedLayerIds([newLayer.id]);
    };
    
    // Asset handling (simplified)
    const getMediaDimensions = (url: string, type: 'image' | 'video'): Promise<{width: number, height: number}> => {
        return new Promise((resolve, reject) => {
            if (mediaDimensionsCache.current.has(url)) {
                resolve(mediaDimensionsCache.current.get(url)!); return;
            }
            if (type === 'image') {
                const img = new Image();
                img.onload = () => {
                    const d = { width: img.naturalWidth, height: img.naturalHeight };
                    mediaDimensionsCache.current.set(url, d); resolve(d);
                };
                img.onerror = reject; img.src = url;
            } else {
                const video = document.createElement('video');
                video.onloadedmetadata = () => {
                     const d = { width: video.videoWidth, height: video.videoHeight };
                    mediaDimensionsCache.current.set(url, d); resolve(d);
                };
                video.onerror = reject; video.src = url;
            }
        });
    };
    
    // Canvas Interaction
    const getPointInCanvasSpace = useCallback((e: MouseEvent | React.MouseEvent) => {
        if (!canvasContainerRef.current) return { x: 0, y: 0 };
        const rect = canvasContainerRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - panOffset.x) / zoom,
            y: (e.clientY - rect.top - panOffset.y) / zoom,
        };
    }, [zoom, panOffset]);
    
    const onAddAssetToCanvas = async (asset: UploadedAsset | PublicAsset) => {
        const assetUrl = 'asset_url' in asset ? asset.asset_url : asset.url;
        const assetType = 'asset_type' in asset ? asset.asset_type : asset.type;
    
        try {
            let newLayer: AnyLayer;
            const mediaType = assetType === 'video' ? 'video' : 'image';
            const { width: naturalWidth, height: naturalHeight } = await getMediaDimensions(assetUrl, mediaType);
    
            const canvasCenterX = activePage.width / 2;
            const canvasCenterY = activePage.height / 2;
    
            const MAX_DIM = Math.min(activePage.width, activePage.height) * 0.5;
            const scaleFactor = Math.min(MAX_DIM / naturalWidth, MAX_DIM / naturalHeight, 1);
            const width = naturalWidth * scaleFactor;
            const height = naturalHeight * scaleFactor;
    
            const baseLayerProps = {
                id: `layer_${nanoid()}`,
                name: asset.name,
                x: canvasCenterX - width / 2,
                y: canvasCenterY - height / 2,
                width: width,
                height: height,
                rotation: 0,
                opacity: 100,
                isLocked: false,
                isVisible: true,
            };
            
            if (mediaType === 'image') {
                newLayer = {
                    ...baseLayerProps,
                    type: 'image',
                    src: assetUrl,
                    mediaNaturalWidth: naturalWidth,
                    mediaNaturalHeight: naturalHeight,
                    scale: 1,
                    crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight }
                } as ImageLayer;
            } else { // video
// FIX: Check for the 'duration' property on the asset object before accessing it to prevent errors when handling 'PublicAsset' which does not have this property.
                 const duration = 'duration' in asset && asset.duration ? asset.duration : 10;
                 newLayer = {
                    ...baseLayerProps,
                    type: 'video',
                    src: assetUrl,
                    startTime: 0,
                    endTime: duration,
                    duration: duration,
                    volume: 1,
                    isMuted: false,
                    mediaNaturalWidth: naturalWidth,
                    mediaNaturalHeight: naturalHeight,
                    scale: 1,
                    crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight }
                } as VideoLayer;
            }
            
            addLayer(newLayer);
    
        } catch (error) {
            console.error("Failed to add asset to canvas:", error);
            alert("Não foi possível adicionar o recurso à tela.");
        }
    };

    const renderLayer = (layer: AnyLayer) => {
        const isSelected = selectedLayerIds.includes(layer.id);
    
        const layerStyle: React.CSSProperties = {
            position: 'absolute',
            left: layer.x, top: layer.y,
            width: layer.width, height: layer.height,
            transform: `rotate(${layer.rotation}deg)`,
            cursor: layer.isLocked ? 'not-allowed' : (isSpacePressed ? 'grab' : 'move'),
            opacity: layer.opacity / 100,
            outline: isSelected ? '2px solid #fbbf24' : 'none',
            outlineOffset: '2px',
        };
    
        const mediaStyle: React.CSSProperties = {
            width: '100%',
            height: '100%',
            position: 'absolute',
            objectFit: 'cover',
        };
    
        if (layer.type === 'image' || layer.type === 'video') {
            const scale = layer.scale;
            const crop = layer.crop;
            const translateX = -crop.x * scale;
            const translateY = -crop.y * scale;
            const mediaWidth = layer.mediaNaturalWidth * scale;
            const mediaHeight = layer.mediaNaturalHeight * scale;
    
            mediaStyle.transform = `translate(${translateX}px, ${translateY}px)`;
            mediaStyle.width = `${mediaWidth}px`;
            mediaStyle.height = `${mediaHeight}px`;
            mediaStyle.objectFit = 'initial';
        }
    
        return (
            <div key={layer.id} style={layerStyle} data-layer-id={layer.id}>
                <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                    {layer.type === 'image' && <img src={(layer as ImageLayer).src} style={mediaStyle} draggable={false} />}
                    {layer.type === 'video' && <video src={(layer as VideoLayer).src} style={mediaStyle} playsInline autoPlay muted loop draggable={false} />}
                    {layer.type === 'text' && (
                        <div style={{...mediaStyle, color: (layer as TextLayer).color}}>{(layer as TextLayer).text}</div>
                    )}
                    {layer.type === 'shape' && (
                        <div style={{...mediaStyle, backgroundColor: (layer as ShapeLayer).fill}}></div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full flex bg-[#181818]">
            <CreativeEditorSidebar
                onAddTextLayer={(preset) => {}}
                onAddShapeLayer={(shape) => {}}
                onTriggerUpload={(type) => {}}
                uploadedAssets={uploadedAssets}
                onAddAssetToCanvas={onAddAssetToCanvas}
                onToggleLayersPanel={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
                onSaveProject={handleSave}
                onLoadProject={() => {}}
                onAITool={(tool) => {}}
                isLoadingAI={isLoadingAI}
                selectedLayers={selectedLayers}
            />
            
            <main className="flex-1 flex flex-col bg-[#121212] relative overflow-hidden items-center justify-center p-8">
                 <div 
                    ref={canvasContainerRef}
                    className="relative"
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: '0 0'
                    }}
                 >
                    <div style={{ width: activePage.width, height: activePage.height, backgroundColor: activePage.backgroundColor }}>
                        {activePage?.layers.map(layer => renderLayer(layer))}
                    </div>
                </div>
            </main>

            <PropertiesPanel
                selectedLayers={selectedLayers}
                onUpdateLayers={(layers) => updateLayers(layers, true)}
                canvasWidth={activePage.width}
                canvasHeight={activePage.height}
                onCanvasSizeChange={(w, h) => updateProjectState(p => ({...p, pages: p.pages.map((pg, i) => i === activePageIndex ? {...pg, width: w, height: h} : pg)}))}
                backgroundColor={activePage.backgroundColor}
                onBackgroundColorChange={color => updateProjectState(p => ({...p, pages: p.pages.map((pg, i) => i === activePageIndex ? {...pg, backgroundColor: color} : pg)}), true)}
                onDownload={() => setIsDownloadModalOpen(true)}
                onPublish={() => alert("Publicar no Portfólio (a implementar)")}
            />
        </div>
    );
};

export default CreativeEditorView;