import React, { useState, useRef, useMemo, useContext } from 'react';
import { motion } from 'framer-motion';
import { IconPlus, IconHeart } from '../Icons.tsx';
import UploadOptionsModal from '../UploadOptionsModal.tsx';
import { uploadUserAsset, toggleAssetFavorite, deleteUserAsset, renameUserAsset } from '../../services/databaseService.ts';
import type { UploadedAsset } from '../../types.ts';
import UserAssetsSetupInstructions from '../UserAssetsSetupInstructions.tsx';
import AssetCard from '../AssetCard.tsx';
import AssetPreviewModal from '../AssetPreviewModal.tsx';
import ErrorNotification from '../ErrorNotification.tsx';
import { AssetContext } from '../../types.ts';
import Button from '../Button.tsx';
import SkeletonLoader from '../SkeletonLoader.tsx';
import { showGoogleDrivePicker } from '../../services/googleDriveService.ts';
import { base64ToFile } from '../../utils/imageUtils.ts';

const ProjectsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('all');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const assetContext = useContext(AssetContext);
    if (!assetContext) throw new Error("AssetContext not found");
    const { assets, isLoading, error: globalError, requiresSetup, refetchAssets } = assetContext;

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
// FIX: Explicitly typed the `file` parameter in the `map` callback as `File` to resolve a type inference issue where it was being treated as `unknown`.
            await Promise.all(filesToUpload.map((file: File) => uploadUserAsset(file, null)));
            await refetchAssets();
        } catch (err: any) {
             setLocalError("Ocorreu um erro durante o upload.");
             console.error(err);
             await refetchAssets();
        }
    };
    
    const handleGoogleDriveUpload = async () => {
        setIsUploadModalOpen(false);
        try {
            const images = await showGoogleDrivePicker();
            if (images.length > 0) {
                const filesToUpload = images.map((base64Str, index) =>
                    base64ToFile(base64Str, `gdrive-import-${Date.now()}-${index}.png`)
                );
                
                const uploadFiles = async (files: File[]) => {
                    if (files.length === 0) return;
                    try {
                        // FIX: Explicitly typed the `file` parameter in the `map` callback as `File` to resolve a type inference issue where it was being treated as `unknown`.
                        await Promise.all(files.map((file: File) => uploadUserAsset(file, null)));
                        await refetchAssets();
                    } catch (err: any) {
                         setLocalError("Ocorreu um erro durante o upload.");
                         console.error(err);
                         await refetchAssets();
                    }
                };
                await uploadFiles(filesToUpload);
            }
        } catch (err) {
            setLocalError("Falha ao importar do Google Drive.");
            console.error(err);
        }
    };

    const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
        try {
            await toggleAssetFavorite(id, isFavorite);
            await refetchAssets();
        } catch (err) {
            setLocalError("Não foi possível atualizar o favorito.");
        }
    };

    const handleDelete = async (assetToDelete: UploadedAsset) => {
        setOpenMenuId(null);
        if (!window.confirm('Tem certeza que deseja apagar este item? Esta ação não pode ser desfeita.')) return;
        setDeletingAssetId(assetToDelete.id);
        try {
            await deleteUserAsset(assetToDelete);
            await refetchAssets();
        } catch (err: any) {
            setLocalError(`Falha ao apagar o recurso: ${err.message || 'Ocorreu um erro desconhecido.'}`);
            await refetchAssets();
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
        try {
            await renameUserAsset(renamingAssetId, newName);
            await refetchAssets();
        } catch (err) {
            setLocalError("Falha ao renomear o recurso.");
        } finally {
            handleRenameCancel();
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
            case 'images': return assets.filter(a => a.type === 'image');
            case 'videos': return assets.filter(a => a.type === 'video');
            case 'fonts': return assets.filter(a => a.type === 'font');
            case 'presets': return assets.filter(a => a.type === 'dng' || a.type === 'brmp');
            case 'all': default: return assets;
        }
    }, [assets, activeTab]);

    const tabs = [
        { id: 'all', label: 'Todos' },
        { id: 'favorites', label: 'Favoritos' },
        { id: 'images', label: 'Imagens' },
        { id: 'videos', label: 'Vídeos' },
        { id: 'fonts', label: 'Fontes' },
        { id: 'presets', label: 'Presets' }
    ];
    
    if (requiresSetup) return <UserAssetsSetupInstructions error={globalError} onRetry={refetchAssets} />;

    return (
        <>
            <ErrorNotification message={localError || (globalError && !requiresSetup ? "Falha ao carregar os seus recursos." : null)} onDismiss={() => setLocalError(null)} />
            <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
            <UploadOptionsModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                onLocalUpload={handleLocalUpload} 
                onGalleryUpload={() => {}} 
                onGoogleDriveUpload={handleGoogleDriveUpload}
                galleryEnabled={false} 
            />
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple className="hidden" accept="image/*,video/*,.dng,.brmp,.otf,.ttf" />
            
            <div className="h-full w-full flex flex-col p-8 bg-brand-dark text-white">
                <header className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h1 className="text-3xl font-bold">Meus Recursos</h1>
                    <Button onClick={() => setIsUploadModalOpen(true)} primary><div className="flex items-center gap-2"><IconPlus className="w-5 h-5"/><span>Adicionar Recurso</span></div></Button>
                </header>

                <nav className="flex items-center border-b border-brand-accent mb-6 overflow-x-auto flex-shrink-0">
                    {tabs.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 font-semibold whitespace-nowrap ${activeTab === tab.id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>{tab.label}</button>))}
                </nav>

                <div className="flex-grow overflow-y-auto pr-2 min-h-0">
                    {isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                            {Array.from({ length: 16 }).map((_, i) => <SkeletonLoader key={i} className="aspect-[3/4] rounded-lg" />)}
                        </div>
                    ) : (
                        <>
                            {filteredAssets.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                    {filteredAssets.map(asset => (
                                       <AssetCard 
                                            key={asset.id} asset={asset} onPreview={handlePreview} onToggleFavorite={handleToggleFavorite} onDelete={handleDelete} isDeleting={deletingAssetId === asset.id}
                                            isRenaming={renamingAssetId === asset.id} onStartRename={handleStartRename} onRenameConfirm={handleRenameConfirm} onRenameCancel={handleRenameCancel}
                                            renameValue={renameValue} setRenameValue={setRenameValue} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                                        />
                                   ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-center text-gray-500">
                                    <p>Nenhum recurso encontrado aqui.<br/>Clique em "Adicionar Recurso" para começar.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default ProjectsView;