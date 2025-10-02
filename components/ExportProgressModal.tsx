import React from 'react';
import { motion } from 'framer-motion';
import type { DownloadJob } from '../types.ts';
import Button from './Button.tsx';

interface ExportProgressModalProps {
    isOpen: boolean;
    job: DownloadJob | null;
    onClose: () => void;
}

const ExportProgressModal: React.FC<ExportProgressModalProps> = ({ isOpen, job, onClose }) => {
    if (!isOpen || !job) return null;

    const isDone = job.status === 'done';
    const isError = job.status === 'error';

    const renderContent = () => {
        if (isError) {
            return (
                <>
                    <h2 className="text-2xl font-bold text-red-400 mb-4">Exportação Falhou</h2>
                    <p className="text-gray-300 mb-6 break-words min-h-[2.5rem]">{job.error}</p>
                    <Button onClick={onClose} className="w-full">Fechar</Button>
                </>
            );
        }

        if (isDone && job.resultUrl) {
            return (
                <>
                    <h2 className="text-2xl font-bold text-white mb-4">Download Pronto!</h2>
                    <p className="text-gray-300 mb-6">O seu ficheiro foi processado com sucesso.</p>
                    <div className="flex flex-col gap-4">
                        <a 
                          href={job.resultUrl} 
                          download={job.fileName}
                          className="flex items-center justify-center px-6 py-2 rounded-md font-semibold tracking-wider uppercase transition-all duration-300 bg-brand-primary text-white hover:bg-brand-secondary"
                        >
                            Baixar Ficheiro
                        </a>
                        <Button onClick={onClose}>Fechar</Button>
                    </div>
                </>
            );
        }

        return (
            <>
                <h2 className="text-2xl font-bold text-white mb-4">A Exportar o Seu Projeto</h2>
                <p className="text-gray-300 mb-6 min-h-[2.5rem]">{job.statusText}</p>

                <div className="w-full bg-brand-light rounded-full h-4 overflow-hidden border border-brand-accent">
                    <motion.div
                        className="bg-brand-primary h-4 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${job.progress}%` }}
                        transition={{ duration: 0.2, ease: "linear" }}
                    />
                </div>
                <p className="text-xl font-semibold mt-4">{Math.round(job.progress)}%</p>
                
                <p className="text-xs text-gray-400 mt-6">Pode minimizar o navegador; o processo continuará. Por favor, não feche esta aba.</p>
            </>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-8 border border-brand-accent shadow-2xl w-full max-w-lg text-center"
            >
                {renderContent()}
            </motion.div>
        </div>
    );
};

export default ExportProgressModal;