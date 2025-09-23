import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { IconX } from './Icons.tsx';

type DownloadFormat = 'png' | 'jpg' | 'mp4';
export interface VideoExportOptions {
    resolution: '1080p';
    bitrate: number; 
    frameRate: 30;
    codec: 'h264';
}
export interface DownloadOptions extends VideoExportOptions {
    format: DownloadFormat;
    transparent: boolean;
    pageIndexes: number[];
}

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDownload: (options: DownloadOptions) => void;
    hasVideoOrAudio: boolean;
    pageCount: number;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, onDownload, hasVideoOrAudio, pageCount }) => {
    const [format, setFormat] = useState<DownloadFormat>(hasVideoOrAudio ? 'mp4' : 'png');
    const [transparentBg, setTransparentBg] = useState(false);
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set(Array.from({ length: pageCount }, (_, i) => i)));
    
    useEffect(() => {
        if (isOpen) {
            setFormat(hasVideoOrAudio ? 'mp4' : 'png');
            setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)));
        }
    }, [isOpen, hasVideoOrAudio, pageCount]);

    const handleDownloadClick = () => {
        if (selectedPages.size === 0) {
            alert("Por favor, selecione pelo menos uma página para baixar.");
            return;
        }
        onDownload({ 
            format, 
            transparent: format === 'png' ? transparentBg : false,
            resolution: '1080p',
            bitrate: 8000,
            frameRate: 30,
            codec: 'h264',
            // FIX: Explicitly typed the sort callback parameters `a` and `b` as numbers to resolve a type inference issue that caused an arithmetic operation error.
            pageIndexes: Array.from(selectedPages).sort((a: number, b: number) => a-b),
        });
        onClose();
    };

    const handleFormatChange = (newFormat: DownloadFormat) => {
        setFormat(newFormat);
        if (newFormat !== 'png') setTransparentBg(false);
    }
    
    const handlePageSelect = (index: number) => {
        setSelectedPages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) newSet.delete(index);
            else newSet.add(index);
            return newSet;
        });
    };
    
    const handleSelectAll = () => {
        if (selectedPages.size === pageCount) {
            setSelectedPages(new Set());
        } else {
            setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-brand-dark rounded-lg p-6 border border-brand-accent shadow-2xl w-full max-w-sm relative text-white">
                <h3 className="text-xl font-bold mb-6 text-left">Baixar Design</h3>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Formato do Ficheiro</label>
                        <div className={`grid ${hasVideoOrAudio ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                            <button onClick={() => handleFormatChange('png')} className={`py-2 px-4 rounded-md font-semibold transition-colors ${format === 'png' ? 'bg-brand-primary text-white' : 'bg-brand-accent hover:bg-brand-light'}`}>PNG</button>
                            <button onClick={() => handleFormatChange('jpg')} className={`py-2 px-4 rounded-md font-semibold transition-colors ${format === 'jpg' ? 'bg-brand-primary text-white' : 'bg-brand-accent hover:bg-brand-light'}`}>JPG</button>
                            {hasVideoOrAudio && (
                                <button onClick={() => handleFormatChange('mp4')} className={`py-2 px-4 rounded-md font-semibold transition-colors ${format === 'mp4' ? 'bg-brand-primary text-white' : 'bg-brand-accent hover:bg-brand-light'}`}>MP4</button>
                            )}
                        </div>
                    </div>

                    {format === 'png' && (
                        <motion.div initial={{opacity:0, height: 0}} animate={{opacity:1, height: 'auto'}}>
                        <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-brand-light/50`}>
                            <input
                                type="checkbox"
                                checked={transparentBg}
                                onChange={(e) => setTransparentBg(e.target.checked)}
                                className="w-5 h-5 rounded bg-brand-dark border-brand-accent text-brand-primary focus:ring-brand-secondary"
                            />
                            <span className="font-medium">Fundo transparente</span>
                        </label>
                        </motion.div>
                    )}

                    {pageCount > 1 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-400">Selecionar Páginas</label>
                                <button onClick={handleSelectAll} className="text-xs text-brand-primary font-semibold">
                                    {selectedPages.size === pageCount ? 'Desselecionar Todas' : 'Selecionar Todas'}
                                </button>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1 pr-2 bg-brand-light/50 p-2 rounded-md">
                                {Array.from({ length: pageCount }).map((_, i) => (
                                    <label key={i} className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-brand-accent/50">
                                        <input
                                            type="checkbox"
                                            checked={selectedPages.has(i)}
                                            onChange={() => handlePageSelect(i)}
                                            className="w-4 h-4 rounded bg-brand-dark border-brand-accent text-brand-primary focus:ring-brand-secondary"
                                        />
                                        <span className="text-sm">Página {i + 1}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <Button onClick={onClose}>CANCELAR</Button>
                    <Button onClick={handleDownloadClick} primary>BAIXAR</Button>
                </div>
                
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-400" />
                </button>
            </motion.div>
        </div>
    );
};

export default DownloadModal;