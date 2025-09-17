import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

import Button from '../Button';
import PhotoDisplay from '../PhotoDisplay';
import LoadingCard from '../LoadingCard';
import ErrorCard from '../ErrorCard';
import ErrorNotification from '../ErrorNotification';
import CameraModal from '../CameraModal';
import EditModal from '../EditModal';
import RadioPill from '../RadioPill';
import AlbumDownloadButton from '../AlbumDownloadButton';
import UploadOptionsModal from '../UploadOptionsModal';
import { IconUpload, IconSparkles, IconCamera } from '../Icons';

import { toBase64, cropImage, createSingleFramedImage } from '../../utils/imageUtils';
import { generateImageWithRetry, getModelInstruction } from '../../services/geminiService';
import { TEMPLATES } from '../../constants';
import type { GeneratedImage, Prompt, Template } from '../../types';

interface GeneratorViewProps {
    templateKey: string;
}

const GeneratorView: React.FC<GeneratorViewProps> = ({ templateKey }) => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloadingAlbum, setIsDownloadingAlbum] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingImageInfo, setEditingImageInfo] = useState<{imageUrl: string; index: number} | null>(null);
    
    const [cameraAngle, setCameraAngle] = useState<string>('Padrão');
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [instagramScenePrompt, setInstagramScenePrompt] = useState<string>('');
    const [instagramSceneAspectRatio, setInstagramSceneAspectRatio] = useState<string>('9:16');
    const [swapGender, setSwapGender] = useState<string>('Mulher');
    const [swapEthnicity, setSwapEthnicity] = useState<string>('Latina');
    const [swapHairColor, setSwapHairColor] = useState<string>('Castanho');
    
    const template = TEMPLATES[templateKey];

    const getInstagramScenePrompts = (): Prompt[] => {
        if (!instagramScenePrompt.trim()) return [];
        return Array.from({ length: 6 }, (_, i) => ({
            id: `Variação ${i + 1}`,
            base: `${instagramScenePrompt}${i > 0 ? `, variação ${i + 1}` : ''}`
        }));
    };

    const getPromptsForTemplate = (): Prompt[] => {
        if (!template) return [];
        switch (templateKey) {
            case 'worldTour':
                const destination = (template as any).destinations?.find((d: any) => d.id === selectedLocation);
                return destination ? destination.prompts : [];
            case 'cenasDoInstagram':
                return getInstagramScenePrompts();
            case 'cleanAndSwap':
                return template.prompts || [];
            default:
                return [];
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
        const file = (event.target as any).files?.[0];
        if (file) {
            setIsUploading(true); setError(null);
            try {
                const base64Image = await toBase64(file);
                setUploadedImage(base64Image);
                setGeneratedImages([]); 
            } catch (err) {
                console.error("Erro durante o carregamento da imagem:", err);
                setError("Não foi possível processar essa imagem. Por favor, tente outro ficheiro.");
            } finally { setIsUploading(false); }
        }
    };
    
    const handleCaptureConfirm = (imageDataUrl: string) => {
        setUploadedImage(imageDataUrl);
        setGeneratedImages([]);
        setError(null);
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) { setError("Por favor, carregue uma foto para começar!"); return; }
        if (templateKey === 'worldTour' && !selectedLocation) { setError("Por favor, selecione um destino!"); return; }
        if (templateKey === 'cenasDoInstagram' && !instagramScenePrompt.trim()) { setError("Por favor, descreva a cena."); return; }

        setIsLoading(true); setError(null);
        // FIX: Use optional chaining and cast to `any` for scrollIntoView to prevent runtime errors if ref is null.
        setTimeout(() => { (resultsRef.current as any)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        
        // FIX: Corrected property name `customLookStyle` to `customLookbookStyle` to match the type definition.
        const options = { hairColors: [], cameraAngle, swapGender, swapEthnicity, swapHairColor, lookbookStyle: '', customLookbookStyle: '' };
        
        const promptsForGeneration = getPromptsForTemplate();
        if (!promptsForGeneration || promptsForGeneration.length === 0) {
            setError("Ocorreu um problema ao preparar as ideias. Tente novamente.");
            setIsLoading(false); return;
        }

        setGeneratedImages(promptsForGeneration.map(p => ({ id: p.id, status: 'pending', imageUrl: null })));

        for (let i = 0; i < promptsForGeneration.length; i++) {
            const p = promptsForGeneration[i];
            try {
                const aspectRatio = templateKey === 'cenasDoInstagram' ? instagramSceneAspectRatio : undefined;
                const modelInstruction = getModelInstruction(templateKey, p, options, aspectRatio);
                const imageUrl = await generateImageWithRetry({ prompt: modelInstruction, base64ImageData: uploadedImage });
                setGeneratedImages(prev => prev.map((img, index) => index === i ? { ...img, status: 'success', imageUrl } : img));
            } catch (err) {
                console.error(`Falha ao gerar imagem para ${p.id}:`, err);
                setGeneratedImages(prev => prev.map((img, index) => index === i ? { ...img, status: 'failed' } : img));
            }
        }
        setIsLoading(false);
    };
    
    const regenerateImageAtIndex = async (imageIndex: number) => {
        if (!uploadedImage) {
            setError("Imagem de upload não encontrada para regenerar.");
            return;
        }
        
        const promptsForGeneration = getPromptsForTemplate();
        const promptToRegenerate = promptsForGeneration[imageIndex];

        if (!promptToRegenerate) {
            setError("Não foi possível encontrar o prompt para regenerar esta imagem.");
            return;
        }

        setGeneratedImages(prev => prev.map((img, index) => 
            index === imageIndex ? { ...img, status: 'pending', imageUrl: null } : img
        ));
        
        const options = { hairColors: [], cameraAngle, swapGender, swapEthnicity, swapHairColor, lookbookStyle: '', customLookbookStyle: '' };

        try {
            const aspectRatio = templateKey === 'cenasDoInstagram' ? instagramSceneAspectRatio : undefined;
            const modelInstruction = getModelInstruction(templateKey, promptToRegenerate, options, aspectRatio);
            const imageUrl = await generateImageWithRetry({ prompt: modelInstruction, base64ImageData: uploadedImage });
            setGeneratedImages(prev => prev.map((img, index) => 
                index === imageIndex ? { ...img, status: 'success', imageUrl } : img
            ));
        } catch (err) {
            console.error(`Falha ao regenerar imagem para ${promptToRegenerate.id}:`, err);
            setGeneratedImages(prev => prev.map((img, index) => 
                index === imageIndex ? { ...img, status: 'failed' } : img
            ));
        }
    };
    
    const handleDownloadRequest = async (imageUrl: string, era: string, ratio: string) => {
        try {
            const finalImage = await createSingleFramedImage(imageUrl, ratio, era);
            const a = document.createElement('a');
            a.href = finalImage;
            a.download = `be-retrate-me-${era.toLowerCase().replace(/\s/g, '-')}.png`;
            a.click();
        } catch (e) {
            console.error("Download failed", e);
            setError("Falha ao preparar a imagem para download.");
        }
    };
    
    const handleAlbumDownloadRequest = async (ratio: '1:1' | '9:16') => {
        setIsDownloadingAlbum(true);
        setError(null);
        const successfulImages = generatedImages.filter(img => img.status === 'success' && img.imageUrl);

        if (successfulImages.length === 0) {
            setError("Nenhuma imagem bem-sucedida para baixar.");
            setIsDownloadingAlbum(false);
            return;
        }
        
        for (const img of successfulImages) {
            try {
                await handleDownloadRequest(img.imageUrl!, img.id, ratio);
                await new Promise(res => setTimeout(res, 300)); // Pequeno atraso entre os downloads
            } catch (e) {
                console.error(`Falha ao baixar ${img.id}`, e);
            }
        }
        setIsDownloadingAlbum(false);
    };
    
    const handleOpenEditModal = (imageUrl: string, index: number) => {
        setEditingImageInfo({ imageUrl, index });
        setIsEditModalOpen(true);
    };
    
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingImageInfo(null);
    };
    
    const handleApplyEdit = (newImageUrl: string) => {
        if (editingImageInfo) {
            setGeneratedImages(prev => prev.map((img, index) => 
                index === editingImageInfo.index ? { ...img, imageUrl: newImageUrl } : img
            ));
        }
        handleCloseEditModal();
    };

    const handleStartOver = () => {
        setUploadedImage(null);
        setGeneratedImages([]); 
        setError(null); 
    };

    const progress = generatedImages.length > 0 ? (generatedImages.filter(img => img.status !== 'pending').length / generatedImages.length) * 100 : 0;
    
    if (!template) return <div>Template não encontrado.</div>;

    return (
        <div className="h-full flex flex-col">
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCaptureConfirm} />
            <EditModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} imageUrl={editingImageInfo?.imageUrl ?? null} onApplyEdit={handleApplyEdit} />
            {/* FIX: Prefix 'alert' with 'window.' to ensure availability and prevent 'Cannot find name' errors. */}
            <UploadOptionsModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} onLocalUpload={() => { (fileInputRef.current as any)?.click(); setIsUploadModalOpen(false); }} onGoogleDriveUpload={() => { window.alert('Ainda não implementado'); }} />

            <header className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-white">{template.name}</h1>
                <p className="text-gray-400 mt-1">{template.description}</p>
            </header>
            
            <div className="flex-grow mt-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-700/50 flex flex-col lg:flex-row gap-8 overflow-y-auto">
                {/* Coluna da Esquerda: Upload e Opções */}
                <div className="lg:w-1/3 flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-semibold mb-4 text-white">1. A Sua Foto</h2>
                         <div className="w-full aspect-square border-4 border-dashed border-gray-700 rounded-xl flex items-center justify-center cursor-pointer hover:border-yellow-400 transition-colors bg-gray-800 overflow-hidden shadow-inner" onClick={() => !uploadedImage && setIsUploadModalOpen(true)}>
                            {isUploading ? <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-400"></div> : uploadedImage ? <img src={uploadedImage} alt="Pré-visualização" className="w-full h-full object-cover" /> : <div className="text-center text-gray-500"><IconUpload className="w-12 h-12 mx-auto" /><p className="mt-2">Carregar Foto</p></div>}
                        </div>
                        <div className="flex justify-center gap-2 mt-4">
                            <Button onClick={() => setIsCameraOpen(true)}><div className="flex items-center gap-2"><IconCamera /><span>Câmara</span></div></Button>
                            {uploadedImage && <Button onClick={() => setIsUploadModalOpen(true)}>Mudar</Button>}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    </div>
                    
                     <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white">2. Opções</h2>
                        {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                        {templateKey === 'worldTour' && (<div className="flex flex-wrap gap-2">{ (template as any).destinations?.map((loc: any) => (<RadioPill key={loc.id} name="location" value={loc.id} label={loc.id} checked={selectedLocation === loc.id} onChange={(e) => setSelectedLocation((e.target as any).value)} />))}</div>)}
                        {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                        {templateKey === 'cenasDoInstagram' && ( <> <textarea value={instagramScenePrompt} onChange={(e) => setInstagramScenePrompt((e.target as any).value)} placeholder="Ex: a relaxar numa praia em Florianópolis..." className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 h-24 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white resize-y" /> <div className="flex flex-wrap gap-2"><RadioPill key="9:16" name="ig_format" value="9:16" label="Story (9:16)" checked={instagramSceneAspectRatio === '9:16'} onChange={(e) => setInstagramSceneAspectRatio((e.target as any).value)} /><RadioPill key="3:4" name="ig_format" value="3:4" label="Feed (3:4)" checked={instagramSceneAspectRatio === '3:4'} onChange={(e) => setInstagramSceneAspectRatio((e.target as any).value)} /></div></>)}
                        {templateKey === 'cleanAndSwap' && (<div>...Opções de troca aqui...</div>)}
                        
                        <div className="space-y-2 pt-2 border-t border-gray-700">
                             <h3 className='text-md font-semibold text-gray-300'>Ângulo da Câmara</h3>
                             {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                             <div className="flex flex-wrap gap-2"><RadioPill name="cameraAngle" value="Padrão" label="Padrão" checked={cameraAngle === 'Padrão'} onChange={e => setCameraAngle((e.target as any).value)} /> <RadioPill name="cameraAngle" value="Frontal" label="Frontal" checked={cameraAngle === 'Frontal'} onChange={e => setCameraAngle((e.target as any).value)} /> <RadioPill name="cameraAngle" value="Low Angle" label="De baixo" checked={cameraAngle === 'Low Angle'} onChange={e => setCameraAngle((e.target as any).value)} /> <RadioPill name="cameraAngle" value="High Angle" label="De cima" checked={cameraAngle === 'High Angle'} onChange={e => setCameraAngle((e.target as any).value)} /></div>
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                        <Button onClick={handleGenerateClick} disabled={!uploadedImage || isLoading} primary className="w-full text-lg py-3">
                            {isLoading ? <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>A Gerar...</div> : <div className="flex items-center justify-center gap-2"><IconSparkles /><span>Gerar Fotos</span></div>}
                        </Button>
                    </div>
                </div>
                
                {/* Coluna da Direita: Resultados */}
                <div ref={resultsRef} className="lg:w-2/3 flex-grow flex flex-col">
                    <h2 className="text-xl font-semibold mb-4 text-white">3. Resultados</h2>
                    <div className="flex-grow bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 overflow-y-auto">
                         {isLoading && (<div className="w-full max-w-xl mx-auto my-4 text-center"><div className="bg-gray-700 rounded-full h-2.5 overflow-hidden"><motion.div className="bg-yellow-400 h-2.5 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} /></div><p className="text-gray-400 mt-2 text-xs">A gerar... mantenha esta janela aberta.</p></div>)}
                        {generatedImages.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {generatedImages.map((img, index) => {
                                    switch (img.status) {
                                        case 'success': return <PhotoDisplay key={`${img.id}-${index}`} era={img.id} imageUrl={img.imageUrl!} onDownload={handleDownloadRequest} onRegenerate={() => regenerateImageAtIndex(index)} onEdit={handleOpenEditModal} isPolaroid={template.isPolaroid} index={index} />;
                                        case 'failed': return <ErrorCard key={`${img.id}-${index}`} era={img.id} isPolaroid={template.isPolaroid} onRegenerate={() => regenerateImageAtIndex(index)} />;
                                        default: return <LoadingCard key={`${img.id}-${index}`} era={img.id} isPolaroid={template.isPolaroid} />;
                                    }
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                <p>Os seus resultados aparecerão aqui.</p>
                            </div>
                        )}
                    </div>
                     {!isLoading && generatedImages.length > 0 && (<div className="text-center mt-6 flex justify-center gap-4"><Button onClick={handleStartOver}>Começar de Novo</Button><AlbumDownloadButton isDownloading={isDownloadingAlbum} onDownload={handleAlbumDownloadRequest} /></div>)}
                </div>
            </div>
        </div>
    );
};

export default GeneratorView;