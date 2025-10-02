import React from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabaseClient.ts';
import { IconLogout } from '../Icons.tsx';

const TrialExpiredView: React.FC = () => {

    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-main">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="w-full max-w-lg text-center bg-brand-dark/50 p-10 rounded-2xl border border-brand-accent/50"
            >
                <h1 className="text-3xl font-bold text-white">O seu Período de Teste Gratuito Terminou</h1>
                <p className="mt-4 text-gray-300">
                    Obrigado por experimentar o GenIA! Para continuar a criar e aceder a todas as funcionalidades, por favor, faça um upgrade para um dos nossos planos.
                </p>
                <p className="mt-2 text-sm text-gray-400">
                    Se já fez um upgrade, por favor, saia e entre novamente.
                </p>

                <div className="mt-8 flex flex-col items-center gap-4">
                     <button 
                        // Este botão é um placeholder. Numa aplicação real, levaria para a página de preços.
                        onClick={() => alert('A página de upgrade ainda não foi implementada.')} 
                        className="w-full max-w-xs px-6 py-3 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-secondary transition-all duration-300"
                    >
                        Ver Planos e Fazer Upgrade
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center justify-center gap-2 w-full max-w-xs px-4 py-2 bg-brand-light border border-brand-accent rounded-lg text-white font-semibold hover:bg-brand-accent transition-colors"
                    >
                        <IconLogout className="w-5 h-5" />
                        <span>Sair</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default TrialExpiredView;