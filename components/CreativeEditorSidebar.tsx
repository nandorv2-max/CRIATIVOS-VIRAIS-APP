
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Layer, ImageLayer, ShapeLayer, LayerUpdateProps, UploadedAsset } from '../types';
import { IconChevronDown, IconFlipHorizontal, IconFlipVertical, IconImage, IconLayers, IconShapes, IconSparkles, IconType, IconFrame, IconPlus, IconLine, IconArrow, IconFolder } from './Icons';
import UploadOptionsModal from './UploadOptionsModal';
import { toBase64 } from '../utils/imageUtils';
import { showGoogleDrivePicker } from '../services/googleDriveService';

type CreativeEditorSidebarProps = {
    onAddLayer: (type: 'text' | 'shape' | 'image' | 'frame' | 'video', options?: any) => void;
    onUpdateSelectedLayer: (props: LayerUpdateProps, commit?: boolean) => void;
    selectedLayer: Layer | null;
    onAITool: (tool: 'bg' | 'expand') => void;
    onGenerateAIImage: (prompt: string) => void;
    // FIX: Added 'project' to the union type to accommodate the loading state for project saving/loading.
    isLoadingAI: 'bg' | 'expand' | 'generate' | 'download' | 'project' | null;
    onToggleLayersPanel: () => void;
    onUpdateBackgroundColor: (color: string) => void;
    backgroundColor: string;
    onOpenBgRemover: () => void;
    isViralMode: boolean;
    onTriggerUpload: (type: 'image' | 'video' | 'audio') => void;
    uploadedAssets: UploadedAsset[];
    onAssetClick: (asset: UploadedAsset) => void;
    onSaveProject: () => void;
    onLoadProject: () => void;
};

interface AccordionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const Accordion: React.FC<AccordionProps> = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-700">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 text-left font-semibold text-gray-300 hover:bg-gray-700/50">
                <div className="flex items-center gap-3">
                    {icon}
                    <span>{title}</span>
                </div>
                <IconChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-3 bg-gray-900/50">
                    {children}
                </motion.div>
            )}
        </div>
    );
};

