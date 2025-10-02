import React from 'react';
import { motion } from 'framer-motion';
import { IconX, IconFolder, IconImageIcon, IconGoogleDrive } from './Icons.tsx';

interface UploadOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLocalUpload: () => void;
    onGalleryUpload: () => void;
    onGoogleDriveUpload: () => void;
    galleryEnabled?: boolean;
    title?: string;
    localLabel?: string;
    galleryLabel?: string;
}

const UploadOption: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }> = ({ icon, label, onClick, disabled }) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex flex-col items-center justify-center gap-2 p-4 aspect-square rounded-lg border-2 transition-all duration-200 w-full ${disabled ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 border-gray-700 hover:border-brand-primary hover:bg-brand-primary/10 cursor-pointer'}`}
        >
            <div className="w-10 h-10">{icon}</div>
            <span className="text-sm font-semibold text-center">{label}</span>
        </button>
    );
};


const UploadOptionsModal: React.FC<UploadOptionsModalProps> = ({ 
    isOpen, 
    onClose, 
    onLocalUpload, 
    onGalleryUpload,
    onGoogleDriveUpload,
    galleryEnabled = false,
    title = "Opções de upload",
    localLabel = "Do Dispositivo",
    galleryLabel = "Galeria" 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-lg relative text-white">
                <h3 className="text-xl font-semibold mb-6 text-center">{title}</h3>
                
                <div className={`grid ${galleryEnabled ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                    <UploadOption icon={<IconFolder className="w-full h-full text-gray-400"/>} label={localLabel} onClick={onLocalUpload} />
                    {galleryEnabled && (
                         <UploadOption icon={<IconImageIcon className="w-full h-full text-brand-secondary"/>} label={galleryLabel} onClick={onGalleryUpload} />
                    )}
                    <UploadOption icon={<IconGoogleDrive className="w-full h-full"/>} label="Google Drive" onClick={onGoogleDriveUpload} />
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-400" />
                </button>
            </motion.div>
        </div>
    );
};

export default UploadOptionsModal;