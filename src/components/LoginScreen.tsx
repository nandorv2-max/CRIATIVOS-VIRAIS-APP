import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconGoogle, IconLogo } from './Icons.tsx';
import { supabase } from '../services/supabaseClient.ts';

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) {
            setError("A funcionalidade de login não está disponível. A conexão com o Supabase falhou.");
            return;
        }
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError("Email ou senha inválidos.");
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        if (!supabase) {
            setError("A funcionalidade de login não está disponível. A conexão com o Supabase falhou.");
            return;
        }
        await supabase.auth.signInWithOAuth({ 
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="w-full max-w-md text-center"
            >
                <header className="my-12 flex flex-col items-center">
                     <div className="flex items-center justify-center gap-4">
                        <IconLogo className="w-24 h-24 rounded-full" />
                    </div>
                    <p className="mt-4 text-lg text-gray-300">Transforme as suas fotos com o poder da IA.</p>
                </header>

                <main className="mt-8 space-y-6">
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-brand-light border border-brand-accent rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            required
                        />
                        <input
                            type="password"
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                            {loading ? 'A entrar...' : 'Entrar'}
                        </motion.button>
                        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    </form>

                    <div className="flex items-center gap-4">
                        <hr className="w-full border-brand-accent" />
                        <span className="text-gray-400 font-semibold text-sm">OU</span>
                        <hr className="w-full border-brand-accent" />
                    </div>

                     <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleGoogleLogin}
                        className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-brand-light/50 border border-brand-accent rounded-lg font-semibold text-white hover:bg-brand-light transition-all duration-300 shadow-lg backdrop-blur-sm"
                    >
                        <IconGoogle className="w-6 h-6" />
                        <span>Entrar com Google</span>
                    </motion.button>
                </main>
            </motion.div>
        </div>
    );
};

export default LoginScreen;