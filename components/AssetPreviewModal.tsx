import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX } from './Icons.tsx';
import type { UploadedAsset } from '../types.ts';

interface AssetPreviewModalProps {
    asset: UploadedAsset | null;
    onClose: () => void;
}

const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({ asset, onClose }) => {
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
                        className="relative max-w-full max-h-full"
                    >
                        {asset.type === 'image' && (
                            <img src={asset.url} alt={asset.name} className="block max-w-full max-h-[90vh] object-contain rounded-lg" />
                        )}
                        {asset.type === 'video' && (
                            <video src={asset.url} controls autoPlay className="block max-w-full max-h-[90vh] object-contain rounded-lg" />
                        )}
                        <button
                            onClick={onClose}
                            className="absolute -top-3 -right-3 p-2 bg-brand-dark text-white rounded-full hover:bg-brand-accent transition-colors"
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
