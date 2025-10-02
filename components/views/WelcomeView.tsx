import React from 'react';
import { motion } from 'framer-motion';

const WelcomeView: React.FC = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
                    Bem-vindo ao <span className="text-brand-primary">AuraStudio</span>
                </h1>
                <p className="mt-4 text-xl text-gray-300 max-w-2xl mx-auto">
                    O seu estúdio criativo de IA.
                </p>
                <p className="mt-8 text-lg text-gray-200">
                    &larr; Selecione uma ferramenta na barra lateral para começar a transformar as suas ideias em realidade.
                </p>
            </motion.div>
        </div>
    );
};

export default WelcomeView;