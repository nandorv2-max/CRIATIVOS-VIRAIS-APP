import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import type { User } from '@supabase/gotrue-js';
import Sidebar from '../Sidebar.tsx';
import ProjectsView from './ProjectsView.tsx';
import GeneratorView from './GeneratorView.tsx';
import ImageGeneratorView from './ImageGeneratorView.tsx';
import MockupGeneratorView from './MockupGeneratorView.tsx';
import ProductStudioView from './ProductStudioView.tsx';
import CreativeEditorView from './CreativeEditorView.tsx';
import UnirView from './UnirView.tsx';
import VideoGenerator from '../VideoGenerator.tsx';
import ProfessionalEditorView from './ProfessionalEditorView.tsx';
import AdminView from './AdminView.tsx';
import { getUserAssets } from '../../services/databaseService.ts';
import type { Project, UserProfile, UploadedAsset } from '../../types.ts';


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

// Moved types from ProfessionalEditorView to create a single source of truth for the context.
export type AdjustmentKey = 'exposure' | 'contrast' | 'highlights' | 'shadows' | 'whites' | 'blacks' | 'temperature' | 'tint' | 'saturation' | 'vibrance' | 'texture' | 'clarity' | 'dehaze' | 'grain' | 'vignette' | 'sharpness';
export type Adjustments = { [key in AdjustmentKey]: number };

export const DEFAULT_ADJUSTMENTS: Adjustments = {
    exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
    temperature: 0, tint: 0, saturation: 0, vibrance: 0,
    texture: 0, clarity: 0, dehaze: 0, grain: 0, vignette: 0, sharpness: 0,
};

// Professional Editor Context for state preservation
interface ProfessionalEditorContextType {
    image: HTMLImageElement | null;
    setImage: (image: HTMLImageElement | null) => void;
    liveAdjustments: Adjustments;
    setLiveAdjustments: React.Dispatch<React.SetStateAction<Adjustments>>;
    history: { snapshots: Adjustments[], currentIndex: number };
    undo: () => void;
    redo: () => void;
    pushHistory: (newState: Adjustments) => void;
    resetHistory: (adjustments?: Adjustments) => void;
}

export const ProfessionalEditorContext = createContext<ProfessionalEditorContextType | undefined>(undefined);

const ProfessionalEditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [image, setImageState] = useState<HTMLImageElement | null>(null);
    const [history, setHistory] = useState({
        snapshots: [DEFAULT_ADJUSTMENTS],
        currentIndex: 0,
    });
    const [liveAdjustments, setLiveAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);

    const pushHistory = useCallback((newState: Adjustments) => {
        setHistory(prevHistory => {
            const { snapshots, currentIndex } = prevHistory;
            const lastCommittedState = snapshots[currentIndex];
            if (JSON.stringify(lastCommittedState) === JSON.stringify(newState)) {
                return prevHistory;
            }
            let newSnapshots = snapshots.slice(0, currentIndex + 1);
            newSnapshots.push(newState);
            if (newSnapshots.length > 50) {
                newSnapshots = newSnapshots.slice(newSnapshots.length - 50);
            }
            return {
                snapshots: newSnapshots,
                currentIndex: newSnapshots.length - 1
            };
        });
    }, []);

    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.currentIndex > 0) {
                const newIndex = prev.currentIndex - 1;
                setLiveAdjustments(prev.snapshots[newIndex]);
                return { ...prev, currentIndex: newIndex };
            }
            return prev;
        });
    }, []);

    const redo = useCallback(() => {
        setHistory(prev => {
            if (prev.currentIndex < prev.snapshots.length - 1) {
                const newIndex = prev.currentIndex + 1;
                setLiveAdjustments(prev.snapshots[newIndex]);
                return { ...prev, currentIndex: newIndex };
            }
            return prev;
        });
    }, []);
    
    const resetHistory = useCallback((adjustments = DEFAULT_ADJUSTMENTS) => {
        const newHistory = { snapshots: [adjustments], currentIndex: 0 };
        setHistory(newHistory);
        setLiveAdjustments(adjustments);
    }, []);
    
    const setImage = (newImage: HTMLImageElement | null) => {
        setImageState(newImage);
        resetHistory();
    };

    const value = { image, setImage, liveAdjustments, setLiveAdjustments, history, undo, redo, pushHistory, resetHistory };

    return <ProfessionalEditorContext.Provider value={value}>{children}</ProfessionalEditorContext.Provider>;
};


const MainDashboard: React.FC<MainDashboardProps> = ({ userProfile }) => {
    const [activeView, setActiveView] = useState<string>('projects');
    const [saveProjectTrigger, setSaveProjectTrigger] = useState<{ trigger: () => void }>({ trigger: () => console.warn('Save trigger not initialized') });
    const [loadProjectTrigger, setLoadProjectTrigger] = useState<{ trigger: (project: Project) => void }>({ trigger: () => console.warn('Load trigger not initialized') });

    const viewComponents: { [key: string]: React.ComponentType<any> } = {
        // FIX: Removed `setActiveView` prop as `ProjectsView` does not accept it, resolving the type error.
        projects: () => <ProjectsView />,
        admin: () => <AdminView />,
        imageGenerator: () => <ImageGeneratorView />,
        mockupGenerator: () => <MockupGeneratorView />,
        productStudio: () => <ProductStudioView />,
        studioCriativo: () => <CreativeEditorView setSaveProjectTrigger={setSaveProjectTrigger} setLoadProjectTrigger={setLoadProjectTrigger} />,
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
        <AssetProvider>
            <ProfessionalEditorProvider>
                <div className="flex h-screen bg-brand-dark text-white font-sans">
                    <Sidebar 
                        activeView={activeView} 
                        setActiveView={setActiveView}
                        userProfile={userProfile}
                        saveProjectTrigger={saveProjectTrigger}
                        loadProjectTrigger={loadProjectTrigger}
                    />
                    <main className="flex-1 overflow-auto">
                        {renderActiveView()}
                    </main>
                </div>
            </ProfessionalEditorProvider>
        </AssetProvider>
    );
};

export default MainDashboard;