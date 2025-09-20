import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, User } from '@supabase/gotrue-js';
import LoginScreen from './components/LoginScreen.tsx';
import MainDashboard from './components/MainDashboard.tsx';
import ApiKeyPrompt from './components/ApiKeyPrompt.tsx';
import { supabase } from './services/supabaseClient.ts';
import { initializeGeminiClient } from './geminiService.ts';
import type { UserProfile } from './types.ts';
import { MASTER_USERS } from './constants.ts';


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

                // PRIORITIZE user's own key from local storage, even for admins.
                const userKey = window.localStorage.getItem('user_gemini_api_key');
                if (userKey) {
                    keyToUse = userKey;
                } else if (isAdmin) {
                    // Fallback to master key ONLY if user is admin AND has no personal key set.
                    keyToUse = process.env.API_KEY as string;
                    if (!keyToUse) {
                        console.error("FATAL ERROR: Master API_KEY is not configured in the application environment for admin user.");
                        setApiKeyStatus('error');
                        return;
                    }
                }

                if (keyToUse) {
                    initializeGeminiClient(keyToUse);
                    setApiKeyStatus('set');
                } else {
                    // This now only happens for non-admins with no key.
                    setApiKeyStatus('pending');
                }
            } else {
                // De-initialize on logout
                initializeGeminiClient('');
                setApiKeyStatus('pending');
            }
        };

        const fetchSession = async () => {
            try {
                if (!supabase) {
                    console.error("Supabase client is not available.");
                    setLoading(false);
                    return;
                }

                // Race getSession against a timeout to prevent hanging in restrictive environments.
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Session fetch timed out")), 5000) // 5-second timeout
                );

                const { data } = await (Promise.race([sessionPromise, timeoutPromise]) as Promise<{ data: { session: Session | null }, error: any }>);
                await handleAuthStateChange('INITIAL_SESSION', data.session);
            } catch (error) {
                console.error("Error or timeout fetching initial session:", error);
                // On timeout or error, assume no session is available.
                await handleAuthStateChange('INITIAL_SESSION', null);
            } finally {
                setLoading(false);
            }
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