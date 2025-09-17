import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import { IconX, IconChevronDown } from './Icons';

type DownloadFormat = 'png' | 'jpg' | 'mp4';
export interface VideoExportOptions {
    resolution: '720p' | '1080p' | '1440p' | '4k' | 'source';
    bitrate: number; // in kbps
    frameRate: 24 | 30 | 60;
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

const CustomSelect: React.FC<{label: string, value: any, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, children: React.ReactNode, disabled?: boolean}> = 
({ label, value, onChange, children, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <div className="relative">
            <select 
                value={value} 
                onChange={onChange}
                disabled={disabled}
                className="w-full appearance-none bg-slate-700 border border-slate-600 rounded-md py-2.5 px-3 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-white disabled:opacity-50"
            >
                {children}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <IconChevronDown className="w-5 h-5" />
            </div>
        </div>
    </div>
);

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, onDownload, hasVideoOrAudio }) => {
    const [format, setFormat] = useState<DownloadFormat>(hasVideoOrAudio ? 'mp4' : 'png');
    const [transparentBg, setTransparentBg] = useState(false);
    
    // Video settings state
    const [resolution, setResolution] = useState<VideoExportOptions['resolution']>('1080p');
    const [bitrate, setBitrate] = useState<number>(8000); // 8 Mbps
    const [codec, setCodec] = useState<'h264' | 'hevc'>('h264');
    const [frameRate, setFrameRate] = useState<VideoExportOptions['frameRate']>(30);
    const [opticalFlow, setOpticalFlow] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormat(hasVideoOrAudio ? 'mp4' : 'png');
            setResolution('1080p');
            setBitrate(8000);
            setCodec('h264');
            setFrameRate(30);
            setOpticalFlow(false);
        }
    }, [isOpen, hasVideoOrAudio]);

    const handleDownloadClick = () => {
        onDownload({ 
            format, 
            transparent: format === 'png' ? transparentBg : false,
            resolution,
            bitrate,
            frameRate
        });
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-2xl w-full max-w-sm relative text-white">
                <h3 className="text-xl font-bold mb-6 text-left">Baixar Design</h3>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Formato do Ficheiro</label>
                        <div className={`grid ${hasVideoOrAudio ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                            <button onClick={() => handleFormatChange('png')} className={`py-2 px-4 rounded-md font-semibold transition-colors ${format === 'png' ? 'bg-yellow-400 text-black' : 'bg-slate-700 hover:bg-slate-600'}`}>PNG</button>
                            <button onClick={() => handleFormatChange('jpg')} className={`py-2 px-4 rounded-md font-semibold transition-colors ${format === 'jpg' ? 'bg-yellow-400 text-black' : 'bg-slate-700 hover:bg-slate-600'}`}>JPG</button>
                            {hasVideoOrAudio && (
                                <button onClick={() => handleFormatChange('mp4')} className={`py-2 px-4 rounded-md font-semibold transition-colors ${format === 'mp4' ? 'bg-yellow-400 text-black' : 'bg-slate-700 hover:bg-slate-600'}`}>MP4</button>
                            )}
                        </div>
                    </div>

                    {format === 'png' && (
                        <motion.div initial={{opacity:0, height: 0}} animate={{opacity:1, height: 'auto'}}>
                        <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-700/50`}>
                            <input
                                type="checkbox"
                                checked={transparentBg}
                                // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
                                onChange={(e) => setTransparentBg((e.target as any).checked)}
                                className="w-5 h-5 rounded bg-slate-900 border-slate-600 text-yellow-400 focus:ring-yellow-500"
                            />
                            <span className="font-medium">Fundo transparente</span>
                        </label>
                        </motion.div>
                    )}

                    {format === 'mp4' && (
                        <motion.div initial={{opacity:0, height: 0}} animate={{opacity:1, height: 'auto'}} className="space-y-4 pt-4 border-t border-slate-700">
                            <details open>
                                <summary className="font-semibold text-gray-300 cursor-pointer list-none flex justify-between items-center">
                                    <span>Vídeo</span>
                                    <IconChevronDown className="w-5 h-5" />
                                </summary>
                                <div className="space-y-4 mt-4">
                                    {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                    <CustomSelect label="Resolução" value={resolution} onChange={e => setResolution((e.target as any).value as any)}>
                                        <option value="source">Original</option>
                                        <option value="720p">720p HD</option>
                                        <option value="1080p">1080p Full HD</option>
                                        <option value="1440p">1440p 2K</option>
                                        <option value="4k">2160p 4K</option>
                                    </CustomSelect>
                                    {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                    <CustomSelect label="Taxa de bits (kbps)" value={bitrate} onChange={e => setBitrate(parseInt((e.target as any).value))}>
                                        <option value={2000}>Baixa (2000)</option>
                                        <option value={5000}>Recomendado (5000)</option>
                                        <option value={8000}>Alta (8000)</option>
                                        <option value={12000}>Muito Alta (12000)</option>
                                    </CustomSelect>
                                    {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                    <CustomSelect label="Codec" value={codec} onChange={e => setCodec((e.target as any).value as any)}>
                                        <option value="h264">H.264 (Compatibilidade)</option>
                                        <option value="hevc">HEVC (H.265)</option>
                                    </CustomSelect>
                                        {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                        <CustomSelect label="Taxa de quadros" value={frameRate} onChange={e => setFrameRate(parseInt((e.target as any).value) as any)}>
                                        <option value={24}>24 fps</option>
                                        <option value={30}>30 fps</option>
                                        <option value={60}>60 fps</option>
                                    </CustomSelect>
                                    <div className="flex items-center justify-between pt-1">
                                        <label className="block text-sm font-medium text-gray-400">Fluxo óptico</label>
                                        <button
                                            onClick={() => setOpticalFlow(!opticalFlow)}
                                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-yellow-400 ${opticalFlow ? 'bg-slate-500' : 'bg-slate-600'}`}
                                            aria-pressed={opticalFlow}
                                        >
                                            <span
                                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${opticalFlow ? 'translate-x-6' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </div>
                                        <CustomSelect label="Espaço de cores" value="rec709" onChange={() => {}} disabled>
                                        <option value="rec709">Rec. 709 SDR</option>
                                        <option value="rec2100">Rec. 2100 HLG</option>
                                    </CustomSelect>
                                </div>
                            </details>
                        </motion.div>
                    )}
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <Button onClick={onClose}>CANCELAR</Button>
                    <Button onClick={handleDownloadClick} primary>BAIXAR</Button>
                </div>
                
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-700 transition-colors">
                    <IconX className="w-5 h-5 text-gray-400" />
                </button>
            </motion.div>
        </div>
    );
};

export default DownloadModal;