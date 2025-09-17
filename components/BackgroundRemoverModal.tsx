import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import { IconTrash } from './Icons';

interface BackgroundRemoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageWithTransparency: string | null;
    originalImage: string | null;
    onApply: (newImageUrl: string) => void;
}

const BackgroundRemoverModal: React.FC<BackgroundRemoverModalProps> = ({ isOpen, onClose, imageWithTransparency, originalImage, onApply }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // FIX: Prefix 'Image' with 'window.' to use the browser's Image constructor.
    // FIX: Property 'Image' does not exist on type 'Window'.
    const originalImageRef = useRef<HTMLImageElement>(new window.Image());
    const isDrawingRef = useRef(false);

    const [brushSize, setBrushSize] = useState(40);
    const [brushType, setBrushType] = useState<'erase' | 'restore'>('erase');
    const [showOriginal, setShowOriginal] = useState(false);

    const setupCanvas = useCallback(() => {
        if (!imageWithTransparency || !canvasRef.current) return;
        const canvas = canvasRef.current;
        // FIX: Cast canvas to any to access getContext in environments with incomplete DOM typings.
        const ctx = (canvas as any).getContext('2d');
        if (!ctx) return;

        // FIX: Prefix 'Image' with 'window.' to use the browser's Image constructor.
        // FIX: Property 'Image' does not exist on type 'Window'.
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.clearRect(0, 0, (canvas as any).width, (canvas as any).height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = imageWithTransparency;

        if(originalImage) {
            // FIX: Cast image to `any` to access properties in environments with incomplete DOM typings.
            (originalImageRef.current as any).crossOrigin = 'anonymous';
            (originalImageRef.current as any).src = originalImage;
        }

    }, [imageWithTransparency, originalImage]);
    
    useEffect(() => {
        if(isOpen) {
            setupCanvas();
        }
    }, [isOpen, setupCanvas]);

    const getCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number, y: number } => {
        const canvas = canvasRef.current!;
        // FIX: Cast canvas to `any` to access properties in environments with incomplete DOM typings.
        const rect = (canvas as any).getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * ((canvas as any).width / rect.width),
            y: (e.clientY - rect.top) * ((canvas as any).height / rect.height)
        };
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        const { x, y } = getCoords(e);
        const canvas = canvasRef.current!;
        // FIX: Cast canvas to any to access getContext in environments with incomplete DOM typings.
        const ctx = (canvas as any).getContext('2d')!;

        ctx.save();
        if (brushType === 'erase') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else { // Restore
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(originalImageRef.current, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
    };
    
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        isDrawingRef.current = true;
        draw(e);
    };

    const handleMouseUp = () => { isDrawingRef.current = false; };

    const handleApply = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            // FIX: Cast canvas to any to access toDataURL in environments with incomplete DOM typings.
            onApply((canvas as any).toDataURL('image/png'));
            onClose();
        }
    };

    const checkerboardStyle: React.CSSProperties = {
        backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        backgroundColor: '#f8fafc'
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl w-full h-full max-w-7xl relative flex flex-col md:flex-row gap-6">
                <div className="md:w-72 flex-shrink-0 bg-gray-800/50 p-4 rounded-lg flex flex-col gap-4">
                    <h3 className="text-xl font-semibold text-white text-center">Refinar Remoção</h3>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-400">Selecione um pincel para apagar ou restaurar partes da imagem.</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setBrushType('erase')} className={`p-2 rounded-lg text-center font-semibold transition-colors ${brushType === 'erase' ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>Apagar</button>
                            <button onClick={() => setBrushType('restore')} className={`p-2 rounded-lg text-center font-semibold transition-colors ${brushType === 'restore' ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>Restaurar</button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400">Tamanho do pincel: {brushSize}</label>
                            {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                            <input type="range" min="5" max="150" value={brushSize} onChange={e => setBrushSize(parseInt((e.target as any).value, 10))} className="w-full mt-1" />
                        </div>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-medium text-gray-300">Mostrar imagem original</span>
                            <div className="relative">
                                <input type="checkbox" checked={showOriginal} onChange={() => setShowOriginal(!showOriginal)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-yellow-400 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                            </div>
                        </label>
                    </div>
                    <div className="mt-auto pt-4 border-t border-gray-700 flex flex-col gap-2">
                        <Button onClick={setupCanvas} className="w-full"><div className="flex items-center justify-center gap-2"><IconTrash /> Redefinir</div></Button>
                        <div className="flex gap-2">
                            <Button onClick={onClose} className="w-full">Cancelar</Button>
                            <Button onClick={handleApply} primary className="w-full">Aplicar</Button>
                        </div>
                    </div>
                </div>
                <div className="flex-grow flex items-center justify-center rounded-lg overflow-hidden relative" style={checkerboardStyle}>
                    <canvas 
                        ref={canvasRef}
                        className="max-w-full max-h-full object-contain"
                        style={{ cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="${brushSize}" height="${brushSize}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" stroke="black" stroke-width="3" fill="rgba(255,255,255,0.3)"/></svg>') ${brushSize/2} ${brushSize/2}, auto`}}
                        onMouseDown={handleMouseDown}
                        onMouseMove={draw}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                     {showOriginal && originalImage && (
                        <img src={originalImage} alt="Original" className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-50"/>
                     )}
                </div>
            </motion.div>
        </div>
    );
};

export default BackgroundRemoverModal;