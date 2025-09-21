import React from 'react';
import type { AnyLayer, TextLayer, ShapeLayer } from '../types.ts';
import Button from './Button.tsx';
import { IconDownload, IconFolder, IconSave } from './Icons.tsx';

interface PropertiesPanelProps {
    selectedLayers: AnyLayer[];
    onUpdateLayers: (update: Partial<AnyLayer>) => void;
    onCommitHistory: () => void;
    canvasWidth: number;
    canvasHeight: number;
    onCanvasSizeChange: (width: number, height: number) => void;
    onSaveProject: () => void;
    onLoadProject: () => void;
    onDownload: () => void;
}

const SIZE_PRESETS = [
    { name: 'Personalizado', width: 0, height: 0 },
    { name: 'Quadrado', width: 1080, height: 1080 },
    { name: 'Feed (Retrato)', width: 1080, height: 1350 },
    { name: 'Stories/Reels', width: 1080, height: 1920 },
    { name: 'Thumbnail YouTube', width: 1280, height: 720 },
];

const NumberInput: React.FC<{label: string, value: number, onChange: (v: number) => void, onBlur: () => void}> = ({ label, value, onChange, onBlur }) => (
    <div>
        <label className="text-xs font-medium text-gray-400 mb-1 block">{label}</label>
        <input type="number" value={Math.round(value)} onChange={e => onChange(Number(e.target.value))} onBlur={onBlur} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white"/>
    </div>
);

const SliderInput: React.FC<{label: string, value: number, onChange: (v: number) => void, onBlur: () => void, min: number, max: number, step: number}> = ({ label, value, onChange, onBlur, min, max, step }) => (
    <div>
        <div className="flex justify-between items-center text-xs font-medium text-gray-400 mb-1">
            <label>{label}</label>
            <span>{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : 0}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} onMouseUp={onBlur} onTouchEnd={onBlur} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm" />
    </div>
);

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedLayers, onUpdateLayers, onCommitHistory, canvasWidth, canvasHeight, onCanvasSizeChange,
    onSaveProject, onLoadProject, onDownload
}) => {
    
    const selectedPresetName = SIZE_PRESETS.find(p => p.width === canvasWidth && p.height === canvasHeight)?.name || 'Personalizado';

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = SIZE_PRESETS.find(p => p.name === e.target.value);
        if(selected && selected.name !== 'Personalizado') {
            onCanvasSizeChange(selected.width, selected.height);
        }
    };
    
    const renderCanvasProperties = () => (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold text-white">Propriedades da Tela</h3>
            <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Predefinições de Tamanho</label>
                <select onChange={handlePresetChange} value={selectedPresetName} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white">
                    {SIZE_PRESETS.map((p) => (
                        <option key={p.name} value={p.name}>{p.name} {p.width > 0 ? `(${p.width}x${p.height})` : ''}</option>
                    ))}
                </select>
            </div>
            {selectedPresetName === 'Personalizado' && (
                 <div className="grid grid-cols-2 gap-2">
                    <NumberInput label="Largura" value={canvasWidth} onChange={w => onCanvasSizeChange(w, canvasHeight)} onBlur={onCommitHistory} />
                    <NumberInput label="Altura" value={canvasHeight} onChange={h => onCanvasSizeChange(canvasWidth, h)} onBlur={onCommitHistory} />
                </div>
            )}
            <div className="pt-4 border-t border-brand-accent/50 space-y-2">
                 <Button onClick={onSaveProject} className="w-full">
                    <div className="flex items-center gap-2"><IconSave className="w-5 h-5" /> Salvar Projeto</div>
                </Button>
                <Button onClick={onLoadProject} className="w-full">
                    <div className="flex items-center gap-2"><IconFolder className="w-5 h-5"/> Carregar Projeto</div>
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

         const renderTextProperties = (l: TextLayer) => (
            <>
                <h4 className="text-sm font-bold text-gray-300 pt-4 border-t border-brand-accent/50">Texto</h4>
                <textarea value={l.text} onChange={e => onUpdateLayers({ text: e.target.value })} onBlur={onCommitHistory} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 text-white h-24 resize-y"/>
                <div className="space-y-3 pt-2">
                    <SliderInput label="Espaçamento Linhas" value={l.lineHeight || 1.2} onChange={v => onUpdateLayers({lineHeight: v})} onBlur={onCommitHistory} min={0.5} max={3} step={0.1} />
                    <SliderInput label="Espaçamento Letras" value={l.letterSpacing || 0} onChange={v => onUpdateLayers({letterSpacing: v})} onBlur={onCommitHistory} min={-50} max={100} step={1} />
                </div>
            </>
         );
         const renderShapeProperties = (l: ShapeLayer) => (
             <>
                <h4 className="text-sm font-bold text-gray-300 pt-4 border-t border-brand-accent/50">Forma</h4>
                <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">Preenchimento</label>
                    <div className="flex items-center gap-2">
                        {/* A ColorPicker would go here */}
                    </div>
                </div>
             </>
         );


         return (
             <div className="p-4 space-y-4">
                <h3 className="text-lg font-bold text-white truncate">{selectedLayers.length > 1 ? `${selectedLayers.length} Camadas` : layer.name}</h3>
                
                {/* Transform Properties */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-300">Transformar</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <NumberInput label="X" value={layer.x} onChange={v => onUpdateLayers({x: v})} onBlur={onCommitHistory} />
                        <NumberInput label="Y" value={layer.y} onChange={v => onUpdateLayers({y: v})} onBlur={onCommitHistory} />
                        <NumberInput label="Largura" value={layer.width} onChange={v => onUpdateLayers({width: v})} onBlur={onCommitHistory} />
                        <NumberInput label="Altura" value={layer.height} onChange={v => onUpdateLayers({height: v})} onBlur={onCommitHistory} />
                    </div>
                    <NumberInput label="Rotação" value={layer.rotation} onChange={v => onUpdateLayers({rotation: v})} onBlur={onCommitHistory} />
                </div>

                {/* Appearance Properties */}
                <div className="pt-4 border-t border-brand-accent/50 space-y-3">
                    <h4 className="text-sm font-bold text-gray-300">Aparência</h4>
                    <SliderInput 
                        label="Opacidade" 
                        value={Math.round((layer.opacity ?? 1) * 100)} 
                        onChange={v => onUpdateLayers({ opacity: v / 100 })} 
                        onBlur={onCommitHistory} 
                        min={0} 
                        max={100} 
                        step={1} 
                    />
                </div>

                {selectedLayers.length === 1 && layer.type === 'text' && renderTextProperties(layer as TextLayer)}
                {selectedLayers.length === 1 && layer.type === 'shape' && renderShapeProperties(layer as ShapeLayer)}
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