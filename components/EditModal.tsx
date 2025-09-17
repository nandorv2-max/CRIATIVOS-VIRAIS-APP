import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import { IconRotate, IconBrush, IconTrash, IconSparkles } from './Icons';
import { generateImageWithRetry } from '../services/geminiService';
import { toBase64 } from '../utils/imageUtils';

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
    onApplyEdit: (newImageUrl: string) => void;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, imageUrl, onApplyEdit }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);

    // Editing tools state
    const [brushSize, setBrushSize] = useState(30);
    const [rotation, setRotation] = useState(0);
    const [detailImages, setDetailImages] = useState<string[]>([]);
    const [isMaskDrawn, setIsMaskDrawn] = useState(false);
    
    // Custom cursor state
    const [cursorPos, setCursorPos] = useState({ top: 0, left: 0 });
    const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number, y: number } | null>(null);
    const detailFileInputRef = useRef<HTMLInputElement>(null);

    const resetState = useCallback(() => {
        setPrompt('');
        setIsLoading(false);
        setError(null);
        setEditedImageUrl(null);
        setRotation(0);
        setBrushSize(30);
        setDetailImages([]);
        setIsMaskDrawn(false);
        if (canvasRef.current) {
            // FIX: Cast canvas to `any` to access properties in environments with incomplete DOM typings.
            const ctx = (canvasRef.current as any).getContext('2d');
            ctx?.clearRect(0, 0, (canvasRef.current as any).width, (canvasRef.current as any).height);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    const setupCanvas = useCallback(() => {
        if (imageRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            // Match canvas resolution to its display size for accurate coordinate mapping.
            // This fixes the brush tool by ensuring the canvas drawing buffer dimensions
            // are the same as its CSS dimensions.
            // FIX: Cast canvas to `any` to access properties in environments with incomplete DOM typings.
            (canvas as any).width = (canvas as any).clientWidth;
            (canvas as any).height = (canvas as any).clientHeight;
        }
    }, []);

    useEffect(() => {
        const image = imageRef.current;
        if (image) {
            // FIX: Cast image to `any` to access properties in environments with incomplete DOM typings.
            (image as any).addEventListener('load', setupCanvas);
            // If the image is already loaded (e.g., from cache)
            if ((image as any).complete) {
                setupCanvas();
            }
            return () => {
                // FIX: Cast image to `any` to access properties in environments with incomplete DOM typings.
                (image as any).removeEventListener('load', setupCanvas);
            };
        }
    }, [imageUrl, setupCanvas]);
    
    const getCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number, y: number } | null => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        // FIX: Cast canvas/image to `any` to access properties in environments with incomplete DOM typings.
        if (!canvas || !image || !(image as any).naturalWidth) return null;
    
        const rect = (canvas as any).getBoundingClientRect();
        const canvasWidth = (canvas as any).width;
        const canvasHeight = (canvas as any).height;
    
        const naturalWidth = (image as any).naturalWidth;
        const naturalHeight = (image as any).naturalHeight;
    
        const canvasRatio = canvasWidth / canvasHeight;
        const imageRatio = naturalWidth / naturalHeight;
    
        let renderedWidth, renderedHeight, offsetX, offsetY;
    
        if (imageRatio > canvasRatio) {
            renderedWidth = canvasWidth;
            renderedHeight = canvasWidth / imageRatio;
            offsetX = 0;
            offsetY = (canvasHeight - renderedHeight) / 2;
        } else {
            renderedHeight = canvasHeight;
            renderedWidth = canvasHeight * imageRatio;
            offsetY = 0;
            offsetX = (canvasWidth - renderedWidth) / 2;
        }
    
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (mouseX < offsetX || mouseX > offsetX + renderedWidth || mouseY < offsetY || mouseY > offsetY + renderedHeight) {
            return null; 
        }
    
        // The previous scaling logic caused a mismatch between the cursor position and the drawing position.
        // By returning the direct mouse coordinates, the drawing will now happen exactly where the cursor is.
        // The boundary check above prevents drawing on the letterbox bars.
        return { x: mouseX, y: mouseY };
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        const coords = getCoords(e);
        
        if (!coords) {
            lastPosRef.current = null;
            return;
        }

        const canvas = canvasRef.current!;
        // FIX: Cast canvas to `any` to access properties in environments with incomplete DOM typings.
        const ctx = (canvas as any).getContext('2d')!;
        
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (lastPosRef.current) {
            ctx.beginPath();
            ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
        }
        lastPosRef.current = coords;
    };
    
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCoords(e);
        if (!coords) return; 

        isDrawingRef.current = true;
        setIsMaskDrawn(true);
        lastPosRef.current = coords;

        const canvas = canvasRef.current!;
        // FIX: Cast canvas to `any` to access properties in environments with incomplete DOM typings.
        const ctx = (canvas as any).getContext('2d')!;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        // FIX: Property 'getBoundingClientRect' does not exist on type 'EventTarget & HTMLCanvasElement'.
        const rect = (e.currentTarget as any).getBoundingClientRect();
        setCursorPos({
            top: e.clientY - rect.top,
            left: e.clientX - rect.left,
        });
        draw(e);
    };

    const handleMouseUp = () => {
        isDrawingRef.current = false;
        lastPosRef.current = null;
    };
    
    const handleClearMask = () => {
        const canvas = canvasRef.current!;
        // FIX: Cast canvas to `any` to access properties in environments with incomplete DOM typings.
        const ctx = (canvas as any).getContext('2d')!;
        ctx.clearRect(0, 0, (canvas as any).width, (canvas as any).height);
        setIsMaskDrawn(false);
    };

    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    const handleDetailImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
        // FIX: Property 'files' does not exist on type 'HTMLInputElement'.
        if ((e.target as any).files) {
            // FIX: Explicitly type `files` as File[] to resolve ambiguity for the `toBase64` function.
            // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
            const files: File[] = Array.from(((e.target as any) as HTMLInputElement).files || []);
            try {
                const base64Images = await Promise.all(files.map(file => toBase64(file)));
                setDetailImages(prev => [...prev, ...base64Images].slice(0, 5)); // Limit to 5 detail images
            } catch (err) {
                setError("Falha ao carregar a imagem de detalhe.");
            }
        }
    };

    const removeDetailImage = (index: number) => {
        setDetailImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerateEdit = async () => {
        if (!prompt || !imageUrl) return;
        setIsLoading(true);
        setError(null);

        let instruction = '';
        if (isMaskDrawn) {
            instruction = `
                PRIORIDADE MÁXIMA - TAREFA DE INPAINTING.
                Sua tarefa é executar uma edição de inpainting fotorrealista com base na instrução do usuário.
                Você recebeu uma imagem principal e uma máscara que indica a área exata a ser modificada.
                A instrução do usuário é: "${prompt}".

                Analise a instrução.
                - Se for uma tarefa de REMOÇÃO (ex: "remover tatuagem", "apagar objeto", "limpar pele"), você deve reconstruir a área mascarada de forma impecável. Use o contexto da imagem circundante (textura da pele, padrões de tecido, etc.) para preencher o espaço. O resultado deve parecer que o objeto/imperfeição nunca esteve lá.
                - Se for uma tarefa de ADIÇÃO ou ALTERAÇÃO (ex: "adicionar um colar", "mudar a cor do cabelo para azul"), aplique a mudança estritamente dentro da máscara, integrando-a perfeitamente com a iluminação, sombras e perspectiva da imagem original.

                Em TODOS os casos, a área FORA da máscara DEVE permanecer 100% IDÊNTICA à original. A transição entre a área editada e a não editada deve ser completamente invisível.
            `;
            if (detailImages.length > 0) {
                 instruction += `\nNOTA ADICIONAL: Imagens de detalhe foram fornecidas. Use-as como referência visual principal para o conteúdo a ser adicionado ou replicado na área mascarada.`;
            }
        } else {
             instruction = `
                TAREFA: EDIÇÃO CRIATIVA DE IMAGEM COMPLETA.
                Você recebeu uma imagem principal e uma instrução. Sua tarefa é aplicar a seguinte edição descrita pelo usuário a TODA a imagem de forma fotorrealista. A composição geral e o sujeito principal devem ser mantidos, a menos que a instrução peça explicitamente para alterá-los.
                Instrução de edição do usuário: "${prompt}"
            `;
             if (detailImages.length > 0) {
                 instruction += `\nNOTA: Imagens de detalhe foram fornecidas como referência de estilo ou conteúdo. Use-as para guiar a sua edição.`;
             }
        }

        try {
            const maskCanvas = canvasRef.current!;
            // FIX: Cast canvas to `any` to access properties in environments with incomplete DOM typings.
            const base64Mask = isMaskDrawn ? (maskCanvas as any).toDataURL('image/png') : undefined;
            
            const newImageUrl = await generateImageWithRetry({
                prompt: instruction,
                base64ImageData: imageUrl,
                base64Mask,
                detailImages,
            });
            setEditedImageUrl(newImageUrl);
        } catch (err) {
            console.error("Image editing failed:", err);
            setError("Falha ao editar a imagem. Por favor, tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (editedImageUrl) {
            onApplyEdit(editedImageUrl);
        }
    };
    
    const handleDiscard = () => {
        setEditedImageUrl(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl w-full max-w-4xl relative flex flex-col">
                <h3 className="text-2xl font-semibold mb-4 text-white text-center">Editar Imagem</h3>
                
                {error && <p className="text-red-400 text-center mb-2">{error}</p>}
                
                <div className="relative w-full max-w-lg mx-auto mb-4">
                    <div className="aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                         <img
                            ref={imageRef}
                            src={editedImageUrl || imageUrl}
                            alt="Imagem para editar"
                            className="max-w-full max-h-full object-contain select-none"
                            style={{ transform: `rotate(${rotation}deg)` }}
                            onLoad={setupCanvas}
                        />
                        {!editedImageUrl && (
                             <canvas
                                ref={canvasRef}
                                className="absolute top-0 left-0 w-full h-full cursor-none"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseEnter={() => setIsHoveringCanvas(true)}
                                onMouseLeave={() => { setIsHoveringCanvas(false); handleMouseUp(); }}
                            />
                        )}
                        {isHoveringCanvas && !editedImageUrl && (
                             <div
                                className="absolute rounded-full border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                                style={{
                                    width: `${brushSize}px`,
                                    height: `${brushSize}px`,
                                    top: `${cursorPos.top - brushSize / 2}px`,
                                    left: `${cursorPos.left - brushSize / 2}px`,
                                    transform: 'translateZ(0px)',
                                }}
                            />
                        )}
                    </div>
                </div>

                {!editedImageUrl && (
                    <>
                        <div className="flex items-center justify-center gap-4 bg-gray-800/50 p-3 rounded-lg mb-4">
                            <button onClick={handleRotate} className="flex items-center gap-2 text-gray-300 hover:text-white"><IconRotate /> Girar</button>
                            <div className="flex items-center gap-2 text-gray-300">
                                <IconBrush />
                                {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                <input type="range" min="5" max="100" value={brushSize} onChange={e => setBrushSize(parseInt((e.target as any).value, 10))} className="w-24" />
                            </div>
                            <button onClick={handleClearMask} className="flex items-center gap-2 text-gray-300 hover:text-white"><IconTrash /> Limpar</button>
                        </div>
                        <textarea
                            value={prompt}
                            // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
                            onChange={(e) => setPrompt((e.target as any).value)}
                            placeholder="Descreva a sua edição... ex: 'Adicionar uma tatuagem de dragão no braço'"
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white min-h-[80px] resize-y mb-2"
                        />
                        <p className="text-xs text-gray-500 text-center mb-4">Descreva a sua edição. Se desejar, pinte sobre a imagem para indicar uma área específica.</p>

                        <div className="mb-4">
                             {/* FIX: Cast ref.current to `any` to access properties in environments with incomplete DOM typings. */}
                             <Button onClick={() => (detailFileInputRef.current as any)?.click()} className="w-full">Adicionar Foto de Detalhe</Button>
                             <input type="file" multiple accept="image/*" ref={detailFileInputRef} onChange={handleDetailImageChange} className="hidden" />
                             <div className="flex flex-wrap gap-2 mt-2 justify-center">
                                {detailImages.map((img, index) => (
                                    <div key={index} className="relative w-16 h-16">
                                        <img src={img} className="w-full h-full object-cover rounded" alt={`Detalhe ${index + 1}`} />
                                        <button onClick={() => removeDetailImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">X</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div className="flex justify-center gap-4 mt-auto">
                    {editedImageUrl ? (
                        <>
                             <Button onClick={handleDiscard}>Descartar</Button>
                             <Button onClick={handleApply} primary>Aplicar Alterações</Button>
                        </>
                    ) : (
                        <>
                             <Button onClick={onClose} disabled={isLoading}>Cancelar</Button>
                             <Button onClick={handleGenerateEdit} primary disabled={isLoading || !prompt}>
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></div>
                                        <span>A gerar...</span>
                                    </div>
                                ) : (
                                    <span>Gerar Edição</span>
                                )}
                            </Button>
                        </>
                    )}
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-gray-800/70 text-white hover:bg-gray-700 transition-colors" disabled={isLoading}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
            </motion.div>
        </div>
    );
};

export default EditModal;