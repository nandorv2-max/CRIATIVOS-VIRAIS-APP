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
}

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDownload: (options: DownloadOptions) => void;
    hasVideoOrAudio: boolean;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, onDownload, hasVideoOrAudio }) => {
    const [format, setFormat] = useState<DownloadFormat>(hasVideoOrAudio ? 'mp4' : 'png');
    const [transparentBg, setTransparentBg] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            setFormat(hasVideoOrAudio ? 'mp4' : 'png');
        }
    }, [isOpen, hasVideoOrAudio]);

    const handleDownloadClick = () => {
        onDownload({ 
            format, 
            transparent: format === 'png' ? transparentBg : false,
            // Hardcoded defaults for simplified video export
            resolution: '1080p',
            bitrate: 8000, // 8 Mbps
            frameRate: 30,
            codec: 'h264',
        });
        onClose();
    };

    const handleFormatChange = (newFormat: DownloadFormat) => {
        setFormat(newFormat);
        if (newFormat !== 'png') {
            setTransparentBg(false);
        }
    }

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
