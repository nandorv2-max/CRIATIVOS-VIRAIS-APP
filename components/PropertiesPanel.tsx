import React, { useState } from 'react';
import type { AnyLayer, TextLayer, ShapeLayer } from '../types.ts';
import ColorPicker from './ColorPicker.tsx';
import Button from './Button.tsx';
import { IconDownload, IconSparkles } from './Icons.tsx';

interface PropertiesPanelProps {
    selectedLayers: AnyLayer[];
    onUpdateLayers: (update: Partial<AnyLayer>) => void;
    onCommitHistory: () => void;
    canvasWidth: number;
    canvasHeight: number;
    onCanvasSizeChange: (width: number, height: number) => void;
    backgroundColor: string;
    onBackgroundColorChange: (color: string) => void;
    onDownload: () => void;
    onPublish: () => void;
}

const SIZE_PRESETS = [
    { name: 'Quadrado', width: 1080, height: 1080 },
    { name: 'Feed (Retrato)', width: 1080, height: 1350 },
    { name: 'Stories/Reels', width: 1080, height: 1920 },
    { name: 'Thumbnail YouTube', width: 1280, height: 720 },
];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedLayers, onUpdateLayers, onCommitHistory, canvasWidth, canvasHeight, onCanvasSizeChange,
    backgroundColor, onBackgroundColorChange, onDownload, onPublish
}) => {
    
    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = SIZE_PRESETS[Number(e.target.value)];
        if(selected) {
            onCanvasSizeChange(selected.width, selected.height);
        }
    };
    
    const renderCanvasProperties = () => (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold text-white">Propriedades da Tela</h3>
            <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Predefinições de Tamanho</label>
                <select onChange={handlePresetChange} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white">
                    {SIZE_PRESETS.map((p, i) => (
                        <option key={i} value={i}>{p.name} ({p.width}x{p.height})</option>
                    ))}
                    <option>Personalizado</option>
                </select>
            </div>
             <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">Largura</label>
                    <input type="number" value={canvasWidth} onChange={e => onCanvasSizeChange(Number(e.target.value), canvasHeight)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white"/>
                </div>
                 <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">Altura</label>
                    <input type="number" value={canvasHeight} onChange={e => onCanvasSizeChange(canvasWidth, Number(e.target.value))} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white"/>
                </div>
            </div>
             <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Cor de Fundo</label>
                <div className="flex items-center gap-2">
                    <ColorPicker color={backgroundColor} onChange={onBackgroundColorChange} onInteractionEnd={onCommitHistory} />
                    <input type="text" value={backgroundColor} onChange={e => onBackgroundColorChange(e.target.value)} onBlur={onCommitHistory} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white font-mono"/>
                </div>
            </div>
            <div className="pt-4 border-t border-brand-accent/50 space-y-2">
                <Button onClick={onPublish} className="w-full">
                    <div className="flex items-center gap-2"><IconSparkles /> Publicar no Portfólio</div>
                </Button>
                <Button onClick={onDownload} primary className="w-full">
                     <div className="flex items-center gap-2"><IconDownload /> Fazer Download</div>
                </Button>
            </div>
        </div>
    );
    
    const renderLayerProperties = () => {
         const layer = selectedLayers[0];
         if (!layer) return null;

         return (
             <div className="p-4 space-y-4">
                <h3 className="text-lg font-bold text-white truncate">{layer.name}</h3>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">X</label>
                        <input type="number" value={Math.round(layer.x)} onChange={e => onUpdateLayers({ x: Number(e.target.value) })} onBlur={onCommitHistory} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white"/>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">Y</label>
                        <input type="number" value={Math.round(layer.y)} onChange={e => onUpdateLayers({ y: Number(e.target.value) })} onBlur={onCommitHistory} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white"/>
                    </div>
                     <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">Largura</label>
                        <input type="number" value={Math.round(layer.width)} onChange={e => onUpdateLayers({ width: Number(e.target.value) })} onBlur={onCommitHistory} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white"/>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">Altura</label>
                        <input type="number" value={Math.round(layer.height)} onChange={e => onUpdateLayers({ height: Number(e.target.value) })} onBlur={onCommitHistory} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white"/>
                    </div>
                </div>
             </div>
         );
    };

    return (
        <aside className="w-80 h-full bg-brand-dark/90 backdrop-blur-md shadow-lg z-20 flex-shrink-0 border-l border-brand-accent overflow-y-auto">
            {selectedLayers.length > 0 ? renderLayerProperties() : renderCanvasProperties()}
        </aside>
    );
};

export default PropertiesPanel;