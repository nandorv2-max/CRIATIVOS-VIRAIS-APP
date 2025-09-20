
import React, { useState, useEffect } from 'react';
import {
    IconType, IconShapes, IconUpload, IconMagicWand, IconLayers, IconPlus, IconImageIcon, IconMovie, IconFile
} from './Icons.tsx';
import type { AnyLayer, UploadedAsset, PublicAsset } from '../types.ts';
import Button from './Button.tsx';
import { getPublicAssets } from '../services/databaseService.ts';
import SkeletonLoader from './SkeletonLoader.tsx';

type SidebarTab = 'uploads' | 'gallery' | 'text' | 'elements' | 'ai';
type AITool = 'remove-bg';

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

const AssetGridItem: React.FC<{asset: UploadedAsset | PublicAsset, onClick: () => void}> = ({ asset, onClick }) => {
    const isPublic = 'asset_type' in asset;
    const type = isPublic ? asset.asset_type : asset.type;
    const name = asset.name;
    const thumbnail = isPublic ? (asset.thumbnail_url || asset.asset_url) : asset.thumbnail;

    const renderIcon = () => {
        switch (type) {
            case 'video': return <IconMovie className="w-8 h-8 text-gray-300" />;
            case 'brmp': return <IconFile className="w-8 h-8 text-gray-300" />;
            default: return <IconPlus className="w-8 h-8 text-white"/>;
        }
    };

    return (
        <div className="relative aspect-square cursor-pointer group bg-brand-light rounded-md" onClick={onClick}>
            {type === 'image' || type === 'video' ? (
                 <img src={thumbnail} alt={name} className="w-full h-full object-cover rounded-md" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-1">
                    {renderIcon()}
                    <span className="text-xs text-center text-gray-400 mt-1 truncate">{name}</span>
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
    onToggleLayersPanel, onAITool, isLoadingAI, selectedLayers
}) => {
    const [activeTab, setActiveTab] = useState<SidebarTab>('uploads');
    const [publicAssets, setPublicAssets] = useState<PublicAsset[]>([]);
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);

    useEffect(() => {
        if (activeTab === 'gallery' && publicAssets.length === 0) {
            setIsLoadingGallery(true);
            getPublicAssets()
                .then(setPublicAssets)
                .catch(err => console.error("Failed to fetch public assets", err))
                .finally(() => setIsLoadingGallery(false));
        }
    }, [activeTab, publicAssets.length]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'uploads':
                const imageAssets = uploadedAssets.filter(a => a.type === 'image');
                const videoAssets = uploadedAssets.filter(a => a.type === 'video');
                
                return (
                    <div className="p-4 space-y-4 h-full flex flex-col">
                        <h3 className="text-lg font-bold text-white">Meus Uploads</h3>
                        <Button onClick={onTriggerUpload} primary className="w-full">Fazer upload de mídia</Button>
                         <div className="flex-grow overflow-y-auto space-y-4 pr-1">
                             {uploadedAssets.length > 0 ? (
                                <>
                                 {imageAssets.length > 0 && <div>
                                     <h4 className="font-semibold text-sm text-gray-300 mb-2">Imagens</h4>
                                     <div className="grid grid-cols-2 gap-2">
                                         {imageAssets.map(asset => <AssetGridItem key={asset.id} asset={asset} onClick={() => onAddAssetToCanvas(asset)} />)}
                                     </div>
                                 </div>}
                                 {videoAssets.length > 0 && <div>
                                     <h4 className="font-semibold text-sm text-gray-300 mb-2">Vídeos</h4>
                                     <div className="grid grid-cols-2 gap-2">
                                         {videoAssets.map(asset => <AssetGridItem key={asset.id} asset={asset} onClick={() => onAddAssetToCanvas(asset)} />)}
                                     </div>
                                 </div>}
                                </>
                             ) : (
                                <div className="text-center text-gray-500 text-sm pt-8">Nenhum upload encontrado.</div>
                             )}
                         </div>
                    </div>
                );
            case 'gallery':
                return (
                     <div className="p-4 space-y-4 h-full flex flex-col">
                        <h3 className="text-lg font-bold text-white">Galeria Pública</h3>
                         {isLoadingGallery ? (
                            <div className="grid grid-cols-2 gap-2">
                                {Array.from({length: 8}).map((_, i) => <SkeletonLoader key={i} className="aspect-square rounded-md" />)}
                            </div>
                         ) : (
                             <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
                                {publicAssets.map(asset => <AssetGridItem key={asset.id} asset={asset} onClick={() => onAddAssetToCanvas(asset)} />)}
                            </div>
                         )}
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
            case 'ai':
                 const isImageSelected = selectedLayers.length === 1 && selectedLayers[0].type === 'image';
                 return (
                     <div className="p-4 space-y-4">
                        <h3 className="text-lg font-bold text-white">IA Mágica</h3>
                        <p className="text-xs text-gray-400">Selecione uma única camada de imagem para habilitar as ferramentas de IA.</p>
                        <Button onClick={() => onAITool('remove-bg')} disabled={!isImageSelected || !!isLoadingAI} className="w-full">
                            {isLoadingAI === 'remove-bg' ? "Processando..." : "Removedor de Fundo"}
                        </Button>
                     </div>
                 );
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