import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { nanoid } from 'nanoid';
import Button from '../../components/Button.tsx';
import { IconUpload, IconSparkles, IconTrash, IconImage, IconDownload, IconLayers, IconTranslate, IconX, IconImageIcon } from '../../components/Icons.tsx';
import ErrorNotification from '../../components/ErrorNotification.tsx';
import { generateImageWithRetry, translateText } from '../../services/geminiService.ts';
import { toBase64, base64ToFile, blobToBase64 } from '../../utils/imageUtils.ts';
import { addCreation } from '../../utils/db.ts';
import type { Creation, UploadedAsset } from '../../types.ts';
import MyCreationsModal from '../MyCreationsModal.tsx';
import UploadOptionsModal from '../UploadOptionsModal.tsx';
import GalleryPickerModal from '../GalleryPickerModal.tsx';
import { uploadUserAsset } from '../../services/databaseService.ts';


// A self-contained image uploader component with drag-and-drop support
const ImageUploader: React.FC<{ onUpload?: (files: FileList) => void, onClick?: () => void, children: React.ReactNode, className?: string, single?: boolean }> = ({ onUpload, onClick, children, className, single = false }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragIn = (e: React.DragEvent) => {
        handleDrag(e);
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragOver(true);
        }
    };

    const handleDragOut = (e: React.DragEvent) => {
        handleDrag(e);
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        handleDrag(e);
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUpload) {
            onUpload(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };
    
    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (onUpload) {
            inputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && onUpload) {
            onUpload(e.target.files);
            e.target.value = ''; // Reset input
        }
    };

    return (
        <div
            onClick={handleClick}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg transition-colors duration-200 ${className} ${isDragOver ? 'border-brand-primary bg-brand-primary/10' : 'border-brand-accent hover:border-brand-secondary'}`}
        >
            {onUpload && <input ref={inputRef} type="file" multiple={!single} accept="image/*" onChange={handleFileChange} className="hidden" />}
            {children}
        </div>
    );
};

const UnirView: React.FC = () => {
    const [baseImage, setBaseImage] = useState<string | null>(null);
    const [blendImages, setBlendImages] = useState<string[]>([]);
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [settings, setSettings] = useState({ matchColor: true, strength: 50 });
    
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<'generate' | 'translate' | 'gallery' | null>(null);
    const [isTranslating, setIsTranslating] = useState<'prompt' | 'negative' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [isCreationsModalOpen, setIsCreationsModalOpen] = useState(false);
    const [isUploadOptionsModalOpen, setIsUploadOptionsModalOpen] = useState(false);
    const [isGalleryPickerModalOpen, setIsGalleryPickerModalOpen] = useState(false);
    const [uploadTarget, setUploadTarget] = useState<'base' | 'blend' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFilesUpload = async (files: FileList, target: 'base' | 'blend') => {
        setError(null);
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        try {
            const base64Images = await Promise.all(imageFiles.map(toBase64));
            if (target === 'base') {
                setBaseImage(base64Images[0]);
            } else {
                setBlendImages(prev => [...prev, ...base64Images]);
            }
        } catch (err) {
            console.error("Error loading images:", err);
            setError("Falha ao carregar uma ou mais imagens.");
        }
    };

    const handleTriggerUpload = (target: 'base' | 'blend') => {
        setUploadTarget(target);
        setIsUploadOptionsModalOpen(true);
    };

    const handleLocalUpload = () => {
        setIsUploadOptionsModalOpen(false);
        fileInputRef.current?.click();
    };
    
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && uploadTarget) {
            handleFilesUpload(e.target.files, uploadTarget);
            setUploadTarget(null);
        }
    };
    
    const handleSelectFromGallery = async (asset: UploadedAsset) => {
        setIsGalleryPickerModalOpen(false);
        setError(null);
        try {
            const response = await fetch(asset.url);
            if (!response.ok) throw new Error(`Failed to fetch image`);
            const blob = await response.blob();
            const base64Image = await blobToBase64(blob);

            if (uploadTarget === 'base') {
                setBaseImage(base64Image);
            } else if (uploadTarget === 'blend') {
                setBlendImages(prev => [...prev, base64Image]);
            }
        } catch (err) {
            console.error("Error loading image from gallery:", err);
            setError("Não foi possível carregar a imagem da galeria.");
        } finally {
            setUploadTarget(null);
        }
    };

    const handleTranslate = async (type: 'prompt' | 'negative') => {
        const textToTranslate = type === 'prompt' ? prompt : negativePrompt;
        const setText = type === 'prompt' ? setPrompt : setNegativePrompt;
        
        if (!textToTranslate.trim()) return;

        setIsTranslating(type);
        try {
            const translated = await translateText(textToTranslate, 'English');
            setText(translated);
        } catch (e) {
            setError("A tradução falhou. Por favor, verifique a sua API Key.");
        } finally {
            setIsTranslating(null);
        }
    };

    const handleGenerate = async () => {
        if (!baseImage) {
            setError("Por favor, adicione uma imagem base para começar.");
            return;
        }
        if (!prompt.trim()) {
            setError("Por favor, escreva um prompt para guiar a IA.");
            return;
        }

        setIsLoading('generate');
        setError(null);
        setResultImage(null);

        let modelInstruction = `**CRITICAL TASK: PHOTOREALISTIC IMAGE FUSION**
        You are an expert image editor. Your task is to create a single, cohesive, photorealistic image by masterfully blending subjects from a 'base image' and several 'blend images' into a new scene described by the user's prompt. The result must NOT look like a collage.

        **MANDATORY PROCESS:**
        1.  **SUBJECT ANALYSIS:** From the 'base image', identify and extract the main subject. From each 'blend image', identify and extract their main subjects.
        2.  **SCENE CREATION:** Generate a completely new, photorealistic scene based on the user's prompt. The lighting, shadows, and perspective must be consistent.
        3.  **SEAMLESS INTEGRATION:** Place all extracted subjects into the new scene. **TOP PRIORITY:** Adjust lighting, shadows, scale, and perspective of each subject to perfectly match the new environment and each other.
        
        **USER'S PROMPT:** "${prompt}"
        ${negativePrompt ? `**NEGATIVE PROMPT (AVOID THESE):** "${negativePrompt}"\n` : ''}
        **SETTINGS:**
        ${settings.matchColor ? "- Harmonize the color palette of all subjects and the scene, taking cues from the 'base image' for a consistent look." : ''}
        - The creative influence of the 'blend images' on the final result should be moderate (Strength: ${settings.strength}%).
        
        The final output must be a single, realistic photograph where all elements exist naturally together.`;

        try {
            const newImage = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: baseImage,
                detailImages: blendImages.length > 0 ? blendImages : undefined,
            });
            setResultImage(newImage);

            const creation: Creation = {
                id: nanoid(),
                timestamp: Date.now(),
                finalImage: newImage,
                thumbnail: newImage, // Use final image as thumbnail
                baseImage,
                blendImages,
                prompt,
                negativePrompt,
                settings,
            };
            await addCreation(creation);
        } catch (err) {
            console.error("Image combination failed:", err);
            const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`A geração falhou: ${errorMessage}`);
        } finally {
            setIsLoading(null);
        }
    };
    
    const handleUseAsBase = () => {
        if (resultImage) {
            setBaseImage(resultImage);
            setBlendImages([]);
            setResultImage(null);
        }
    };

    const handleDownload = () => {
        if (resultImage) {
            const link = document.createElement('a');
            link.href = resultImage;
            link.download = `GenIA-Blend-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const handleSaveToGallery = async () => {
        if (!resultImage) return;
        
        setIsLoading('gallery');
        setError(null);
        try {
            const file = base64ToFile(resultImage, `GenIA-Blend-${Date.now()}.png`);
            await uploadUserAsset(file);
            alert('Imagem salva na sua galeria com sucesso!');
        } catch(err) {
            console.error("Failed to save to gallery:", err);
            setError('Falha ao salvar na galeria.');
        } finally {
            setIsLoading(null);
        }
    };
    
    const handleReloadCreation = (creation: Creation) => {
        setBaseImage(creation.baseImage);
        setBlendImages(creation.blendImages);
        setPrompt(creation.prompt);
        setNegativePrompt(creation.negativePrompt);
        setSettings(creation.settings);
        setResultImage(creation.finalImage);
        setError(null);
    };

    return (
        <>
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <MyCreationsModal isOpen={isCreationsModalOpen} onClose={() => setIsCreationsModalOpen(false)} onReload={handleReloadCreation} />
            <UploadOptionsModal
                isOpen={isUploadOptionsModalOpen}
                onClose={() => setIsUploadOptionsModalOpen(false)}
                onLocalUpload={handleLocalUpload}
                onGalleryUpload={() => {
                    setIsUploadOptionsModalOpen(false);
                    setIsGalleryPickerModalOpen(true);
                }}
                galleryEnabled={true}
            />
             <GalleryPickerModal
                isOpen={isGalleryPickerModalOpen}
                onClose={() => setIsGalleryPickerModalOpen(false)}
                onSelectAsset={handleSelectFromGallery}
            />
            <input ref={fileInputRef} type="file" multiple={uploadTarget === 'blend'} accept="image/*" onChange={handleFileInputChange} className="hidden" />
            
            <div className="h-full flex flex-col p-6">
                <header className="flex-shrink-0 mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Image Blender</h1>
                        <p className="text-gray-300 mt-1">Combine elementos de várias imagens numa única criação.</p>
                    </div>
                    <Button onClick={() => setIsCreationsModalOpen(true)}>
                        <div className="flex items-center gap-2"><IconLayers /> Minhas Criações</div>
                    </Button>
                </header>

                <div className="flex-grow flex flex-col lg:flex-row gap-8 min-h-0">
                    {/* Left Panel: Controls */}
                    <div className="lg:w-1/3 flex flex-col gap-4 bg-brand-dark/50 p-4 rounded-2xl border border-brand-accent/50 overflow-y-auto">
                         <div>
                            <label className="text-lg font-semibold text-white mb-2 block">Imagem Base</label>
                            <ImageUploader onClick={() => handleTriggerUpload('base')} className="aspect-video w-full flex items-center justify-center text-gray-400 cursor-pointer" single>
                                {baseImage ? <img src={baseImage} className="w-full h-full object-contain p-1" /> : <div className="text-center"><IconUpload className="mx-auto h-10 w-10"/><p>Clique ou arraste a imagem</p></div>}
                            </ImageUploader>
                        </div>
                        <div>
                            <label className="text-lg font-semibold text-white mb-2 block">Imagens para Misturar</label>
                            <div className="grid grid-cols-3 gap-2">
                                {blendImages.map((img, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        <img src={img} className="w-full h-full object-cover rounded-md" />
                                        <button onClick={() => setBlendImages(prev => prev.filter((_, i) => i !== index))} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><IconX className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                <ImageUploader onClick={() => handleTriggerUpload('blend')} className="aspect-square flex items-center justify-center text-gray-400 cursor-pointer">
                                    <IconUpload className="h-8 w-8" />
                                </ImageUploader>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-sm font-medium text-gray-300 mb-1 block">Prompt</label>
                             <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: 'Um cão a usar o chapéu, sentado no sofá...'" className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 h-24 focus:outline-none focus:ring-1 focus:ring-brand-primary text-white resize-y" />
                             <button onClick={() => handleTranslate('prompt')} disabled={isTranslating === 'prompt'} className="absolute bottom-2 right-2 p-1.5 rounded hover:bg-brand-accent" title="Traduzir para Inglês">{isTranslating === 'prompt' ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-200"></div> : <IconTranslate className="w-4 h-4" />}</button>
                        </div>
                         <div className="relative">
                            <label className="text-sm font-medium text-gray-300 mb-1 block">Prompt Negativo</label>
                             <textarea value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="Ex: 'desenho animado, má qualidade, texto'" className="w-full bg-brand-light border border-brand-accent rounded-lg p-2 h-16 focus:outline-none focus:ring-1 focus:ring-brand-primary text-white resize-y" />
                             <button onClick={() => handleTranslate('negative')} disabled={isTranslating === 'negative'} className="absolute bottom-2 right-2 p-1.5 rounded hover:bg-brand-accent" title="Traduzir para Inglês">{isTranslating === 'negative' ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-200"></div> : <IconTranslate className="w-4 h-4" />}</button>
                        </div>

                         <div>
                            <label className="text-lg font-semibold text-white mb-2 block">Definições</label>
                            <div className="space-y-3 bg-brand-light/50 p-3 rounded-lg">
                                 <label className="flex items-center justify-between cursor-pointer"><span className="text-sm text-gray-200">Corresponder Cor</span><input type="checkbox" checked={settings.matchColor} onChange={e => setSettings(s => ({...s, matchColor: e.target.checked}))} className="w-4 h-4 rounded bg-brand-dark border-brand-accent text-brand-primary focus:ring-red-500 ring-offset-brand-dark" /></label>
                                 <div>
                                    <div className="flex justify-between items-center text-sm text-gray-200"><span>Força</span><span>{settings.strength}</span></div>
                                    <input type="range" min="0" max="100" value={settings.strength} onChange={e => setSettings(s => ({...s, strength: Number(e.target.value)}))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm" />
                                 </div>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <Button onClick={handleGenerate} primary disabled={!!isLoading} className="w-full text-lg py-3">
                                {isLoading === 'generate' ? <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-dark"></div>A Gerar...</div> : <div className="flex items-center justify-center gap-2"><IconSparkles />Gerar</div>}
                            </Button>
                        </div>
                    </div>

                    {/* Right Panel: Result */}
                    <div className="lg:w-2/3 flex-grow flex items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 relative group">
                        {isLoading === 'generate' ? (
                            <div className="flex flex-col items-center text-gray-300"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary mb-4"></div><p>A IA está a criar a sua imagem...</p></div>
                        ) : resultImage ? (
                            <motion.img initial={{opacity:0}} animate={{opacity:1}} src={resultImage} alt="Imagem gerada" className="max-w-full max-h-full object-contain rounded-lg" />
                        ) : (
                            <div className="text-center text-gray-500"><IconImage /><p className="mt-2">O seu resultado aparecerá aqui</p></div>
                        )}
                        {resultImage && !isLoading && (
                            <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button onClick={handleDownload}><div className="flex items-center gap-2"><IconDownload/><span>Baixar</span></div></Button>
                                <Button onClick={handleUseAsBase}><div className="flex items-center gap-2"><IconImage/><span>Usar como Base</span></div></Button>
                                <Button onClick={handleSaveToGallery} disabled={isLoading === 'gallery'}>
                                    <div className="flex items-center gap-2"><IconImageIcon className="w-5 h-5"/><span>{isLoading === 'gallery' ? 'A Salvar...' : 'Salvar na Galeria'}</span></div>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default UnirView;