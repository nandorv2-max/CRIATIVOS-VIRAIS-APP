import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { IconX } from './Icons.tsx';
// FIX: Add PublicAsset and Category types to handle different asset structures and category editing.
import type { UploadedAsset, PublicAsset, Category, PublicProject, PublicProjectCategory } from '../types.ts';

interface EditAssetModalProps {
    // FIX: Update asset prop to accept a union of PublicAsset and PublicProject for broader compatibility.
    asset: (UploadedAsset | PublicAsset | PublicProject) | null;
    isOpen: boolean;
    onClose: () => void;
    // FIX: Modify onSave signature to include an optional categoryId, making the component more versatile.
    onSave: (assetId: string, newName: string, categoryId: string | null) => Promise<void>;
    // FIX: Add an optional categories prop to enable category selection within the modal.
    categories?: (Category | PublicProjectCategory)[];
}

const EditAssetModal: React.FC<EditAssetModalProps> = ({ asset, isOpen, onClose, onSave, categories }) => {
    const [name, setName] = useState('');
    // FIX: Add state to manage the selected category ID.
    const [categoryId, setCategoryId] = useState<string | null>(null);

    useEffect(() => {
        if (asset) {
            setName(asset.name);
            // FIX: Set the initial category from the asset if it's a PublicAsset or PublicProject.
            if ('category_id' in asset) {
                setCategoryId(asset.category_id);
            }
        }
    }, [asset]);

    const handleSave = async () => {
        if (asset && name.trim()) {
            // FIX: Pass the current categoryId when saving the asset.
            await onSave(asset.id, name.trim(), categoryId);
            onClose();
        }
    };

    if (!isOpen || !asset) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-md relative text-white"
            >
                <h3 className="text-xl font-semibold mb-4 text-center">Editar Recurso</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>
                    {/* FIX: Conditionally render the category selector if categories are provided. */}
                    {categories && ('category_id' in asset) && (
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
                    <Button onClick={handleSave} primary>Salvar</Button>
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-300" />
                </button>
            </motion.div>
        </div>
    );
};

export default EditAssetModal;
