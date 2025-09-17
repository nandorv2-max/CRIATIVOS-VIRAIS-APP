import React from 'react';
import { motion } from 'framer-motion';
import { IconGoogle } from './Icons';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="w-full max-w-md text-center"
            >
                <header className="my-12">
                    <h1 className="text-6xl md:text-7xl font-caveat text-white tracking-tight">
                        Bee Retrate-<span className="text-yellow-400">Me</span>
                    </h1>
                    <p className="mt-4 text-lg text-gray-400">Transforme as suas fotos com o poder da IA do Gemini.</p>
                </header>

                <main className="mt-8">
                     <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onLoginSuccess}
                        className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-gray-700/50 border border-gray-600 rounded-lg font-semibold text-white hover:bg-gray-700 transition-all duration-300 shadow-lg backdrop-blur-sm"
                    >
                        <IconGoogle className="w-6 h-6" />
                        <span>Entrar com Google</span>
                    </motion.button>
                </main>
                 <footer className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-600">
                    Feito com Gemini
                </footer>
            </motion.div>
        </div>
    );
};

export default LoginScreen;