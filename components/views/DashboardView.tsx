import React, { useContext, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UploadedAsset, UserProfile } from '../../types.ts';
import { TEMPLATES } from '../../constants.ts';
import { ThemeContext } from '../../types.ts';
import { AssetContext } from '../../types.ts';
import { IconChevronDown, IconX } from '../Icons.tsx';

interface DashboardViewProps {
    userProfile: UserProfile | null;
    setActiveView: (view: string) => void;
}

const ModuleCard: React.FC<{
    id: string;
    template: (typeof TEMPLATES)[string];
    onClick: (id: string) => void;
    isFeatured?: boolean;
}> = ({ id, template, onClick, isFeatured }) => {
    const themeContext = useContext(ThemeContext);
    const customIconData = themeContext?.theme?.module_icons?.[id];
    const DefaultIcon = template.sidebarIcon;

    const renderIcon = () => {
        const iconClassName = isFeatured ? "w-7 h-7" : "w-6 h-6";
        const iconStyle = { color: customIconData?.color };

        if (customIconData?.svg_content) {
            const processedSvg = customIconData.svg_content
                .replace(/width=".*?"/, `width="100%"`)
                .replace(/height=".*?"/, `height="100%"`)
                .replace(/fill=".*?"/g, `fill="${customIconData.color || 'currentColor'}"`)
                .replace(/stroke=".*?"/g, `stroke="${customIconData.color || 'currentColor'}"`);

            return (
                <div
                    className={iconClassName}
                    style={{ color: customIconData?.color || 'var(--color-primary)' }}
                    dangerouslySetInnerHTML={{ __html: processedSvg }}
                />
            );
        }
        return <DefaultIcon className={iconClassName} style={iconStyle} />;
    };

    const iconContainerClass = isFeatured
        ? "w-12 h-12 bg-brand-primary/20 text-brand-primary rounded-lg flex items-center justify-center mb-4"
        : "w-10 h-10 bg-brand-primary/20 text-brand-primary rounded-lg flex items-center justify-center flex-shrink-0";
    
    // Updated padding and min-height for featured cards
    const cardBaseClass = "cursor-pointer bg-brand-light/50 border border-brand-accent/50 rounded-xl p-4 flex";

    if (isFeatured) {
        return (
            <motion.div
                whileHover={{ y: -5, transition: { type: 'spring', stiffness: 300 } }}
                onClick={() => onClick(id)}
                className={`${cardBaseClass} flex-col items-start justify-between min-h-[180px]`} // Adjusted min-height
            >
                <div>
                    <div className={iconContainerClass}>
                        {renderIcon()}
                    </div>
                    <h3 className="text-lg font-bold text-white">{template.name}</h3>
                </div>
                <p className="text-sm text-gray-400 mt-2">{template.description}</p>
            </motion.div>
        );
    }
    
    return (
         <motion.div
            whileHover={{ y: -5, transition: { type: 'spring', stiffness: 300 } }}
            onClick={() => onClick(id)}
            className={`${cardBaseClass} flex-row items-center gap-4`}
        >
            <div className={iconContainerClass}>
                {renderIcon()}
            </div>
            <div>
                <h3 className="text-md font-bold text-white">{template.name}</h3>
                <p className="text-xs text-gray-400">{template.description}</p>
            </div>
        </motion.div>
    );
};

const RecentAssetCard: React.FC<{ asset: UploadedAsset, onClick: () => void }> = ({ asset, onClick }) => {
    return (
        <motion.div
            onClick={onClick}
            className="flex-shrink-0 w-48 aspect-square cursor-pointer bg-brand-light rounded-xl overflow-hidden relative group"
            whileHover={{ scale: 1.05 }}
        >
            <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
            <p className="absolute bottom-2 left-3 right-3 text-white text-xs font-semibold truncate">{asset.name}</p>
        </motion.div>
    );
};

