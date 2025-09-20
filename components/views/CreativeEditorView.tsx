import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { nanoid } from 'nanoid';
import CreativeEditorSidebar from '../CreativeEditorSidebar.tsx';
import PropertiesPanel from '../PropertiesPanel.tsx';
import LayersPanel from '../LayersPanel.tsx';
import Timeline from '../Timeline.tsx';
import DownloadModal from '../DownloadModal.tsx';
import CreativeEditorHeader from '../CreativeEditorHeader.tsx';
import { removeBackground } from '../../geminiService.ts';
import { saveProject as saveProjectToDb } from '../../utils/db.ts';
import type { 
    AnyLayer, UploadedAsset, ImageLayer, TextLayer, ShapeLayer, 
    Page, ProjectState, Project, PublicAsset 
} from '../../types.ts';
import { AssetContext } from '../MainDashboard.tsx';
import { blobToBase64 } from '../../utils/imageUtils.ts';
import { uploadUserAsset } from '../../services/databaseService.ts';

const MAX_HISTORY_LENGTH = 50;

const createNewPage = (name: string = 'Página 1'): Page => ({
    id: `page_${nanoid()}`,
    name,
    layers: [],
    duration: 5,
    backgroundColor: '#1E1E1E',
    width: 1080,
    height: 1080,
});

const DEFAULT_PROJECT_STATE: ProjectState = {
    name: 'Projeto Sem Título',
    pages: [createNewPage()],
    audioTracks: [],
};

// ======================= RENDER COMPONENTS =======================

const LayerComponent: React.FC<{ layer: AnyLayer }> = React.memo(({ layer }) => {
    const commonStyle: React.CSSProperties = {
        position: 'absolute',
        left: layer.x,
        top: layer.y,
        width: layer.width,
        height: layer.height,
        transform: `rotate(${layer.rotation}deg)`,
        opacity: layer.opacity / 100,
        pointerEvents: 'none',
        userSelect: 'none',
        transformOrigin: 'center center',
    };

    switch (layer.type) {
        case 'image':
            return <img src={(layer as ImageLayer).src} style={commonStyle} className="object-cover" draggable={false} alt={layer.name}/>;
        case 'text':
            const textLayer = layer as TextLayer;
            return (
                <div style={{...commonStyle, color: textLayer.color, fontSize: textLayer.fontSize, fontFamily: textLayer.fontFamily, fontWeight: textLayer.fontWeight, fontStyle: textLayer.fontStyle, textDecoration: textLayer.textDecoration, textAlign: textLayer.textAlign, lineHeight: textLayer.lineHeight, letterSpacing: `${textLayer.letterSpacing}px`, textTransform: textLayer.textTransform as any }} className="whitespace-pre-wrap">
                    {textLayer.text}
                </div>
            );
        case 'shape':
             const shapeLayer = layer as ShapeLayer;
            return <div style={{...commonStyle, backgroundColor: shapeLayer.fill, borderRadius: shapeLayer.shape === 'ellipse' ? '50%' : '0' }} />;
        default:
            return null;
    }
});

const SelectionBox: React.FC<{ layer: AnyLayer, onMouseDown: (e: React.MouseEvent, handle: string) => void }> = ({ layer, onMouseDown }) => {
    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        width: '12px',
        height: '12px',
        backgroundColor: 'white',
        border: '2px solid #4CAF50',
        borderRadius: '2px',
        zIndex: 10001
    };

    return (
        <div 
            style={{
                position: 'absolute',
                left: layer.x,
                top: layer.y,
                width: layer.width,
                height: layer.height,
                transform: `rotate(${layer.rotation}deg)`,
                border: '2px solid #4CAF50',
                pointerEvents: 'none',
                zIndex: 10000,
            }}
        >
            <div onMouseDown={(e) => onMouseDown(e, 'tl')} style={{...handleStyle, top: '-7px', left: '-7px', cursor: 'nwse-resize', pointerEvents: 'auto'}}></div>
            <div onMouseDown={(e) => onMouseDown(e, 'tr')} style={{...handleStyle, top: '-7px', right: '-7px', cursor: 'nesw-resize', pointerEvents: 'auto'}}></div>
            <div onMouseDown={(e) => onMouseDown(e, 'bl')} style={{...handleStyle, bottom: '-7px', left: '-7px', cursor: 'nesw-resize', pointerEvents: 'auto'}}></div>
            <div onMouseDown={(e) => onMouseDown(e, 'br')} style={{...handleStyle, bottom: '-7px', right: '-7px', cursor: 'nwse-resize', pointerEvents: 'auto'}}></div>
        </div>
    );
};


