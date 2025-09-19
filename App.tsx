import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, User } from '@supabase/gotrue-js';
import LoginScreen from './components/LoginScreen.tsx';
import MainDashboard from './components/MainDashboard.tsx';
import ApiKeyPrompt from './components/ApiKeyPrompt.tsx';
import { supabase } from './services/supabaseClient.ts';
import { initializeGeminiClient } from './services/geminiService.ts';
import type { UserProfile } from './types.ts';

const MASTER_USERS = ['helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com'];

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [userProfile, setUserProfile] = useState<(User & UserProfile & { isAdmin: boolean }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiKeyStatus, setApiKeyStatus] = useState<'pending' | 'set' | 'error'>('pending');

    const updateUserProfile = async (user: User | null) => {
        if (!user) {
            setUserProfile(null);
            return;
        }
        const isAdmin = MASTER_USERS.includes(user.email ?? '');

        const { data, error } = await supabase.from('user_profiles').select('role, credits').eq('id', user.id).single();

        if (error) {
            console.error("Error fetching user profile, using defaults:", error.message);
            setUserProfile({
                ...user,
                id: user.id,
                email: user.email ?? '',
                role: isAdmin ? 'admin' : 'starter',
                credits: 0,
                isAdmin,
            });
        } else {
            setUserProfile({
                ...user,
                id: user.id,
                email: user.email ?? '',
                role: data.role,
                credits: data.credits,
                isAdmin,
            });
        }
    };

    useEffect(() => {
        const handleAuthStateChange = async (_event: string, session: Session | null) => {
            setSession(session);
            await updateUserProfile(session?.user ?? null);

            if (session) {
                const isAdmin = MASTER_USERS.includes(session.user.email ?? '');
                let keyToUse = '';

                if (isAdmin) {
                    keyToUse = process.env.API_KEY as string;
                    if (!keyToUse) {
                        console.error("FATAL ERROR: Master API_KEY is not configured in the application environment for admin user.");
                        setApiKeyStatus('error');
                        return;
                    }
                } else {
                    keyToUse = window.localStorage.getItem('user_gemini_api_key') || '';
                }

                if (keyToUse) {
                    initializeGeminiClient(keyToUse);
                    setApiKeyStatus('set');
                } else {
                    setApiKeyStatus('pending'); // Prompt for key if not admin and no key is stored
                }
            } else {
                // De-initialize on logout
                initializeGeminiClient('');
                setApiKeyStatus('pending');
            }
        };

        const fetchSession = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }
            const { data: { session } } = await supabase.auth.getSession();
            await handleAuthStateChange('INITIAL_SESSION', session);
            setLoading(false);
        };

        fetchSession();

        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
            return () => subscription.unsubscribe();
        }
    }, []);

    const handleApiKeySubmit = (apiKey: string) => {
        initializeGeminiClient(apiKey);
        setApiKeyStatus('set');
    };
    
    const renderContent = () => {
        if (loading) {
            return (
                <div key="loading" className="min-h-screen flex items-center justify-center bg-brand-dark">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                </div>
            );
        }
    
        if (!session) {
            return (
                <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                    <LoginScreen />
                </motion.div>
            );
        }

        if (apiKeyStatus === 'error') {
             return (
                 <div key="error" className="min-h-screen flex items-center justify-center bg-brand-dark text-center p-4">
                    <div>
                        <h1 className="text-2xl font-bold text-red-400">Erro de Configuração Crítico</h1>
                        <p className="text-gray-300 mt-2">A chave de API principal da aplicação não foi encontrada no ambiente.</p>
                         <p className="text-gray-400 mt-1 text-sm">Por favor, contacte o administrador do site.</p>
                    </div>
                </div>
            );
        }
        
        // If user is not an admin and API key is not set, show the prompt
        if (apiKeyStatus === 'pending' && userProfile && !userProfile.isAdmin) {
             return (
                 <motion.div key="apikey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ApiKeyPrompt onApiKeySubmit={handleApiKeySubmit} />
                </motion.div>
            );
        }

        if (apiKeyStatus === 'set' && userProfile) {
            return (
                 <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                    <MainDashboard userProfile={userProfile} />
                </motion.div>
            );
        }

        // Default to a loading state while things initialize
        return (
             <div key="pending" className="min-h-screen flex items-center justify-center bg-brand-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
            </div>
        );
    };
    
    return (
        <AnimatePresence mode="wait">
            {renderContent()}
        </AnimatePresence>
    );
};

export default App;