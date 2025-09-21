import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import type { UploadedAsset, Project } from '../types.ts';
import { IconX, IconTrash, IconRocket } from './Icons.tsx';
import { AssetContext } from './MainDashboard.tsx';
import { deleteUserAsset } from '../services/databaseService.ts';


interface MyProjectsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadProject: (project: Project) => void;
}

const MyProjectsModal: React.FC<MyProjectsModalProps> = ({ isOpen, onClose, onLoadProject }) => {
    const assetContext = useContext(AssetContext);
    if (!assetContext) throw new Error("Asset context not found");

    const { assets, isLoading, refetchAssets } = assetContext;
    const projectAssets = assets.filter(a => a.type === 'brmp');
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);

    useEffect(() => {
        if (isOpen && projectAssets.length > 0) {
            setLoadingProjects(true);
            const fetchProjectJsons = async () => {
                const fetchedProjects = [];
                for (const asset of projectAssets) {
                    try {
                        const response = await fetch(asset.url);
                        if (!response.ok) continue;
                        const projectJson = await response.json();
                        fetchedProjects.push({ ...projectJson, id: asset.id });
                    } catch (e) {
                        console.error(`Failed to fetch project content for ${asset.name}`, e);
                    }
                }
                setProjects(fetchedProjects.sort((a,b) => (b.lastModified || 0) - (a.lastModified || 0)));
                setLoadingProjects(false);
            };
            fetchProjectJsons();
        } else if (isOpen) {
            setProjects([]);
            setLoadingProjects(false);
        }
    }, [isOpen, projectAssets]);


    const handleDelete = async (asset: UploadedAsset) => {
        if (window.confirm('Tem certeza que deseja apagar este projeto? Esta ação não pode ser desfeita.')) {
            await deleteUserAsset(asset);
            await refetchAssets();
        }
    };

    const handleLoad = (project: Project) => {
        onLoadProject(project);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-6xl h-[90vh] relative text-white flex flex-col"
            >
                <header className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold">Meus Projetos</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-brand-accent transition-colors">
                        <IconX className="w-6 h-6 text-gray-300" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto pr-2">
                    {isLoading || loadingProjects ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center text-gray-500">
                            <p>Você ainda não salvou nenhum projeto.<br/>Clique em "Salvar Projeto" no menu da sua conta para começar.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {projects.map(project => {
                                const asset = projectAssets.find(a => a.id === project.id);
                                return (
                                <motion.div 
                                    key={project.id} 
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative group aspect-video bg-brand-light rounded-lg overflow-hidden"
                                >
                                    {project.thumbnail ? (
                                        <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-brand-accent flex items-center justify-center"><IconRocket className="w-10 h-10 text-gray-500"/></div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                        <p className="text-sm font-semibold text-white truncate" title={project.name}>{project.name}</p>
                                        <p className="text-xs text-gray-400">{new Date(project.lastModified).toLocaleDateString()}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <button onClick={() => handleLoad(project)} className="flex-1 text-xs bg-brand-primary/80 text-white p-1.5 rounded hover:bg-brand-primary backdrop-blur-sm">Carregar</button>
                                            <button onClick={() => asset && handleDelete(asset)} className="p-1.5 bg-red-600/80 text-white rounded hover:bg-red-500 backdrop-blur-sm"><IconTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </motion.div>
                            )})}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default MyProjectsModal;