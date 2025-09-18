import React from 'react';
import { motion } from 'framer-motion';
import { IconX, IconFolder, IconGoogleDrive, IconInstagram, IconFacebook } from './Icons.tsx';

interface UploadOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLocalUpload: () => void;
    onGoogleDriveUpload: () => void;
}

const UploadOption: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }> = ({ icon, label, onClick, disabled }) => {
    const content = (
        <div className={`flex flex-col items-center justify-center gap-2 p-4 aspect-square rounded-lg border-2 transition-all duration-200 ${disabled ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 border-gray-700 hover:border-yellow-400 hover:bg-gray-700/50 cursor-pointer'}`}>
            <div className="w-10 h-10">{icon}</div>
            <span className="text-sm font-semibold text-center">{label}</span>
        </div>
    );
    
    // FIX: Prefix 'alert' with 'window.' to ensure it is available in non-browser-default environments.
    // FIX: Property 'alert' does not exist on type 'Window'.
    return disabled ? <div onClick={() => window.alert('Esta funcionalidade será adicionada em breve!')}>{content}</div> : <button onClick={onClick}>{content}</button>;
};

const UploadOptionsModal: React.FC<UploadOptionsModalProps> = ({ isOpen, onClose, onLocalUpload, onGoogleDriveUpload }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl w-full max-w-lg relative text-white">
                <h3 className="text-xl font-semibold mb-6 text-center">Opções de upload</h3>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    <UploadOption icon={<IconFolder className="w-full h-full text-gray-400"/>} label="Fazer upload" onClick={onLocalUpload} />
                    <UploadOption icon={<IconGoogleDrive className="w-full h-full"/>} label="Google Drive" onClick={onGoogleDriveUpload} />
                    <UploadOption icon={<IconInstagram className="w-full h-full"/>} label="Instagram" onClick={() => {}} disabled />
                    <UploadOption icon={<IconFacebook className="w-full h-full"/>} label="Facebook" onClick={() => {}} disabled />
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 transition-colors">
                    <IconX className="w-5 h-5 text-gray-400" />
                </button>
            </motion.div>
        </div>
    );
};

export default UploadOptionsModal;