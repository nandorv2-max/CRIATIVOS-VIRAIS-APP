import React, { useState, useRef } from 'react';
import Button from '../Button';
import { IconUpload, IconImage } from '../Icons';
import { toBase64 } from '../../utils/imageUtils';
import { generateImageWithRetry, getModelInstruction } from '../../services/geminiService';
import { Prompt } from '../../types';

const ProductStudioView: React.FC = () => {
    const [productImage, setProductImage] = useState<string | null>(null);
    const [sceneDescription, setSceneDescription] = useState('');
    const [cameraPerspective, setCameraPerspective] = useState('Eye-level (straight-on)');
    const [lighting, setLighting] = useState('Softbox diffused lighting');
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const productImageRef = useRef<HTMLInputElement>(null);

    const handleProductImageUpload = async (file: File | null) => {
        if (!file) return;
        try {
            const base64 = await toBase64(file);
            setProductImage(base64);
        } catch (err) { setError("Falha ao carregar a imagem do produto."); }
    };

    const handleGenerate = async () => {
        if (!productImage || !sceneDescription) {
            setError("Por favor, carregue uma imagem do produto e descreva a cena.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);

        const prompt: Prompt = { id: 'product_studio', base: sceneDescription };
        const options = { cameraAngle: cameraPerspective, lookbookStyle: lighting };
        const modelInstruction = getModelInstruction('productStudio', prompt, options as any);

        try {
            const imageUrl = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: productImage,
            });
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
             {/* Left Panel */}
            <div className="w-full md:w-1/2 lg:w-2/5 bg-brand-dark/50 p-6 rounded-2xl border border-brand-accent/50 flex flex-col">
                <h1 className="text-2xl font-bold text-white mb-6">Estúdio de Produto</h1>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">1. Imagem do Produto *</label>
                        <div onClick={() => productImageRef.current?.click()} className="cursor-pointer aspect-square w-full bg-brand-light border-2 border-dashed border-brand-accent rounded-lg flex items-center justify-center text-center text-gray-400 hover:border-brand-primary">
                            {productImage ? <img src={productImage} className="max-w-full max-h-full object-contain p-2" /> : <div><IconUpload className="mx-auto" /><p>Clique para carregar</p></div>}
                        </div>
                        <input type="file" ref={productImageRef} onChange={(e) => handleProductImageUpload(e.target.files?.[0] || null)} accept="image/*" className="hidden" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">2. Descreva a Cena *</label>
                        <textarea value={sceneDescription} onChange={e => setSceneDescription(e.target.value)} placeholder="Ex: Um perfume em uma mesa de mármore com pétalas de rosa ao redor..." className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">3. Perspectiva da Câmera</label>
                        <select value={cameraPerspective} onChange={e => setCameraPerspective(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                            <option>Eye-level (straight-on)</option>
                            <option>Low-angle</option>
                            <option>High-angle</option>
                            <option>Overhead (top-down)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">4. Iluminação</label>
                         <select value={lighting} onChange={e => setLighting(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                            <option>Softbox diffused lighting</option>
                            <option>Natural daylight</option>
                            <option>Dramatic studio lighting</option>
                            <option>Golden hour sunlight</option>
                        </select>
                    </div>
                     {error && <div className="text-red-400 bg-red-900/50 p-2 rounded text-sm text-center">{error}</div>}
                </div>
                 <div className="mt-6 flex-shrink-0 flex justify-end gap-4">
                    <Button onClick={handleGenerate} primary disabled={isLoading}>
                        {isLoading ? 'A gerar...' : 'Gerar Cena'}
                    </Button>
                </div>
            </div>
             {/* Right Panel */}
            <div className="flex-grow flex items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px] md:min-h-0">
                {isLoading && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>}
                {resultImage && <img src={resultImage} alt="Resultado do estúdio de produto" className="max-w-full max-h-full object-contain rounded-lg" />}
                {!isLoading && !resultImage && <div className="text-center text-gray-500"><IconImage /><p className="mt-2">O seu resultado aparecerá aqui.</p></div>}
            </div>
        </div>
    );
};

export default ProductStudioView;