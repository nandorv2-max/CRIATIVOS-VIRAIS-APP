import React from 'react';
import { motion, Reorder } from 'framer-motion';
import { AnyLayer, ImageLayer, TextLayer, ShapeLayer, VideoLayer } from '../types.ts';
import { IconImage, IconType, IconShapes, IconMovie, IconFrame, IconLock, IconUnlock, IconX } from './Icons.tsx';

interface LayersPanelProps {
    isOpen: boolean;
    onClose: () => void;
    layers: AnyLayer[];
    selectedLayerIds: string[];
    onSelectLayer: (id: string, shiftKey: boolean) => void;
    onReorderLayers: (layers: AnyLayer[]) => void;
    onToggleLayerLock: (id: string) => void;
}

const LayerIcon: React.FC<{ layer: AnyLayer }> = ({ layer }) => {
    const className = "w-5 h-5 text-gray-300";
    switch (layer.type) {
        case 'image': return <IconImage />;
        case 'text': return <IconType className={className}/>;
        case 'shape': return <IconShapes className={className}/>;
        case 'video': return <IconMovie />;
        default: return <IconImage />;
    }
};

const LayerPreview: React.FC<{ layer: AnyLayer }> = ({ layer }) => {
    const baseClasses = "w-10 h-10 object-cover rounded-sm bg-brand-light flex-shrink-0";
    if (layer.type === 'image') return <img src={(layer as ImageLayer).src} className={baseClasses} alt={layer.name}/>;
    if (layer.type === 'video') {
        // We can't easily show a video thumbnail here without more complex logic,
        // so we use an icon as a reliable fallback.
        return <div className={`${baseClasses} flex items-center justify-center`}><IconMovie /></div>
    }
    if (layer.type === 'text') {
        const textLayer = layer as TextLayer;
        return <div className={`${baseClasses} flex items-center justify-center p-1`}><span className="text-xs truncate" style={{color: textLayer.color, fontFamily: textLayer.fontFamily, fontWeight: textLayer.fontWeight}}>{textLayer.text}</span></div>
    }
     if (layer.type === 'shape') {
        const shapeLayer = layer as ShapeLayer;
        return <div className={`${baseClasses} flex items-center justify-center`}><div className={`w-6 h-6 ${shapeLayer.shape === 'ellipse' ? 'rounded-full' : ''}`} style={{backgroundColor: shapeLayer.fill}}></div></div>
    }
    return <div className="w-10 h-10 bg-brand-light rounded-sm"></div>;
};

const LayersPanel: React.FC<LayersPanelProps> = ({ isOpen, onClose, layers, selectedLayerIds, onSelectLayer, onReorderLayers, onToggleLayerLock }) => {
    if (!isOpen) return null;

    // The canvas z-index is the array order (0 is back).
    // The layers panel should show the top layer first (visually).
    // So we reverse the array for display and reordering.
    const handleReorder = (newOrder: AnyLayer[]) => {
        onReorderLayers([...newOrder].reverse());
    };
    
    const reversedLayers = [...layers].reverse();

    return (
        <motion.div 
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="absolute top-0 right-0 h-full w-80 bg-brand-dark/90 backdrop-blur-md shadow-2xl z-40 flex flex-col border-l border-brand-accent"
        >
            <div className="p-4 border-b border-brand-accent flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-semibold text-white">Camadas</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-brand-light">
                    <IconX className="w-5 h-5" />
                </button>
            </div>
            {layers.length > 0 ? (
                <Reorder.Group axis="y" values={reversedLayers} onReorder={handleReorder} className="overflow-y-auto p-2">
                    {reversedLayers.map(layer => (
                        <Reorder.Item key={layer.id} value={layer} className="bg-brand-accent/30 rounded-md mb-1">
                            <div 
                                onClick={(e) => onSelectLayer(layer.id, e.shiftKey)}
                                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${selectedLayerIds.includes(layer.id) ? 'bg-brand-primary/30 ring-1 ring-brand-primary' : 'hover:bg-brand-light/50'}`}
                            >
                                <LayerPreview layer={layer} />
                                <span className="text-sm truncate flex-grow">{layer.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); onToggleLayerLock(layer.id); }} className="p-1 text-gray-400 hover:text-white flex-shrink-0">
                                    {layer.isLocked ? <IconLock className="w-4 h-4" /> : <IconUnlock className="w-4 h-4" />}
                                </button>
                            </div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            ) : (
                <div className="flex-1 flex items-center justify-center text-center text-gray-500 text-sm p-4">
                    <p>Adicione elementos da barra lateral para começar.</p>
                </div>
            )}
        </motion.div>
    );
};

export default LayersPanel;
