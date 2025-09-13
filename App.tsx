import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

import Button from './components/Button';
import PhotoDisplay from './components/PhotoDisplay';
import LoadingCard from './components/LoadingCard';
import ErrorCard from './components/ErrorCard';
import ErrorNotification from './components/ErrorNotification';
import CameraModal from './components/CameraModal';
import EditModal from './components/EditModal';
import ProfessionalEditorModal from './components/ProfessionalEditorModal';
import CreativeEditorModal from './components/CreativeEditorModal';
import VideoGenerator from './components/VideoGenerator';
import RadioPill from './components/RadioPill';
import TemplateCard from './components/TemplateCard';
import AlbumDownloadButton from './components/AlbumDownloadButton';
import UploadOptionsModal from './components/UploadOptionsModal';
import { IconUpload, IconSparkles, IconCamera } from './components/Icons';

import { toBase64, cropImage, createSingleFramedImage } from './utils/imageUtils';
import { generateImageWithRetry, getModelInstruction } from './services/geminiService';
import { TEMPLATES } from './constants';
import type { GeneratedImage, Prompt, Template } from './types';

const App: React.FC = () => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloadingAlbum, setIsDownloadingAlbum] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    
    // Modals
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingImageInfo, setEditingImageInfo] = useState<{imageUrl: string; index: number} | null>(null);
    const [isProfessionalEditorOpen, setIsProfessionalEditorOpen] = useState(false);
    const [isCreativeEditorOpen, setIsCreativeEditorOpen] = useState(false);
    const [imageForEditor, setImageForEditor] = useState<string | null>(null);

    const [template, setTemplate] = useState<string | null>(null);
    const [cameraAngle, setCameraAngle] = useState<string>('Padrão');
    
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [instagramScenePrompt, setInstagramScenePrompt] = useState<string>('');
    const [instagramSceneAspectRatio, setInstagramSceneAspectRatio] = useState<string>('9:16');
    const [swapGender, setSwapGender] = useState<string>('Mulher');
    const [swapEthnicity, setSwapEthnicity] = useState<string>('Latina');
    const [swapHairColor, setSwapHairColor] = useState<string>('Castanho');

    const getInstagramScenePrompts = (): Prompt[] => {
        if (!instagramScenePrompt.trim()) return [];
        return [
            { id: 'Variação 1', base: instagramScenePrompt },
            { id: 'Variação 2', base: `${instagramScenePrompt}, com uma pose diferente` },
            { id: 'Variação 3', base: `${instagramScenePrompt}, visto de um ângulo ligeiramente diferente` },
            { id: 'Variação 4', base: `${instagramScenePrompt}, com uma expressão natural e espontânea` },
            { id: 'Variação 5', base: `${instagramScenePrompt}, close-up focado no detalhe da cena` },
            { id: 'Variação 6', base: `${instagramScenePrompt}, mostrando a interação com o ambiente` }
        ];
    };

    const getPromptsForTemplate = (): Prompt[] => {
        const activeTemplate = template ? (TEMPLATES[template] as Template) : null;
        if (!activeTemplate) return [];

        switch (template) {
            case 'worldTour':
                const destination = activeTemplate.destinations?.find(d => d.id === selectedLocation);
                return destination ? destination.prompts : [];
            case 'cenasDoInstagram':
                return getInstagramScenePrompts();
            case 'cleanAndSwap':
            case 'criativo':
            case 'criativoViral':
            case 'video':
            case 'editor':
                return activeTemplate.prompts || [];
            default:
                return [];
        }
    };
    
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setIsUploading(true);
            setError(null);
            try {
                const base64Image = await toBase64(file);
                setUploadedImage(base64Image);
                setGeneratedImages([]); 
            } catch (err) {
                console.error("Erro durante o carregamento da imagem:", err);
                setError("Não foi possível processar essa imagem. Por favor, tente outro ficheiro.");
            } finally {
                setIsUploading(false);
            }
        }
    };
    
    const handleCaptureConfirm = (imageDataUrl: string) => {
        setUploadedImage(imageDataUrl);
        setGeneratedImages([]);
        setError(null);
    };

    const handleMainActionClick = () => {
        if (!uploadedImage) {
            setError("Por favor, carregue uma foto principal para começar!");
            return;
        }
        if (!template) {
             setError("Por favor, selecione um tema!");
             return;
        }

        if (template === 'editor') {
            setImageForEditor(uploadedImage);
            setIsProfessionalEditorOpen(true);
        } else if (template === 'criativo' || template === 'criativoViral') {
            setImageForEditor(uploadedImage);
            setIsCreativeEditorOpen(true);
        } else if (template !== 'video') { // Video has its own button
            handleGenerateClick();
        }
    }

    const handleGenerateClick = async () => {
        if (!uploadedImage) { setError("Por favor, carregue uma foto principal para começar!"); return; }
        if (!template) { setError("Por favor, selecione um tema!"); return; }
        if (template === 'worldTour' && !selectedLocation) { setError("Por favor, selecione um destino!"); return; }
        if (template === 'cenasDoInstagram' && !instagramScenePrompt.trim()) { setError("Por favor, descreva a cena que deseja criar."); return; }

        setIsLoading(true);
        setError(null);
        setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        
        const options = { hairColors: [], cameraAngle, swapGender, swapEthnicity, swapHairColor, lookbookStyle: '', customLookbookStyle: '' };

        if (template === 'cleanAndSwap') {
            setGeneratedImages([{ id: 'Resultado', status: 'pending', imageUrl: null }]);
            const cleaningPrompt = "Execute uma tarefa de inpainting de alta precisão. A sua única função é remover completamente todos os elementos de interface da imagem. Identifique, apague e reconstrua o fundo por trás de TODOS os ícones (como ícones de volume, menus de três pontos), texto sobreposto (legendas, nomes de utilizador), emojis e quaisquer outros gráficos de interface. O resultado DEVE ser uma imagem que pareça uma fotografia perfeitamente limpa e original, sem NENHUM vestígio de interface.";
            try {
                const cleanedImageUrl = await generateImageWithRetry({ prompt: cleaningPrompt, base64ImageData: uploadedImage });
                const swapModelInstruction = getModelInstruction(template, { id: '', base: '' }, options);
                const finalImageUrl = await generateImageWithRetry({ prompt: swapModelInstruction, base64ImageData: cleanedImageUrl });
                setGeneratedImages([{ id: 'Resultado', status: 'success', imageUrl: finalImageUrl }]);
            } catch (err) {
                 console.error(`Falha ao gerar imagem para Limpar e Trocar:`, err);
                 setGeneratedImages([{ id: 'Resultado', status: 'failed', imageUrl: null }]);
            }
        } else {
            const promptsForGeneration = getPromptsForTemplate();
            if (!promptsForGeneration || promptsForGeneration.length === 0) {
                setError("Ocorreu um problema ao preparar as ideias criativas. Por favor, tente novamente.");
                setIsLoading(false);
                return;
            }

            setGeneratedImages(promptsForGeneration.map(p => ({ id: p.id, status: 'pending', imageUrl: null })));

            for (let i = 0; i < promptsForGeneration.length; i++) {
                const p = promptsForGeneration[i];
                try {
                    const aspectRatio = template === 'cenasDoInstagram' ? instagramSceneAspectRatio : undefined;
                    const modelInstruction = getModelInstruction(template, p, options, aspectRatio);
                    const imageUrl = await generateImageWithRetry({ prompt: modelInstruction, base64ImageData: uploadedImage });
                    setGeneratedImages(prev => prev.map((img, index) => index === i ? { ...img, status: 'success', imageUrl } : img));
                } catch (err) {
                    console.error(`Falha ao gerar imagem para ${p.id}:`, err);
                    setGeneratedImages(prev => prev.map((img, index) => index === i ? { ...img, status: 'failed' } : img));
                }
            }
        }
        setIsLoading(false);
    };

    const regenerateImageAtIndex = async (imageIndex: number) => {
        if (!template || !uploadedImage) return;
        if (template === 'cleanAndSwap') { handleGenerateClick(); return; }

        const imageToRegenerate = generatedImages[imageIndex];
        if (!imageToRegenerate) return;
    
        setGeneratedImages(prev => prev.map((img, index) => index === imageIndex ? { ...img, status: 'pending' } : img));
        setError(null);
    
        const promptsForGeneration = getPromptsForTemplate();
        const prompt = promptsForGeneration[imageIndex];
        if (!prompt) {
            setError("Não foi possível encontrar o prompt para gerar novamente.");
            setGeneratedImages(prev => prev.map((img, index) => index === imageIndex ? { ...img, status: 'failed' } : img));
            return;
        }
    
        try {
            const options = { hairColors: [], cameraAngle, swapGender, swapEthnicity, swapHairColor, lookbookStyle: '', customLookbookStyle: '' };
            const aspectRatio = template === 'cenasDoInstagram' ? instagramSceneAspectRatio : undefined;
            const modelInstruction = getModelInstruction(template, prompt, options, aspectRatio);
            const imageUrl = await generateImageWithRetry({ prompt: modelInstruction, base64ImageData: uploadedImage });
            setGeneratedImages(prev => prev.map((img, index) => index === imageIndex ? { ...img, status: 'success', imageUrl } : img));
        } catch (err) {
            console.error(`A regeneração falhou para ${prompt.id}:`, err);
            setError(`Ups! A regeneração para "${prompt.id}" falhou. Por favor, tente novamente.`);
            setGeneratedImages(prev => prev.map((img, index) => index === imageIndex ? { ...img, status: 'failed' } : img));
        }
    };

    const triggerDownload = async (href: string, fileName: string) => {
        try {
            const link = document.createElement('a');
            link.href = href;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Não foi possível descarregar a imagem:", error);
            setError("Desculpe, o download falhou. Por favor, tente novamente.");
        }
    };
    
    const handleDownloadRequest = async (imageUrl: string, era: string, ratio: string) => {
        const fileName = `retrate-me-${era.toLowerCase().replace(/\s+/g, '-')}-${ratio.replace(':', 'x')}.png`;
        try {
            const shouldAddLabel = template === 'worldTour' || template === 'cenasDoInstagram';
            const framedImageUrl = await createSingleFramedImage(imageUrl, ratio, shouldAddLabel ? era : null);
            await triggerDownload(framedImageUrl, fileName);
        } catch (err) {
            console.error(`Falha ao criar imagem emoldurada para download:`, err);
            setError(`Não foi possível preparar essa imagem para download. Por favor, tente novamente.`);
        }
    };

    const handleAlbumDownloadRequest = async (ratio: '1:1' | '9:16') => {
        if (isDownloadingAlbum) return;
        setIsDownloadingAlbum(true);
        setError(null);
        try {
            const successfulImages = generatedImages.filter(img => img.status === 'success' && img.imageUrl);
            if (successfulImages.length === 0) throw new Error("Não há imagens bem-sucedidas para incluir num álbum.");
            
            const croppedImageUrls = await Promise.all(successfulImages.map(img => cropImage(img.imageUrl!, ratio)));
            const imagesToStitch = await Promise.all(
                croppedImageUrls.map(url => new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = url;
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                }))
            );

            const stitchCanvas = document.createElement('canvas');
            const stitchCtx = stitchCanvas.getContext('2d');
            if(!stitchCtx) throw new Error("Could not create canvas context for stitching");
            
            const cols = imagesToStitch.length > 2 ? 3 : 2;
            const rows = Math.ceil(imagesToStitch.length / cols);
            const imageWidth = imagesToStitch[0].width; const imageHeight = imagesToStitch[0].height;
            const padding = Math.floor(imageWidth * 0.05);
            stitchCanvas.width = (cols * imageWidth) + ((cols + 1) * padding);
            stitchCanvas.height = (rows * imageHeight) + ((rows + 1) * padding);
            stitchCtx.fillStyle = '#FFFFFF';
            stitchCtx.fillRect(0, 0, stitchCanvas.width, stitchCanvas.height);
            imagesToStitch.forEach((img, index) => {
                const row = Math.floor(index / cols); const col = index % cols;
                stitchCtx.drawImage(img, padding + col * (imageWidth + padding), padding + row * (imageHeight + padding), imageWidth, imageHeight);
            });
            
            await triggerDownload(stitchCanvas.toDataURL('image/png'), `album-bee-retrate-me-${ratio.replace(':', 'x')}.png`);
        } catch (err: any) {
            console.error("Falha ao criar ou descarregar álbum:", err);
            setError(`Desculpe, o download do álbum falhou. ${err.message}`);
        } finally {
            setIsDownloadingAlbum(false);
        }
    };
    
    const handleTemplateSelect = (templateId: string | null) => {
        setTemplate(templateId);
        setGeneratedImages([]);
        setSelectedLocation('');
        setInstagramScenePrompt(''); setInstagramSceneAspectRatio('9:16');
        setCameraAngle('Padrão');
    };

    const handleStartOver = () => {
        setUploadedImage(null);
        setGeneratedImages([]); 
        setError(null); 
        handleTemplateSelect(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        if (editingImageInfo !== null) {
            setGeneratedImages(prev => 
                prev.map((img, index) => 
                    index === editingImageInfo.index ? { ...img, imageUrl: newImageUrl } : img
                )
            );
        }
        handleCloseEditModal();
    };
    
    const handleApplyEditorResult = (newImageUrl: string) => {
        setUploadedImage(newImageUrl);
        setIsProfessionalEditorOpen(false);
        setIsCreativeEditorOpen(false);
        setImageForEditor(null);
        // Set the new image as the only result to be displayed
        setGeneratedImages([{id: "Criativo Editado", status: 'success', imageUrl: newImageUrl}]);
        setTemplate('result'); // A virtual template to show the result
    };

    const progress = generatedImages.length > 0 ? (generatedImages.filter(img => img.status !== 'pending').length / generatedImages.length) * 100 : 0;
    
    const isTemplateSelected = template !== null;

    const mainButtonText = useMemo(() => {
        if (isLoading) {
            return `A gerar... (${Math.round(progress)}%)`;
        }
        switch (template) {
            case 'editor':
                return 'Abrir Editor';
            case 'criativo':
            case 'criativoViral':
                return 'Abrir Editor de Criativos';
            default:
                return 'Gerar Fotos';
        }
    }, [isLoading, progress, template]);

    return (
        <>
            <UploadOptionsModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)}
                onLocalUpload={() => { fileInputRef.current?.click(); setIsUploadModalOpen(false); }}
                onGoogleDriveUpload={() => { alert('Ainda não implementado'); setIsUploadModalOpen(false); }}
            />
            <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCaptureConfirm} />
            <EditModal 
                isOpen={isEditModalOpen}
                onClose={handleCloseEditModal}
                imageUrl={editingImageInfo?.imageUrl ?? null}
                onApplyEdit={handleApplyEdit}
            />
            <ProfessionalEditorModal
                isOpen={isProfessionalEditorOpen}
                onClose={() => setIsProfessionalEditorOpen(false)}
                imageUrl={imageForEditor}
                onApply={handleApplyEditorResult}
            />
            <CreativeEditorModal
                isOpen={isCreativeEditorOpen}
                onClose={() => setIsCreativeEditorOpen(false)}
                imageUrl={imageForEditor}
                onApply={handleApplyEditorResult}
                activeTemplate={template}
            />
            <div className="bg-black text-gray-200 min-h-screen flex flex-col items-center p-4 pb-20">
                <ErrorNotification message={error} onDismiss={() => setError(null)} />
                <div className="w-full max-w-6xl mx-auto">
                    <header className="text-center my-12">
                        <h1 className="text-6xl md:text-7xl font-caveat text-white tracking-tight">
                            Bee Retrate-<span className="text-yellow-400">Me</span>
                        </h1>
                        <p className="mt-4 text-lg text-gray-500">Transforme as suas fotos com o poder da IA do Gemini.</p>
                    </header>
                    <main>
                        <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-800 mb-8">
                            {isTemplateSelected && (
                                <div className="mb-6">
                                    <Button onClick={() => handleTemplateSelect(null)}>&larr; Voltar</Button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div>
                                    <h2 className="text-2xl font-semibold mb-6 text-white">1. A Sua Foto</h2>
                                    <div className="w-full aspect-square border-4 border-dashed border-gray-700 rounded-xl flex items-center justify-center cursor-pointer hover:border-yellow-400 transition-colors bg-gray-800 overflow-hidden shadow-inner"
                                        onClick={() => !uploadedImage && setIsUploadModalOpen(true)}>
                                        {isUploading ? (
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-400"></div>
                                                <p className="text-gray-400 mt-4">A carregar...</p>
                                            </div>
                                        ) : uploadedImage ? (
                                            <img src={uploadedImage} alt="Pré-visualização carregada" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-6 text-center text-gray-500">
                                                <IconUpload className="w-12 h-12" />
                                                <p className="mt-4 text-lg text-gray-300">Foto Principal</p>
                                                <p className="mt-1 text-sm text-gray-500">Clique para carregar</p>
                                            </div>
                                        )}
                                    </div>
                                     <div className="flex justify-center mt-4">
                                         <Button onClick={() => setIsCameraOpen(true)}>
                                             <div className="flex items-center gap-2"><IconCamera /><span>Usar Câmara</span></div>
                                         </Button>
                                      </div>
                                      {uploadedImage && !isUploading && (
                                        <div className="flex justify-center mt-4">
                                            <Button onClick={() => setIsUploadModalOpen(true)}>
                                                Mudar Ficheiro
                                            </Button>
                                        </div>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/png, image/jpeg, .dng, image/x-adobe-dng" className="hidden" />
                                </div>
                                <div>
                                    {isTemplateSelected ? (
                                        template === 'video' ? (
                                            <VideoGenerator initialImageDataUrl={uploadedImage} />
                                        ) : (
                                            <>
                                                <h2 className="text-2xl font-semibold mb-6 text-white">2. Opções de Geração</h2>
                                                <div className="p-6 border border-gray-700 rounded-xl space-y-6 bg-gray-800/50">
                                                    <h3 className='text-xl font-semibold text-white'>Ângulo / Perspectiva</h3>
                                                    <div className="flex flex-wrap gap-3">
                                                        <RadioPill name="cameraAngle" value="Padrão" label="Padrão do Tema" checked={cameraAngle === 'Padrão'} onChange={e => setCameraAngle(e.target.value)} />
                                                        <RadioPill name="cameraAngle" value="Frontal" label="Frontal (Conversando)" checked={cameraAngle === 'Frontal'} onChange={e => setCameraAngle(e.target.value)} />
                                                        <RadioPill name="cameraAngle" value="Low Angle" label="De baixo para cima" checked={cameraAngle === 'Low Angle'} onChange={e => setCameraAngle(e.target.value)} />
                                                        <RadioPill name="cameraAngle" value="High Angle" label="De cima para baixo" checked={cameraAngle === 'High Angle'} onChange={e => setCameraAngle(e.target.value)} />
                                                        <RadioPill name="cameraAngle" value="Extreme Close-up" label="Close-up Extremo" checked={cameraAngle === 'Extreme Close-up'} onChange={e => setCameraAngle(e.target.value)} />
                                                    </div>
                                                </div>
                                            </>
                                        )
                                    ) : (
                                        <div>
                                            <h2 className="text-2xl font-semibold mb-6 text-white text-center lg:text-left">2. Escolha um Tema</h2>
                                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-8">
                                                {Object.entries(TEMPLATES).map(([key, data]) => (<TemplateCard key={key} id={key} name={data.name} icon={data.icon} description={data.description} isSelected={template === key} onSelect={handleTemplateSelect} />))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                           
                            {isTemplateSelected && template !== 'video' && (
                                <>
                                    <div className="mt-6">
                                        {template === 'worldTour' && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} className="p-6 border border-gray-700 rounded-xl space-y-6 bg-gray-800/50 mt-6"><h3 className='text-xl font-semibold text-white mb-3'>Escolha o seu Destino</h3><div className="flex flex-wrap gap-3">{TEMPLATES.worldTour.destinations?.map(location => (<RadioPill key={location.id} name="location" value={location.id} label={location.id} checked={selectedLocation === location.id} onChange={(e) => setSelectedLocation(e.target.value)} />))}</div></motion.div>)}
                                        {template === 'cenasDoInstagram' && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} className="p-6 border border-gray-700 rounded-xl space-y-6 bg-gray-800/50 mt-6"><h3 className='text-xl font-semibold text-white mb-3'>Descreva a sua cena</h3><textarea value={instagramScenePrompt} onChange={(e) => setInstagramScenePrompt(e.target.value)} placeholder="Ex: fotos de uma pessoa rica em Florianópolis, minha viagem para Porto de Galinhas..." className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 h-24 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white resize-y" /><h3 className='text-xl font-semibold text-white mb-3'>Formato da Foto</h3><div className="flex flex-wrap gap-3"><RadioPill key="9:16" name="instagram_format" value="9:16" label="Story (9:16)" checked={instagramSceneAspectRatio === '9:16'} onChange={(e) => setInstagramSceneAspectRatio(e.target.value)} /><RadioPill key="3:4" name="instagram_format" value="3:4" label="Feed (3:4)" checked={instagramSceneAspectRatio === '3:4'} onChange={(e) => setInstagramSceneAspectRatio(e.target.value)} /></div></motion.div>)}
                                        {template === 'cleanAndSwap' && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} className="p-6 border border-gray-700 rounded-xl space-y-6 bg-gray-800/50 mt-6"><h3 className='text-xl font-semibold text-white'>Personalize a Nova Pessoa</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-sm font-medium text-gray-400 mb-2">Género</label><select value={swapGender} onChange={e => setSwapGender(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white"><option>Mulher</option><option>Homem</option></select></div><div><label className="block text-sm font-medium text-gray-400 mb-2">Etnia</label><select value={swapEthnicity} onChange={e => setSwapEthnicity(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white"><option>Latina</option><option>Asiática</option><option>Negra</option><option>Caucasiana</option><option>Indiana</option></select></div><div><label className="block text-sm font-medium text-gray-400 mb-2">Cor do Cabelo</label><select value={swapHairColor} onChange={e => setSwapHairColor(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white"><option>Castanho</option><option>Preto</option><option>Loiro</option><option>Ruivo</option><option>Colorido</option></select></div></div></motion.div>)}
                                    </div>
                                    <div className="mt-12 text-center">
                                        <Button onClick={handleMainActionClick} disabled={!uploadedImage || !template || isLoading || isUploading} primary className="text-lg px-12 py-4">
                                            <div className="flex items-center gap-3">
                                                {isLoading ? (
                                                    <><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>{mainButtonText}</>
                                                ) : (
                                                    <>
                                                        {template !== 'editor' && template !== 'criativo' && template !== 'criativoViral' && <IconSparkles />}
                                                        {mainButtonText}
                                                    </>
                                                )}
                                            </div>
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>

                        <div ref={resultsRef}>
                            {(isLoading || generatedImages.length > 0) && template !== 'editor' && template !== 'criativo' && template !== 'criativoViral' && template !== 'video' && (
                                <div className="mt-16">
                                    <h2 className="text-3xl font-bold text-white mb-8 text-center">As Suas Fotos Geradas</h2>
                                    {isLoading && (<div className="w-full max-w-4xl mx-auto mb-8 text-center"><div className="bg-gray-800 rounded-full h-3 overflow-hidden shadow-md"><motion.div className="bg-yellow-400 h-3 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} /></div><p className="text-gray-400 mt-4 text-sm">Por favor, mantenha esta janela aberta enquanto as suas fotos estão a ser geradas.</p></div>)}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-8">
                                        {generatedImages.map((img, index) => {
                                            const activeTemplate = template && template !== 'result' ? TEMPLATES[template] : {isPolaroid: true};
                                            const isResultPolaroid = template === 'result' ? false : activeTemplate.isPolaroid;
                                            const showLabel = template !== 'cleanAndSwap';
                                            
                                            switch (img.status) {
                                                case 'success': return <PhotoDisplay key={`${img.id}-${index}-success`} era={img.id} imageUrl={img.imageUrl!} onDownload={handleDownloadRequest} onRegenerate={() => regenerateImageAtIndex(index)} onEdit={handleOpenEditModal} isPolaroid={isResultPolaroid} index={index} showLabel={showLabel} />;
                                                case 'failed': return <ErrorCard key={`${img.id}-${index}-failed`} era={img.id} isPolaroid={activeTemplate.isPolaroid} onRegenerate={() => regenerateImageAtIndex(index)} showLabel={showLabel} />;
                                                default: return <LoadingCard key={`${img.id}-${index}-pending`} era={img.id} isPolaroid={activeTemplate.isPolaroid} showLabel={showLabel} />;
                                            }
                                        })}
                                    </div>
                                    <p className="text-center text-xs text-gray-600 mt-8">Feito com Gemini</p>
                                </div>
                            )}
                            {!isLoading && generatedImages.length > 0 && (<div className="text-center mt-16 mb-12 flex justify-center gap-6"><Button onClick={handleStartOver}>Começar de Novo</Button><AlbumDownloadButton isDownloading={isDownloadingAlbum} onDownload={handleAlbumDownloadRequest} /></div>)}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
};

export default App;