import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from '@supabase/gotrue-js';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar.tsx';
import DashboardView from './views/DashboardView.tsx';
import ProjectsView from './views/ProjectsView.tsx';
import GeneratorView from './views/GeneratorView.tsx';
import ImageGeneratorView from './views/ImageGeneratorView.tsx';
import MockupGeneratorView from './views/MockupGeneratorView.tsx';
import ProductStudioView from './views/ProductStudioView.tsx';
import CreativeEditorView from './views/CreativeEditorView.tsx';
import UnirView from './views/UnirView.tsx';
import VideoGenerator from './VideoGenerator.tsx';
import ProfessionalEditorView from './views/ProfessionalEditorView.tsx';
import AdminView from './views/AdminView.tsx';
import ThemeCustomizationView from './views/ThemeCustomizationView.tsx';
import PendingApprovalView from './views/PendingApprovalView.tsx';
import SettingsView from './views/SettingsView.tsx'; // Import the new SettingsView
import SceneRecreatorView from './views/SceneRecreatorView.tsx';
import type { UserProfile } from '../types.ts';
import { TEMPLATES } from '../constants.ts';


interface MainDashboardProps {
    userProfile: (User & UserProfile & { isAdmin: boolean; }) | null;
    refetchUserProfile: () => void;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ userProfile, refetchUserProfile }) => {
    const [activeView, setActiveView] = useState<string>('home');
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

    const handleSetActiveView = useCallback((view: string | null) => {
        if (view) {
            setActiveView(view);
            if (isMobileView) {
                setIsSidebarOpen(false); // Close sidebar on mobile after selection
            }
        }
    }, [isMobileView]);

    const availableViewComponents = useMemo(() => {
        const allViews: { [key: string]: React.ReactNode } = {
            home: <DashboardView userProfile={userProfile} setActiveView={handleSetActiveView} />,
            settings: <SettingsView userProfile={userProfile} refetchUserProfile={refetchUserProfile} setActiveView={handleSetActiveView} />,
            upgrade: <PendingApprovalView showLogout={false} />,
            projects: <ProjectsView />,
            admin: <AdminView />,
            personalizacao: <ThemeCustomizationView />,
            imageGenerator: <ImageGeneratorView />,
            mockupGenerator: <MockupGeneratorView />,
            productStudio: <ProductStudioView />,
            studioCriativo: <CreativeEditorView userProfile={userProfile} />,
            video: <VideoGenerator userProfile={userProfile!} refetchUserProfile={refetchUserProfile} />,
            cenasDoInstagram: <GeneratorView templateKey="cenasDoInstagram" userProfile={userProfile} />,
            worldTour: <GeneratorView templateKey="worldTour" userProfile={userProfile} />,
            editor: <ProfessionalEditorView />,
            cleanAndSwap: <GeneratorView templateKey="cleanAndSwap" userProfile={userProfile} />,
            unir: <UnirView />,
            sceneRecreator: <SceneRecreatorView />,
        };

        const allowedKeys = new Set<string>(['home', 'settings', 'upgrade', 'projects']);
        if (userProfile?.isAdmin) {
            allowedKeys.add('admin');
            allowedKeys.add('personalizacao');
            Object.keys(TEMPLATES).forEach(key => allowedKeys.add(key));
        } else if (userProfile?.features) {
            userProfile.features.forEach(key => allowedKeys.add(key));
        }

        return Object.fromEntries(
            Object.entries(allViews).filter(([key]) => allowedKeys.has(key))
        );
    }, [userProfile, handleSetActiveView, refetchUserProfile]);


    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const viewFromUrl = urlParams.get('view');
        if (viewFromUrl && availableViewComponents.hasOwnProperty(viewFromUrl)) {
            setActiveView(viewFromUrl);
        } else if (viewFromUrl) {
            // If view from URL is not available, default to home
            setActiveView('home');
        }
    }, [availableViewComponents]);


    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobileView(mobile);
            // Sidebar is always open on desktop, closed by default on mobile
            setIsSidebarOpen(!mobile);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex h-screen bg-brand-dark text-white font-sans">
             {/* Mobile overlay */}
            <AnimatePresence>
                {isSidebarOpen && isMobileView && (
                    <motion.div
                        key="sidebar-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 z-20 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar for Mobile */}
            <AnimatePresence>
                {isMobileView && isSidebarOpen && (
                    <motion.div
                        key="mobile-sidebar"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                        className="fixed top-0 left-0 h-full z-30"
                    >
                        <Sidebar 
                            activeView={activeView} 
                            setActiveView={handleSetActiveView}
                            userProfile={userProfile}
                            isMobile={true}
                            onClose={() => setIsSidebarOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

             {/* Sidebar for Desktop */}
            {!isMobileView && (
                <Sidebar 
                    activeView={activeView} 
                    setActiveView={handleSetActiveView}
                    userProfile={userProfile}
                    isMobile={false}
                />
            )}
            
            <main className="flex-1 overflow-auto relative">
                {isMobileView && (
                     <div className="sticky top-0 p-4 bg-brand-dark/80 backdrop-blur-sm z-10 flex items-center md:hidden">
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-white"
                            aria-label="Abrir menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                )}
                {Object.entries(availableViewComponents).map(([key, Component]) => (
                    <div key={key} hidden={activeView !== key} className={`h-full w-full`}>
                        {Component}
                    </div>
                ))}
            </main>
        </div>
    );
};

export default MainDashboard;