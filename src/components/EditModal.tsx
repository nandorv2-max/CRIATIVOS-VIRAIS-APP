import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { IconBrush, IconSparkles, IconX } from './Icons.tsx';
import { generateImageWithRetry } from '../services/geminiService.ts';

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
    const [brushSize, setBrushSize] = useState(30);
    const [isMaskDrawn, setIsMaskDrawn] = useState(false);
    const [cursorPos, setCursorPos] = useState({ top: 0, left: 0 });
    const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number, y: number } | null>(null);

    const resetState = useCallback(() => {
        setPrompt('');
        setIsLoading(false);
        setError(null);
        setEditedImageUrl(null);
        setBrushSize(30);
        setIsMaskDrawn(false);
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            resetState();
        } else if (imageUrl) {
            setEditedImageUrl(imageUrl);
        }
    }, [isOpen, imageUrl, resetState]);

    const setupCanvas = useCallback(() => {
        if (imageRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const image = imageRef.current;
            canvas.width = image.clientWidth;
            canvas.height = image.clientHeight;
        }
    }, []);

    useEffect(() => {
        const image = imageRef.current;
        if (image) {
            image.addEventListener('load', setupCanvas);
            if (image.complete) {
                setupCanvas();
            }
            return () => {
                image.removeEventListener('load', setupCanvas);
            };
        }
    }, [editedImageUrl, setupCanvas]);
    
    const getCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number, y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCoords(e);
        if (!coords) return;
        isDrawingRef.current = true;
        setIsMaskDrawn(true);
        lastPosRef.current = coords;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        const coords = getCoords(e);
        const lastPos = lastPosRef.current;
        const ctx = canvasRef.current?.getContext('2d');
        if (!coords || !lastPos || !ctx) return;
        
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.7)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        lastPosRef.current = coords;
    };

    const handleMouseUp = () => {
        isDrawingRef.current = false;
        lastPosRef.current = null;
    };

    const handleGenerate = async () => {
        if (!prompt || !imageUrl) return;
        setIsLoading(true);
        setError(null);
        try {
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("Canvas not available");
            const maskDataUrl = isMaskDrawn ? canvas.toDataURL('image/png') : undefined;

            const newImageUrl = await generateImageWithRetry({
                prompt: prompt,
                base64ImageData: imageUrl,
                base64Mask: maskDataUrl,
            });
            setEditedImageUrl(newImageUrl);
        } catch (err) {
            console.error("AI editing failed:", err);
            setError("Falha na edição com IA. Por favor, tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyAndClose = () => {
        if (editedImageUrl) {
            onApplyEdit(editedImageUrl);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-7xl relative flex flex-col md:flex-row gap-6 h-[90vh]">
                <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden relative" onMouseEnter={() => setIsHoveringCanvas(true)} onMouseLeave={() => setIsHoveringCanvas(false)} onMouseMove={(e) => setCursorPos({ top: e.clientY, left: e.clientX })}>
                    {imageUrl && <img ref={imageRef} src={editedImageUrl || imageUrl} alt="Editing preview" className="max-w-full max-h-full object-contain" />}
                    <canvas 
                        ref={canvasRef} 
                        className="absolute inset-0"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ cursor: isHoveringCanvas ? 'none' : 'default' }}
                    />
                    {isHoveringCanvas && (
                        <div className="absolute rounded-full border-2 border-white bg-white/30 pointer-events-none" style={{ top: cursorPos.top, left: cursorPos.left, width: brushSize, height: brushSize, transform: `translate(-${brushSize / 2}px, -${brushSize / 2}px)` }}></div>
                    )}
                </div>

                <div className="w-full md:w-80 flex-shrink-0 bg-brand-light/50 p-4 rounded-lg flex flex-col gap-4 overflow-y-auto">
                    <h3 className="text-xl font-semibold text-white text-center">Editar com IA</h3>
                    {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                    
                    <div>
                        <label className="font-semibold text-gray-300">Comando</label>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex: 'Adicionar um chapéu de sol na pessoa'" className="w-full bg-brand-dark border border-brand-accent rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary resize-y mt-1" rows={3}/>
                    </div>

                    <div>
                        <label className="font-semibold text-gray-300">Pincel de Máscara</label>
                        <div className="flex items-center gap-2 mt-1">
                            <IconBrush />
                            <input type="range" min="10" max="100" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value, 10))} className="w-full" />
                        </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-brand-accent flex flex-col gap-2">
                        <Button onClick={handleGenerate} primary disabled={isLoading}>
                            {isLoading ? 'A gerar...' : <div className="flex items-center justify-center gap-2"><IconSparkles /><span>Gerar</span></div>}
                        </Button>
                        <div className="flex gap-2">
                            <Button onClick={onClose} disabled={isLoading}>Cancelar</Button>
                            <Button onClick={handleApplyAndClose} primary disabled={!editedImageUrl || editedImageUrl === imageUrl}>Aplicar</Button>
                        </div>
                    </div>
                </div>
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-300" />
                </button>
            </motion.div>
        </div>
    );
};

export default EditModal;