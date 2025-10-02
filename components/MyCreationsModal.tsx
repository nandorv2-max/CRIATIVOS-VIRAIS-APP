import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCreations, deleteCreation } from '../utils/db.ts';
import type { Creation } from '../types.ts';
import { IconX, IconTrash, IconRocket, IconLayers } from './Icons.tsx';

interface MyCreationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReload: (creation: Creation) => void;
}

const MyCreationsModal: React.FC<MyCreationsModalProps> = ({ isOpen, onClose, onReload }) => {
    const [creations, setCreations] = useState<Creation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getCreations()
                .then(setCreations)
                .catch(err => console.error("Failed to load creations:", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const handleDelete = async (id: string) => {
        // FIX: Use `window.confirm` to ensure it's available in all environments.
        if (window.confirm('Tem a certeza que quer apagar esta criação? Esta ação não pode ser desfeita.')) {
            await deleteCreation(id);
            setCreations(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleReload = (creation: Creation) => {
        onReload(creation);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-6xl h-[90vh] relative text-white flex flex-col"
            >
                <header className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold">Minhas Criações</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-brand-accent transition-colors">
                        <IconX className="w-6 h-6 text-gray-300" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto pr-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                        </div>
                    ) : creations.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center text-gray-500">
                            <p>Ainda não guardou nenhuma criação.<br/>As suas imagens geradas aparecerão aqui.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {creations.map(creation => (
                                <motion.div 
                                    key={creation.id} 
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative group aspect-square bg-brand-light rounded-lg overflow-hidden"
                                >
                                    <img src={creation.finalImage} alt="Criação guardada" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                        <p className="text-xs font-semibold text-white truncate" title={creation.prompt}>{creation.prompt}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <button onClick={() => handleReload(creation)} className="flex-1 text-xs bg-brand-primary/80 text-white p-1.5 rounded hover:bg-brand-primary backdrop-blur-sm">Recarregar</button>
                                            <button onClick={() => handleDelete(creation.id)} className="p-1.5 bg-red-600/80 text-white rounded hover:bg-red-500 backdrop-blur-sm"><IconTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default MyCreationsModal;
