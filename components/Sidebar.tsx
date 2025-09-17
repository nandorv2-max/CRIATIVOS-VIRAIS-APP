import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEMPLATES } from '../constants';
import { IconUser, IconLogout } from './Icons';

interface SidebarProps {
    activeView: string | null;
    setActiveView: (view: string | null) => void;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onLogout }) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const NavItem = ({ id, name, icon: Icon }: { id: string, name: string, icon: React.FC<{className?: string}> }) => (
        <div className="relative group">
            <button
                onClick={() => setActiveView(id)}
                className={`relative flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ease-in-out
                    ${activeView === id
                        ? 'bg-yellow-400 text-black scale-110 shadow-lg'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:rounded-2xl'
                    }`}
            >
                <Icon className="w-7 h-7" />
            </button>
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform translate-x-[-10px] group-hover:translate-x-0 duration-200">
                {name}
            </div>
        </div>
    );
    
    return (
        <nav className="flex flex-col items-center p-4 bg-gray-800/50 backdrop-blur-sm border-r border-gray-700/50 space-y-5">
             <div className="font-caveat text-4xl text-yellow-400">BR</div>

            <div className="flex flex-col items-center gap-5 flex-grow">
                {Object.entries(TEMPLATES).map(([key, template]) => (
                    <NavItem key={key} id={key} name={template.name} icon={template.sidebarIcon} />
                ))}
            </div>
            
            <div className="relative">
                <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center ring-2 ring-transparent hover:ring-yellow-400 transition-all"
                >
                    <IconUser className="w-7 h-7 text-gray-300" />
                </button>
                <AnimatePresence>
                {isUserMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2"
                    >
                         <div className="p-2 border-b border-gray-700">
                            <p className="font-semibold text-white">Usuário Convidado</p>
                            <p className="text-xs text-gray-400">guest@email.com</p>
                        </div>
                        <button 
                            onClick={onLogout}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-md mt-1 transition-colors"
                        >
                            <IconLogout className="w-5 h-5" />
                            <span>Sair</span>
                        </button>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
        </nav>
    );
};

export default Sidebar;