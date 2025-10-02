import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getUserAssets } from '../services/databaseService.ts';
import type { UploadedAsset, UploadedAssetType } from '../types.ts';
import { IconX } from './Icons.tsx';

interface GalleryPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectAsset: (asset: UploadedAsset) => void;
    assetTypeFilter?: UploadedAssetType;
}

const GalleryPickerModal: React.FC<GalleryPickerModalProps> = ({ isOpen, onClose, onSelectAsset, assetTypeFilter = 'image' }) => {
    const [assets, setAssets] = useState<UploadedAsset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getUserAssets()
                .then(userAssets => {
                    // Filter for the specified asset type
                    setAssets(userAssets.filter(a => a.type === assetTypeFilter));
                })
                .catch(err => console.error("Failed to load user assets:", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, assetTypeFilter]);
    
    const handleSelect = (asset: UploadedAsset) => {
        onSelectAsset(asset);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-4xl h-[80vh] relative text-white flex flex-col"
            >
                <header className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold">Selecionar da Galeria</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-brand-accent transition-colors">
                        <IconX className="w-6 h-6 text-gray-300" />
                    </button>
                </header>
                <div className="flex-grow overflow-y-auto pr-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center text-gray-500">
                            <p>Nenhum item do tipo '{assetTypeFilter}' encontrado na sua galeria.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            {assets.map(asset => (
                                <motion.div 
                                    key={asset.id} 
                                    onClick={() => handleSelect(asset)}
                                    className="relative group aspect-square bg-brand-light rounded-lg overflow-hidden cursor-pointer"
                                >
                                    <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <p className="text-white font-bold text-lg">Selecionar</p>
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

export default GalleryPickerModal;