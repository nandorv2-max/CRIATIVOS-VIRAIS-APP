import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { IconX, IconSparkles } from './Icons.tsx';
import { generateImageWithRetry } from '../services/geminiService.ts';
import ErrorNotification from './ErrorNotification.tsx';

interface MagicCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    image: string | null;
    onApply: (capturedImageUrl: string) => void;
}

const MagicCaptureModal: React.FC<MagicCaptureModalProps> = ({ isOpen, onClose, image, onApply }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleApplyCapture = async () => {
        if (!image || !prompt.trim()) {
            setError("Por favor, descreva o objeto que deseja capturar.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const modelInstruction = `From the provided image, perfectly extract the object described as: "${prompt}". The output MUST be a high-resolution PNG of only the extracted object on a fully transparent background. Do not include any other part of the original image or background.`;
            const resultUrl = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: image,
            });
            onApply(resultUrl);
        } catch (err) {
            console.error("Magic Capture failed:", err);
            setError("A captura falhou. Por favor, tente uma descrição diferente.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
             <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-4xl relative text-white h-[80vh] flex flex-col">
                <h3 className="text-xl font-semibold mb-4 text-center">Captura Mágica</h3>
                <div className="flex-grow flex items-center justify-center bg-black rounded-lg overflow-hidden relative">
                    {image && <img src={image} alt="Captura Mágica" className="max-w-full max-h-full object-contain" />}
                     {isLoading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-primary mb-4"></div>
                            <p>A capturar objeto...</p>
                        </div>
                    )}
                </div>
                <div className="mt-4 flex flex-col md:flex-row items-center gap-4">
                     <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Descreva o objeto a capturar (ex: a pessoa, o copo...)"
                        className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        disabled={isLoading}
                    />
                    <div className="flex-shrink-0 flex gap-2">
                        <Button onClick={onClose} disabled={isLoading}>Cancelar</Button>
                        <Button primary onClick={handleApplyCapture} disabled={isLoading || !prompt.trim()}>
                            <div className="flex items-center justify-center gap-2">
                                <IconSparkles />
                                <span>Aplicar</span>
                            </div>
                        </Button>
                    </div>
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-300" />
                </button>
            </motion.div>
        </div>
    );
};

export default MagicCaptureModal;
