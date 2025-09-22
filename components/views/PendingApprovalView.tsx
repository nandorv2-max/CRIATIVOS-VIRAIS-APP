import React from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabaseClient.ts';
import { IconLogout } from '../Icons.tsx';

const PendingApprovalView: React.FC = () => {

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
                <h1 className="text-3xl font-bold text-white">Conta Pendente de Aprovação</h1>
                <p className="mt-4 text-gray-300">
                    O seu registo foi bem-sucedido. A sua conta está agora a aguardar aprovação e atribuição de um plano por um administrador.
                </p>
                <p className="mt-2 text-sm text-gray-400">
                    Será notificado quando a sua conta estiver ativa.
                </p>

                <div className="mt-8">
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center justify-center gap-2 w-full max-w-xs mx-auto px-4 py-2 bg-brand-light border border-brand-accent rounded-lg text-white font-semibold hover:bg-brand-accent transition-colors"
                    >
                        <IconLogout className="w-5 h-5" />
                        <span>Sair</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default PendingApprovalView;
