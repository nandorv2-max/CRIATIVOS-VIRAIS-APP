import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../services/supabaseClient.ts';

interface ApiKeyPromptProps {
    onApiKeySubmit: (apiKey: string) => void;
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onApiKeySubmit }) => {
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) return;
        setLoading(true);
        
        // Save to localStorage for persistence
        window.localStorage.setItem('user_gemini_api_key', trimmedKey);

        // Add a slight delay for user feedback
        setTimeout(() => {
            onApiKeySubmit(trimmedKey);
        }, 500);
    };
    
    const handleLogout = async () => {
        if (supabase) {
            // FIX: `signOut` does not exist on older Supabase client versions. This call may need adjustment for the specific version in use.
            await supabase.auth.signOut();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="w-full max-w-lg text-center bg-brand-dark/50 p-10 rounded-2xl border border-brand-accent/50"
            >
                <h1 className="text-3xl font-bold text-white">Chave de API do Google</h1>
                <p className="mt-4 text-gray-300">
                    Para usar esta ferramenta, por favor, insira a sua própria chave de API do Google.
                    Isso garante que você use seus próprios créditos e mantenha sua atividade privada.
                </p>
                <p className="mt-2 text-sm text-gray-400">
                    Não tem uma chave? Obtenha uma no <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline hover:text-brand-secondary">Google AI Studio</a>.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    <input
                        type="password"
                        placeholder="Cole a sua chave de API aqui"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full px-4 py-3 bg-brand-light border border-brand-accent rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        required
                    />
                    <motion.button
                        type="submit"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={loading}
                        className="w-full px-6 py-3 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-secondary transition-all duration-300 disabled:opacity-50"
                    >
                        {loading ? 'A verificar...' : 'Continuar'}
                    </motion.button>
                </form>
                <button onClick={handleLogout} className="mt-6 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                    Sair
                </button>
            </motion.div>
        </div>
    );
};

export default ApiKeyPrompt;