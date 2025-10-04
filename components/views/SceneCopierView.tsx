import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../Button.tsx';
import ImageUploader from '../ImageUploader.tsx';
import ErrorNotification from '../ErrorNotification.tsx';
import { IconUpload, IconSparkles, IconImage, IconDownload, IconImageIcon } from '../Icons.tsx';
import { toBase64, base64ToFile } from '../../utils/imageUtils.ts';
import { describeImage, generateImageWithRetry } from '../../services/geminiService.ts';
import { uploadUserAsset } from '../../services/databaseService.ts';
import { nanoid } from 'nanoid';

const SceneCopierView: React.FC = () => {
    const [inspirationImage, setInspirationImage] = useState<string | null>(null);
    const [userImage, setUserImage] = useState<string | null>(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<'describing' | 'generating' | false>(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = async (file: File, target: 'inspiration' | 'user') => {
        setError(null);
        try {
            const base64 = await toBase64(file);
            if (target === 'inspiration') {
                setInspirationImage(base64);
                setGeneratedPrompt(''); // Reset prompt when inspiration changes
            } else {
                setUserImage(base64);
            }
        } catch (err) {
            setError("Falha ao carregar a imagem.");
        }
    };

    const handleDescribeScene = async () => {
        if (!inspirationImage) return;
        setIsLoading('describing');
        setError(null);
        try {
            const description = await describeImage(inspirationImage);
            setGeneratedPrompt(description);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`Falha ao descrever a imagem de inspiração. Detalhes: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!userImage || !generatedPrompt) {
            setError("Por favor, adicione sua foto e gere uma descrição da cena primeiro.");
            return;
        }
        setIsLoading('generating');
        setError(null);
        setResultImage(null);

        const modelInstruction = `A photorealistic image based on the following description: "${generatedPrompt}". CRITICAL: The main person in the scene must be the person from the provided reference image. Integrate them seamlessly, matching the style, lighting, and clothing described in the prompt.`;

        try {
            const imageUrl = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: userImage,
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
        link.download = `GenIA_SceneCopy_${nanoid(6)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveToGallery = async () => {
        if (!resultImage) return;
        setIsSaving(true);
        setError(null);
        try {
            const fileName = `SceneCopy_${nanoid(6)}.png`;
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
                <h1 className="text-2xl font-bold text-white mb-6">Copiador de Cenas</h1>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">1. Imagem de Inspiração</label>
                        <ImageUploader onUpload={(files) => handleImageUpload(files[0], 'inspiration')} className="aspect-video w-full flex items-center justify-center text-gray-400 cursor-pointer" single>
                            {inspirationImage ? <img src={inspirationImage} className="w-full h-full object-contain p-1" /> : <div className="text-center"><IconUpload className="mx-auto h-8 w-8"/><p className="text-sm mt-1">Clique ou arraste a imagem</p></div>}
                        </ImageUploader>
                    </div>
                    <Button onClick={handleDescribeScene} disabled={!inspirationImage || isLoading === 'describing'} className="w-full">
                        {isLoading === 'describing' ? 'A descrever...' : '2. Descrever Cena com IA'}
                    </Button>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">3. Sua Foto</label>
                        <ImageUploader onUpload={(files) => handleImageUpload(files[0], 'user')} className="aspect-square w-full flex items-center justify-center text-gray-400 cursor-pointer" single>
                            {userImage ? <img src={userImage} className="w-full h-full object-cover" /> : <div className="text-center"><IconUpload className="mx-auto h-8 w-8"/><p className="text-sm mt-1">Clique ou arraste sua foto</p></div>}
                        </ImageUploader>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">4. Comando Gerado (edite se quiser)</label>
                        <textarea
                            value={generatedPrompt}
                            onChange={(e) => setGeneratedPrompt(e.target.value)}
                            placeholder="A descrição da sua imagem de inspiração aparecerá aqui..."
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y"
                        />
                    </div>
                </div>
                <div className="mt-auto pt-6 flex-shrink-0">
                    <Button onClick={handleGenerate} primary disabled={!!isLoading || !userImage || !generatedPrompt} className="w-full">
                        {isLoading === 'generating' ? (
                            <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-dark"></div><span>A gerar...</span></div>
                        ) : (
                            <div className="flex items-center justify-center gap-2"><IconSparkles className="w-6 h-6" /><span>Gerar Imagem</span></div>
                        )}
                    </Button>
                </div>
            </div>
            {/* Right Panel */}
            <div className="flex-grow flex items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px] overflow-hidden">
                {isLoading === 'generating' && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>}
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

export default SceneCopierView;