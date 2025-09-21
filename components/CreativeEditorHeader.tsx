import React from 'react';
import ColorPicker from './ColorPicker.tsx';
import { 
    IconUndo, IconRedo, IconBringForward, IconSendBackward, IconDuplicate, IconTrash,
    IconBold, IconItalic, IconUnderline, IconAlignLeft, IconAlignCenter, IconAlignRight, IconType
} from './Icons.tsx';
import type { AnyLayer, TextLayer, ShapeLayer } from '../types.ts';

interface CreativeEditorHeaderProps {
    projectName: string;
    onProjectNameChange: (name: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    selectedLayers: AnyLayer[];
    onUpdateSelectedLayers: (update: Partial<AnyLayer>) => void;
    onCommitHistory: () => void;
    onDeleteLayers: () => void;
    onDuplicateLayers: () => void;
    onReorderLayers: (direction: 'forward' | 'backward') => void;
    backgroundColor: string;
    onBackgroundColorChange: (color: string) => void;
    customFonts: string[];
    onTriggerFontUpload: () => void;
}

const CreativeEditorHeader: React.FC<CreativeEditorHeaderProps> = ({
    projectName, onProjectNameChange, onUndo, onRedo, canUndo, canRedo,
    selectedLayers, onUpdateSelectedLayers, onCommitHistory, onDeleteLayers, onDuplicateLayers, onReorderLayers,
    backgroundColor, onBackgroundColorChange, customFonts, onTriggerFontUpload
}) => {
    
    const singleSelectedLayer = selectedLayers.length === 1 ? selectedLayers[0] : null;

    const renderContextualTools = () => {
        if (!singleSelectedLayer) {
             return (
                 <div className="flex items-center gap-2">
                     <span className="text-sm font-medium text-gray-300">Fundo</span>
                     <ColorPicker color={backgroundColor} onChange={onBackgroundColorChange} onInteractionEnd={onCommitHistory} />
                 </div>
             );
        }

        const commonTools = (
            <div className="flex items-center gap-1 border-l border-brand-accent/50 ml-2 pl-2">
                <button onClick={() => onReorderLayers('forward')} className="p-2 rounded hover:bg-brand-accent" title="Trazer para a Frente"><IconBringForward/></button>
                <button onClick={() => onReorderLayers('backward')} className="p-2 rounded hover:bg-brand-accent" title="Enviar para Trás"><IconSendBackward/></button>
                <button onClick={onDuplicateLayers} className="p-2 rounded hover:bg-brand-accent" title="Duplicar"><IconDuplicate className="w-5 h-5"/></button>
                <button onClick={onDeleteLayers} className="p-2 rounded hover:bg-red-500/20 text-red-400" title="Apagar"><IconTrash className="w-5 h-5"/></button>
            </div>
        );

        if (singleSelectedLayer.type === 'text') {
            const layer = singleSelectedLayer as TextLayer;
            const handleTextUpdate = (update: Partial<TextLayer>) => {
                onUpdateSelectedLayers(update);
                onCommitHistory();
            };
            const systemFonts = ['Inter', 'Arial', 'Verdana', 'Caveat'];
            const allFonts = [...systemFonts, ...customFonts];

            return (
                <div className="flex items-center gap-2">
                    <select value={layer.fontFamily} onChange={e => handleTextUpdate({ fontFamily: e.target.value })} className="bg-brand-accent text-white p-2 rounded-md h-9 text-sm">
                        {allFonts.map(font => <option key={font} value={font}>{font}</option>)}
                    </select>
                    <button onClick={onTriggerFontUpload} className="p-2 h-9 rounded bg-brand-accent hover:bg-brand-light" title="Adicionar Fonte"><IconType/></button>
                    <ColorPicker color={layer.color} onChange={(c) => onUpdateSelectedLayers({ color: c })} onInteractionEnd={onCommitHistory} />
                    <input type="number" value={layer.fontSize} onChange={e => onUpdateSelectedLayers({ fontSize: Number(e.target.value)})} onBlur={onCommitHistory} className="w-16 bg-brand-accent p-2 rounded text-center h-9"/>
                    <div className="flex items-center gap-1 bg-brand-accent/50 rounded-md p-0.5 h-9">
                        <button onClick={() => handleTextUpdate({ fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold'})} className={`p-1.5 rounded ${layer.fontWeight === 'bold' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconBold/></button>
                        <button onClick={() => handleTextUpdate({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic'})} className={`p-1.5 rounded ${layer.fontStyle === 'italic' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconItalic/></button>
                        <button onClick={() => handleTextUpdate({ textDecoration: layer.textDecoration === 'underline' ? 'none' : 'underline'})} className={`p-1.5 rounded ${layer.textDecoration === 'underline' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconUnderline/></button>
                    </div>
                    <div className="flex items-center gap-1 bg-brand-accent/50 rounded-md p-0.5 h-9">
                        <button onClick={() => handleTextUpdate({ textAlign: 'left'})} className={`p-1.5 rounded ${layer.textAlign === 'left' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconAlignLeft/></button>
                        <button onClick={() => handleTextUpdate({ textAlign: 'center'})} className={`p-1.5 rounded ${layer.textAlign === 'center' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconAlignCenter/></button>
                        <button onClick={() => handleTextUpdate({ textAlign: 'right'})} className={`p-1.5 rounded ${layer.textAlign === 'right' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconAlignRight/></button>
                    </div>
                    <div className="flex items-center gap-1 bg-brand-accent/50 rounded-md p-0.5 h-9">
                        <button onClick={() => handleTextUpdate({ textTransform: 'uppercase' })} className={`px-2 py-1.5 rounded w-9 ${layer.textTransform === 'uppercase' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`} title="Maiúsculas">
                            <span className="font-bold text-sm">AA</span>
                        </button>
                        <button onClick={() => handleTextUpdate({ textTransform: 'lowercase' })} className={`px-2 py-1.5 rounded w-9 ${layer.textTransform === 'lowercase' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`} title="Minúsculas">
                            <span className="font-bold text-sm">aa</span>
                        </button>
                        <button onClick={() => handleTextUpdate({ textTransform: 'none' })} className={`px-2 py-1.5 rounded w-9 ${layer.textTransform === 'none' || !layer.textTransform ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`} title="Normal">
                            <span className="font-bold text-sm">Aa</span>
                        </button>
                    </div>
                    {commonTools}
                </div>
            );
        }
        
         if (singleSelectedLayer.type === 'shape') {
            const layer = singleSelectedLayer as ShapeLayer;
            return (
                 <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-300">Preenchimento</span>
                    <ColorPicker color={layer.fill} onChange={(c) => onUpdateSelectedLayers({ fill: c })} onInteractionEnd={onCommitHistory} />
                    {commonTools}
                 </div>
            );
        }

        return commonTools;
    };

    return (
        <header className="bg-brand-dark flex-shrink-0 p-3 flex items-center justify-between border-b border-brand-accent shadow-md z-30">
            <div className="flex items-center gap-4 w-1/3">
                 <input type="text" value={projectName} onChange={e => onProjectNameChange(e.target.value)} onBlur={onCommitHistory} className="bg-transparent text-white font-semibold focus:outline-none focus:ring-1 focus:ring-brand-accent p-1 rounded-md" />
            </div>

            <div className="flex-1 flex justify-center items-center min-w-0">
                {renderContextualTools()}
            </div>

            <div className="flex items-center gap-4 w-1/3 justify-end">
                 <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Desfazer"><IconUndo/></button>
                 <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Refazer"><IconRedo/></button>
            </div>
        </header>
    );
};

export default CreativeEditorHeader;