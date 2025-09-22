import React, { useState, useEffect, useContext, useRef } from 'react';
import { motion } from 'framer-motion';
import { getPublicAssets } from '../services/databaseService.ts';
import type { UploadedAsset, ProjectState, PublicAsset } from '../types.ts';
import { IconX, IconRocket } from './Icons.tsx';
// FIX: Corrected the import path for AssetContext from the now-defunct MainDashboard.tsx to App.tsx where it is now defined.
import { AssetContext } from '../types.ts';
import Button from './Button.tsx';

interface ProjectBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadProject: (projectState: ProjectState) => void;
}

const ProjectCard: React.FC<{
    name: string;
    onClick: () => void;
}> = ({ name, onClick }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={onClick}
        className="relative group aspect-video bg-brand-light rounded-lg overflow-hidden cursor-pointer p-4 flex flex-col justify-end"
    >
        <div className="absolute inset-0 bg-brand-accent flex items-center justify-center">
            <IconRocket className="w-10 h-10 text-gray-500" />
        </div>
        <div className="relative z-10">
            <p className="text-sm font-semibold text-white truncate" title={name}>{name}</p>
        </div>
    </motion.div>
);

const ProjectBrowserModal: React.FC<ProjectBrowserModalProps> = ({ isOpen, onClose, onLoadProject }) => {
    const assetContext = useContext(AssetContext);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<'user' | 'public'>('user');
    const [publicProjects, setPublicProjects] = useState<PublicAsset[]>([]);
    const [isLoadingPublic, setIsLoadingPublic] = useState(false);
    
    const userProjects = assetContext?.assets.filter(a => a.type === 'brmp') || [];

    useEffect(() => {
        if (isOpen && activeTab === 'public' && publicProjects.length === 0) {
            setIsLoadingPublic(true);
            getPublicAssets()
                .then(assets => {
                    setPublicProjects(assets.filter(a => a.asset_type === 'brmp'));
                })
                .catch(err => console.error("Failed to load public projects:", err))
                .finally(() => setIsLoadingPublic(false));
        }
    }, [isOpen, activeTab, publicProjects.length]);

    const handleLoad = async (asset: UploadedAsset | PublicAsset) => {
        const url = 'asset_url' in asset ? asset.asset_url : asset.url;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch project file.");
            const projectJson = await response.json();
            onLoadProject(projectJson);
        } catch (err) {
            alert("Não foi possível carregar o ficheiro do projeto.");
            console.error(err);
        }
    };
    
    const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const projectJson = JSON.parse(content);
                onLoadProject(projectJson);
            } catch (err) {
                alert("Ficheiro de projeto inválido ou corrompido.");
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    const renderContent = () => {
        const isLoading = activeTab === 'public' ? isLoadingPublic : assetContext?.isLoading;
        const projects = activeTab === 'public' ? publicProjects : userProjects;

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                </div>
            );
        }
        if (projects.length === 0) {
            return (
                <div className="flex items-center justify-center h-full text-center text-gray-500">
                    <p>{activeTab === 'public' ? "Nenhum modelo de projeto público disponível." : "Você ainda não salvou nenhum projeto."}</p>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {projects.map(project => (
                    <ProjectCard key={project.id} name={project.name.replace('.brmp', '')} onClick={() => handleLoad(project)} />
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-6xl h-[90vh] relative text-white flex flex-col"
            >
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <div>
                        <h3 className="text-2xl font-bold">Carregar Projeto</h3>
                        <div className="flex items-center border-b border-brand-accent mt-2">
                            <button onClick={() => setActiveTab('user')} className={`px-4 py-2 font-semibold ${activeTab === 'user' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Meus Projetos</button>
                            <button onClick={() => setActiveTab('public')} className={`px-4 py-2 font-semibold ${activeTab === 'public' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Modelos Públicos</button>
                        </div>
                    </div>
                    <Button onClick={() => fileInputRef.current?.click()}>Carregar do Computador</Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileLoad} accept=".brmp" className="hidden" />
                </header>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-6 h-6 text-gray-300" />
                </button>
                <div className="flex-grow overflow-y-auto pr-2">{renderContent()}</div>
            </motion.div>
        </div>
    );
};

export default ProjectBrowserModal;