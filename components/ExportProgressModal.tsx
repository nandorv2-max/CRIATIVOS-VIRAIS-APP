import React from 'react';
import { motion } from 'framer-motion';

interface ExportProgressModalProps {
    isOpen: boolean;
    progress: number;
    statusText: string;
}

const ExportProgressModal: React.FC<ExportProgressModalProps> = ({ isOpen, progress, statusText }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-8 border border-brand-accent shadow-2xl w-full max-w-lg text-center"
            >
                <h2 className="text-2xl font-bold text-white mb-4">A Exportar o Seu Projeto</h2>
                <p className="text-gray-300 mb-6 min-h-[2.5rem]">{statusText}</p>

                <div className="w-full bg-brand-light rounded-full h-4 overflow-hidden border border-brand-accent">
                    <motion.div
                        className="bg-brand-primary h-4 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.2, ease: "linear" }}
                    />
                </div>
                <p className="text-xl font-semibold mt-4">{Math.round(progress)}%</p>
                
                 <p className="text-xs text-gray-400 mt-6">Pode minimizar o navegador; o processo continuará. Por favor, não feche esta aba.</p>
            </motion.div>
        </div>
    );
};

export default ExportProgressModal;