import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../Button.tsx';
import ImageUploader from '../ImageUploader.tsx';
import ErrorNotification from '../ErrorNotification.tsx';
import { IconUpload, IconSparkles, IconImage, IconDownload, IconImageIcon } from '../Icons.tsx';
import { toBase64, base64ToFile } from '../../utils/imageUtils.ts';
import { generateImageWithRetry } from '../../services/geminiService.ts';
import { uploadUserAsset } from '../../services/databaseService.ts';
import { nanoid } from 'nanoid';

const SceneRecreatorView: React.FC = () => {
    const [inspirationImage, setInspirationImage] = useState<string | null>(null);
    const [userImage, setUserImage] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = async (file: File, target: 'inspiration' | 'user') => {
        setError(null);
        try {
            const base64 = await toBase64(file);
            if (target === 'inspiration') {
                setInspirationImage(base64);
            } else {
                setUserImage(base64);
            }
        } catch (err) {
            setError("Falha ao carregar a imagem.");
        }
    };

    const handleGenerate = async () => {
        if (!userImage || !inspirationImage) {
            setError("Por favor, adicione a sua foto e a imagem de inspiração.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);

        const modelInstruction = `**CRITICAL TASK: Subject Replacement and Scene Recreation.**
        You are given two images.
        - **IMAGE 1 (The Scene):** This image provides the complete background, environment, lighting, camera angle, and clothing style.
        - **IMAGE 2 (The Person):** This image provides the person whose face and identity MUST be used in the final result.

        **YOUR GOAL:** Create a new image by taking the person from IMAGE 2 and placing them into the scene from IMAGE 1.

        **MANDATORY INSTRUCTIONS:**
        1.  **IGNORE THE PERSON IN IMAGE 1.** Their identity is irrelevant.
        2.  **USE ONLY THE PERSON FROM IMAGE 2.** Their face and likeness must be accurately represented.
        3.  **RECREATE THE SCENE from IMAGE 1.** This includes the background, lighting, and overall mood.
        4.  **ADAPT THE CLOTHING.** The person from IMAGE 2 should be wearing clothes that match the style and type seen in IMAGE 1.
        5.  **SEAMLESS INTEGRATION:** The final image must be a single, photorealistic photograph. The person must look like they were naturally part of the scene.

        **DO NOT, under any circumstances, return the original IMAGE 1. You MUST perform the subject replacement.**`;

        try {
            const imageUrl = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: inspirationImage, // SCENE is now the primary image
                detailImages: [userImage],       // PERSON is now the detail image
            });
            setResultImage(imageUrl);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`A geração falhou: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = () => {
        if (!resultImage) return;
        const link = document.createElement('a');
        link.href = resultImage;
        link.download = `GenIA_SceneRecreation_${nanoid(6)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveToGallery = async () => {
        if (!resultImage) return;
        setIsSaving(true);
        setError(null);
        try {
            const fileName = `SceneRecreation_${nanoid(6)}.png`;
            const file = base64ToFile(resultImage, fileName);
            await uploadUserAsset(file);
            alert('Imagem salva na sua galeria com sucesso!');
        } catch (err) {
            setError('Falha ao salvar na galeria.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-8 p-6">
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            {/* Left Panel */}
            <div className="w-full md:w-1/2 lg:w-2/5 xl:w-1/3 bg-brand-dark/50 p-6 rounded-2xl border border-brand-accent/50 flex flex-col">
                <h1 className="text-2xl font-bold text-white mb-6">Recriador de Cenas</h1>
                <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">1. Imagem de Inspiração</label>
                        <ImageUploader onUpload={(files) => handleImageUpload(files[0], 'inspiration')} className="aspect-video w-full flex items-center justify-center text-gray-400 cursor-pointer" single>
                            {inspirationImage ? <img src={inspirationImage} className="w-full h-full object-contain p-1" /> : <div className="text-center"><IconUpload className="mx-auto h-8 w-8"/><p className="text-sm mt-1">Clique ou arraste a imagem</p></div>}
                        </ImageUploader>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">2. Sua Foto</label>
                        <ImageUploader onUpload={(files) => handleImageUpload(files[0], 'user')} className="aspect-square w-full flex items-center justify-center text-gray-400 cursor-pointer" single>
                            {userImage ? <img src={userImage} className="w-full h-full object-cover" /> : <div className="text-center"><IconUpload className="mx-auto h-8 w-8"/><p className="text-sm mt-1">Clique ou arraste sua foto</p></div>}
                        </ImageUploader>
                    </div>
                </div>
                <div className="mt-auto pt-6 flex-shrink-0">
                    <Button onClick={handleGenerate} primary disabled={isLoading || !userImage || !inspirationImage} className="w-full">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-dark"></div><span>A gerar...</span></div>
                        ) : (
                            <div className="flex items-center justify-center gap-2"><IconSparkles className="w-6 h-6" /><span>Recriar Cena</span></div>
                        )}
                    </Button>
                </div>
            </div>
            {/* Right Panel */}
            <div className="flex-grow flex items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px] overflow-hidden">
                {isLoading && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>}
                {resultImage && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="relative w-full h-full flex items-center justify-center group"
                    >
                        <img src={resultImage} alt="Imagem gerada" className="block max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                        <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button onClick={handleDownload}><div className="flex items-center gap-2"><IconDownload/> Baixar</div></Button>
                            <Button onClick={handleSaveToGallery} disabled={isSaving}><div className="flex items-center gap-2"><IconImageIcon className="w-4 h-4" />{isSaving ? 'Salvando...' : 'Salvar na Galeria'}</div></Button>
                        </div>
                    </motion.div>
                )}
                {!isLoading && !resultImage && (
                    <div className="text-center text-gray-500">
                        <IconImage />
                        <p className="mt-2">O seu resultado aparecerá aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SceneRecreatorView;