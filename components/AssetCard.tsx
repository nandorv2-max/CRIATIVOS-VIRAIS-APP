import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconHeart, IconTrash, IconFile, IconType, IconEdit, IconOptions } from './Icons.tsx';
import type { UploadedAsset } from '../types.ts';

interface AssetCardProps {
    asset: UploadedAsset;
    onPreview: (asset: UploadedAsset) => void;
    onToggleFavorite: (id: string, isFavorite: boolean) => void;
    onDelete: (asset: UploadedAsset) => void;
    isDeleting: boolean;
    onStartRename: (asset: UploadedAsset) => void;
    isRenaming: boolean;
    onRenameConfirm: () => void;
    onRenameCancel: () => void;
    renameValue: string;
    setRenameValue: (value: string) => void;
    openMenuId: string | null;
    setOpenMenuId: (id: string | null) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ 
    asset, onPreview, onToggleFavorite, onDelete, isDeleting, onStartRename, isRenaming, onRenameConfirm, onRenameCancel, renameValue, setRenameValue, openMenuId, setOpenMenuId 
}) => {
    
    const menuRef = useRef<HTMLDivElement>(null);
    const isPreviewable = asset.type === 'image' || asset.type === 'video';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId === asset.id) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openMenuId, asset.id, setOpenMenuId]);

    const renderThumbnail = () => {
        switch (asset.type) {
            case 'image':
            case 'video':
                return <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />;
            case 'font':
                return <div className="p-2 flex flex-col items-center justify-center h-full"><IconType className="w-8 h-8 text-gray-400" /><span className="text-xs mt-1 text-center truncate">{asset.name}</span></div>;
            case 'dng':
                return <div className="p-2 flex flex-col items-center justify-center h-full"><IconFile className="w-8 h-8 text-gray-400" /><span className="text-xs mt-1 text-center truncate">Preset DNG</span></div>;
            default:
                return <IconFile className="w-10 h-10 text-gray-400" />;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur(); // Trigger onBlur which calls onRenameConfirm
        } else if (e.key === 'Escape') {
            onRenameCancel();
        }
    };
    
    const handleCardClick = () => {
        if (isPreviewable && !isRenaming) {
            onPreview(asset);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative group aspect-[3/4] bg-brand-light rounded-lg overflow-hidden ${isPreviewable ? 'cursor-pointer' : ''}`}
            onClick={handleCardClick}
        >
            {isDeleting && (
                <div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                </div>
            )}
            <div 
                className="w-full h-full flex items-center justify-center"
            >
                {renderThumbnail()}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 p-2 flex flex-col justify-end pointer-events-none">
                <div className="pointer-events-auto">
                    {isRenaming ? (
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={onRenameConfirm}
                            autoFocus
                            onClick={e => e.stopPropagation()} // Prevent card click from triggering preview
                            className="w-full bg-black/80 text-white text-xs p-1 rounded border border-brand-primary outline-none"
                        />
                    ) : (
                        <p className="text-xs font-semibold text-white truncate" title={asset.name}>{asset.name}</p>
                    )}
                </div>
                
                {!isRenaming && (
                    <div className="absolute top-2 right-2 pointer-events-auto">
                        <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === asset.id ? null : asset.id); }}
                            className="p-1.5 bg-black/40 text-gray-200 rounded-full backdrop-blur-sm hover:bg-brand-primary/80 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                            title="Opções"
                        >
                            <IconOptions className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                            {openMenuId === asset.id && (
                                <motion.div
                                    ref={menuRef}
                                    initial={{ opacity: 0, y: -5, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -5, scale: 0.9, transition: { duration: 0.1 } }}
                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                    onClick={e => e.stopPropagation()}
                                    className="absolute top-full right-0 mt-1 w-48 bg-brand-dark rounded-md shadow-2xl z-20 p-1 border border-brand-accent/50"
                                >
                                    <button onClick={(e) => { e.stopPropagation(); onStartRename(asset); }} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-brand-light">
                                        <IconEdit className="w-4 h-4" /> Renomear
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(asset.id, !asset.is_favorite); }} className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-brand-light ${asset.is_favorite ? 'text-red-400' : ''}`}>
                                        <IconHeart filled={asset.is_favorite} className="w-4 h-4" /> {asset.is_favorite ? 'Remover Favorito' : 'Favoritar'}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(asset); }} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded text-red-400 hover:bg-red-500/10">
                                        <IconTrash className="w-4 h-4" /> Apagar
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default AssetCard;