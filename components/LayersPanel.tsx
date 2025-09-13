import React from 'react';
import { motion, Reorder } from 'framer-motion';
import { Layer, ImageLayer, TextLayer, ShapeLayer } from '../types';
import { IconImage, IconType, IconShapes } from './Icons';

interface LayersPanelProps {
    isOpen: boolean;
    onClose: () => void;
    layers: Layer[];
    selectedLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onReorderLayers: (layers: Layer[]) => void;
}

const LayerPreview: React.FC<{ layer: Layer }> = ({ layer }) => {
    if (layer.type === 'image') {
        return <img src={(layer as ImageLayer).src} className="w-8 h-8 object-cover rounded-sm bg-gray-600" alt="Layer preview"/>;
    }
    if (layer.type === 'text') {
        const textLayer = layer as TextLayer;
        const shortText = textLayer.text.length > 10 ? textLayer.text.substring(0, 10) + '...' : textLayer.text;
        return <div className="w-8 h-8 flex items-center justify-center bg-gray-600 rounded-sm text-xs truncate" style={{color: textLayer.color}}>{shortText}</div>
    }
     if (layer.type === 'shape') {
        const shapeLayer = layer as ShapeLayer;
        return <div className="w-8 h-8 flex items-center justify-center bg-gray-600 rounded-sm">
            <div className={`w-5 h-5 ${shapeLayer.shape === 'ellipse' ? 'rounded-full' : ''}`} style={{backgroundColor: shapeLayer.fill}}></div>
        </div>
    }
    return <div className="w-8 h-8 bg-gray-600 rounded-sm"></div>;
};


const LayersPanel: React.FC<LayersPanelProps> = ({ isOpen, onClose, layers, selectedLayerId, onSelectLayer, onReorderLayers }) => {
    if (!isOpen) return null;

    const handleReorder = (newOrder: Layer[]) => {
        // The list is reversed for display, so we reverse it back before updating state
        onReorderLayers([...newOrder].reverse());
    };
    
    // Reverse layers for intuitive display (top layer at the top of the list)
    const reversedLayers = [...layers].reverse();

    return (
        <motion.div 
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="absolute top-0 right-0 h-full w-80 bg-gray-800/90 backdrop-blur-md shadow-2xl z-20 flex flex-col border-l border-gray-700"
        >
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Camadas</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <Reorder.Group axis="y" values={reversedLayers} onReorder={handleReorder} className="overflow-y-auto p-2">
                {reversedLayers.map(layer => (
                    <Reorder.Item key={layer.id} value={layer}>
                        <div 
                            onClick={() => onSelectLayer(layer.id)}
                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors mb-1 ${selectedLayerId === layer.id ? 'bg-yellow-400/20' : 'hover:bg-gray-700/50'}`}
                        >
                            <div className="cursor-grab text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                            </div>
                            <LayerPreview layer={layer} />
                            <span className="text-sm truncate">Camada {layer.type}</span>
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </motion.div>
    );
};

export default LayersPanel;
