import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from './Sidebar';
import WelcomeView from './views/WelcomeView';
import GeneratorView from './views/GeneratorView';
import ModalTriggerView from './views/ModalTriggerView';
import UnirView from './views/UnirView'; // Import the new view
import DownloadManager from './DownloadManager';
import { DownloadJob } from '../types';

import EditModal from './EditModal';
import ProfessionalEditorModal from './ProfessionalEditorModal';
import CreativeEditorModal from './CreativeEditorModal';
import VideoGenerator from './VideoGenerator';

interface MainDashboardProps {
    onLogout: () => void;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ onLogout }) => {
    const [activeView, setActiveView] = useState<string | null>(null);
    const [isProfessionalEditorOpen, setIsProfessionalEditorOpen] = useState(false);
    const [isCreativeEditorOpen, setIsCreativeEditorOpen] = useState(false);
    const [isVideoGeneratorOpen, setIsVideoGeneratorOpen] = useState(false);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingImageInfo, setEditingImageInfo] = useState<{imageUrl: string; index: number} | null>(null);
    const [imageForEditor, setImageForEditor] = useState<string | null>(null);
    const [professionalEditorResult, setProfessionalEditorResult] = useState<string | null>(null);
    const [downloads, setDownloads] = useState<DownloadJob[]>([]);

    useEffect(() => {
        if (activeView !== 'editor') {
            setProfessionalEditorResult(null);
        }
    }, [activeView]);

    const handleApplyEditorResult = (newImageUrl: string) => {
        setIsProfessionalEditorOpen(false);
        setImageForEditor(null);
        setProfessionalEditorResult(newImageUrl);
    };
    
    // The creative editor does not "apply" a result back to the dashboard, it handles its own downloads.
    // This handler is just for closing the modal.
    const handleCreativeEditorClose = () => {
        setIsCreativeEditorOpen(false);
    };

    const renderActiveView = () => {
        if (!activeView) {
            return <WelcomeView />;
        }
        
        const generatorViews = ['worldTour', 'cenasDoInstagram', 'cleanAndSwap'];
        if (generatorViews.includes(activeView)) {
            return <GeneratorView key={activeView} templateKey={activeView} />;
        }

        switch (activeView) {
            case 'editor':
                return <ModalTriggerView
                            title="Editor Profissional"
                            description="Inicie o editor profissional para ajustes manuais e edições com IA."
                            buttonText={professionalEditorResult ? "Editar Novamente" : "Abrir Editor"}
                            onTrigger={() => { 
                                setImageForEditor(professionalEditorResult); 
                                setIsProfessionalEditorOpen(true); 
                            }}
                            imageUrl={professionalEditorResult}
                            onClear={() => setProfessionalEditorResult(null)}
                         />;
            case 'criativoViral':
                 return <ModalTriggerView
                            title="Editor de Criativos"
                            description="Abra o editor de criativos para criar designs com fotos, vídeos e áudio."
                            buttonText="Abrir Editor de Criativos"
                            onTrigger={() => setIsCreativeEditorOpen(true)}
                         />;
            case 'video':
                 return <ModalTriggerView
                            title="Gerador de Vídeo"
                            description="Crie sequências de vídeo impressionantes a partir de uma única foto."
                            buttonText="Abrir Gerador de Vídeo"
                            onTrigger={() => setIsVideoGeneratorOpen(true)}
                         />;
            case 'unir':
                return <UnirView />;
            default:
                return <WelcomeView />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-900/50 text-gray-200">
            <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={onLogout} />
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeView}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                    >
                        {renderActiveView()}
                    </motion.div>
                </AnimatePresence>
            </main>
            
            <DownloadManager jobs={downloads} setJobs={setDownloads} />

            <ProfessionalEditorModal
                isOpen={isProfessionalEditorOpen}
                onClose={() => setIsProfessionalEditorOpen(false)}
                imageUrl={imageForEditor}
                onApply={handleApplyEditorResult}
            />
            <CreativeEditorModal
                isOpen={isCreativeEditorOpen}
                onClose={handleCreativeEditorClose}
                imageUrl={imageForEditor}
                onApply={handleCreativeEditorClose} // `onApply` is not really used here, but passing a handler is good practice
                setDownloads={setDownloads}
            />
            {isVideoGeneratorOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                     <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        className="bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl w-full max-w-7xl h-[90vh] relative"
                     >
                        <VideoGenerator />
                        <button onClick={() => setIsVideoGeneratorOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-gray-800/70 text-white hover:bg-gray-700 transition-colors z-10">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default MainDashboard;