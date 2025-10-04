import React, { useState, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/gotrue-js';
import { nanoid } from 'nanoid';

import Button from '../../components/Button.tsx';
import PhotoDisplay from '../../components/PhotoDisplay.tsx';
import LoadingCard from '../../components/LoadingCard.tsx';
import ErrorCard from '../../components/ErrorCard.tsx';
import ErrorNotification from '../../components/ErrorNotification.tsx';
import CameraModal from '../../components/CameraModal.tsx';
import EditModal from '../../components/EditModal.tsx';
import RadioPill from '../../components/RadioPill.tsx';
import AlbumDownloadButton from '../../components/AlbumDownloadButton.tsx';
import UploadOptionsModal from '../../components/UploadOptionsModal.tsx';
import { IconUpload, IconSparkles, IconCamera, IconChevronDown } from '../../components/Icons.tsx';
import GalleryPickerModal from '../GalleryPickerModal.tsx';

import { toBase64, createSingleFramedImage, blobToBase64, base64ToFile } from '../../utils/imageUtils.ts';
import { generateImageWithRetry, getModelInstruction, translateText } from '../../services/geminiService.ts';
import { uploadUserAsset, createSignedUrlForPath } from '../../services/databaseService.ts';
import { TEMPLATES, ENHANCER_CATEGORIES } from '../../constants.ts';
import type { GeneratedImage, Prompt, Template, UserProfile, UploadedAsset } from '../../types.ts';
import { showGoogleDrivePicker } from '../../services/googleDriveService.ts';
import { ApiKeyContext } from '../../types.ts';

interface GeneratorViewProps {
    templateKey: string;
    userProfile: (User & { isAdmin: boolean }) | null;
}

const GeneratorView: React.FC<GeneratorViewProps> = ({ templateKey, userProfile }) => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloadingAlbum, setIsDownloadingAlbum] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isGalleryPickerModalOpen, setIsGalleryPickerModalOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingImageInfo, setEditingImageInfo] = useState<{imageUrl: string; index: number} | null>(null);
    
    // Customization state
    const [numImages, setNumImages] = useState(6);
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [instagramScenePrompt, setInstagramScenePrompt] = useState<string>('');
    const [instagramSceneAspectRatio, setInstagramSceneAspectRatio] = useState<string>('9:16');
    const [swapGender, setSwapGender] = useState<string>('Mulher');
    const [swapEthnicity, setSwapEthnicity] = useState<string>('Latina');
    const [swapHairColor, setSwapHairColor] = useState<string>('Castanho');
    const [swapAge, setSwapAge] = useState<string>('Jovem (20-30)');
    
    // State for enhancers
    const [openEnhancerSections, setOpenEnhancerSections] = useState<Set<string>>(new Set());
    const [selectedEnhancers, setSelectedEnhancers] = useState<Set<string>>(new Set());
    const apiKey = useContext(ApiKeyContext);
    
    const template = TEMPLATES[templateKey];

    const toggleEnhancerSection = (sectionName: string) => {
        setOpenEnhancerSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionName)) {
                newSet.delete(sectionName);
            } else {
                newSet.add(sectionName);
            }
            return newSet;
        });
    };

    const handleEnhancerChange = (term: string, isChecked: boolean) => {
        setSelectedEnhancers(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(term);
            } else {
                newSet.delete(term);
            }
            return newSet;
        });
    };


    const getPromptsForTemplate = (): Prompt[] => {
        if (!template) return [];
        switch (templateKey) {
            case 'worldTour':
                const destination = (template as any).destinations?.find((d: any) => d.id === selectedLocation);
                if (!destination) return [];
                const shuffled = [...destination.prompts].sort(() => 0.5 - Math.random());
                return shuffled.slice(0, numImages);
            case 'cenasDoInstagram':
                 if (!instagramScenePrompt.trim()) return [];
                return Array.from({ length: numImages }, (_, i) => ({
                    id: `Variação ${i + 1}`,
                    base: `${instagramScenePrompt}${i > 0 ? `, variação ${i + 1}` : ''}`
                }));
            case 'cleanAndSwap':
                return template.prompts || [];
            default:
                return [];
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    
    const handleSelectFromGallery = async (asset: UploadedAsset) => {
        setIsGalleryPickerModalOpen(false);
        setIsUploading(true);
        setError(null);
        try {
            if (!asset.storage_path) {
                throw new Error("O caminho de armazenamento do recurso está ausente.");
            }
            const signedUrl = await createSignedUrlForPath(asset.storage_path);
            const response = await fetch(signedUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
            }
            const blob = await response.blob();
            const base64Image = await blobToBase64(blob);
            setUploadedImage(base64Image);
            setGeneratedImages([]); 
        } catch (err) {
            console.error("Error loading image from gallery:", err);
            setError("Não foi possível carregar a imagem da galeria.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleGoogleDriveUpload = async () => {
        setIsUploadModalOpen(false);
        setIsUploading(true);
        setError(null);
        try {
            const images = await showGoogleDrivePicker();
            if (images.length > 0) {
                setUploadedImage(images[0]);
                setGeneratedImages([]);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            console.error("Google Drive Picker Error:", err);
            setError(`Falha ao importar do Google Drive: ${msg}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) { setError("Por favor, carregue uma foto para começar!"); return; }
        if (templateKey === 'worldTour' && !selectedLocation) { setError("Por favor, selecione um destino!"); return; }
        if (templateKey === 'cenasDoInstagram' && !instagramScenePrompt.trim()) { setError("Por favor, descreva a cena."); return; }
        if (!apiKey) {
            setError("A sua chave de API não foi encontrada. Por favor, verifique as configurações.");
            return;
        }

        setIsLoading(true); setError(null);
        setTimeout(() => { (resultsRef.current as any)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        
        const options = { hairColors: [], swapGender, swapEthnicity, swapHairColor, swapAge, lookbookStyle: '', customLookbookStyle: '' };
        
        const promptsForGeneration = getPromptsForTemplate();
        if (!promptsForGeneration || promptsForGeneration.length === 0) {
            setError("Ocorreu um problema ao preparar as ideias. Tente novamente.");
            setIsLoading(false); return;
        }

        setGeneratedImages(promptsForGeneration.map(p => ({ id: p.id, status: 'pending', imageUrl: null })));
        
        let translatedBasePrompt = instagramScenePrompt;
        if (templateKey === 'cenasDoInstagram') {
            try {
                translatedBasePrompt = await translateText(instagramScenePrompt, 'English', apiKey);
            } catch (e) {
                setError("A tradução do prompt falhou. A gerar com o prompt original.");
                console.error("Translation failed:", e);
            }
        }


        for (let i = 0; i < promptsForGeneration.length; i++) {
            const p = promptsForGeneration[i];
            try {
                let promptForModel = p;
                 if (templateKey === 'cenasDoInstagram') {
                    const translatedVariation = i > 0 ? ` (variation ${i + 1})` : '';
                    promptForModel = { ...p, base: translatedBasePrompt + translatedVariation };
                }

                const aspectRatio = templateKey === 'cenasDoInstagram' ? instagramSceneAspectRatio : undefined;
                let modelInstruction = getModelInstruction(templateKey, promptForModel, options, aspectRatio);
                
                if ((templateKey === 'cenasDoInstagram' || templateKey === 'worldTour') && selectedEnhancers.size > 0) {
                    const enhancersString = Array.from(selectedEnhancers).join(', ');
                    modelInstruction += `. Apply the following visual styles: ${enhancersString}`;
                }

                const imageUrl = await generateImageWithRetry({ prompt: modelInstruction, base64ImageData: uploadedImage, apiKey });
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
        if (!apiKey) {
            setError("A sua chave de API não foi encontrada para regenerar.");
            return;
        }
        
        let promptsForGeneration = getPromptsForTemplate();
        
        if (templateKey === 'cenasDoInstagram' && instagramScenePrompt) {
             const translatedBasePrompt = await translateText(instagramScenePrompt, 'English', apiKey);
             promptsForGeneration = Array.from({ length: numImages }, (_, i) => ({
                id: `Variação ${i + 1}`,
                base: `${translatedBasePrompt}${i > 0 ? `, variação ${i + 1}` : ''}`
            }));
        }

        const promptToRegenerate = promptsForGeneration[imageIndex];
        
        if (!promptToRegenerate) {
            setError("Não foi possível encontrar o prompt para regenerar.");
            return;
        }

        setGeneratedImages(prev => prev.map((img, index) => index === imageIndex ? { ...img, status: 'pending' } : img));
        
        try {
            const options = { hairColors: [], swapGender, swapEthnicity, swapHairColor, swapAge, lookbookStyle: '', customLookbookStyle: '' };
            const aspectRatio = templateKey === 'cenasDoInstagram' ? instagramSceneAspectRatio : undefined;
            let modelInstruction = getModelInstruction(templateKey, promptToRegenerate, options, aspectRatio);

            if ((templateKey === 'cenasDoInstagram' || templateKey === 'worldTour') && selectedEnhancers.size > 0) {
                const enhancersString = Array.from(selectedEnhancers).join(', ');
                modelInstruction += `. Apply the following visual styles: ${enhancersString}`;
            }

            const imageUrl = await generateImageWithRetry({ prompt: modelInstruction, base64ImageData: uploadedImage, apiKey });
            
            setGeneratedImages(prev => prev.map((img, index) => 
                index === imageIndex 
                    ? { ...img, status: 'success', imageUrl } 
                    : img
            ));
        } catch (err) {
            console.error(`Falha ao regenerar imagem para ${promptToRegenerate.id}:`, err);
            setGeneratedImages(prev => prev.map((img, index) => 
                index === imageIndex 
                    ? { ...img, status: 'failed' } 
                    : img
            ));
        }
    };

    const handleEditImage = (imageUrl: string, index: number) => {
        setEditingImageInfo({imageUrl, index});
        setIsEditModalOpen(true);
    };

    const handleApplyEdit = (newImageUrl: string) => {
        if (editingImageInfo) {
            setGeneratedImages(prev => prev.map((img, index) => 
                index === editingImageInfo.index
                    ? { ...img, status: 'success', imageUrl: newImageUrl }
                    : img
            ));
        }
        setIsEditModalOpen(false);
        setEditingImageInfo(null);
    };

    const handleDownload = async (imageUrl: string, era: string, ratio: string) => {
        const framedImage = await createSingleFramedImage(imageUrl, ratio, era);
        const link = document.createElement('a');
        link.href = framedImage;
        link.download = `GenIA-${era.replace(/\s/g, '_')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const downloadAlbum = async (ratio: '1:1' | '9:16') => {
        const successfulImages = generatedImages.filter(img => img.status === 'success' && img.imageUrl);
        if (successfulImages.length === 0) {
            setError("Nenhuma imagem para descarregar.");
            return;
        }
        setIsDownloadingAlbum(true);
        setError(null);

        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        for (const image of successfulImages) {
            try {
                const framedImageB64 = await createSingleFramedImage(image.imageUrl!, ratio, image.id);
                const fileData = framedImageB64.split(',')[1];
                zip.file(`GenIA-${image.id.replace(/\s/g, '_')}.png`, fileData, { base64: true });
            } catch (err) {
                 console.error(`Falha ao processar a imagem ${image.id} para o álbum:`, err);
            }
        }

        try {
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `GenIA_Album_${template?.name.replace(/\s/g, '_')}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (err) {
            setError("Falha ao criar o arquivo zip.");
            console.error("Erro ao gerar zip:", err);
        } finally {
            setIsDownloadingAlbum(false);
        }
    };

    const handleSaveToGallery = async (imageUrl: string, era: string) => {
        setError(null);
        alert('A salvar na sua galeria...');
        try {
            const fileName = `GenIA_${template?.name}_${era}_${nanoid(4)}.png`;
            const file = base64ToFile(imageUrl, fileName);
            await uploadUserAsset(file);
            alert(`'${era}' salvo na sua galeria com sucesso!`);
        } catch (err) {
            console.error("Failed to save to gallery:", err);
            setError("Falha ao salvar na galeria. Por favor, tente novamente.");
        }
    };
    
    return (
        <>
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <CameraModal isOpen={isCameraOpen} onCapture={handleCaptureConfirm} onClose={() => setIsCameraOpen(false)} />
            <EditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} imageUrl={editingImageInfo?.imageUrl ?? null} onApplyEdit={handleApplyEdit} />
            <UploadOptionsModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                onLocalUpload={() => { (fileInputRef.current as any)?.click(); setIsUploadModalOpen(false); }}
                onGalleryUpload={() => {
                    setIsUploadModalOpen(false);
                    setIsGalleryPickerModalOpen(true);
                }}
                onGoogleDriveUpload={handleGoogleDriveUpload}
                galleryEnabled={true}
            />
            <GalleryPickerModal
                isOpen={isGalleryPickerModalOpen}
                onClose={() => setIsGalleryPickerModalOpen(false)}
                onSelectAsset={handleSelectFromGallery}
            />

            <div className="h-full flex flex-col">
                <div className="flex-grow overflow-y-auto pr-4">
                    <header className="text-center py-8">
                        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">{template?.name}</h1>
                        <p className="mt-3 text-lg text-gray-300 max-w-2xl mx-auto">{template?.description}</p>
                    </header>

                    <motion.section 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-5xl mx-auto bg-brand-dark/50 p-8 rounded-2xl border border-brand-accent/50"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="flex flex-col items-center">
                                <h2 className="text-xl font-semibold text-center text-white mb-4">1. A Sua Foto</h2>
                                <div className="w-full max-w-sm aspect-square bg-brand-light rounded-xl border-2 border-dashed border-brand-accent flex items-center justify-center overflow-hidden">
                                    {isUploading ? (
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                                    ) : uploadedImage ? (
                                        <img src={uploadedImage} alt="Carregado pelo utilizador" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-gray-400 p-4">
                                            <IconUpload className="mx-auto" />
                                            <p className="mt-2 text-sm">Arraste e solte uma imagem ou clique para carregar</p>
                                        </div>
                                    )}
                                </div>
                                 <div className="flex gap-4 mt-4">
                                    <Button onClick={() => setIsUploadModalOpen(true)}>{uploadedImage ? 'Mudar Foto' : 'Carregar Foto'}</Button>
                                    <Button onClick={() => setIsCameraOpen(true)}><div className="flex items-center gap-2"><IconCamera/><span>Usar Câmara</span></div></Button>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                            </div>

                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-center text-white">2. Personalize</h2>
                                
                                {templateKey === 'worldTour' && (
                                    <div className="space-y-2">
                                        <label className="block font-medium text-gray-300">Destino</label>
                                        <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
                                            <option value="">Selecione um destino</option>
                                            {(template as any).destinations?.map((d: any) => <option key={d.id} value={d.id}>{d.id}</option>)}
                                        </select>
                                    </div>
                                )}

                                {templateKey === 'cenasDoInstagram' && (
                                    <div className="space-y-4">
                                        <textarea value={instagramScenePrompt} onChange={(e) => setInstagramScenePrompt(e.target.value)} placeholder="Descreva a cena para as 6 fotos. Ex: 'a trabalhar num café moderno e elegante...'" className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-24 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y" />
                                        <div>
                                            <label htmlFor="aspect-ratio-select-ig" className="block text-sm font-medium text-gray-300 mb-1">Tamanho da Imagem</label>
                                            <select
                                                id="aspect-ratio-select-ig"
                                                value={instagramSceneAspectRatio}
                                                onChange={(e) => setInstagramSceneAspectRatio(e.target.value)}
                                                className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                            >
                                                <option value="1:1">Feed Quadrado (1:1)</option>
                                                <option value="4:5">Feed Retrato (4:5)</option>
                                                <option value="9:16">Stories (9:16)</option>
                                                <option value="4:3">Paisagem (4:3)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                                
                                {(templateKey === 'worldTour' || templateKey === 'cenasDoInstagram') && (
                                     <div className="space-y-2 pt-2">
                                        <h3 className="text-base font-semibold text-gray-200">Potenciadores (Opcional)</h3>
                                        {ENHANCER_CATEGORIES.map(category => (
                                            <div key={category.name} className="bg-brand-light/50 rounded-lg border border-brand-accent/50 overflow-hidden">
                                                <button
                                                    onClick={() => toggleEnhancerSection(category.name)}
                                                    className="w-full flex justify-between items-center p-3 text-left font-semibold"
                                                >
                                                    <span>{category.name}</span>
                                                    <IconChevronDown className={`w-5 h-5 transition-transform ${openEnhancerSections.has(category.name) ? 'rotate-180' : ''}`} />
                                                </button>
                                                <AnimatePresence>
                                                    {openEnhancerSections.has(category.name) && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="p-3 border-t border-brand-accent/50 space-y-2 max-h-48 overflow-y-auto">
                                                                {category.options.map(option => (
                                                                    <label key={option.term} className="flex items-center gap-2 cursor-pointer text-sm p-1 rounded hover:bg-brand-accent/50">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedEnhancers.has(option.term)}
                                                                            onChange={(e) => handleEnhancerChange(option.term, e.target.checked)}
                                                                            className="w-4 h-4 rounded bg-brand-dark border-brand-accent text-brand-primary focus:ring-brand-secondary"
                                                                        />
                                                                        <span>{option.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {templateKey === 'cleanAndSwap' && (
                                    <div className="grid grid-cols-2 gap-4">
                                         <select value={swapGender} onChange={(e) => setSwapGender(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                                             <option>Mulher</option><option>Homem</option>
                                         </select>
                                         <select value={swapEthnicity} onChange={(e) => setSwapEthnicity(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                                            <option>Latina</option><option>Asiática</option><option>Negra</option><option>Caucasiana</option><option>Indiana</option>
                                         </select>
                                          <select value={swapHairColor} onChange={(e) => setSwapHairColor(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                                            <option>Castanho</option><option>Preto</option><option>Loiro</option><option>Ruivo</option><option>Colorido</option>
                                         </select>
                                          <select value={swapAge} onChange={(e) => setSwapAge(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                                            <option>Jovem (20-30)</option><option>Adulto (30-45)</option><option>Maduro (45-60)</option>
                                         </select>
                                    </div>
                                )}
                                
                                { (templateKey === 'worldTour' || templateKey === 'cenasDoInstagram') && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="block font-medium text-gray-300">Número de Imagens</label>
                                            <input type="number" value={numImages} onChange={(e) => setNumImages(Math.max(1, Math.min(12, parseInt(e.target.value, 10))))} min="1" max="12" className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white" />
                                        </div>
                                    </div>
                                )}
                                
                                <Button onClick={handleGenerateClick} primary disabled={isLoading} className="w-full">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-dark"></div><span>A gerar...</span></div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2"><IconSparkles className="w-6 h-6"/><span>Gerar Imagens</span></div>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </motion.section>

                    {(isLoading || generatedImages.length > 0) && (
                        <section ref={resultsRef} className="max-w-7xl mx-auto py-12">
                            <h2 className="text-3xl font-bold text-center text-white mb-8">Os Seus Resultados</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {generatedImages.map((img, index) => {
                                    if (img.status === 'pending') return <LoadingCard key={img.id} era={img.id} isPolaroid={template?.isPolaroid} />;
                                    if (img.status === 'failed') return <ErrorCard key={img.id} era={img.id} isPolaroid={template?.isPolaroid} onRegenerate={() => regenerateImageAtIndex(index)} />;
                                    if (img.status === 'success' && img.imageUrl) {
                                        return (
                                            <PhotoDisplay 
                                                key={img.id} 
                                                era={img.id} 
                                                imageUrl={img.imageUrl} 
                                                onDownload={handleDownload}
                                                onRegenerate={() => regenerateImageAtIndex(index)}
                                                onEdit={handleEditImage}
                                                isPolaroid={template?.isPolaroid}
                                                index={index}
                                                onSaveToGallery={handleSaveToGallery}
                                                canSaveToGallery={true}
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                            
                            {generatedImages.some(img => img.status === 'success') && (
                                <div className="mt-12 flex justify-center">
                                    <AlbumDownloadButton isDownloading={isDownloadingAlbum} onDownload={downloadAlbum} />
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </>
    );
};
export default GeneratorView;