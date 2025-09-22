import React, { useState, useEffect, useMemo } from 'react';
import {
    IconType, IconShapes, IconUpload, IconMagicWand, IconLayers, IconPlus, IconImageIcon, IconMovie, IconFile, IconHeart, IconRocket, IconSparkles
} from './Icons.tsx';
import type { AnyLayer, UploadedAsset, PublicAsset, UploadedAssetType } from '../types.ts';
import Button from './Button.tsx';
import { getPublicAssets, getFavoritePublicAssetIds, addFavoritePublicAsset, removeFavoritePublicAsset } from '../services/databaseService.ts';
import SkeletonLoader from './SkeletonLoader.tsx';

type SidebarTab = 'uploads' | 'gallery' | 'text' | 'elements' | 'ai';
type AITool = 'remove-bg';

const RECENT_ASSETS_KEY = 'genia-recent-public-assets';
const MAX_RECENT_ASSETS = 50;

// Helper to manage recently used assets in localStorage
const getRecentAssetIds = (): string[] => {
    try {
        const item = window.localStorage.getItem(RECENT_ASSETS_KEY);
        return item ? JSON.parse(item) : [];
    } catch (error) {
        console.error("Failed to parse recent assets from localStorage", error);
        return [];
    }
};

const logRecentAsset = (assetId: string) => {
    try {
        let recentIds = getRecentAssetIds();
        recentIds = recentIds.filter(id => id !== assetId);
        recentIds.unshift(assetId);
        if (recentIds.length > MAX_RECENT_ASSETS) {
            recentIds.pop();
        }
        window.localStorage.setItem(RECENT_ASSETS_KEY, JSON.stringify(recentIds));
    } catch (error) {
        console.error("Failed to save recent asset to localStorage", error);
    }
};

interface CreativeEditorSidebarProps {
    onAddTextLayer: (preset: 'heading' | 'subheading' | 'body') => void;
    onAddShapeLayer: (shape: 'rectangle' | 'ellipse') => void;
    onTriggerUpload: () => void;
    uploadedAssets: UploadedAsset[];
    onAddAssetToCanvas: (asset: UploadedAsset | PublicAsset) => void;
    onToggleLayersPanel: () => void;
    onSaveProject: () => void;
    onLoadProject: () => void;
    onAITool: (tool: AITool, options?: any) => void;
    isLoadingAI: 'remove-bg' | false;
    selectedLayers: AnyLayer[];
    onGenerateImage: (prompt: string) => void;
    isGeneratingImage: boolean;
}

const TabButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1 w-full py-2 px-1 rounded-lg transition-all duration-200 text-gray-200 ${
            isActive ? 'bg-brand-primary text-white' : 'hover:bg-brand-light'
        }`}
    >
        {icon}
        <span className="text-[10px] font-semibold">{label}</span>
    </button>
);

const PublicAssetGridItem: React.FC<{
    asset: PublicAsset;
    onClick: () => void;
    isFavorite: boolean;
    onToggleFavorite: (assetId: string, isCurrentlyFavorite: boolean) => void;
}> = ({ asset, onClick, isFavorite, onToggleFavorite }) => {
    const renderIcon = () => {
        switch (asset.asset_type) {
            case 'font': return <IconType className="w-8 h-8 text-gray-300" />;
            case 'brmp': return <IconRocket className="w-8 h-8 text-gray-300" />;
            default: return <IconPlus className="w-8 h-8 text-white"/>;
        }
    };

    return (
        <div className="relative aspect-square cursor-pointer group bg-brand-light rounded-md flex-shrink-0 w-32" onClick={onClick}>
            {asset.asset_type === 'image' || asset.asset_type === 'video' ? (
                 <img src={asset.thumbnail_url || asset.asset_url} alt={asset.name} className="w-full h-full object-cover rounded-md" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-1">
                    {renderIcon()}
                    <span className="text-xs text-center text-gray-400 mt-1 truncate">{asset.name.replace(/\.[^/.]+$/, "")}</span>
                </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                 {renderIcon()}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(asset.id, isFavorite);
                }}
                className="absolute top-1 right-1 p-1.5 bg-black/40 rounded-full backdrop-blur-sm transition-colors text-white hover:bg-black/60 opacity-0 group-hover:opacity-100"
            >
                <IconHeart filled={isFavorite} className={`w-4 h-4 ${isFavorite ? 'text-red-500' : 'text-white'}`} />
            </button>
        </div>
    );
};


const UserAssetGridItem: React.FC<{asset: UploadedAsset, onClick: () => void}> = ({ asset, onClick }) => {
    const renderIcon = () => {
        switch (asset.type) {
            case 'video': return <IconMovie className="w-8 h-8 text-gray-300" />;
            case 'brmp': return <IconRocket className="w-8 h-8 text-gray-300" />;
            default: return <IconPlus className="w-8 h-8 text-white"/>;
        }
    };

    return (
        <div className="relative aspect-square cursor-pointer group bg-brand-light rounded-md" onClick={onClick}>
            {asset.type === 'image' || asset.type === 'video' ? (
                 <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover rounded-md" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-1">
                    {renderIcon()}
                    <span className="text-xs text-center text-gray-400 mt-1 truncate">{asset.name.replace(/\.[^/.]+$/, "")}</span>
                </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {renderIcon()}
            </div>
        </div>
    );
};

const CreativeEditorSidebar: React.FC<CreativeEditorSidebarProps> = ({
    onAddTextLayer, onAddShapeLayer, onTriggerUpload, uploadedAssets, onAddAssetToCanvas,
    onToggleLayersPanel, onAITool, isLoadingAI, selectedLayers, onGenerateImage, isGeneratingImage
}) => {
    const [activeTab, setActiveTab] = useState<SidebarTab>('gallery');
    const [publicAssets, setPublicAssets] = useState<PublicAsset[]>([]);
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);
    const [gallerySearchTerm, setGallerySearchTerm] = useState('');
    const [favoriteAssetIds, setFavoriteAssetIds] = useState<Set<string>>(new Set());
    const [galleryTab, setGalleryTab] = useState<UploadedAssetType | 'all' | 'brmp'>('all');
    const [genPrompt, setGenPrompt] = useState('');

    const handleAddAsset = (asset: PublicAsset | UploadedAsset) => {
        if ('asset_type' in asset) { // It's a PublicAsset
            logRecentAsset(asset.id);
        }
        onAddAssetToCanvas(asset);
    };

    useEffect(() => {
        if (activeTab === 'gallery') {
            if (publicAssets.length === 0) {
                setIsLoadingGallery(true);
                getPublicAssets()
                    .then(setPublicAssets)
                    .catch(err => console.error("Failed to fetch public assets", err))
                    .finally(() => setIsLoadingGallery(false));
            }
            getFavoritePublicAssetIds().then(ids => setFavoriteAssetIds(new Set(ids)));
        }
    }, [activeTab, publicAssets.length]);

    const handleToggleFavorite = async (assetId: string, isCurrentlyFavorite: boolean) => {
        setFavoriteAssetIds(prev => {
            const newSet = new Set(prev);
            if (isCurrentlyFavorite) newSet.delete(assetId); else newSet.add(assetId);
            return newSet;
        });
        try {
            if (isCurrentlyFavorite) await removeFavoritePublicAsset(assetId); else await addFavoritePublicAsset(assetId);
        } catch (error) {
            console.error("Failed to update favorite status:", error);
            setFavoriteAssetIds(prev => {
                const newSet = new Set(prev);
                if (isCurrentlyFavorite) newSet.add(assetId); else newSet.delete(assetId);
                return newSet;
            });
        }
    };
    
    const groupedAndFilteredAssets = useMemo(() => {
        const HIDDEN_TYPES: UploadedAssetType[] = ['font', 'brmp', 'dng'];
        
        const filtered = publicAssets
            .filter(asset => !HIDDEN_TYPES.includes(asset.asset_type))
            .filter(asset => gallerySearchTerm ? asset.name.toLowerCase().includes(gallerySearchTerm.toLowerCase()) : true)
            .filter(asset => galleryTab === 'all' ? true : asset.asset_type === galleryTab);

        const groups: { [key: string]: PublicAsset[] } = {};
        for (const asset of filtered) {
            const categoryName = asset.public_asset_categories?.name || 'Outros';
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push(asset);
        }
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [publicAssets, gallerySearchTerm, galleryTab]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'uploads':
                const visibleUserAssets = uploadedAssets.filter(asset => 
                    ['image', 'video', 'audio'].includes(asset.type)
                );
                return (
                    <div className="p-4 space-y-4 h-full flex flex-col">
                        <h3 className="text-lg font-bold text-white">Meus Uploads</h3>
                        <Button onClick={onTriggerUpload} primary className="w-full">Fazer upload de mídia</Button>
                         <div className="flex-grow overflow-y-auto space-y-4 pr-1">
                             {visibleUserAssets.length > 0 ? (
                                     <div className="grid grid-cols-2 gap-2">
                                         {visibleUserAssets.map(asset => <UserAssetGridItem key={asset.id} asset={asset} onClick={() => handleAddAsset(asset)} />)}
                                     </div>
                             ) : (
                                <div className="text-center text-gray-500 text-sm pt-8">Nenhum upload encontrado.</div>
                             )}
                         </div>
                    </div>
                );
            case 'gallery':
                 const galleryTabs: { id: UploadedAssetType | 'all', label: string }[] = [
                    { id: 'all', label: 'Tudo' }, { id: 'image', label: 'Imagens' }, { id: 'video', label: 'Vídeos' },
                    { id: 'audio', label: 'Áudios' },
                ];
                return (
                     <div className="p-4 space-y-4 h-full flex flex-col">
                        <h3 className="text-lg font-bold text-white">Galeria Pública</h3>
                        <div className="relative">
                            <input type="text" placeholder="Pesquisar..." value={gallerySearchTerm} onChange={(e) => setGallerySearchTerm(e.target.value)}
                                className="w-full bg-brand-light border border-brand-accent rounded-md py-2 px-3 pl-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <div className="flex space-x-2 border-b border-brand-accent/50 overflow-x-auto">
                            {galleryTabs.map(tab => <button key={tab.id} onClick={() => setGalleryTab(tab.id)} className={`px-3 py-1.5 text-sm font-semibold rounded-t-md ${galleryTab === tab.id ? 'bg-brand-accent/50 text-white' : 'text-gray-400 hover:text-white'}`}>{tab.label}</button>)}
                        </div>
                         <div className="flex-grow overflow-y-auto space-y-4 pr-1">
                             {isLoadingGallery ? ( Array.from({length: 4}).map((_, i) => <SkeletonLoader key={i} className="h-40 w-full rounded-md" />) ) : 
                               ( groupedAndFilteredAssets.map(([categoryName, assets]) => (
                                    <div key={categoryName}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-semibold text-white">{categoryName}</h4>
                                            <a href="#" className="text-xs text-brand-secondary font-semibold">Ver tudo</a>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {assets.map(asset => <PublicAssetGridItem key={asset.id} asset={asset} onClick={() => handleAddAsset(asset)} isFavorite={favoriteAssetIds.has(asset.id)} onToggleFavorite={handleToggleFavorite} />)}
                                        </div>
                                    </div>
                                ))
                             )}
                         </div>
                    </div>
                );
            case 'text':
                return (
                    <div className="p-4 space-y-3">
                         <h3 className="text-lg font-bold text-white mb-2">Texto</h3>
                        <button onClick={() => onAddTextLayer('heading')} className="w-full text-left p-3 hover:bg-brand-light rounded-md transition-colors">
                            <span className="font-bold text-2xl">Adicionar Título</span>
                        </button>
                         <button onClick={() => onAddTextLayer('subheading')} className="w-full text-left p-3 hover:bg-brand-light rounded-md transition-colors">
                            <span className="font-semibold text-xl">Adicionar Subtítulo</span>
                        </button>
                         <button onClick={() => onAddTextLayer('body')} className="w-full text-left p-3 hover:bg-brand-light rounded-md transition-colors">
                            <span className="text-base">Adicionar um pouco de texto</span>
                        </button>
                    </div>
                );
            case 'elements':
                return (
                     <div className="p-4 space-y-3">
                         <h3 className="text-lg font-bold text-white mb-2">Elementos</h3>
                         <div className="pt-2">
                            <p className="text-sm font-semibold text-gray-300 mb-2">Formas</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => onAddShapeLayer('rectangle')} className="flex items-center justify-center aspect-square bg-brand-light hover:bg-brand-accent rounded-md transition-colors">
                                    <div className="w-16 h-16 bg-gray-400"></div>
                                </button>
                                <button onClick={() => onAddShapeLayer('ellipse')} className="flex items-center justify-center aspect-square bg-brand-light hover:bg-brand-accent rounded-md transition-colors">
                                    <div className="w-16 h-16 bg-gray-400 rounded-full"></div>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'ai': {
                 const isImageSelected = selectedLayers.length === 1 && selectedLayers[0].type === 'image';
                 return (
                     <div className="p-4 space-y-4 divide-y divide-brand-accent/50 h-full flex flex-col">
                        <div className="space-y-3 pb-4">
                            <h3 className="text-lg font-bold text-white">Gerador de Imagem</h3>
                            <p className="text-xs text-gray-400">Descreva a imagem que você quer criar. Ela será adicionada à sua tela.</p>
                            <textarea
                                value={genPrompt}
                                onChange={(e) => setGenPrompt(e.target.value)}
                                placeholder="Ex: Um tigre majestoso numa floresta de néon"
                                className="w-full bg-brand-light border border-brand-accent rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary h-24 resize-y"
                            />
                            <Button
                                onClick={() => {
                                    onGenerateImage(genPrompt);
                                    setGenPrompt('');
                                }}
                                disabled={isGeneratingImage || !genPrompt.trim()}
                                primary
                                className="w-full"
                            >
                                <div className="flex items-center justify-center gap-2">
                                <IconSparkles />
                                {isGeneratingImage ? "Gerando..." : "Gerar e Adicionar"}
                                </div>
                            </Button>
                        </div>
                        <div className="space-y-3 pt-4 flex-grow flex flex-col">
                            <h3 className="text-lg font-bold text-white">Edição com IA</h3>
                            <p className="text-xs text-gray-400">Selecione uma única camada de imagem para habilitar as ferramentas abaixo.</p>
                            <Button onClick={() => onAITool('remove-bg')} disabled={!isImageSelected || !!isLoadingAI} className="w-full">
                                {isLoadingAI === 'remove-bg' ? "Processando..." : "Removedor de Fundo"}
                            </Button>
                        </div>
                     </div>
                 );
            }
            default:
                return null;
        }
    };
    
    return (
        <div className="w-96 h-full bg-brand-dark/90 backdrop-blur-md shadow-lg z-20 flex border-r border-brand-accent">
            <div className="w-24 bg-brand-light/50 p-2 flex flex-col items-center gap-2 flex-shrink-0">
                <TabButton icon={<IconUpload className="w-6 h-6"/>} label="Uploads" isActive={activeTab === 'uploads'} onClick={() => setActiveTab('uploads')} />
                <TabButton icon={<IconImageIcon className="w-6 h-6"/>} label="Galeria" isActive={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} />
                <TabButton icon={<IconType className="w-6 h-6"/>} label="Texto" isActive={activeTab === 'text'} onClick={() => setActiveTab('text')} />
                <TabButton icon={<IconShapes className="w-6 h-6"/>} label="Elementos" isActive={activeTab === 'elements'} onClick={() => setActiveTab('elements')} />
                <TabButton icon={<IconMagicWand className="w-6 h-6"/>} label="IA Mágica" isActive={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
                <div className="mt-auto w-full">
                    <TabButton icon={<IconLayers className="w-6 h-6"/>} label="Camadas" isActive={false} onClick={onToggleLayersPanel} />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default CreativeEditorSidebar;