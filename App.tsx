import React, { useState, useEffect, useCallback, createContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, User } from '@supabase/supabase-js';
import LoginScreen from './components/LoginScreen.tsx';
import MainDashboard from './components/MainDashboard.tsx';
import ApiKeyPrompt from './components/ApiKeyPrompt.tsx';
import PendingApprovalView from './components/views/PendingApprovalView.tsx';
import { supabase } from './services/supabaseClient.ts';
import { initializeGeminiClient } from './services/geminiService.ts';
import { ThemeContext, AssetContext } from './types.ts';
import type { UserProfile, UploadedAsset, Theme, AssetContextType } from './types.ts';
import { MASTER_USERS } from './constants.ts';
import { getUserAssets, getThemeSettings } from './services/databaseService.ts';
import { initTouchEventBridge } from './utils/touchEvents.ts';
import { initializeGoogleDriveService } from './services/googleDriveService.ts';


const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme | null>(null);

    const applyTheme = (themeData: Theme) => {
        const root = document.documentElement;
        if (themeData.color_primary) root.style.setProperty('--color-primary', themeData.color_primary);
        if (themeData.color_secondary) root.style.setProperty('--color-secondary', themeData.color_secondary);
        if (themeData.color_dark) root.style.setProperty('--color-dark', themeData.color_dark);
        if (themeData.color_light) root.style.setProperty('--color-light', themeData.color_light);
        if (themeData.color_accent) root.style.setProperty('--color-accent', themeData.color_accent);
        
        if (themeData.background_image_url) {
            root.style.setProperty('--bg-image-url', `url(${themeData.background_image_url})`);
        } else {
             root.style.setProperty('--bg-image-url', 'none');
        }

        if (themeData.font_family_url && themeData.font_family_main) {
            const fontLink = document.getElementById('main-font') as HTMLLinkElement;
            if (fontLink && fontLink.href !== themeData.font_family_url) {
                fontLink.href = themeData.font_family_url;
            }
            root.style.setProperty('--font-family-main', themeData.font_family_main);
            if(themeData.font_family_handwriting) {
                 root.style.setProperty('--font-family-handwriting', themeData.font_family_handwriting);
            }
        }
        
        // Handle custom text colors
        if (themeData.color_text_base) {
            root.style.setProperty('--color-text-base-custom', themeData.color_text_base);
        } else {
            root.style.removeProperty('--color-text-base-custom');
        }
        if (themeData.color_text_muted) {
            root.style.setProperty('--color-text-muted-custom', themeData.color_text_muted);
        } else {
            root.style.removeProperty('--color-text-muted-custom');
        }
        setTheme(themeData);
    };

    const loadTheme = useCallback(async () => {
        try {
            const themeData = await getThemeSettings();
            if (themeData) {
                applyTheme(themeData);
            }
        } catch (error) {
            console.error("Failed to load theme settings:", error);
        }
    }, []);

    useEffect(() => {
        loadTheme();
    }, [loadTheme]);

    return (
        <ThemeContext.Provider value={{ theme, loadTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

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
        
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*, plan:plans(*)')
            .eq('id', user.id)
            .maybeSingle();

        if (error || !data) {
            if (error) {
                console.error("Error fetching user profile, using defaults:", error.message);
            } else {
                 console.warn(`User profile not found for ${user.id}, using default values. This is expected on first login.`);
            }

            return {
                ...user,
                id: user.id,
                email: user.email ?? '',
                role: isAdmin ? 'admin' : 'free',
                credits: 10,
                status: isAdmin ? 'active' : 'pending_approval',
                plan_id: null,
                access_expires_at: null,
                storage_used_bytes: 0,
                isAdmin,
            };
        } else {
            return {
                ...user,
                ...data, // Spread all properties from the fetched data
                id: user.id, // Ensure user.id from auth isn't overwritten
                email: user.email ?? '', // Ensure email from auth is used
                isAdmin, // Our calculated admin status
            };
        }
    }, []);

    const refetchUserProfile = useCallback(async () => {
        if (session?.user) {
            const profile = await fetchUserProfile(session.user);
            setUserProfile(profile);
        }
    }, [session, fetchUserProfile]);
    
    useEffect(() => {
        let isMounted = true;

        const processSession = async (currentSession: Session | null) => {
            try {
                if (currentSession && currentSession.user) {
                    const profile = await fetchUserProfile(currentSession.user);
                    if (!isMounted) return;

                    setSession(currentSession);
                    setUserProfile(profile);
                    
                    const keyToUse = window.localStorage.getItem('user_gemini_api_key');

                    if (keyToUse) {
                        initializeGeminiClient(keyToUse);
                        initializeGoogleDriveService(keyToUse);
                        setApiKeyStatus('set');
                    } else {
                        initializeGeminiClient('');
                        initializeGoogleDriveService('');
                        setApiKeyStatus('pending');
                    }
                } else {
                    if (!isMounted) return;
                    setSession(null);
                    setUserProfile(null);
                    initializeGeminiClient('');
                    initializeGoogleDriveService('');
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

    // Light/Dark Theme management
    useEffect(() => {
        const applyUserTheme = () => {
            const theme = localStorage.getItem('user-theme') || 'system';
            if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark-mode');
                document.documentElement.classList.remove('light-mode');
            } else {
                document.documentElement.classList.add('light-mode');
                document.documentElement.classList.remove('dark-mode');
            }
        };

        applyUserTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', applyUserTheme);
        window.addEventListener('storage', (e) => {
            if (e.key === 'user-theme') applyUserTheme();
        });

        return () => {
            mediaQuery.removeEventListener('change', applyUserTheme);
        };
    }, []);

    // Initialize the touch event polyfill once on app mount
    useEffect(() => {
        initTouchEventBridge();
    }, []);

    const handleApiKeySubmit = (apiKey: string) => {
        initializeGeminiClient(apiKey);
        initializeGoogleDriveService(apiKey);
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
        
        // Unified check for free users, pending users, and expired trials.
        // This directs them all to the upgrade/pricing page.
        if (userProfile.role === 'free' && !userProfile.isAdmin) {
             return (
                <motion.div key="upgrade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
        
        if (apiKeyStatus === 'pending') {
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
                       <MainDashboard userProfile={userProfile} refetchUserProfile={refetchUserProfile} />
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
        <ThemeProvider>
            <AnimatePresence mode="wait">
                {renderContent()}
            </AnimatePresence>
        </ThemeProvider>
    );
};

export default App;