// ======================= UTILITY FUNCTIONS =======================

type Interaction =
    | { type: 'none' }
    | { type: 'dragging'; startMouse: { x: number; y: number }; startLayers: { id: string; x: number; y: number }[] }
    | { type: 'resizing'; startMouse: { x: number, y: number }; layer: AnyLayer, handle: string };

const isPointInLayer = (point: { x: number, y: number }, layer: AnyLayer): boolean => {
    const { x, y, width, height, rotation } = layer;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const translatedX = point.x - centerX;
    const translatedY = point.y - centerY;
    const rad = -rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = translatedX * cos - translatedY * sin;
    const rotatedY = translatedX * sin + translatedY * cos;
    return (
        rotatedX >= -width / 2 && rotatedX <= width / 2 &&
        rotatedY >= -height / 2 && rotatedY <= height / 2
    );
};


// ======================= MAIN COMPONENT =======================

interface CreativeEditorViewProps {
    setSaveProjectTrigger: React.Dispatch<React.SetStateAction<{ trigger: () => void }>>;
    setLoadProjectTrigger: React.Dispatch<React.SetStateAction<{ trigger: (project: Project) => void }>>;
}

const CreativeEditorView: React.FC<CreativeEditorViewProps> = ({ setSaveProjectTrigger, setLoadProjectTrigger }) => {
    const [project, setProject] = useState<Project>(() => ({
        id: `proj_${nanoid()}`,
        thumbnail: '',
        lastModified: Date.now(),
        ...DEFAULT_PROJECT_STATE
    }));
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [history, setHistory] = useState<ProjectState[]>([DEFAULT_PROJECT_STATE]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [interaction, setInteraction] = useState<Interaction>({ type: 'none' });

    const assetContext = useContext(AssetContext);
    if (!assetContext) throw new Error("AssetContext not found");
    const { assets: uploadedAssets, refetchAssets } = assetContext;

    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(true);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLoadingAI, setIsLoadingAI] = useState<'remove-bg' | false>(false);
    
    const [zoom] = useState(0.65);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    
    const activePage = project.pages[activePageIndex];
    const selectedLayers = activePage?.layers.filter(l => selectedLayerIds.includes(l.id)) || [];

    // ======================= STATE & HISTORY MANAGEMENT =======================

    const commitToHistory = useCallback((newState: ProjectState) => {
        const currentHistoryState = history[historyIndex];
        if (JSON.stringify(currentHistoryState) === JSON.stringify(newState)) return;

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newState);
        if (newHistory.length > MAX_HISTORY_LENGTH) {
            newHistory.shift();
        }
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);
    
    const updateProjectState = useCallback((updater: (p: ProjectState) => ProjectState, commit: boolean = true) => {
        setProject(prev => {
            const newState = updater(prev);
            if (commit) {
                commitToHistory(newState);
            }
            return { ...prev, ...newState, lastModified: Date.now() };
        });
    }, [commitToHistory]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setProject(p => ({...p, ...history[newIndex]}));
            setSelectedLayerIds([]);
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setProject(p => ({...p, ...history[newIndex]}));
            setSelectedLayerIds([]);
        }
    }, [history, historyIndex]);
    
    // ======================= LAYER MANIPULATION =======================

    const addLayer = (newLayer: AnyLayer) => {
        updateProjectState(p => {
            const newPages = p.pages.map((pg, i) => i === activePageIndex ? { ...pg, layers: [...pg.layers, newLayer] } : pg);
            return { ...p, pages: newPages };
        });
        setSelectedLayerIds([newLayer.id]);
    };
    
    const handleUpdateSelectedLayers = (update: Partial<AnyLayer>, commit: boolean = false) => {
        const updater = (p: ProjectState) => ({
            ...p,
            pages: p.pages.map((page, index) => 
                index === activePageIndex ? {
                    ...page,
                    layers: page.layers.map(layer => 
                        selectedLayerIds.includes(layer.id) ? { ...layer, ...update } as AnyLayer : layer
                    )
                } : page
            )
        });
        
        if (commit) {
            updateProjectState(updater, true);
        } else {
             setProject(prev => ({...prev, ...updater(prev)}));
        }
    };
    
    const handleDeleteLayers = () => {
        updateProjectState(p => ({ ...p, pages: p.pages.map((pg, i) => i === activePageIndex ? { ...pg, layers: pg.layers.filter(l => !selectedLayerIds.includes(l.id)) } : pg) }));
        setSelectedLayerIds([]);
    };

    const handleDuplicateLayers = () => {
        updateProjectState(p => {
            const pageToUpdate = p.pages[activePageIndex];
            const layersToDuplicate = pageToUpdate.layers.filter(l => selectedLayerIds.includes(l.id));
            const newIds: string[] = [];

            const duplicatedLayers = layersToDuplicate.map(layer => {
                 const newLayer = { ...layer, id: `layer_${nanoid()}`, x: layer.x + 20, y: layer.y + 20, name: `${layer.name} Cópia` } as AnyLayer;
                 newIds.push(newLayer.id);
                 return newLayer;
            });
            
            const newPages = p.pages.map((page, index) => 
                index === activePageIndex ? { ...page, layers: [...page.layers, ...duplicatedLayers] } : page
            );
            setSelectedLayerIds(newIds);
            return { ...p, pages: newPages };
        });
    };
    
    const handleReorderLayers = (direction: 'forward' | 'backward') => {
        updateProjectState(p => {
            const page = p.pages[activePageIndex];
            let layers = [...page.layers];
            if (selectedLayerIds.length !== 1) return p;
            const selectedIndex = layers.findIndex(l => l.id === selectedLayerIds[0]);

            if (selectedIndex === -1) return p;

            if (direction === 'forward' && selectedIndex < layers.length - 1) {
                [layers[selectedIndex], layers[selectedIndex + 1]] = [layers[selectedIndex + 1], layers[selectedIndex]];
            } else if (direction === 'backward' && selectedIndex > 0) {
                 [layers[selectedIndex], layers[selectedIndex - 1]] = [layers[selectedIndex - 1], layers[selectedIndex]];
            }
            
            const newPages = p.pages.map((pg, i) => i === activePageIndex ? { ...pg, layers } : pg);
            return { ...p, pages: newPages };
        });
    };

    // ======================= CANVAS & ASSETS =======================
    const handleAddTextLayer = () => addLayer({ id: `layer_${nanoid()}`, type: 'text', name: 'Texto', x: 50, y: 50, width: 300, height: 50, rotation: 0, opacity: 100, isLocked: false, isVisible: true, text: 'Adicionar Texto', fontFamily: 'Inter', fontSize: 48, color: '#FFFFFF', fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, textTransform: 'none' });
    const handleAddShapeLayer = () => addLayer({ id: `layer_${nanoid()}`, type: 'shape', name: 'Forma', x: 50, y: 50, width: 200, height: 200, rotation: 0, opacity: 100, isLocked: false, isVisible: true, shape: 'rectangle', fill: '#4CAF50', stroke: '#000000', strokeWidth: 0 });
    const handleAddAssetToCanvas = (asset: UploadedAsset | PublicAsset) => addLayer({ id: `layer_${nanoid()}`, type: 'image', name: asset.name, src: 'asset_url' in asset ? asset.asset_url : asset.url, x: 50, y: 50, width: 300, height: 300, rotation: 0, opacity: 100, isLocked: false, isVisible: true, mediaNaturalWidth: 300, mediaNaturalHeight: 300, scale: 1, crop: { x: 0, y: 0, width: 300, height: 300 }});
    const handleFilesUpload = async (files: FileList) => { for (const file of Array.from(files)) { const asset = await uploadUserAsset(file); refetchAssets(); handleAddAssetToCanvas(asset); } };
    const handleAITool = async (tool: 'remove-bg') => {
        if (tool === 'remove-bg' && selectedLayers[0]?.type === 'image') {
            setIsLoadingAI('remove-bg');
            try {
                const layer = selectedLayers[0] as ImageLayer;
                const blob = await fetch(layer.src).then(r => r.blob());
                const base64 = await blobToBase64(blob);
                const resultBase64 = await removeBackground(base64);
                handleUpdateSelectedLayers({ src: resultBase64, originalSrc: layer.src }, true);
            } catch (error) { alert("Falha ao remover o fundo."); } 
            finally { setIsLoadingAI(false); }
        }
    };

    // ======================= INTERACTION HANDLING (REBUILT) =======================

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canvasContainerRef.current) return;
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const mouse = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
        const clickedLayer = [...activePage.layers].reverse().find(layer => !layer.isLocked && isPointInLayer(mouse, layer));

        if (clickedLayer) {
            setSelectedLayerIds([clickedLayer.id]);
            setInteraction({ type: 'dragging', startMouse: { x: e.clientX, y: e.clientY }, startLayers: [{ id: clickedLayer.id, x: clickedLayer.x, y: clickedLayer.y }] });
        } else {
            setSelectedLayerIds([]);
            setInteraction({ type: 'none' });
        }
    };
    
    const handleSelectionHandleMouseDown = (e: React.MouseEvent, handle: string) => {
        e.stopPropagation();
        if (selectedLayers.length === 1) {
            setInteraction({ type: 'resizing', startMouse: { x: e.clientX, y: e.clientY }, layer: selectedLayers[0], handle });
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (interaction.type === 'none') return;
            e.preventDefault();

            if (interaction.type === 'dragging') {
                const dx = (e.clientX - interaction.startMouse.x) / zoom;
                const dy = (e.clientY - interaction.startMouse.y) / zoom;
                handleUpdateSelectedLayers({ x: interaction.startLayers[0].x + dx, y: interaction.startLayers[0].y + dy }, false);
            } else if (interaction.type === 'resizing') {
                const { layer, handle, startMouse } = interaction;
                const rad = layer.rotation * (Math.PI / 180);
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                let dx = (e.clientX - startMouse.x) / zoom;
                let dy = (e.clientY - startMouse.y) / zoom;

                // Rotate mouse delta to be in layer's coordinate system
                const rotatedDx = dx * cos + dy * sin;
                const rotatedDy = -dx * sin + dy * cos;

                let newWidth = layer.width;
                let newHeight = layer.height;
                let newX = layer.x;
                let newY = layer.y;
                
                if (handle.includes('r')) newWidth = Math.max(20, layer.width + rotatedDx);
                if (handle.includes('l')) newWidth = Math.max(20, layer.width - rotatedDx);
                if (handle.includes('b')) newHeight = Math.max(20, layer.height + rotatedDy);
                if (handle.includes('t')) newHeight = Math.max(20, layer.height - rotatedDy);

                const dw = newWidth - layer.width;
                const dh = newHeight - layer.height;

                // Adjust position to keep opposite handle stationary
                const cx = dw / 2;
                const cy = dh / 2;

                if (handle.includes('l')) newX += (cx * cos + cy * sin);
                if (handle.includes('r')) newX += (-cx * cos + cy * sin);
                if (handle.includes('t')) newY += (cx * sin - cy * cos);
                if (handle.includes('b')) newY += (-cx * sin - cy * cos);
                
                if (handle.includes('t')) newY += (-cy * cos - cx * sin);
                if (handle.includes('b')) newY += (cy * cos - cx * sin);

                handleUpdateSelectedLayers({ width: newWidth, height: newHeight, x: newX, y: newY }, false);
            }
        };

        const handleMouseUp = () => {
            if (interaction.type !== 'none') {
                commitToHistory(project);
                setInteraction({ type: 'none' });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [interaction, project, zoom, updateProjectState]);


    // ======================= HOTKEYS & TRIGGERS =======================

    useHotkeys('ctrl+z, cmd+z', handleUndo, { preventDefault: true }, [handleUndo]);
    useHotkeys('ctrl+y, cmd+shift+z', handleRedo, { preventDefault: true }, [handleRedo]);
    useHotkeys('backspace, delete', () => { if (selectedLayerIds.length > 0) handleDeleteLayers(); }, {}, [selectedLayerIds]);
    
    const handleSave = useCallback(async () => { await saveProjectToDb(project); alert('Projeto Salvo!'); }, [project]);
    const handleLoad = useCallback((projectToLoad: Project) => {
        setProject(projectToLoad); setActivePageIndex(0); setSelectedLayerIds([]);
        setHistory([projectToLoad]); setHistoryIndex(0);
    }, []);

    useEffect(() => {
        setSaveProjectTrigger({ trigger: handleSave });
        setLoadProjectTrigger({ trigger: handleLoad });
    }, [setSaveProjectTrigger, setLoadProjectTrigger, handleSave, handleLoad]);

    // ======================= RENDER =======================

    return (
        <div className="h-full w-full flex flex-col bg-[#181818]">
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => e.target.files && handleFilesUpload(e.target.files)} />
            <CreativeEditorHeader
                projectName={project.name} onProjectNameChange={name => updateProjectState(p => ({...p, name}), false)}
                onDownload={() => setIsDownloadModalOpen(true)}
                onUndo={handleUndo} onRedo={handleRedo} canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1}
                selectedLayers={selectedLayers}
                onUpdateSelectedLayers={(update) => handleUpdateSelectedLayers(update, true)}
                onCommitHistory={() => commitToHistory(project)}
                onDeleteLayers={handleDeleteLayers} onDuplicateLayers={handleDuplicateLayers} onReorderLayers={handleReorderLayers}
                backgroundColor={activePage.backgroundColor} // FIX: Corrected the background color change handler to update the page state instead of layer state.
onBackgroundColorChange={(color) => updateProjectState(p => ({ ...p, pages: p.pages.map((pg, i) => i === activePageIndex ? { ...pg, backgroundColor: color } : pg) }), false)}
            />
            <div className="flex-grow flex min-h-0">
                <CreativeEditorSidebar 
                    onAddTextLayer={handleAddTextLayer} onAddShapeLayer={handleAddShapeLayer}
                    onTriggerUpload={() => fileInputRef.current?.click()}
                    uploadedAssets={uploadedAssets} onAddAssetToCanvas={handleAddAssetToCanvas} 
                    onToggleLayersPanel={() => setIsLayersPanelOpen(p => !p)} 
                    onSaveProject={handleSave} onLoadProject={() => {}} 
                    onAITool={handleAITool} isLoadingAI={isLoadingAI} selectedLayers={selectedLayers}
                />
                <main className="flex-1 flex flex-col bg-[#121212] relative overflow-hidden items-center justify-center p-8 select-none">
                    <div 
                        ref={canvasContainerRef} 
                        className="relative" 
                        onMouseDown={handleCanvasMouseDown}
                        style={{
                            width: activePage.width * zoom,
                            height: activePage.height * zoom,
                        }}
                    >
                        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                            <div 
                                className="relative shadow-lg" 
                                style={{ 
                                    width: activePage.width, 
                                    height: activePage.height, 
                                    backgroundColor: activePage.backgroundColor 
                                }}
                            >
                                {activePage?.layers.map((layer) => (
                                    <LayerComponent key={layer.id} layer={layer} />
                                ))}
                                {selectedLayers.length === 1 && <SelectionBox layer={selectedLayers[0]} onMouseDown={handleSelectionHandleMouseDown}/>}
                            </div>
                        </div>
                    </div>
                </main>
                <PropertiesPanel
                    selectedLayers={selectedLayers}
                    onUpdateLayers={(update) => handleUpdateSelectedLayers(update, false)}
                    onCommitHistory={() => commitToHistory(project)}
                    canvasWidth={activePage.width} canvasHeight={activePage.height}
                    onCanvasSizeChange={(w, h) => updateProjectState(p => ({ ...p, pages: p.pages.map((pg, i) => i === activePageIndex ? { ...pg, width: w, height: h } : pg) }))}
                    backgroundColor={activePage.backgroundColor} onBackgroundColorChange={(c) => updateProjectState(p => ({ ...p, pages: p.pages.map((pg, i) => i === activePageIndex ? { ...pg, backgroundColor: c } : pg) }), false)}
                    onDownload={() => setIsDownloadModalOpen(true)} onPublish={() => {}}
                />
                <LayersPanel 
                    isOpen={isLayersPanelOpen} 
                    onClose={() => setIsLayersPanelOpen(false)} 
                    layers={activePage.layers} 
                    selectedLayerIds={selectedLayerIds} 
                    onSelectLayer={(id, shift) => setSelectedLayerIds([id])}
                    onReorderLayers={(layers) => updateProjectState(p => ({ ...p, pages: p.pages.map((pg, i) => i === activePageIndex ? { ...pg, layers } : pg) }))} 
                    onToggleLayerLock={(id) => handleUpdateSelectedLayers({ isLocked: !selectedLayers.find(l=>l.id===id)?.isLocked }, true)}
                />
            </div>
            <Timeline pages={project.pages} activePageIndex={activePageIndex} onSelectPage={setActivePageIndex} onAddPage={() => {}} onDeletePage={() => {}} onDuplicatePage={() => {}} onReorderPages={() => {}} onPageDurationChange={() => {}} projectTime={0} isPlaying={false} onPlayPause={() => {}} />
            <DownloadModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} onDownload={() => {}} hasVideoOrAudio={false} />
        </div>
    );
};

export default CreativeEditorView;