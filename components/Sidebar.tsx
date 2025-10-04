import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/gotrue-js';
import { TEMPLATES } from '../constants.ts';
import { IconUser, IconLogout, IconKey, IconLogo, IconFolder, IconX, IconPalette, IconHome } from './Icons.tsx';
import { supabase } from '../services/supabaseClient.ts';
import { initializeGeminiClient } from '../services/geminiService.ts';
import type { Template, UserProfile } from '../types.ts';
import { ThemeContext } from '../types.ts';

interface SidebarProps {
    activeView: string | null;
    setActiveView: (view: string | null) => void;
    userProfile: (User & UserProfile & { isAdmin: boolean }) | null;
    isMobile?: boolean;
    onClose?: () => void;
}

const NavItem: React.FC<{
    id: string;
    template: Template;
    setActiveView: (view: string | null) => void;
    activeView: string | null;
}> = ({ id, template, setActiveView, activeView }) => {
    const themeContext = useContext(ThemeContext);
    const customIconData = themeContext?.theme?.module_icons?.[id];
    const DefaultIcon = template.sidebarIcon;

    const renderIcon = () => {
        const iconProps = {
            className: "w-7 h-7",
            style: { color: customIconData?.color }
        };

        if (customIconData?.svg_content) {
            // This is a simplified SVG renderer. It might not handle all SVG features.
            // It replaces fill/stroke with the custom color or defaults to 'currentColor'.
            const processedSvg = customIconData.svg_content
                .replace(/width=".*?"/, `width="100%"`)
                .replace(/height=".*?"/, `height="100%"`)
                .replace(/fill=".*?"/g, `fill="${customIconData.color || 'currentColor'}"`)
                .replace(/stroke=".*?"/g, `stroke="${customIconData.color || 'currentColor'}"`);

            return (
                <div
                    className="w-7 h-7"
                    dangerouslySetInnerHTML={{ __html: processedSvg }}
                />
            );
        }
        return <DefaultIcon {...iconProps} />;
    };

    return (
        <div className="relative group">
            <button
                onClick={() => setActiveView(id)}
                className={`relative flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ease-in-out
                ${activeView === id
                        ? 'bg-brand-primary text-white scale-110 shadow-lg'
                        : 'bg-brand-accent text-gray-200 hover:bg-brand-light hover:rounded-2xl'
                    }`}
            >
                {renderIcon()}
            </button>
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-brand-light text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform translate-x-[-10px] group-hover:translate-x-0 duration-200">
                {template.name}
            </div>
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, userProfile, isMobile, onClose }) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userButtonRef = useRef<HTMLButtonElement>(null);

    const availableTemplates = useMemo(() => {
        if (userProfile?.isAdmin) {
            return TEMPLATES; // Admins see everything
        }
        if (!userProfile?.features) {
            return {}; // No features, show nothing
        }
        return Object.fromEntries(
            Object.entries(TEMPLATES).filter(([key]) => userProfile.features!.includes(key))
        );
    }, [userProfile]);

    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userButtonRef.current && !userButtonRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    return (
        <>
            <nav className="relative z-30 flex flex-col items-center p-4 bg-brand-light/50 backdrop-blur-sm border-r border-brand-accent/50 h-full">
                 <div className="flex-shrink-0 w-full flex items-center justify-between">
                    <div className="w-16 h-16">
                       <IconLogo className="w-full h-full rounded-full object-cover" />
                    </div>
                     {isMobile && onClose && (
                        <button onClick={onClose} className="p-2 -mr-2 text-gray-300 hover:text-white">
                           <IconX className="w-6 h-6"/>
                        </button>
                    )}
                 </div>

                <div className="custom-sidebar-scroll flex flex-col items-center gap-5 flex-grow overflow-y-auto overflow-x-hidden min-h-0 w-full pt-5">
                    <NavItem id="home" template={{ name: 'Início', sidebarIcon: IconHome } as any} setActiveView={setActiveView} activeView={activeView} />
                    <NavItem id="projects" template={{ name: 'Projetos', sidebarIcon: IconFolder } as any} setActiveView={setActiveView} activeView={activeView} />
                    {Object.entries(availableTemplates).map(([key, template]) => (
                        <NavItem key={key} id={key} template={template as Template} setActiveView={setActiveView} activeView={activeView} />
                    ))}
                </div>
                
                <div className="relative">
                    <button 
                        ref={userButtonRef}
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
                            className="absolute bottom-4 left-full ml-3 w-64 bg-brand-dark border border-brand-accent rounded-lg shadow-2xl p-2"
                        >
                             <div className="p-2 border-b border-brand-accent">
                                <p className="font-semibold text-white truncate">{userProfile?.user_metadata?.name || 'Minha Conta'}</p>
                                <p className="text-xs text-gray-300 truncate">{userProfile?.email ?? 'guest@email.com'}</p>
                            </div>
                             <div className="mt-1 space-y-1">
                                <button onClick={() => { setActiveView('home'); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-100 hover:bg-brand-light rounded-md transition-colors"><IconHome className="w-5 h-5" /><span>Dashboard</span></button>
                                <button onClick={() => { setActiveView('settings'); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-100 hover:bg-brand-light rounded-md transition-colors"><IconUser className="w-5 h-5" /><span>Configurações</span></button>
                                {userProfile?.isAdmin && (
                                    <>
                                        <button onClick={() => { setActiveView('admin'); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-100 hover:bg-brand-light rounded-md transition-colors"><IconKey className="w-5 h-5" /><span>Administração</span></button>
                                        <button onClick={() => { setActiveView('personalizacao'); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-100 hover:bg-brand-light rounded-md transition-colors"><IconPalette className="w-5 h-5" /><span>Personalização</span></button>
                                    </>
                                )}
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