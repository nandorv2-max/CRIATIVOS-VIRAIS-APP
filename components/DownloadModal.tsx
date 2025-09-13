import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import { IconX } from './Icons';

type DownloadFormat = 'png' | 'jpg' | 'mp4';

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDownload: (options: { format: DownloadFormat; transparent: boolean }, onProgress: (p: number) => void) => void;
    hasVideoOrAudio: boolean;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, onDownload, hasVideoOrAudio }) => {
    const [format, setFormat] = useState<DownloadFormat>(hasVideoOrAudio ? 'mp4' : 'png');
    const [transparentBg, setTransparentBg] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setIsProcessing(false);
            setProgress(0);
            setFormat(hasVideoOrAudio ? 'mp4' : 'png');
        }
    }, [isOpen, hasVideoOrAudio]);

    const handleDownload = () => {
        setIsProcessing(true);
        setProgress(0);
        onDownload(
            { format, transparent: format === 'png' ? transparentBg : false },
            (p) => {
                setProgress(p);
                if (p >= 1) {
                    setTimeout(() => {
                        setIsProcessing(false);
                        onClose();
                    }, 1000);
                }
            }
        );
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-2xl w-full max-w-sm relative text-white">
                <h3 className="text-xl font-semibold mb-6 text-center">{isProcessing ? 'A processar...' : 'Baixar Design'}</h3>
                
                {isProcessing ? (
                    <div className="space-y-4">
                        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                            <motion.div
                                className="bg-yellow-400 h-4 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress * 100}%` }}
                                transition={{ duration: 0.2, ease: "linear" }}
                            />
                        </div>
                        <p className="text-center text-gray-400">{progress < 1 ? 'A exportar o seu design. Por favor, aguarde.' : 'Concluído! O seu download vai começar.'}</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Formato do Ficheiro</label>
                                <div className={`grid ${hasVideoOrAudio ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                    <button onClick={() => handleFormatChange('png')} className={`p-2 rounded-lg font-semibold ${format === 'png' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}>PNG</button>
                                    <button onClick={() => handleFormatChange('jpg')} className={`p-2 rounded-lg font-semibold ${format === 'jpg' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}>JPG</button>
                                    {hasVideoOrAudio && (
                                        <button onClick={() => handleFormatChange('mp4')} className={`p-2 rounded-lg font-semibold ${format === 'mp4' ? 'bg-yellow-400 text-black' : 'bg-gray-700'}`}>MP4</button>
                                    )}
                                </div>
                            </div>
                            <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-700/50 ${format !== 'png' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={transparentBg}
                                    onChange={(e) => setTransparentBg(e.target.checked)}
                                    disabled={format !== 'png'}
                                    className="w-5 h-5 rounded bg-gray-900 border-gray-600 text-yellow-400 focus:ring-yellow-500 disabled:opacity-50"
                                />
                                <span className="font-medium">Fundo transparente</span>
                            </label>
                            <p className="text-xs text-gray-500 px-3">
                                {format === 'png' && 'Ideal para logos e designs com transparência.'}
                                {format === 'jpg' && 'Ideal para fotos com ficheiros de tamanho mais pequeno.'}
                                {format === 'mp4' && 'Ideal para designs com vídeo ou áudio.'}
                            </p>
                        </div>
                        <div className="mt-8 flex justify-end gap-4">
                            <Button onClick={onClose}>Cancelar</Button>
                            <Button onClick={handleDownload} primary>Baixar</Button>
                        </div>
                    </>
                )}
                
                <button onClick={onClose} disabled={isProcessing} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50">
                    <IconX className="w-5 h-5 text-gray-400" />
                </button>
            </motion.div>
        </div>
    );
};

export default DownloadModal;