const CreativeEditorSidebar: React.FC<CreativeEditorSidebarProps> = ({ 
    onAddLayer, 
    onUpdateSelectedLayer, 
    selectedLayer, 
    onAITool, 
    onGenerateAIImage, 
    isLoadingAI,
    onToggleLayersPanel,
    onUpdateBackgroundColor,
    backgroundColor,
    onOpenBgRemover,
    isViralMode,
    onTriggerUpload,
    uploadedAssets,
    onAssetClick,
    onSaveProject,
    onLoadProject
}) => {
    const [aiPrompt, setAiPrompt] = useState('');
    
    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if(selectedLayer) onUpdateSelectedLayer({ opacity: parseFloat(e.target.value) }, true);
    };

    const handleFlip = (direction: 'h' | 'v') => {
        if (!selectedLayer || (selectedLayer.type !== 'image' && selectedLayer.type !== 'shape' && selectedLayer.type !== 'frame' && selectedLayer.type !== 'video')) return;
        if (direction === 'h') {
            onUpdateSelectedLayer({ flipH: !selectedLayer.flipH }, true);
        } else {
            onUpdateSelectedLayer({ flipV: !selectedLayer.flipV }, true);
        }
    };

    const handleBackgroundRemovalClick = () => {
        if (!selectedLayer || selectedLayer.type !== 'image' || isLoadingAI) return;
        
        const imageLayer = selectedLayer as ImageLayer;

        if (imageLayer.originalSrc) {
            onOpenBgRemover();
        } else {
            onAITool('bg');
        }
    };
    
    return (
        <div className="w-full h-full bg-gray-800/50 rounded-lg flex flex-col overflow-hidden relative">
            <div className="p-3 border-b border-gray-700">
                <button onClick={onToggleLayersPanel} className="w-full p-2 text-left rounded bg-gray-700 hover:bg-gray-600 transition-colors flex items-center gap-3 font-semibold text-gray-300">
                    <IconLayers />
                    <span>Camadas (Alt+1)</span>
                </button>
            </div>
            <div className="overflow-y-auto">
                 <Accordion title="Projeto" icon={<IconFolder className="w-5 h-5" />}>
                     <div className="space-y-2 p-2 text-sm">
                         <button onClick={onSaveProject} className="w-full p-2 text-left rounded bg-gray-700 hover:bg-gray-600 transition-colors">Salvar Projeto</button>
                         <button onClick={onLoadProject} className="w-full p-2 text-left rounded bg-gray-700 hover:bg-gray-600 transition-colors">Carregar Projeto</button>
                         <p className="text-xs text-gray-500 pt-1">O seu projeto é guardado automaticamente no seu navegador.</p>
                     </div>
                 </Accordion>
                 <Accordion title="Stúdio Mágico" icon={<IconSparkles />} defaultOpen>
                    <div className="space-y-3 p-2 text-sm">
                        <button onClick={handleBackgroundRemovalClick} disabled={!selectedLayer || selectedLayer.type !== 'image' || !!isLoadingAI} className="w-full p-2 text-left rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isLoadingAI === 'bg' ? 'A processar...' : 'Removedor de Fundo'}</button>
                        <button onClick={() => onAITool('expand')} disabled={!selectedLayer || selectedLayer.type !== 'image' || !!isLoadingAI} className="w-full p-2 text-left rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isLoadingAI === 'expand' ? 'A processar...' : 'Expansão Mágica'}</button>
                         {selectedLayer && (
                            <div className="pt-2 border-t border-gray-700/50 space-y-3">
                                <label className="block text-gray-400">
                                    Transparência
                                    <input type="range" min="0" max="1" step="0.01" value={selectedLayer.opacity} onChange={handleOpacityChange} className="w-full mt-1"/>
                                </label>
                                 <div className="flex gap-2">
                                     <button onClick={() => handleFlip('h')} disabled={selectedLayer.type !== 'image' && selectedLayer.type !== 'shape' && selectedLayer.type !== 'frame' && selectedLayer.type !== 'video'} className="w-full p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><IconFlipHorizontal /> Inverter H</button>
                                     <button onClick={() => handleFlip('v')} disabled={selectedLayer.type !== 'image' && selectedLayer.type !== 'shape' && selectedLayer.type !== 'frame' && selectedLayer.type !== 'video'} className="w-full p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><IconFlipVertical /> Inverter V</button>
                                 </div>
                            </div>
                         )}
                    </div>
                 </Accordion>
                 <Accordion title="Fundo" icon={<IconImage/>}>
                    <div className="p-2">
                        <label className="flex items-center justify-between text-gray-400">
                            Cor de Fundo
                            <input type="color" value={backgroundColor} onChange={e => onUpdateBackgroundColor(e.target.value)} className="w-10 h-8 p-0 border-none bg-transparent cursor-pointer"/>
                        </label>
                    </div>
                 </Accordion>
                <Accordion title="Molduras" icon={<IconFrame />}>
                    <div className="p-2 space-y-2">
                        <h4 className="text-gray-400 font-semibold text-sm">Adicionar Moldura</h4>
                        <div className="grid grid-cols-4 gap-2">
                            <button onClick={() => onAddLayer('frame', { shape: 'rectangle' })} className="aspect-square bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center border-2 border-dashed border-gray-500">
                                <div className="w-8 h-8 bg-gray-500/50"></div>
                            </button>
                            <button onClick={() => onAddLayer('frame', { shape: 'ellipse' })} className="aspect-square bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center border-2 border-dashed border-gray-500">
                                <div className="w-8 h-8 bg-gray-500/50 rounded-full"></div>
                            </button>
                        </div>
                    </div>
                </Accordion>
                 <Accordion title="Elementos" icon={<IconShapes />}>
                     <div className="space-y-4 p-2 text-sm">
                        <div>
                             <h4 className="text-gray-400 font-semibold mb-2">Texto</h4>
                             <button onClick={() => onAddLayer('text')} className="w-full p-3 text-left rounded bg-gray-700 hover:bg-gray-600 transition-colors font-bold text-lg">Adicionar Texto</button>
                        </div>
                        <div>
                             <h4 className="text-gray-400 font-semibold mb-2">Formas</h4>
                             <div className="grid grid-cols-4 gap-2">
                                 <button onClick={() => onAddLayer('shape', { shape: 'rectangle' })} className="aspect-square bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"><div className="w-8 h-8 bg-gray-400"></div></button>
                                 <button onClick={() => onAddLayer('shape', { shape: 'ellipse' })} className="aspect-square bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"><div className="w-8 h-8 bg-gray-400 rounded-full"></div></button>
                                 <button onClick={() => onAddLayer('shape', { shape: 'line' })} title="Line" className="aspect-square bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"><IconLine /></button>
                                 <button onClick={() => onAddLayer('shape', { shape: 'arrow' })} title="Arrow" className="aspect-square bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"><IconArrow /></button>
                             </div>
                             {selectedLayer?.type === 'shape' && (
                                <div className="mt-3">
                                    <label className="flex items-center gap-2 text-gray-400">
                                        Cor:
                                        <input type="color" 
                                            value={(selectedLayer as ShapeLayer).fill} 
                                            onInput={e => onUpdateSelectedLayer({ fill: (e.target as HTMLInputElement).value }, false)}
                                            onChange={e => onUpdateSelectedLayer({ fill: (e.target as HTMLInputElement).value }, true)}
                                            className="w-8 h-8 p-0 border-none bg-transparent"/>
                                    </label>
                                </div>
                             )}
                        </div>
                     </div>
                 </Accordion>
                  <Accordion title="Uploads" icon={<IconImage />} defaultOpen>
                     <div className="p-2 space-y-3">
                        {isViralMode ? (
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => onTriggerUpload('image')} className="p-2 text-center rounded bg-gray-700 hover:bg-gray-600 transition-colors font-semibold text-sm">Imagem</button>
                                <button onClick={() => onTriggerUpload('video')} className="p-2 text-center rounded bg-gray-700 hover:bg-gray-600 transition-colors font-semibold text-sm">Vídeo</button>
                                <button onClick={() => onTriggerUpload('audio')} className="p-2 text-center rounded bg-gray-700 hover:bg-gray-600 transition-colors font-semibold text-sm">Áudio</button>
                            </div>
                        ) : (
                            <button onClick={() => onTriggerUpload('image')} className="w-full p-2 text-center rounded bg-gray-700 hover:bg-gray-600 transition-colors font-semibold">Adicionar Imagem</button>
                        )}
                         <div className="space-y-2 pt-2 border-t border-gray-700/50">
                            <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Descreva uma imagem..." className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
                            <button onClick={() => onGenerateAIImage(aiPrompt)} disabled={!aiPrompt || !!isLoadingAI} className="w-full p-2 text-center rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-colors disabled:opacity-50">{isLoadingAI === 'generate' ? 'A gerar...' : 'Gerar com IA'}</button>
                         </div>
                         {uploadedAssets.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-700/50 max-h-64 overflow-y-auto">
                                {uploadedAssets.map(asset => (
                                    <div 
                                        key={asset.id} 
                                        onClick={() => onAssetClick(asset)} 
                                        draggable="true" 
                                        onDragStart={(e) => { 
                                            e.dataTransfer.setData('asset-src', asset.src);
                                            e.dataTransfer.setData('asset-type', asset.type);
                                        }} 
                                        className="aspect-square bg-gray-700 hover:opacity-80 rounded overflow-hidden cursor-pointer relative group">
                                        <img src={asset.thumbnail} className="w-full h-full object-cover pointer-events-none" alt={asset.name} />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <IconPlus className="w-8 h-8 text-white"/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                         )}
                     </div>
                 </Accordion>
            </div>
        </div>
    );
};

export default CreativeEditorSidebar;
