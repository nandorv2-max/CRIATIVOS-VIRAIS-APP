import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/gotrue-js';
import { TEMPLATES } from '../constants.ts';
import { IconUser, IconLogout, IconKey, IconLogo, IconFolder, IconDownload } from './Icons.tsx';
import { supabase } from '../services/supabaseClient.ts';
import { initializeGeminiClient } from '../geminiService.ts';
import ApiKeyManagerModal from './ApiKeyManagerModal.tsx';
import type { Template, Project } from '../types.ts';
import MyProjectsModal from './MyProjectsModal.tsx';

interface SidebarProps {
    activeView: string | null;
    setActiveView: (view: string | null) => void;
    userProfile: (User & { isAdmin: boolean }) | null;
    // FIX: Added props for save/load triggers to connect sidebar actions to the active editor view.
    saveProjectTrigger: { trigger: () => void };
    loadProjectTrigger: { trigger: (project: Project) => void };
}

const NavItem: React.FC<{
    id: string;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    setActiveView: (view: string | null) => void;
    activeView: string | null;
}> = ({ id, name, icon: Icon, setActiveView, activeView }) => (
    <div className="relative group">
        <button
            onClick={() => setActiveView(id)}
            className={`relative flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ease-in-out
                ${activeView === id
                    ? 'bg-brand-primary text-white scale-110 shadow-lg'
                    : 'bg-brand-accent text-gray-200 hover:bg-brand-light hover:rounded-2xl'
                }`}
        >
            <Icon className="w-7 h-7" />
        </button>
        <div className="absolute left-full ml-4 px-3 py-1.5 bg-brand-light text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform translate-x-[-10px] group-hover:translate-x-0 duration-200">
            {name}
        </div>
    </div>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, userProfile, saveProjectTrigger, loadProjectTrigger }) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);

    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
    };
    
    const handleSaveApiKey = (apiKey: string) => {
        window.localStorage.setItem('user_gemini_api_key', apiKey);
        initializeGeminiClient(apiKey);
    };
    
    return (
        <>
            <ApiKeyManagerModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKey} />
            {/* The MyProjectsModal is triggered from here now */}
            <MyProjectsModal 
                isOpen={isProjectsModalOpen} 
                onClose={() => setIsProjectsModalOpen(false)} 
                // FIX: Implemented project loading by switching to the Creative Editor view and triggering the load function.
                onLoadProject={(project) => {
                    setActiveView('studioCriativo');
                    loadProjectTrigger.trigger(project);
                }} 
            />
            <nav className="flex flex-col items-center p-4 bg-brand-light/50 backdrop-blur-sm border-r border-brand-accent/50 space-y-5">
                 <div className="w-16 h-16">
                    <IconLogo className="w-full h-full rounded-full object-cover" />
                 </div>

                <div className="flex flex-col items-center gap-5 flex-grow">
                    <NavItem id="projects" name="Projetos" icon={IconFolder} setActiveView={setActiveView} activeView={activeView} />
                    {Object.entries(TEMPLATES).map(([key, template]) => (
                        <NavItem key={key} id={key} name={(template as Template).name} icon={(template as Template).sidebarIcon} setActiveView={setActiveView} activeView={activeView} />
                    ))}
                    {userProfile?.isAdmin && (
                         <NavItem id="admin" name="Admin" icon={IconKey} setActiveView={setActiveView} activeView={activeView} />
                    )}
                </div>
                
                <div className="relative">
                    <button 
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="w-14 h-14 rounded-full bg-brand-accent flex items-center justify-center ring-2 ring-transparent hover:ring-brand-primary transition-all overflow-hidden"
                    >
                        {userProfile?.user_metadata?.avatar_url ? (
                            <img src={userProfile.user_metadata.avatar_url} alt="User avatar" className="w-full h-full object-cover"/>
                        ) : (
                            <IconUser className="w-7 h-7 text-gray-200" />
                        )}
                    </button>
                    <AnimatePresence>
                    {isUserMenuOpen && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-brand-dark border border-brand-accent rounded-lg shadow-2xl p-2"
                        >
                             <div className="p-2 border-b border-brand-accent">
                                <p className="font-semibold text-white truncate">Logado como</p>
                                <p className="text-xs text-gray-300 truncate">{userProfile?.email ?? 'guest@email.com'}</p>
                            </div>
                             <div className="mt-1 space-y-1">
                                {!userProfile?.isAdmin && (
                                    <button onClick={() => { setIsApiKeyModalOpen(true); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-100 hover:bg-brand-light rounded-md transition-colors"><IconKey className="w-5 h-5" /><span>Gerir API Key</span></button>
                                )}
                                {/* FIX: Replaced alert with a call to the save project trigger. Button is only fully functional in the Creative Editor. */}
                                <button onClick={() => { if (activeView === 'studioCriativo') { saveProjectTrigger.trigger(); } else { alert("A funcionalidade Salvar Projeto está disponível apenas no Studio Criativo."); } setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-100 hover:bg-brand-light rounded-md transition-colors"><IconDownload className="w-5 h-5" /><span>Salvar Projeto</span></button>
                                <button onClick={() => { setIsProjectsModalOpen(true); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-100 hover:bg-brand-light rounded-md transition-colors"><IconFolder className="w-5 h-5" /><span>Meus Projetos</span></button>
                            </div>
                            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-md mt-1 border-t border-brand-accent transition-colors"><IconLogout className="w-5 h-5" /><span>Sair</span></button>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>
            </nav>
        </>
    );
};

export default Sidebar;