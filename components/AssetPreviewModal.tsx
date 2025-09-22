import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX } from './Icons.tsx';
import type { UploadedAsset } from '../types.ts';
import { createSignedUrlForPath } from '../services/databaseService.ts';

interface AssetPreviewModalProps {
    asset: UploadedAsset | null;
    onClose: () => void;
}

const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({ asset, onClose }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (asset && asset.storage_path) {
            setIsLoading(true);
            createSignedUrlForPath(asset.storage_path)
                .then(setSignedUrl)
                .catch(err => {
                    console.error("Failed to get signed URL for preview", err);
                    setSignedUrl(null);
                })
                .finally(() => setIsLoading(false));
        } else {
            setSignedUrl(null);
        }
    }, [asset]);

    return (
        <AnimatePresence>
            {asset && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-8"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative max-w-full max-h-full bg-brand-dark rounded-lg flex items-center justify-center"
                    >
                        {isLoading && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary m-16"></div>}
                        {!isLoading && signedUrl && (
                            <>
                                {asset.type === 'image' && (
                                    <img src={signedUrl} alt={asset.name} className="block max-w-full max-h-[90vh] object-contain rounded-lg" />
                                )}
                                {asset.type === 'video' && (
                                    <video src={signedUrl} controls autoPlay className="block max-w-full max-h-[90vh] object-contain rounded-lg" />
                                )}
                            </>
                        )}
                        {!isLoading && !signedUrl && (
                             <div className="p-16 text-center text-red-400">Não foi possível carregar a pré-visualização.</div>
                        )}
                        <button
                            onClick={onClose}
                            className="absolute -top-3 -right-3 p-2 bg-brand-dark text-white rounded-full hover:bg-brand-accent transition-colors border border-brand-accent"
                            aria-label="Close preview"
                        >
                            <IconX className="w-6 h-6" />
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AssetPreviewModal;