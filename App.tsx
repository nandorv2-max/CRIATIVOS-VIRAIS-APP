import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, User } from '@supabase/gotrue-js';
import LoginScreen from './components/LoginScreen.tsx';
import MainDashboard from './components/MainDashboard.tsx';
import ApiKeyPrompt from './components/ApiKeyPrompt.tsx';
import { supabase } from './services/supabaseClient.ts';
import { initializeGeminiClient } from './services/geminiService.ts';

const MASTER_USERS = ['helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com'];

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [userProfile, setUserProfile] = useState<(User & { isAdmin: boolean }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiKeyStatus, setApiKeyStatus] = useState<'pending' | 'prompt' | 'set'>('pending');

    const updateUserProfile = (user: User | null) => {
        if (!user) {
            setUserProfile(null);
            return;
        }
        const isAdmin = MASTER_USERS.includes(user.email ?? '');
        setUserProfile({ ...user, isAdmin });
    };

    useEffect(() => {
        const handleAuthStateChange = (_event: string, session: Session | null) => {
            setSession(session);
            updateUserProfile(session?.user ?? null);

            const isAdmin = MASTER_USERS.includes(session?.user?.email ?? '');

            if (!session) {
                setApiKeyStatus('pending');
                initializeGeminiClient(''); // De-initialize
                window.localStorage.removeItem('user_gemini_api_key');
            } else if (isAdmin) {
                const masterKey = process.env.API_KEY;
                if (masterKey) {
                    initializeGeminiClient(masterKey);
                    setApiKeyStatus('set');
                } else {
                    console.error("Master user logged in but no API_KEY found in environment.");
                    setApiKeyStatus('prompt');
                }
            } else {
                const savedKey = window.localStorage.getItem('user_gemini_api_key');
                if (savedKey) {
                    initializeGeminiClient(savedKey);
                    setApiKeyStatus('set');
                } else {
                    setApiKeyStatus('prompt');
                }
            }
        };

        const fetchSession = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }
            const { data: { session } } = await supabase.auth.getSession();
            handleAuthStateChange('INITIAL_SESSION', session);
            setLoading(false);
        };

        fetchSession();

        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
            return () => subscription.unsubscribe();
        }
    }, []);

    const handleApiKeySubmit = (key: string) => {
        initializeGeminiClient(key);
        setApiKeyStatus('set');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
            </div>
        );
    }
    
    const renderContent = () => {
        if (!session) {
            return (
                <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                    <LoginScreen />
                </motion.div>
            );
        }
        if (apiKeyStatus === 'prompt') {
            return (
                 <motion.div key="apikey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
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