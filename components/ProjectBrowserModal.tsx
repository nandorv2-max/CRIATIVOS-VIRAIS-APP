import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPublicProjects, createSignedUrlForPath, getUserAssets, adminDeletePublicProject, adminUpdatePublicProject, adminGetPublicProjectCategories, getPublicProjectCategoriesForUser } from '../../services/databaseService.ts';
import type { UploadedAsset, ProjectState, PublicProject, UserProfile, PublicProjectCategory } from '../../types.ts';
import type { User } from '@supabase/gotrue-js';
import { IconX, IconRocket, IconOptions, IconEdit, IconTrash } from './Icons.tsx';
import Button from './Button.tsx';
import EditAssetModal from './EditAssetModal.tsx';

interface ProjectBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadProject: (projectState: ProjectState) => void;
    userProfile: (User & UserProfile & { isAdmin: boolean; }) | null;
}

const ProjectCard: React.FC<{
    asset: PublicProject | UploadedAsset;
    onClick: () => void;
    isAdmin: boolean;
    onEdit: () => void;
    onDelete: () => void;
    openMenuId: string | null;
    setOpenMenuId: (id: string | null) => void;
}> = ({ asset, onClick, isAdmin, onEdit, onDelete, openMenuId, setOpenMenuId }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const name = asset.name.replace('.brmp', '');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId === asset.id) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openMenuId, asset.id, setOpenMenuId]);

    return (
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

            {isAdmin && 'visibility' in asset && ( // Admin options only for public projects
                <div className="absolute top-2 right-2 z-20 pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === asset.id ? null : asset.id);
                        }}
                        className="p-1.5 bg-black/40 text-gray-200 rounded-full backdrop-blur-sm hover:bg-brand-primary/80 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                    >
                        <IconOptions className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                        {openMenuId === asset.id && (
                            <motion.div
                                ref={menuRef}
                                initial={{ opacity: 0, y: -5, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -5, scale: 0.9 }}
                                className="absolute top-full right-0 mt-1 w-40 bg-brand-dark rounded-md shadow-2xl p-1 border border-brand-accent/50"
                            >
                                <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-brand-light">
                                    <IconEdit className="w-4 h-4" /> Editar
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded text-red-400 hover:bg-red-500/10">
                                    <IconTrash className="w-4 h-4" /> Apagar
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
};


const ProjectBrowserModal: React.FC<ProjectBrowserModalProps> = ({ isOpen, onClose, onLoadProject, userProfile }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'public' | 'user'>('public');
    
    const [publicProjects, setPublicProjects] = useState<PublicProject[]>([]);
    const [isLoadingPublic, setIsLoadingPublic] = useState(false);

    const [userProjects, setUserProjects] = useState<UploadedAsset[]>([]);
    const [isLoadingUser, setIsLoadingUser] = useState(false);
    
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingAsset, setEditingAsset] = useState<PublicProject | null>(null);
    const [projectCategories, setProjectCategories] = useState<PublicProjectCategory[]>([]);


    useEffect(() => {
        if (!isOpen) return;

        if (activeTab === 'public') {
            setIsLoadingPublic(true);
            Promise.all([
                getPublicProjects(),
                userProfile?.isAdmin ? adminGetPublicProjectCategories() : getPublicProjectCategoriesForUser()
            ]).then(([projects, categories]) => {
                setPublicProjects(projects);
                setProjectCategories(categories as any);
            }).catch(err => console.error("Failed to load public projects/categories:", err))
            .finally(() => setIsLoadingPublic(false));
        } else if (activeTab === 'user') {
            setIsLoadingUser(true);
            getUserAssets()
                .then(assets => {
                    setUserProjects(assets.filter(a => a.type === 'brmp'));
                })
                .catch(err => console.error("Failed to load user projects:", err))
                .finally(() => setIsLoadingUser(false));
        }
    }, [isOpen, activeTab, userProfile?.isAdmin]);

    const handleLoad = async (asset: UploadedAsset | PublicProject) => {
        let projectUrl: string;
        try {
             if ('asset_url' in asset) { // PublicProject
                projectUrl = asset.asset_url;
            } else { // UploadedAsset
                projectUrl = await createSignedUrlForPath(asset.storage_path);
            }

            const response = await fetch(projectUrl);
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
    
    const handleDeletePublicProject = async (asset: PublicProject) => {
        setOpenMenuId(null);
        if (window.confirm(`Tem a certeza que quer apagar o modelo "${asset.name}"?`)) {
            try {
                await adminDeletePublicProject(asset.id);
                setPublicProjects(prev => prev.filter(p => p.id !== asset.id));
            } catch (err) {
                alert('Falha ao apagar o modelo.');
                console.error(err);
            }
        }
    };
    
    const handleSaveAsset = async (assetId: string, newName: string, newCategoryId: string | null) => {
        try {
            await adminUpdatePublicProject(assetId, newName, newCategoryId);
            setEditingAsset(null);
            setPublicProjects(prev => prev.map(p => 
                p.id === assetId ? { ...p, name: newName, category_id: newCategoryId } : p
            ));
        } catch (err) {
            alert('Falha ao atualizar o modelo.');
            console.error(err);
        }
    };


    if (!isOpen) return null;

    const renderContent = () => {
        const isLoading = activeTab === 'public' ? isLoadingPublic : isLoadingUser;
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
                    <ProjectCard 
                        key={project.id} 
                        asset={project}
                        onClick={() => handleLoad(project)}
                        isAdmin={userProfile?.isAdmin ?? false}
                        onEdit={() => setEditingAsset(project as PublicProject)}
                        onDelete={() => handleDeletePublicProject(project as PublicProject)}
                        openMenuId={openMenuId}
                        setOpenMenuId={setOpenMenuId}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <EditAssetModal 
                asset={editingAsset}
                isOpen={!!editingAsset}
                onClose={() => setEditingAsset(null)}
                onSave={handleSaveAsset}
                categories={projectCategories as any}
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-6xl h-[90vh] relative text-white flex flex-col"
            >
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <div>
                        <h3 className="text-2xl font-bold">Carregar Projeto</h3>
                        <div className="flex items-center border-b border-brand-accent mt-2">
                            <button onClick={() => setActiveTab('public')} className={`px-4 py-2 font-semibold ${activeTab === 'public' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Modelos Públicos</button>
                            <button onClick={() => setActiveTab('user')} className={`px-4 py-2 font-semibold ${activeTab === 'user' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Meus Projetos</button>
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