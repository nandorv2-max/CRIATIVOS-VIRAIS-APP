import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { IconUpload, IconX, IconImage, IconDownload, IconImageIcon } from './Icons.tsx';
import { toBase64, base64ToFile } from '../utils/imageUtils.ts';
import { generateImageWithRetry, getModelInstruction } from '../geminiService.ts';
import { uploadUserAsset } from '../services/databaseService.ts';
import { nanoid } from 'nanoid';
import { Prompt } from '../types.ts';

interface MockupDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    mockupType: { id: string, name: string, prompt: string };
}

const MockupDetailModal: React.FC<MockupDetailModalProps> = ({ isOpen, onClose, mockupType }) => {
    const [artImage, setArtImage] = useState<string | null>(null);
    const [instructions, setInstructions] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultImages, setResultImages] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleArtUpload = async (file: File | null) => {
        if (!file) return;
        try {
            const base64 = await toBase64(file);
            setArtImage(base64);
        } catch (err) {
            setError("Falha ao carregar a arte.");
        }
    };

    const handleGenerate = async () => {
        if (!artImage) {
            setError("Por favor, carregue sua arte.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImages([]);

        const prompt: Prompt = { id: mockupType.id, base: mockupType.prompt };
        const modelInstruction = getModelInstruction('mockupGenerator', prompt, {} as any);
        
        const fullPrompt = `${modelInstruction}${instructions ? ` Instruções adicionais do usuário: "${instructions}"` : ''}`;

        try {
            const imageUrl = await generateImageWithRetry({
                prompt: fullPrompt,
                base64ImageData: artImage,
            });
            setResultImages([imageUrl]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`A geração falhou: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        const imageUrl = resultImages[0];
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `GenIA_Mockup_${mockupType.name}_${nanoid(6)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveToGallery = async () => {
        const imageUrl = resultImages[0];
        if (!imageUrl) return;
        setIsSaving(true);
        setError(null);
        try {
            const fileName = `Mockup_${mockupType.name}_${nanoid(6)}.png`;
            const file = base64ToFile(imageUrl, fileName);
            await uploadUserAsset(file);
            alert('Mockup salvo na sua galeria com sucesso!');
        } catch (err) {
            setError('Falha ao salvar na galeria.');
        } finally {
            setIsSaving(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-4xl relative flex gap-6 h-[80vh]">
                {/* Left side */}
                <div className="w-1/2 flex flex-col gap-4">
                    <h3 className="text-xl font-semibold text-white">Gerador de Mockup de {mockupType.name}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">1. Carregue sua arte</label>
                            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer aspect-video w-full bg-brand-light border-2 border-dashed border-brand-accent rounded-lg flex items-center justify-center text-center text-gray-400 hover:border-brand-primary">
                                {artImage ? <img src={artImage} className="max-w-full max-h-full object-contain p-2" /> : <div><IconUpload className="mx-auto" /><p>Clique para carregar</p><p className="text-xs">PNG, JPG, WEBP, etc.</p></div>}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={(e) => handleArtUpload(e.target.files?.[0] || null)} accept="image/*" className="hidden" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">2. Instruções Adicionais (Opcional)</label>
                            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Ex: 'Coloque a arte no centro'" className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-24 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">3. Quantidade</label>
                            <select value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                                <option value={1}>1 Variação</option>
                            </select>
                        </div>
                    </div>
                     {error && <div className="text-red-400 bg-red-900/50 p-2 rounded text-sm text-center">{error}</div>}
                    <div className="mt-auto flex justify-end gap-4">
                        <Button onClick={onClose}>Cancelar</Button>
                        <Button onClick={handleGenerate} primary disabled={isLoading}>
                            {isLoading ? 'A gerar...' : 'Gerar Mockup'}
                        </Button>
                    </div>
                </div>
                {/* Right side */}
                <div className="w-1/2 bg-black rounded-lg flex flex-col items-center justify-center p-2">
                    {isLoading && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>}
                    {!isLoading && resultImages.length > 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                             <img src={resultImages[0]} className="max-w-full max-h-[80%] object-contain rounded-lg" />
                             <div className="flex items-center gap-2">
                                <Button onClick={handleDownload}><div className="flex items-center gap-2"><IconDownload/> Baixar</div></Button>
                                <Button onClick={handleSaveToGallery} disabled={isSaving}><div className="flex items-center gap-2"><IconImageIcon className="w-4 h-4" />{isSaving ? 'Salvando...' : 'Salvar na Galeria'}</div></Button>
                             </div>
                        </div>
                    ): null}
                    {!isLoading && resultImages.length === 0 && <div className="text-center text-gray-500"><IconImage /><p className="mt-2">O seu mockup aparecerá aqui.</p></div>}
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors"><IconX/></button>
            </motion.div>
        </div>
    );
};

export default MockupDetailModal;