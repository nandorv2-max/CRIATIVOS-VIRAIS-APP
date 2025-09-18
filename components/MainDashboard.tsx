import React, { useState, useCallback } from 'react';
import type { User } from '@supabase/gotrue-js';
import Sidebar from './Sidebar.tsx';
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
import type { Project } from '../types.ts';


interface MainDashboardProps {
    userProfile: (User & { isAdmin: boolean }) | null;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ userProfile }) => {
    const [activeView, setActiveView] = useState<string>('projects');
    // FIX: Added state to hold the save and load trigger functions from the CreativeEditorView, to be passed to the Sidebar.
    const [saveProjectTrigger, setSaveProjectTrigger] = useState<{ trigger: () => void }>({ trigger: () => console.warn('Save trigger not initialized') });
    const [loadProjectTrigger, setLoadProjectTrigger] = useState<{ trigger: (project: Project) => void }>({ trigger: () => console.warn('Load trigger not initialized') });

    const viewComponents: { [key: string]: React.ComponentType<any> } = {
        projects: () => <ProjectsView setActiveView={setActiveView} />,
        admin: AdminView,
        imageGenerator: ImageGeneratorView,
        mockupGenerator: MockupGeneratorView,
        productStudio: ProductStudioView,
        // FIX: Passed the `setSaveProjectTrigger` and `setLoadProjectTrigger` props to `CreativeEditorView` to satisfy its required props and enable project saving/loading functionality.
        criativoViral: () => <CreativeEditorView setSaveProjectTrigger={setSaveProjectTrigger} setLoadProjectTrigger={setLoadProjectTrigger} />,
        video: VideoGenerator,
        cenasDoInstagram: () => <GeneratorView templateKey="cenasDoInstagram" />,
        worldTour: () => <GeneratorView templateKey="worldTour" />,
        editor: ProfessionalEditorView,
        cleanAndSwap: () => <GeneratorView templateKey="cleanAndSwap" />,
        unir: UnirView,
    };

    const renderActiveView = () => {
        const ViewComponent = viewComponents[activeView] || viewComponents.projects;
        return <ViewComponent />;
    };

    return (
        <div className="flex h-screen bg-brand-dark text-white font-sans">
            <Sidebar 
                activeView={activeView} 
                setActiveView={setActiveView}
                userProfile={userProfile}
                saveProjectTrigger={saveProjectTrigger}
                loadProjectTrigger={loadProjectTrigger}
            />
            <main className="flex-1 overflow-auto p-0">
                {renderActiveView()}
            </main>
        </div>
    );
};

export default MainDashboard;