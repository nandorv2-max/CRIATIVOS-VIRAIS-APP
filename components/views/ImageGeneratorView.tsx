import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../Button';
import { IconSparkles, IconImage } from '../Icons';
import { generateImageFromPrompt } from '../../geminiService.ts';
import ErrorNotification from '../ErrorNotification';
import LoadingCard from '../LoadingCard';

const ImageGeneratorView: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [numImages, setNumImages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Por favor, insira um comando.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);
        try {
            const imageUrl = await generateImageFromPrompt(prompt);
            setResultImage(imageUrl);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`A geração falhou: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-8 p-6">
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            {/* Left Panel */}
            <div className="w-full md:w-1/3 lg:w-1/4 bg-brand-dark/50 p-6 rounded-2xl border border-brand-accent/50 flex flex-col">
                <h1 className="text-2xl font-bold text-white mb-6">Gerador de Imagem por IA</h1>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Comando (em inglês)</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ex: 'Um astronauta andando a cavalo na lua'"
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nº de Imagens</label>
                        <select
                            value={numImages}
                            onChange={(e) => setNumImages(Number(e.target.value))}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value={1}>1</option>
                        </select>
                    </div>
                </div>
                <div className="mt-auto pt-6">
                    <Button onClick={handleGenerate} primary disabled={isLoading} className="w-full !py-3 !text-lg">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-dark"></div><span>A gerar...</span></div>
                        ) : (
                            <div className="flex items-center justify-center gap-2"><IconSparkles /><span>Gerar Imagem</span></div>
                        )}
                    </Button>
                </div>
            </div>
            {/* Right Panel */}
            <div className="flex-grow flex items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px]">
                {isLoading && <LoadingCard era="" isPolaroid={false} showLabel={false} />}
                {resultImage && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <img src={resultImage} alt="Imagem gerada" className="max-w-full max-h-full object-contain rounded-lg" />
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

export default ImageGeneratorView;