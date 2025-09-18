// FIX: Implemented the ProfessionalEditorModal component to resolve "Cannot find name" and "is not a module" errors.
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { toBase64 } from '../utils/imageUtils.ts';

interface ProfessionalEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (imageUrl: string) => void;
}

const ProfessionalEditorModal: React.FC<ProfessionalEditorModalProps> = ({ isOpen, onClose, onApply }) => {
    const [image, setImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (file: File) => {
        const base64 = await toBase64(file);
        setImage(base64);
    };

    const handleApply = () => {
        if (image) {
            onApply(image);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
                <h3 className="text-xl font-semibold text-white text-center mb-4">Editor Profissional</h3>
                <div className="flex-grow flex items-center justify-center bg-black rounded-lg">
                    {image ? (
                        <img src={image} alt="Para editar" className="max-w-full max-h-full object-contain" />
                    ) : (
                        <div className="text-center">
                            <p className="text-gray-400 mb-4">Carregue uma imagem para editar</p>
                            <Button onClick={() => fileInputRef.current?.click()}>Carregar Imagem</Button>
                            <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} accept="image/*" className="hidden" />
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-4 mt-4">
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleApply} primary disabled={!image}>Aplicar & Fechar</Button>
                </div>
            </motion.div>
        </div>
    );
};

export default ProfessionalEditorModal;