import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Button from '../Button';
import { IconUpload, IconSparkles, IconTrash, IconX, IconImage } from '../Icons';
import ErrorNotification from '../ErrorNotification';
import { generateImageWithRetry } from '../../services/geminiService';
import { toBase64 } from '../../utils/imageUtils';

const UnirView: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
        if ((event.target as any).files) {
            setError(null);
            // FIX: Explicitly type 'files' as File[] to resolve ambiguity for the 'toBase64' function.
            const files: File[] = Array.from((event.target as any).files || []);
            try {
                const base64Images = await Promise.all(files.map(file => toBase64(file)));
                setImages(prev => [...prev, ...base64Images]);
            } catch (err) {
                console.error("Error loading images:", err);
                setError("Falha ao carregar uma ou mais imagens.");
            }
        }
    };

    const removeImage = (indexToRemove: number) => {
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Por favor, escreva um prompt para guiar a IA.");
            return;
        }
        if (images.length < 2) {
            setError("Por favor, carregue pelo menos duas imagens para unir.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResultImage(null);

        const modelInstruction = `**TAREFA CRÍTICA: FUSÃO DE SUJEITOS FOTORREALISTA**

Você é um especialista em edição de imagens. Sua tarefa é criar uma única imagem fotorrealista e coesa, combinando os sujeitos principais de múltiplas imagens de referência. O resultado NÃO PODE parecer uma colagem ou uma montagem mal feita.

**PROCESSO OBRIGATÓRIO (SEGUIR À RISCA):**

1.  **ANÁLISE E EXTRAÇÃO DE SUJEITOS:**
    *   Para cada imagem de referência fornecida, identifique o sujeito principal (ex: a pessoa, o animal, o objeto específico).
    *   Isole mentalmente cada sujeito principal do seu fundo original. Você deve extrair apenas o sujeito completo e anatomicamente correto. **REGRA DE OURO: Se uma imagem tem uma pessoa, extraia a pessoa inteira, não apenas partes dela. Evite duplicar membros como braços ou pernas.**

2.  **CRIAÇÃO DA CENA:**
    *   Com base no prompt do usuário, gere um cenário completamente novo e fotorrealista. A iluminação, as sombras e a perspectiva desta nova cena devem ser consistentes.
    *   **Prompt do usuário:** "${prompt}"

3.  **INTEGRAÇÃO E HARMONIZAÇÃO:**
    *   Insira os sujeitos extraídos (do Passo 1) na nova cena (do Passo 2).
    *   **PRIORIDADE MÁXIMA:** Ajuste a escala, a iluminação e as sombras de cada sujeito para que se integrem perfeitamente ao novo ambiente. O tamanho relativo entre os sujeitos deve ser realista (um cachorro deve ter um tamanho proporcional a uma pessoa). As sombras que eles projetam devem corresponder à fonte de luz da nova cena.
    *   Garanta que a interação entre os sujeitos seja natural, conforme descrito no prompt do usuário.

**SAÍDA FINAL:** A imagem final deve parecer uma fotografia única e real, onde todos os elementos existem naturalmente juntos.`;

        try {
            const newImage = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: images[0],
                detailImages: images.slice(1),
            });
            setResultImage(newImage);
        } catch (err) {
            console.error("Image combination failed:", err);
            const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`A geração falhou: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            <header className="flex-shrink-0 mb-6">
                <h1 className="text-3xl font-bold text-white">Unir Imagens</h1>
                <p className="text-gray-400 mt-1">Combine elementos de várias imagens numa única criação com o poder da IA.</p>
            </header>
            <div className="flex-grow flex flex-col lg:flex-row gap-8 min-h-0">
                {/* Left Panel: Inputs */}
                <div className="lg:w-1/3 flex flex-col gap-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-700/50">
                    <div>
                        <label className="text-xl font-semibold text-white mb-3 block">1. Descreva o Resultado</label>
                        <textarea
                            value={prompt}
                            // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
                            onChange={e => setPrompt((e.target as any).value)}
                            placeholder="Ex: 'Um astronauta a usar as sapatilhas vermelhas, a segurar o skate, na superfície de Marte...'"
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white resize-y"
                        />
                    </div>
                    <div className="flex-grow flex flex-col min-h-0">
                        <label className="text-xl font-semibold text-white mb-3 block">2. Adicionar Imagens</label>
                        <div className="flex-grow grid grid-cols-3 gap-3 overflow-y-auto pr-2">
                            {images.map((imgSrc, index) => (
                                <motion.div key={index} initial={{scale:0.8, opacity: 0}} animate={{scale:1, opacity: 1}} className="relative group aspect-square">
                                    <img src={imgSrc} alt={`Input image ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                                    <button onClick={() => removeImage(index)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <IconX className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ))}
                             {/* FIX: Use optional chaining and cast to `any` to safely call click on the ref. */}
                             <button onClick={() => (fileInputRef.current as any)?.click()} className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-600 rounded-md text-gray-500 hover:border-yellow-400 hover:text-yellow-400 transition-colors">
                                <IconUpload className="w-8 h-8" />
                                <span className="text-xs mt-1">Adicionar</span>
                            </button>
                        </div>
                        <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>
                    <div className="mt-auto">
                         <Button onClick={handleGenerate} primary disabled={isLoading} className="w-full text-lg py-3">
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>A Unir...</div>
                            ) : (
                                <div className="flex items-center justify-center gap-2"><IconSparkles /><span>Unir Imagens</span></div>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Right Panel: Result */}
                <div className="lg:w-2/3 flex-grow flex items-center justify-center bg-black rounded-2xl p-4 border border-gray-700/50">
                    {isLoading ? (
                         <div className="flex flex-col items-center text-gray-400">
                             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mb-4"></div>
                             <p>A IA está a criar a sua imagem...</p>
                         </div>
                    ) : resultImage ? (
                        <motion.img initial={{opacity:0}} animate={{opacity:1}} src={resultImage} alt="Imagem gerada" className="max-w-full max-h-full object-contain rounded-lg" />
                    ) : (
                        <div className="text-center text-gray-600">
                            <IconImage />
                            <p className="mt-2">O seu resultado aparecerá aqui</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnirView;
