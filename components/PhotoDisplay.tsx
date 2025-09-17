import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { IconOptions, IconEdit } from './Icons';

interface PhotoDisplayProps {
    era: string;
    imageUrl: string;
    onDownload: (imageUrl: string, era: string, ratio: string) => void;
    onRegenerate: () => void;
    onEdit: (imageUrl: string, index: number) => void;
    isPolaroid?: boolean;
    index?: number;
    showLabel?: boolean;
}

const PhotoDisplay: React.FC<PhotoDisplayProps> = ({ era, imageUrl, onDownload, onRegenerate, onEdit, isPolaroid = true, index = 0, showLabel = true }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // FIX: Cast event.target to `any` to use the 'contains' method, and to resolve 'Cannot find name 'Node'' error.
        // FIX: Property 'contains' does not exist on type 'HTMLDivElement'.
        const handleClickOutside = (event: MouseEvent) => { 
            if (menuRef.current && !menuRef.current.contains(event.target as any)) {
                setIsMenuOpen(false);
            }
        };
        // FIX: Prefix document with window. to ensure availability.
        // FIX: Property 'document' does not exist on type 'Window'.
        window.document.addEventListener("mousedown", handleClickOutside);
        // FIX: Prefix document with window. to ensure availability.
        // FIX: Property 'document' does not exist on type 'Window'.
        return () => { window.document.removeEventListener("mousedown", handleClickOutside); };
    }, []);

    const rotation = useMemo(() => {
        if (!isPolaroid) return 'rotate-0';
        const rotations = ['rotate-1', '-rotate-1', 'rotate-0.5', '-rotate-1.5'];
        return rotations[index % rotations.length];
    }, [index, isPolaroid]);
    
    const containerClass = isPolaroid ? `relative group bg-gray-100 p-3 pb-12 shadow-xl transform transition-all duration-300 hover:shadow-2xl hover:scale-105 ${rotation}` : 'relative group pb-4 bg-gray-900 rounded-xl shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-105';
    const imageContainerClass = isPolaroid ? 'aspect-square bg-gray-200' : 'rounded-t-xl overflow-hidden';
    const textClass = isPolaroid ? 'text-center mt-4 font-caveat text-3xl text-gray-900 absolute bottom-3 left-0 right-0' : 'text-center mt-3 text-lg font-semibold text-gray-300 px-3';

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={containerClass}>
            <div className={imageContainerClass}><img src={imageUrl} alt={`Você em ${era}`} className={`w-full ${isPolaroid ? 'h-full object-cover' : 'h-auto'}`} /></div>
            {showLabel && <p className={textClass}>{era}</p>}
            <div className="absolute top-3 right-3 z-10" ref={menuRef}>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm shadow-lg" aria-label="Opções"><IconOptions /></button>
                {isMenuOpen && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.1 }} className="absolute right-0 top-12 mt-2 w-48 origin-top-right bg-black/80 backdrop-blur-md rounded-lg shadow-2xl ring-1 ring-white/10 text-white text-sm flex flex-col p-1">
                        <span className="w-full text-left px-3 pt-2 pb-1 text-xs text-gray-500 uppercase tracking-wider">Ações</span>
                        <button onClick={() => { onRegenerate(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md transition-colors">Gerar Novamente</button>
                        <button onClick={() => { onEdit(imageUrl, index); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md transition-colors flex items-center gap-2" aria-label={`Editar foto de ${era}`}>
                            <IconEdit /> Editar Foto
                        </button>
                        <div className="my-1 h-px bg-white/10"></div>
                        <span className="w-full text-left px-3 pt-1 pb-1 text-xs text-gray-500 uppercase tracking-wider">Descarregar</span>
                        <button onClick={() => { onDownload(imageUrl, era, '1:1'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md transition-colors">Quadrado (1:1)</button>
                        <button onClick={() => { onDownload(imageUrl, era, '9:16'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-yellow-400/20 rounded-md transition-colors">Retrato (9:16)</button>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

export default PhotoDisplay;