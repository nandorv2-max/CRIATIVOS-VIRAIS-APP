import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconPlus } from '../Icons.tsx';

interface ProjectsViewProps {
    setActiveView: (view: string) => void;
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ setActiveView }) => {
    const [activeTab, setActiveTab] = useState('all');

    return (
        <div className="h-full w-full flex flex-col p-8 bg-gray-900 text-white">
            <header className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <select className="bg-brand-light border border-brand-accent rounded-md px-3 py-2 text-sm">
                        <option>Titular</option>
                    </select>
                    <select className="bg-brand-light border border-brand-accent rounded-md px-3 py-2 text-sm">
                        <option>Categoria</option>
                    </select>
                    <select className="bg-brand-light border border-brand-accent rounded-md px-3 py-2 text-sm">
                        <option>Data de edição</option>
                    </select>
                </div>
                <button
                    onClick={() => setActiveView('criativoViral')}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors"
                >
                    <IconPlus className="w-5 h-5" />
                    <span>Adicionar</span>
                </button>
            </header>

            <nav className="flex items-center border-b border-brand-accent mb-6">
                <button onClick={() => setActiveTab('all')} className={`px-4 py-2 font-semibold ${activeTab === 'all' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Todos</button>
                <button onClick={() => setActiveTab('folders')} className={`px-4 py-2 font-semibold ${activeTab === 'folders' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Pastas</button>
                <button onClick={() => setActiveTab('designs')} className={`px-4 py-2 font-semibold ${activeTab === 'designs' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Designs</button>
                <button onClick={() => setActiveTab('images')} className={`px-4 py-2 font-semibold ${activeTab === 'images' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Imagens</button>
                <button onClick={() => setActiveTab('videos')} className={`px-4 py-2 font-semibold ${activeTab === 'videos' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Vídeos</button>
            </nav>

            <div className="flex-grow overflow-y-auto pr-2">
                <section>
                    <h2 className="text-xl font-bold mb-4">Designs recentes</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                         <div className="aspect-[3/4] bg-brand-light rounded-lg flex items-center justify-center text-gray-500">
                            <p>Projeto em branco</p>
                        </div>
                    </div>
                </section>
                
                <section className="mt-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">&gt; Pastas</h2>
                    <p className="text-gray-500 text-sm">Você ainda não criou nenhuma pasta.</p>
                </section>

                 <section className="mt-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">&gt; Designs</h2>
                    <p className="text-gray-500 text-sm">Nenhum design encontrado.</p>
                </section>
            </div>
        </div>
    );
};

export default ProjectsView;
