import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, User } from '@supabase/gotrue-js';
import LoginScreen from './components/LoginScreen.tsx';
import MainDashboard from './components/MainDashboard.tsx';
import ApiKeyPrompt from './components/ApiKeyPrompt.tsx';
import PendingApprovalView from './components/views/PendingApprovalView.tsx';
import { supabase } from './services/supabaseClient.ts';
import { initializeGeminiClient } from './services/geminiService.ts';
import type { UserProfile, UploadedAsset } from './types.ts';
import { MASTER_USERS } from './constants.ts';
import { getUserAssets } from './services/databaseService.ts';
import { AssetContext, AssetContextType } from './types.ts';


const AssetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [assets, setAssets] = useState<UploadedAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requiresSetup, setRequiresSetup] = useState(false);

    const fetchAssets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setRequiresSetup(false);
        try {
            const userAssets = await getUserAssets();
            setAssets(userAssets);
        } catch (err: any) {
            if (err.message?.startsWith('USER_ASSETS_SETUP_REQUIRED')) {
                setRequiresSetup(true);
                setError(err.message);
            } else {
                setError("Falha ao carregar os seus recursos.");
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAssets();
    }, [fetchAssets]);

    const value: AssetContextType = { assets, setAssets, isLoading, error, requiresSetup, refetchAssets: fetchAssets };

    return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
};

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [userProfile, setUserProfile] = useState<(User & UserProfile & { isAdmin: boolean }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiKeyStatus, setApiKeyStatus] = useState<'pending' | 'set' | 'error'>('pending');

    const fetchUserProfile = useCallback(async (user: User): Promise<(User & UserProfile & { isAdmin: boolean })> => {
        const isAdmin = MASTER_USERS.includes(user.email ?? '');
        
        const { data, error } = await supabase.from('user_profiles').select('role, credits, status, plan_id').eq('id', user.id).single();

        if (error) {
            console.error("Error fetching user profile, using defaults:", error.message);
            // This fallback may not be perfect but prevents a crash if the profile is missing post-signup.
            return {
                ...user,
                id: user.id,
                email: user.email ?? '',
                role: isAdmin ? 'admin' : 'starter',
                credits: 10,
                status: isAdmin ? 'active' : 'pending_approval',
                plan_id: null,
                isAdmin,
            };
        } else {
            return {
                ...user,
                id: user.id,
                email: user.email ?? '',
                role: data.role,
                credits: data.credits,
                status: data.status,
                plan_id: data.plan_id,
                isAdmin,
            };
        }
    }, []);
    
    useEffect(() => {
        let isMounted = true;

        const processSession = async (currentSession: Session | null) => {
            try {
                if (currentSession && currentSession.user) {
                    const profile = await fetchUserProfile(currentSession.user);
                    if (!isMounted) return;

                    setSession(currentSession);
                    setUserProfile(profile);

                    let keyToUse = window.localStorage.getItem('user_gemini_api_key');
                    if (!keyToUse && profile.isAdmin) {
                        keyToUse = process.env.API_KEY as string;
                        if (!keyToUse) {
                            console.error("FATAL ERROR: Master API_KEY is not configured for admin user.");
                            setApiKeyStatus('error');
                            return;
                        }
                    }

                    if (keyToUse) {
                        initializeGeminiClient(keyToUse);
                        setApiKeyStatus('set');
                    } else {
                        initializeGeminiClient('');
                        setApiKeyStatus('pending');
                    }
                } else {
                    if (!isMounted) return;
                    setSession(null);
                    setUserProfile(null);
                    initializeGeminiClient('');
                    setApiKeyStatus('pending');
                }
            } catch (error) {
                console.error("Error processing session:", error);
                if (isMounted) {
                    setSession(null);
                    setUserProfile(null);
                    setApiKeyStatus('error');
                }
            }
        };

        // First, check for an existing session to handle the initial page load.
        supabase.auth.getSession().then(({ data: { session } }) => {
            processSession(session).finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });
        });

        // Then, listen for any auth changes (login, logout) during the session.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (isMounted) {
                    processSession(session);
                }
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [fetchUserProfile]);

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
    
        if (!session || !userProfile) {
            return (
                <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                    <LoginScreen />
                </motion.div>
            );
        }
        
        if (userProfile.status === 'pending_approval' && !userProfile.isAdmin) {
             return (
                <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <PendingApprovalView />
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
        
        if (apiKeyStatus === 'pending' && !userProfile.isAdmin) {
             return (
                 <motion.div key="apikey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ApiKeyPrompt onApiKeySubmit={handleApiKeySubmit} />
                </motion.div>
            );
        }

        if (apiKeyStatus === 'set') {
            return (
                 <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                    <AssetProvider>
                       <MainDashboard userProfile={userProfile} />
                    </AssetProvider>
                </motion.div>
            );
        }

        return (
             <div key="fallback" className="min-h-screen flex items-center justify-center bg-brand-dark">
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