import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
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
import { getUserAssets } from '../services/databaseService.ts';
import type { Project, UserProfile, UploadedAsset } from '../types.ts';


interface MainDashboardProps {
    // FIX: Update prop type to include the full UserProfile, which contains 'credits'.
    userProfile: (User & UserProfile & { isAdmin: boolean; }) | null;
}

// Asset Context for Caching
interface AssetContextType {
    assets: UploadedAsset[];
    setAssets: React.Dispatch<React.SetStateAction<UploadedAsset[]>>;
    isLoading: boolean;
    error: string | null;
    requiresSetup: boolean;
    refetchAssets: () => Promise<void>;
}
export const AssetContext = createContext<AssetContextType | undefined>(undefined);

const AssetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [assets, setAssets] = useState<UploadedAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requiresSetup, setRequiresSetup] = useState(false);

    const fetchAssets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setRequiresSetup(false);
        try {
            const userAssets = await getUserAssets();
            setAssets(userAssets);
        } catch (err: any) {
            if (err.message?.startsWith('USER_ASSETS_SETUP_REQUIRED')) {
                setRequiresSetup(true);
                setError(err.message);
            } else {
                setError("Falha ao carregar os seus recursos.");
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAssets();
    }, [fetchAssets]);

    const value = { assets, setAssets, isLoading, error, requiresSetup, refetchAssets: fetchAssets };

    return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
};


const MainDashboard: React.FC<MainDashboardProps> = ({ userProfile }) => {
    const [activeView, setActiveView] = useState<string>('projects');
    // FIX: Added state to hold the save and load trigger functions from the CreativeEditorView, to be passed to the Sidebar.
    const [saveProjectTrigger, setSaveProjectTrigger] = useState<{ trigger: () => void }>({ trigger: () => console.warn('Save trigger not initialized') });
    const [loadProjectTrigger, setLoadProjectTrigger] = useState<{ trigger: (project: Project) => void }>({ trigger: () => console.warn('Load trigger not initialized') });

    const viewComponents: { [key: string]: React.ComponentType<any> } = {
        projects: () => <ProjectsView setActiveView={setActiveView} />,
        admin: () => <AdminView />,
        // FIX: Removed unused `userProfile` prop to match the component's definition and fix type errors.
        imageGenerator: () => <ImageGeneratorView />,
        // FIX: Removed unused `userProfile` prop to match the component's definition and fix type errors.
        mockupGenerator: () => <MockupGeneratorView />,
        // FIX: Removed unused `userProfile` prop to match the component's definition and fix type errors.
        productStudio: () => <ProductStudioView />,
        // FIX: Passed the `setSaveProjectTrigger` and `setLoadProjectTrigger` props to `CreativeEditorView` to satisfy its required props and enable project saving/loading functionality.
        criativoViral: () => <CreativeEditorView setSaveProjectTrigger={setSaveProjectTrigger} setLoadProjectTrigger={setLoadProjectTrigger} />,
        // FIX: Add non-null assertion as userProfile is guaranteed to exist when MainDashboard renders.
        video: () => <VideoGenerator userProfile={userProfile!} />,
        cenasDoInstagram: () => <GeneratorView templateKey="cenasDoInstagram" userProfile={userProfile} />,
        worldTour: () => <GeneratorView templateKey="worldTour" userProfile={userProfile} />,
        editor: () => <ProfessionalEditorView />,
        cleanAndSwap: () => <GeneratorView templateKey="cleanAndSwap" userProfile={userProfile} />,
        // FIX: Removed unused `userProfile` prop to match the component's definition and fix type errors.
        unir: () => <UnirView />,
    };

    const renderActiveView = () => {
        const ViewComponent = viewComponents[activeView] || viewComponents.projects;
        return <ViewComponent />;
    };

    return (
        <AssetProvider>
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
        </AssetProvider>
    );
};

export default MainDashboard;