const DashboardView: React.FC<DashboardViewProps> = ({ userProfile, setActiveView }) => {
    const themeContext = useContext(ThemeContext);
    const assetContext = useContext(AssetContext);
    const [showAnnouncement, setShowAnnouncement] = useState(false);
    
    const announcementChecked = useRef(false);

    useEffect(() => {
        if (themeContext?.theme && !announcementChecked.current) {
            const announcementText = themeContext.theme.announcement_text;
            const announcementActive = themeContext.theme.announcement_active;
            const dismissed = localStorage.getItem('dismissed-announcement') === announcementText;

            if (announcementActive && announcementText && !dismissed) {
                setShowAnnouncement(true);
            }
            announcementChecked.current = true;
        }
    }, [themeContext?.theme]);

    const handleDismissAnnouncement = () => {
        if (themeContext?.theme?.announcement_text) {
            localStorage.setItem('dismissed-announcement', themeContext.theme.announcement_text);
        }
        setShowAnnouncement(false);
    };
    
    const userName = userProfile?.user_metadata?.name || userProfile?.email?.split('@')[0] || 'Criador';
    
    const recentAssets = (assetContext?.assets || [])
        .filter(asset => ['image', 'video'].includes(asset.type))
        .slice(0, 10);

    const mainTools = {
        imageGenerator: TEMPLATES.imageGenerator,
        cenasDoInstagram: TEMPLATES.cenasDoInstagram,
        editor: TEMPLATES.editor,
        studioCriativo: TEMPLATES.studioCriativo,
    };
    
    const otherTools = Object.fromEntries(
        Object.entries(TEMPLATES).filter(([key]) => !mainTools.hasOwnProperty(key))
    );
    
    const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(false);

    return (
        <div className="w-full p-6 md:p-8">
            <AnimatePresence>
                {showAnnouncement && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -20, height: 0 }}
                        className="mb-6 p-4 bg-brand-primary/20 border border-brand-primary rounded-lg text-center flex items-center justify-between gap-4"
                    >
                        <p className="font-semibold text-brand-secondary-light flex-grow">{themeContext?.theme?.announcement_text}</p>
                        <button onClick={handleDismissAnnouncement} className="p-1 rounded-full hover:bg-brand-primary/30 flex-shrink-0">
                            <IconX className="w-5 h-5"/>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-12"
            >
                <header>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">Bem-vindo de volta, {userName}!</h1>
                    <p className="mt-2 text-lg text-gray-300">O que vamos criar hoje?</p>
                </header>

                <main className="space-y-12">
                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-6">Comece a Criar</h2>
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            {Object.entries(mainTools).map(([key, template]) => (
                                <ModuleCard key={key} id={key} template={template} onClick={setActiveView} isFeatured={true} />
                            ))}
                        </div>
                    </section>
                    
                    {recentAssets.length > 0 && (
                        <section>
                             <h2 className="text-2xl font-semibold text-white mb-6">Suas Criações Recentes</h2>
                             <div className="flex space-x-4 overflow-x-auto pb-4">
                                {recentAssets.map(asset => (
                                    <RecentAssetCard key={asset.id} asset={asset} onClick={() => setActiveView('projects')} />
                                ))}
                             </div>
                        </section>
                    )}

                    <section>
                        <div 
                            onClick={() => setIsMoreToolsOpen(!isMoreToolsOpen)}
                            className="flex justify-between items-center cursor-pointer mb-6"
                        >
                            <h2 className="text-2xl font-semibold text-white">Mais Ferramentas</h2>
                            <IconChevronDown className={`w-6 h-6 transition-transform ${isMoreToolsOpen ? 'rotate-180' : ''}`} />
                        </div>
                        <AnimatePresence>
                        {isMoreToolsOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                    {Object.entries(otherTools).map(([key, template]) => (
                                        <ModuleCard key={key} id={key} template={template} onClick={setActiveView} />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </section>
                </main>
            </motion.div>
        </div>
    );
};

export default DashboardView;