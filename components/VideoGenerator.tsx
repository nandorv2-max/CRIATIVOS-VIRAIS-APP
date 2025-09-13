
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import { generateVideo } from '../services/geminiService';
import { extractLastFrame } from '../utils/imageUtils';

interface VideoGeneratorProps {
    initialImageDataUrl: string | null;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ initialImageDataUrl }) => {
    const [prompt, setPrompt] = useState('Animate a imagem como um UGC de uma pessoa como se estivesse a falar para a câmara, a explicar algo, sem fazer alterações bruscas e mantendo o mesmo ambiente. Gerar um vídeo de alta definição, preservando a alta fidelidade e os detalhes nítidos da imagem original. A animação deve manter a qualidade fotorrealista e a textura da imagem de referência. Não deve haver alteração no zoom ou cortes para diferentes ângulos em nenhum momento do vídeo gerado. Nenhum elemento da imagem pode ser alterado, apenas a animação deve ser feita de forma natural, como se fosse um UGC real. A animação não deve alterar as cores da imagem original, mantendo o mesmo padrão de cores do início ao fim, sem quaisquer modificações.');
    const [status, setStatus] = useState('Pronto.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<{ message: string, details: string } | null>(null);
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [sequenceLength, setSequenceLength] = useState(3);
    const [videos, setVideos] = useState<string[]>([]);
    
    const [initialImageBytes, setInitialImageBytes] = useState<string | null>(null);
    const [initialImageMimeType, setInitialImageMimeType] = useState<string>('');
    const videoContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialImageDataUrl) {
            const parts = initialImageDataUrl.split(',');
            const mimeType = parts[0].split(':')[1].split(';')[0];
            const bytes = parts[1];
            setInitialImageBytes(bytes);
            setInitialImageMimeType(mimeType);
        } else {
            setInitialImageBytes(null);
            setInitialImageMimeType('');
        }
    }, [initialImageDataUrl]);

    const handleGenerate = async () => {
        if (!prompt) { setStatus('Por favor, introduza um prompt.'); return; }
        if (!initialImageBytes) { setStatus('Por favor, carregue uma imagem inicial na Etapa 1.'); return; }

        setIsLoading(true);
        setStatus('A iniciar a geração da sequência...');
        setVideos([]);
        setError(null);

        let currentImageBytes: string | null = initialImageBytes;
        let currentMimeType: string = initialImageMimeType;

        try {
            const newVideos = [];
            for (let i = 1; i <= sequenceLength; i++) {
                setStatus(`A gerar vídeo ${i} de ${sequenceLength}... Isto pode demorar alguns minutos.`);
                
                const fullPrompt = `Um vídeo de 8 segundos de ${prompt}`;
                const videoBlob = await generateVideo(
                    fullPrompt,
                    currentImageBytes,
                    currentMimeType,
                    aspectRatio,
                );

                const videoUrl = URL.createObjectURL(videoBlob);
                newVideos.push(videoUrl);
                setVideos([...newVideos]);

                await new Promise(resolve => setTimeout(resolve, 100));
                videoContainerRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                
                if (i < sequenceLength) {
                    setStatus(`A extrair fotograma do vídeo ${i} para continuar a sequência...`);
                    const frame = await extractLastFrame(videoBlob);
                    currentImageBytes = frame.base64data;
                    currentMimeType = frame.mimeType;
                }
            }
            setStatus('Geração da sequência concluída.');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error('Erro de Geração:', e);
            setStatus('Ocorreu um erro durante a geração.');
            setError({ message: "Ocorreu um erro na API.", details: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="w-full">
            <h2 className="text-2xl font-semibold mb-6 text-white">2. Gerador de Vídeo</h2>
            <div className="space-y-6">
                <div className="p-6 border border-gray-700 rounded-xl space-y-4 bg-gray-800/50">
                    <h3 className='text-xl font-semibold text-white'>Descreva a Cena</h3>
                    <textarea 
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="Descreva a animação para a sequência de vídeo..."
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white resize-y"
                    />
                </div>
                <div className="p-6 border border-gray-700 rounded-xl space-y-4 bg-gray-800/50">
                     <h3 className='text-xl font-semibold text-white'>Defina o Palco</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-medium text-gray-400 mb-2">Proporção:</label>
                             <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white">
                                 <option value="9:16">9:16 (Retrato)</option>
                                 <option value="16:9">16:9 (Paisagem)</option>
                                 <option value="1:1">1:1 (Quadrado)</option>
                             </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-400 mb-2">Número de Vídeos:</label>
                             <input type="number" value={sequenceLength} onChange={e => setSequenceLength(Math.max(1, Math.min(10, parseInt(e.target.value, 10))))} min="1" max="10" className="w-full bg-gray-800 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white" />
                        </div>
                     </div>
                </div>

                <div className="text-center">
                    <Button onClick={handleGenerate} primary disabled={isLoading || !initialImageDataUrl} className="text-lg px-8 py-3">
                         {isLoading ? (
                            <div className="flex items-center gap-3"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div><span>A gerar...</span></div>
                        ) : 'Gerar Sequência'}
                    </Button>
                    <p className="text-gray-400 mt-2 text-sm">{status}</p>
                </div>
                
                {error && (
                    <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-center text-red-300">
                        <p className="font-semibold">{error.message}</p>
                        <p className="text-xs mt-2 text-red-400">{error.details}</p>
                    </div>
                )}

                <div>
                    <h3 className='text-xl font-semibold text-white mb-4'>A Sua Linha do Tempo</h3>
                    <div className="bg-gray-800/50 p-4 rounded-xl min-h-[200px] flex items-center border border-gray-700">
                        <div ref={videoContainerRef} className="flex flex-row items-center gap-10 overflow-x-auto p-4 w-full">
                            {videos.map((videoSrc, index) => (
                                <div key={index} className="relative flex-shrink-0">
                                    <figure className="m-0 w-64 h-auto">
                                        <video src={videoSrc} controls autoPlay={index > 0} muted loop={false} className="w-full h-full rounded-lg bg-black" />
                                        <figcaption className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                                            Vídeo {index + 1}
                                        </figcaption>
                                    </figure>
                                    {index < videos.length - 1 && (
                                        <div className="absolute h-0.5 w-10 bg-gray-600 top-1/2 -right-10"></div>
                                    )}
                                </div>
                            ))}
                            {videos.length === 0 && !isLoading && <p className="text-gray-500 w-full text-center">Os seus vídeos gerados aparecerão aqui.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default VideoGenerator;
