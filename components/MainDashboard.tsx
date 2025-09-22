import React, { useState } from 'react';
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
import type { UserProfile } from '../types.ts';


interface MainDashboardProps {
    userProfile: (User & UserProfile & { isAdmin: boolean; }) | null;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ userProfile }) => {
    const [activeView, setActiveView] = useState<string>('projects');
    
    const viewComponents: { [key: string]: React.ComponentType<any> } = {
        projects: () => <ProjectsView />,
        admin: () => <AdminView />,
        imageGenerator: () => <ImageGeneratorView />,
        mockupGenerator: () => <MockupGeneratorView />,
        productStudio: () => <ProductStudioView />,
        studioCriativo: () => <CreativeEditorView userProfile={userProfile} />,
        video: () => <VideoGenerator userProfile={userProfile!} />,
        cenasDoInstagram: () => <GeneratorView templateKey="cenasDoInstagram" userProfile={userProfile} />,
        worldTour: () => <GeneratorView templateKey="worldTour" userProfile={userProfile} />,
        editor: () => <ProfessionalEditorView />,
        cleanAndSwap: () => <GeneratorView templateKey="cleanAndSwap" userProfile={userProfile} />,
        unir: () => <UnirView />,
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
            />
            <main className="flex-1 overflow-auto">
                {renderActiveView()}
            </main>
        </div>
    );
};

export default MainDashboard;
