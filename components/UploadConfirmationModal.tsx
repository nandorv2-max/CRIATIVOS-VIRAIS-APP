import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { IconX } from './Icons.tsx';
import { toBase64 } from '../utils/imageUtils.ts';
import type { Category } from '../types.ts';

interface UploadConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: File | null;
    categories: Category[];
    onConfirm: (assetName: string, categoryId: string | null) => void;
}

const UploadConfirmationModal: React.FC<UploadConfirmationModalProps> = ({ isOpen, onClose, file, categories, onConfirm }) => {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (file) {
            setName(file.name.replace(/\.[^/.]+$/, ""));
            // Default to the first category if available, otherwise null
            setCategoryId(categories.length > 0 ? categories[0].id : null); 
            if (file.type.startsWith('image/')) {
                toBase64(file).then(setPreview).catch(console.error);
            } else {
                setPreview(null);
            }
        }
    }, [file, categories]);

    const handleConfirm = () => {
        if (name.trim()) {
            onConfirm(name.trim(), categoryId);
        }
    };
    
    if (!isOpen || !file) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-md relative text-white"
            >
                <h3 className="text-xl font-semibold mb-4 text-center">Confirmar Upload</h3>
                <div className="space-y-4">
                    {preview && (
                        <div className="w-full aspect-video bg-black rounded-md flex items-center justify-center">
                            <img src={preview} alt="Pré-visualização" className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nome do Recurso</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>
                    {categories.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
                            <select
                                value={categoryId || ''}
                                onChange={(e) => setCategoryId(e.target.value || null)}
                                className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            >
                                <option value="">Nenhuma</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleConfirm} primary>Salvar e Fazer Upload</Button>
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-300" />
                </button>
            </motion.div>
        </div>
    );
};

export default UploadConfirmationModal;