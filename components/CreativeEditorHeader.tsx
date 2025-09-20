import React, { useState } from 'react';
import ColorPicker from './ColorPicker.tsx';
import { 
    IconUndo, IconRedo, IconDownload, IconBringForward, IconSendBackward, IconDuplicate, IconTrash,
    IconBold, IconItalic, IconUnderline, IconAlignLeft, IconAlignCenter, IconAlignRight, IconLetterCase
} from './Icons.tsx';
import type { AnyLayer, TextLayer, ShapeLayer } from '../types.ts';

interface CreativeEditorHeaderProps {
    projectName: string;
    onProjectNameChange: (name: string) => void;
    onDownload: () => void;
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
}

const CreativeEditorHeader: React.FC<CreativeEditorHeaderProps> = ({
    projectName, onProjectNameChange, onDownload, onUndo, onRedo, canUndo, canRedo,
    selectedLayers, onUpdateSelectedLayers, onCommitHistory, onDeleteLayers, onDuplicateLayers, onReorderLayers,
    backgroundColor, onBackgroundColorChange
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
            <div className="flex items-center gap-1">
                <button onClick={() => onReorderLayers('forward')} className="p-2 rounded hover:bg-brand-accent" title="Trazer para a Frente"><IconBringForward/></button>
                <button onClick={() => onReorderLayers('backward')} className="p-2 rounded hover:bg-brand-accent" title="Enviar para Trás"><IconSendBackward/></button>
                <button onClick={onDuplicateLayers} className="p-2 rounded hover:bg-brand-accent" title="Duplicar"><IconDuplicate/></button>
                <button onClick={onDeleteLayers} className="p-2 rounded hover:bg-red-500/20 text-red-400" title="Apagar"><IconTrash/></button>
            </div>
        );

        if (singleSelectedLayer.type === 'text') {
            const layer = singleSelectedLayer as TextLayer;
            return (
                <div className="flex items-center gap-3">
                    <ColorPicker color={layer.color} onChange={(c) => onUpdateSelectedLayers({ color: c })} onInteractionEnd={onCommitHistory} />
                    <input type="number" value={layer.fontSize} onChange={e => onUpdateSelectedLayers({ fontSize: Number(e.target.value)})} onBlur={onCommitHistory} className="w-16 bg-brand-accent p-2 rounded text-center"/>
                    <button onClick={() => { onUpdateSelectedLayers({ fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold'}); onCommitHistory(); }} className={`p-2 rounded ${layer.fontWeight === 'bold' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconBold/></button>
                    <button onClick={() => { onUpdateSelectedLayers({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic'}); onCommitHistory(); }} className={`p-2 rounded ${layer.fontStyle === 'italic' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconItalic/></button>
                    <button onClick={() => { onUpdateSelectedLayers({ textDecoration: layer.textDecoration === 'underline' ? 'none' : 'underline'}); onCommitHistory(); }} className={`p-2 rounded ${layer.textDecoration === 'underline' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconUnderline/></button>
                    <button onClick={() => { onUpdateSelectedLayers({ textAlign: 'left'}); onCommitHistory(); }} className={`p-2 rounded ${layer.textAlign === 'left' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconAlignLeft/></button>
                    <button onClick={() => { onUpdateSelectedLayers({ textAlign: 'center'}); onCommitHistory(); }} className={`p-2 rounded ${layer.textAlign === 'center' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconAlignCenter/></button>
                    <button onClick={() => { onUpdateSelectedLayers({ textAlign: 'right'}); onCommitHistory(); }} className={`p-2 rounded ${layer.textAlign === 'right' ? 'bg-brand-primary' : 'hover:bg-brand-accent'}`}><IconAlignRight/></button>
                    <button onClick={() => {
                        let newTransform = 'none';
                        if (layer.textTransform === 'none') newTransform = 'uppercase';
                        else if (layer.textTransform === 'uppercase') newTransform = 'lowercase';
                        onUpdateSelectedLayers({ textTransform: newTransform as any});
                        onCommitHistory();
                    }} className="p-2 rounded hover:bg-brand-accent"><IconLetterCase/></button>
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

            <div className="flex-1 flex justify-center items-center">
                {renderContextualTools()}
            </div>

            <div className="flex items-center gap-4 w-1/3 justify-end">
                 <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Desfazer"><IconUndo/></button>
                 <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded hover:bg-brand-accent disabled:opacity-50" title="Refazer"><IconRedo/></button>
                <button onClick={onDownload} className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold bg-brand-primary text-white hover:bg-brand-secondary">
                    <IconDownload />
                    <span>Baixar</span>
                </button>
            </div>
        </header>
    );
};

export default CreativeEditorHeader;