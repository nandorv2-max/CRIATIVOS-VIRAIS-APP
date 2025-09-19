import React, { useState, useRef, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconPlus } from '../Icons.tsx';
import UploadOptionsModal from '../UploadOptionsModal.tsx';
import { uploadUserAsset, toggleAssetFavorite, deleteUserAsset, renameUserAsset } from '../../services/databaseService.ts';
import type { UploadedAsset } from '../../types.ts';
import UserAssetsSetupInstructions from '../UserAssetsSetupInstructions.tsx';
import AssetCard from '../AssetCard.tsx';
import AssetPreviewModal from '../AssetPreviewModal.tsx';
import ErrorNotification from '../ErrorNotification.tsx';
import { AssetContext } from '../MainDashboard.tsx';

interface ProjectsViewProps {
    setActiveView: (view: string) => void;
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ setActiveView }) => {
    const [activeTab, setActiveTab] = useState('all');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const assetContext = useContext(AssetContext);
    if (!assetContext) throw new Error("AssetContext not found");
    const { assets, setAssets, isLoading, error, requiresSetup, refetchAssets } = assetContext;

    const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [previewAsset, setPreviewAsset] = useState<UploadedAsset | null>(null);
    const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleLocalUpload = () => {
        setIsUploadModalOpen(false);
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesToUpload = Array.from(e.target.files);
        if (filesToUpload.length === 0) return;
        
        try {
            await Promise.all(filesToUpload.map(file => uploadUserAsset(file)));
            await refetchAssets(); // Refresh the list from the source
        } catch (err: any) {
             setLocalError("Ocorreu um erro durante o upload.");
             console.error(err);
             await refetchAssets();
        }
    };
    
    const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
        const originalAssets = assets;
        // Optimistic UI update
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === id ? { ...asset, is_favorite: isFavorite } : asset
        ));
    
        try {
            await toggleAssetFavorite(id, isFavorite);
        } catch (err) {
            // Rollback on error
            setAssets(originalAssets);
            console.error(err);
            setLocalError("Não foi possível atualizar o favorito.");
        }
    };

    const handleDelete = async (assetToDelete: UploadedAsset) => {
        setOpenMenuId(null);
    
        const confirmed = window.confirm('Tem certeza que deseja apagar este item? Esta ação não pode ser desfeita.');
        if (!confirmed) return;
    
        const originalAssets = assets;
        setDeletingAssetId(assetToDelete.id);
        
        // Optimistic UI update
        setAssets(prevAssets => prevAssets.filter(asset => asset.id !== assetToDelete.id));
    
        try {
            await deleteUserAsset(assetToDelete);
            // On success, do nothing. The UI is already updated.
        } catch (err: any) {
            // On failure, revert the state and show an error.
            setAssets(originalAssets);
            let errorMessage = `Falha ao apagar o recurso: ${err.message || 'Ocorreu um erro desconhecido.'}`;
            setLocalError(errorMessage);
        } finally {
            setDeletingAssetId(null);
        }
    };
    
    const handleStartRename = (asset: UploadedAsset) => {
        setOpenMenuId(null);
        setRenamingAssetId(asset.id);
        setRenameValue(asset.name);
    };

    const handleRenameCancel = () => {
        setRenamingAssetId(null);
        setRenameValue('');
    };

    const handleRenameConfirm = async () => {
        if (!renamingAssetId) return;
        const newName = renameValue.trim();
        const assetToRename = assets.find(a => a.id === renamingAssetId);

        if (!assetToRename || !newName || newName === assetToRename.name) {
            handleRenameCancel();
            return;
        }

        const originalAssets = assets;
        
        // Optimistic UI Update
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === renamingAssetId ? { ...asset, name: newName } : asset
        ));
        
        handleRenameCancel();

        try {
            await renameUserAsset(renamingAssetId, newName);
        } catch (err) {
            // Rollback
            setAssets(originalAssets);
            console.error("Failed to rename asset:", err);
            setLocalError("Falha ao renomear o recurso.");
        }
    };
    
    const handlePreview = (asset: UploadedAsset) => {
        if (asset.type === 'image' || asset.type === 'video') {
            setPreviewAsset(asset);
        }
    };

    const filteredAssets = useMemo(() => {
        switch(activeTab) {
            case 'favorites': return assets.filter(a => a.is_favorite);
            case 'designs': return []; // Placeholder for future project types
            case 'images': return assets.filter(a => a.type === 'image');
            case 'videos': return assets.filter(a => a.type === 'video');
            case 'fonts': return assets.filter(a => a.type === 'font');
            case 'presets': return assets.filter(a => a.type === 'brmp');
            case 'all':
            default:
                return assets;
        }
    }, [assets, activeTab]);

    const tabs = [
        { id: 'all', label: 'Todos' },
        { id: 'favorites', label: 'Favoritos' },
        { id: 'designs', label: 'Designs' },
        { id: 'images', label: 'Imagens' },
        { id: 'videos', label: 'Vídeos' },
        { id: 'fonts', label: 'Fontes' },
        { id: 'presets', label: 'Pré-definições' },
    ];
    
    if (requiresSetup) {
        return <UserAssetsSetupInstructions error={error} onRetry={refetchAssets} />;
    }

    return (
        <>
            <ErrorNotification message={localError || (error && !requiresSetup ? error : null)} onDismiss={() => setLocalError(null)} />
            <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
            <UploadOptionsModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onLocalUpload={handleLocalUpload}
                onGalleryUpload={() => {
                    alert("A galeria será adicionada em breve!");
                    setIsUploadModalOpen(false);
                }}
            />
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple className="hidden" accept="image/*,video/*,.dng,.brmp,.otf,.ttf" />
            <div className="h-full w-full flex flex-col p-8 bg-brand-dark text-white">
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Meus Projetos e Recursos</h1>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors"
                    >
                        <IconPlus className="w-5 h-5" />
                        <span>Adicionar Recurso</span>
                    </button>
                </header>

                <nav className="flex items-center border-b border-brand-accent mb-6 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 font-semibold whitespace-nowrap ${activeTab === tab.id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <div className="flex-grow overflow-y-auto pr-2">
                    {isLoading ? (
                         <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div></div>
                    ) : (
                        <>
                             <div 
                                onClick={() => setActiveView('criativoViral')} 
                                className="cursor-pointer aspect-[16/5] w-full max-w-sm bg-brand-light rounded-lg flex items-center justify-center text-gray-400 hover:border-brand-primary border-2 border-transparent transition-all mb-8"
                            >
                                <div className="flex items-center gap-4">
                                    <IconPlus className="w-8 h-8"/>
                                    <p className="text-lg font-semibold">Criar Novo Design</p>
                                </div>
                            </div>
                            
                            <h2 className="text-xl font-bold mb-4">Meus Recursos</h2>
                            {filteredAssets.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                   {filteredAssets.map(asset => (
                                       <AssetCard 
                                            key={asset.id} 
                                            asset={asset} 
                                            onPreview={handlePreview}
                                            onToggleFavorite={handleToggleFavorite} 
                                            onDelete={handleDelete}
                                            isDeleting={deletingAssetId === asset.id}
                                            isRenaming={renamingAssetId === asset.id}
                                            onStartRename={handleStartRename}
                                            onRenameConfirm={handleRenameConfirm}
                                            onRenameCancel={handleRenameCancel}
                                            renameValue={renameValue}
                                            setRenameValue={setRenameValue}
                                            openMenuId={openMenuId}
                                            setOpenMenuId={setOpenMenuId}
                                        />
                                   ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm mt-4">Nenhum recurso encontrado neste filtro.</p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default ProjectsView;