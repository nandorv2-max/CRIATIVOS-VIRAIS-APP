import React from 'react';
import { motion } from 'framer-motion';
import Button from '../../components/Button.tsx';
import { IconDownload } from '../../components/Icons.tsx';

interface ModalTriggerViewProps {
    title: string;
    description: string;
    buttonText: string;
    onTrigger: () => void;
    imageUrl?: string | null;
    onClear?: () => void;
}

const ModalTriggerView: React.FC<ModalTriggerViewProps> = ({ title, description, buttonText, onTrigger, imageUrl, onClear }) => {

    if (imageUrl && onClear) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <motion.div
                    className="w-full max-w-3xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <h1 className="text-3xl font-bold text-white mb-6">Sua Imagem Editada</h1>
                    <div className="w-full bg-black rounded-2xl border border-brand-accent/50 mb-8 shadow-2xl flex items-center justify-center p-2" style={{ minHeight: '50vh' }}>
                        <img src={imageUrl} alt="Resultado da edição" className="max-w-full max-h-[65vh] object-contain rounded-lg" />
                    </div>
                    <div className="flex justify-center gap-4">
                        <Button onClick={onClear}>Editar Outra Foto</Button>
                        <Button onClick={onTrigger}>Editar Novamente</Button>
                        <a href={imageUrl} download="imagem-editada.png" className="flex items-center justify-center gap-2 px-6 py-2 rounded-md font-semibold tracking-wider uppercase transition-all duration-300 no-underline bg-brand-primary text-white hover:bg-brand-secondary">
                            <IconDownload />
                            Baixar Imagem
                        </a>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <motion.div
                className="w-full max-w-2xl bg-brand-dark/50 p-10 rounded-2xl border border-brand-accent/50"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <h1 className="text-3xl font-bold text-white">{title}</h1>
                <p className="mt-4 text-lg text-gray-300">
                    {description}
                </p>
                <div className="mt-8">
                    <Button onClick={onTrigger} primary className="text-lg px-8 py-3">
                        {buttonText}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default ModalTriggerView;