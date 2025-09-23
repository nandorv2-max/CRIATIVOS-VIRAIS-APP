import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    adminGetAllUserProfiles,
    adminGetPlans,
    adminUpdateUserDetails,
    getPublicAssets,
    adminGetCategories,
    adminCreateCategory,
    adminDeleteCategory,
    adminUpdateCategory,
    adminUploadPublicAsset,
    adminDeletePublicAsset,
    adminUpdatePublicAsset,
    adminGetFeatures,
    adminGetPlanFeatures,
    adminUpdatePlan,
    adminSetPlanFeatures,
    adminGetCreditCosts,
    adminUpdateCreditCost,
    getPublicProjects,
    adminGetPublicProjectCategories,
    adminCreatePublicProjectCategory,
    adminUpdatePublicProjectCategory,
    adminDeletePublicProjectCategory,
    adminUploadPublicProject,
    adminDeletePublicProject,
    adminUpdatePublicProject
} from '../../services/databaseService.ts';
import type { UserProfile, Plan, PublicAsset, Category, Feature, CreditCost, AssetVisibility, PublicProject, PublicProjectCategory } from '../../types.ts';
import EditUserModal from '../EditUserModal.tsx';
import Button from '../Button.tsx';
import AdminSetupInstructions from '../AdminSetupInstructions.tsx';
import { IconTrash, IconEdit, IconRocket } from '../Icons.tsx';
import EditAssetModal from '../EditAssetModal.tsx';

type AdminTab = 'users' | 'media' | 'fonts' | 'presets' | 'publicProjects' | 'plans';
type AssetTypeFilter = 'media' | 'font' | 'preset';

// Gallery Component
const AssetGallery: React.FC<{
    assets: PublicAsset[];
    categories: Category[];
    assetTypeFilter: AssetTypeFilter;
    onUpload: (file: File, categoryId: string | null, visibility: AssetVisibility) => void;
    onDelete: (asset: PublicAsset) => void;
    onEdit: (asset: PublicAsset) => void;
    onNewCategory: (name: string) => void;
    onDeleteCategory: (id: string) => void;
    onUpdateCategory: (id: string, newName: string) => void;
}> = ({ assets, categories, assetTypeFilter, onUpload, onDelete, onEdit, onNewCategory, onDeleteCategory, onUpdateCategory }) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [visibility, setVisibility] = useState<AssetVisibility>('Public');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(file, selectedCategory, visibility);
        }
    };

    const handleNewCategory = () => {
        const name = prompt("Nome da nova categoria:");
        if (name) onNewCategory(name);
    };

    const handleUpdateCategory = (id: string) => {
        if (editingCategoryName.trim()) {
            onUpdateCategory(id, editingCategoryName.trim());
        }
        setEditingCategoryId(null);
        setEditingCategoryName('');
    };

    const filteredAssets = selectedCategory ? assets.filter(a => a.category_id === selectedCategory) : assets;
    
    const getAcceptableFileTypes = () => {
        switch(assetTypeFilter) {
            case 'media': return 'image/*,video/*';
            case 'font': return '.otf,.ttf,.woff,.woff2';
            case 'preset': return '.dng'; // Note: .brmp is now handled separately
            default: return '*/*';
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Fazer Upload de Novo Recurso</h3>
                <div className="bg-brand-light p-4 rounded-lg border border-brand-accent flex items-center gap-4">
                    <label htmlFor={`file-upload-${assetTypeFilter}`} className="cursor-pointer bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-brand-secondary transition-colors">
                        Escolher arquivo
                    </label>
                    <input id={`file-upload-${assetTypeFilter}`} type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept={getAcceptableFileTypes()}/>
                    <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">Visibilidade</label>
                        <select value={visibility} onChange={e => setVisibility(e.target.value as AssetVisibility)} className="bg-brand-dark border border-brand-accent rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary">
                            <option value="Public">Público</option>
                            <option value="Restricted">Restrito</option>
                        </select>
                    </div>
                </div>
            </div>
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Gerenciar Categorias</h3>
                    <Button onClick={handleNewCategory} className="!px-3 !py-1 text-xs">Nova Categoria</Button>
                </div>
                <div className="flex flex-wrap gap-2 p-2 bg-brand-light rounded-lg border border-brand-accent">
                    <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1 rounded-md text-sm ${!selectedCategory ? 'bg-brand-primary text-white' : 'bg-brand-accent hover:bg-brand-light'}`}>Todas</button>
                    {categories.map(cat => (
                        <div key={cat.id} className="relative group flex items-center gap-1">
                            {editingCategoryId === cat.id ? (
                                <input
                                    type="text"
                                    value={editingCategoryName}
                                    onChange={(e) => setEditingCategoryName(e.target.value)}
                                    onBlur={() => handleUpdateCategory(cat.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory(cat.id)}
                                    className="bg-brand-dark border border-brand-primary rounded-md px-3 py-1 text-sm outline-none"
                                    autoFocus
                                />
                            ) : (
                                <button onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1 rounded-md text-sm ${selectedCategory === cat.id ? 'bg-brand-primary text-white' : 'bg-brand-accent hover:bg-brand-light'}`}>{cat.name}</button>
                            )}
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }} className="p-1 hover:text-white"><IconEdit className="w-3 h-3" /></button>
                                <button onClick={() => onDeleteCategory(cat.id)} className="p-1 hover:text-red-400"><IconTrash className="w-3 h-3" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredAssets.map(asset => (
                    <div key={asset.id} className="relative group aspect-square bg-brand-light rounded-lg">
                         {['image', 'video'].includes(asset.asset_type) ? (
                            <img src={asset.thumbnail_url || asset.asset_url} alt={asset.name} className="w-full h-full object-contain p-2" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2">
                                <IconRocket className="w-12 h-12" />
                                <span className="text-xs mt-2 text-center break-all">{asset.name.replace('.brmp', '').replace('.dng', '')}</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                            <p className="text-xs text-white truncate">{asset.name}</p>
                            <div className="flex justify-end gap-2">
                                <Button onClick={() => onEdit(asset)} className="!p-2"><IconEdit className="w-4 h-4" /></Button>
                                <Button onClick={() => onDelete(asset)} className="!p-2 !bg-red-600 hover:!bg-red-500"><IconTrash className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// Main Admin View
const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    
    // Data states
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [creditCosts, setCreditCosts] = useState<CreditCost[]>([]);
    const [publicAssets, setPublicAssets] = useState<PublicAsset[]>([]);
    const [mediaCategories, setMediaCategories] = useState<Category[]>([]);
    const [fontCategories, setFontCategories] = useState<Category[]>([]);
    const [presetCategories, setPresetCategories] = useState<Category[]>([]);
    const [planFeatures, setPlanFeatures] = useState<Record<string, string[]>>({});
    const [publicProjects, setPublicProjects] = useState<PublicProject[]>([]);
    const [publicProjectCategories, setPublicProjectCategories] = useState<PublicProjectCategory[]>([]);

    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [editingAsset, setEditingAsset] = useState<PublicAsset | PublicProject | null>(null);
    const [requiresSetup, setRequiresSetup] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setRequiresSetup(false);
        try {
            const [
                userProfiles, planData, publicAssetData,
                mediaCats, fontCats, presetCats,
                featureData, creditCostData,
                publicProjectData, publicProjectCats
            ] = await Promise.all([
                adminGetAllUserProfiles(), adminGetPlans(), getPublicAssets(),
                adminGetCategories('media'), adminGetCategories('font'), adminGetCategories('preset'),
                adminGetFeatures(), adminGetCreditCosts(),
                getPublicProjects(), adminGetPublicProjectCategories()
            ]);
            
            setUsers(userProfiles);
            setPlans(planData);
            setPublicAssets(publicAssetData);
            setMediaCategories(mediaCats);
            setFontCategories(fontCats);
            setPresetCategories(presetCats);
            setFeatures(featureData);
            setCreditCosts(creditCostData);
            setPublicProjects(publicProjectData);
            setPublicProjectCategories(publicProjectCats);

            if (planData.length > 0) {
                const firstPlanId = planData[0].id;
                setSelectedPlanId(firstPlanId);
                const featuresForPlans: Record<string, string[]> = {};
                for (const plan of planData) {
                    featuresForPlans[plan.id] = await adminGetPlanFeatures(plan.id);
                }
                setPlanFeatures(featuresForPlans);
            }

        } catch (err: any) {
            console.error("Admin data fetch failed:", err);
            const errorMessage = err?.message || 'Ocorreu um erro desconhecido.';
            if (errorMessage.includes('relation') || errorMessage.includes('does not exist') || errorMessage.includes('permission denied')) {
                setRequiresSetup(true);
            } else {
                setError(`Falha ao carregar dados de administrador: ${errorMessage}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveUser = async (userId: string, updates: any) => {
        try {
            await adminUpdateUserDetails(userId, updates);
            setEditingUser(null);
            await fetchData();
        } catch (err: any) { setError(`Falha ao atualizar o utilizador: ${err.message}`); }
    };
    
    const handleUploadPublicAsset = async (file: File, categoryId: string | null, visibility: AssetVisibility) => {
        try {
            await adminUploadPublicAsset(file, visibility, categoryId);
            await fetchData();
        } catch(err: any) { setError(`Falha ao fazer upload do recurso público: ${err.message}`); }
    };

    const handleDeletePublicAsset = async (asset: PublicAsset) => {
        if (window.confirm(`Tem a certeza que quer apagar "${asset.name}"?`)) {
            try {
                await adminDeletePublicAsset(asset.id);
                await fetchData();
            } catch(err: any) { setError(`Falha ao apagar o recurso público: ${err.message}`); }
        }
    };
    
    const handleSaveAsset = async (assetId: string, newName: string, newCategoryId: string | null) => {
        try {
            if (!editingAsset) return;
            // Check if it's a project or a regular asset
            if ('asset_type' in editingAsset) {
                await adminUpdatePublicAsset(assetId, newName, newCategoryId);
            } else {
                await adminUpdatePublicProject(assetId, newName, newCategoryId);
            }
            setEditingAsset(null);
            await fetchData();
        } catch(err: any) { setError(`Falha ao atualizar o recurso: ${err.message}`); }
    };
    
    const handleCategoryAction = async (action: 'create' | 'update' | 'delete', type: AssetTypeFilter, nameOrId: string, newName?: string) => {
        try {
            if (action === 'create') await adminCreateCategory(nameOrId, type);
            if (action === 'update' && newName) await adminUpdateCategory(nameOrId, newName);
            if (action === 'delete') await adminDeleteCategory(nameOrId);
            await fetchData();
        } catch(err: any) { setError(`Falha na operação da categoria: ${err.message}`); }
    };
    
    const handlePlanFeatureChange = (planId: string, featureId: string, isChecked: boolean) => {
        setPlanFeatures(prev => {
            const currentFeatures = prev[planId] || [];
            const newFeatures = isChecked 
                ? [...currentFeatures, featureId]
                : currentFeatures.filter(id => id !== featureId);
            return { ...prev, [planId]: newFeatures };
        });
    };
    
    const handleSavePlan = async (plan: Plan) => {
        try {
            const featuresToSave = planFeatures[plan.id] || [];
            await Promise.all([
                adminUpdatePlan(plan.id, { name: plan.name, stripe_payment_link: plan.stripe_payment_link, initial_credits: plan.initial_credits }),
                adminSetPlanFeatures(plan.id, featuresToSave)
            ]);
            alert('Plano salvo!');
            await fetchData();
        } catch(err: any) { setError(`Falha ao salvar o plano: ${err.message}`); }
    };
    
    const handleCreditCostChange = async (action: string, cost: number) => {
        try {
            await adminUpdateCreditCost(action, cost);
            await fetchData();
        } catch(err: any) { setError(`Falha ao atualizar o custo de crédito: ${err.message}`); }
    };

    const handlePublicProjectCategoryAction = async (action: 'create' | 'update' | 'delete', nameOrId: string, newName?: string) => {
        try {
            if (action === 'create') await adminCreatePublicProjectCategory(nameOrId);
            if (action === 'update' && newName) await adminUpdatePublicProjectCategory(nameOrId, newName);
            if (action === 'delete') await adminDeletePublicProjectCategory(nameOrId);
            await fetchData();
        } catch(err: any) { setError(`Falha na operação da categoria de projeto: ${err.message}`); }
    };

    const handleUploadPublicProject = async (file: File, categoryId: string | null, visibility: AssetVisibility) => {
        try {
            await adminUploadPublicProject(file, visibility, categoryId);
            await fetchData();
        } catch(err: any) { setError(`Falha ao fazer upload do modelo de projeto: ${err.message}`); }
    };

    const handleDeletePublicProject = async (project: PublicProject) => {
        if (window.confirm(`Tem a certeza que quer apagar o modelo "${project.name}"?`)) {
            try {
                await adminDeletePublicProject(project.id);
                await fetchData();
            } catch(err: any) { setError(`Falha ao apagar o modelo de projeto: ${err.message}`); }
        }
    };

    if (requiresSetup) return <AdminSetupInstructions />;

    const renderCurrentTab = () => {
        switch (activeTab) {
            case 'users': return (
                <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-brand-accent">
                        <thead className="bg-brand-light">
                             <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Créditos</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Editar</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-brand-dark divide-y divide-brand-accent">
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.credits}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Button onClick={() => setEditingUser(user)} className="!px-3 !py-1 text-xs">Editar</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            case 'media': return <AssetGallery assets={publicAssets.filter(a => ['image', 'video'].includes(a.asset_type))} categories={mediaCategories} assetTypeFilter="media" onUpload={handleUploadPublicAsset} onDelete={handleDeletePublicAsset} onEdit={setEditingAsset} onNewCategory={(name) => handleCategoryAction('create', 'media', name)} onDeleteCategory={(id) => handleCategoryAction('delete', 'media', id)} onUpdateCategory={(id, name) => handleCategoryAction('update', 'media', id, name)} />;
            case 'fonts': return <AssetGallery assets={publicAssets.filter(a => a.asset_type === 'font')} categories={fontCategories} assetTypeFilter="font" onUpload={handleUploadPublicAsset} onDelete={handleDeletePublicAsset} onEdit={setEditingAsset} onNewCategory={(name) => handleCategoryAction('create', 'font', name)} onDeleteCategory={(id) => handleCategoryAction('delete', 'font', id)} onUpdateCategory={(id, name) => handleCategoryAction('update', 'font', id, name)} />;
            case 'presets': return <AssetGallery assets={publicAssets.filter(a => a.asset_type === 'dng')} categories={presetCategories} assetTypeFilter="preset" onUpload={handleUploadPublicAsset} onDelete={handleDeletePublicAsset} onEdit={setEditingAsset} onNewCategory={(name) => handleCategoryAction('create', 'preset', name)} onDeleteCategory={(id) => handleCategoryAction('delete', 'preset', id)} onUpdateCategory={(id, name) => handleCategoryAction('update', 'preset', id, name)} />;
            case 'publicProjects': return (
                // This is a simplified, inlined version of AssetGallery for projects
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold mb-2">Fazer Upload de Novo Modelo</h3>
                    <div className="bg-brand-light p-4 rounded-lg border border-brand-accent">
                         <input type="file" accept=".brmp" onChange={e => {
                             const file = e.target.files?.[0];
                             if (file) handleUploadPublicProject(file, null, 'Public');
                         }} className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-secondary"/>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {publicProjects.map(project => (
                             <div key={project.id} className="relative group aspect-video bg-brand-light rounded-lg flex flex-col items-center justify-center text-gray-400 p-2">
                                <IconRocket className="w-12 h-12" />
                                <span className="text-xs mt-2 text-center break-all">{project.name.replace('.brmp', '')}</span>
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                                    <p className="text-xs text-white truncate">{project.name}</p>
                                    <div className="flex justify-end gap-2">
                                        <Button onClick={() => setEditingAsset(project)} className="!p-2"><IconEdit className="w-4 h-4" /></Button>
                                        <Button onClick={() => handleDeletePublicProject(project)} className="!p-2 !bg-red-600 hover:!bg-red-500"><IconTrash className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
            case 'plans': 
                const selectedPlan = plans.find(p => p.id === selectedPlanId);
                return (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-semibold mb-2">Planos</h3>
                            <div className="space-y-2">
                                {plans.map(plan => <button key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className={`w-full text-left p-3 rounded-md ${selectedPlanId === plan.id ? 'bg-brand-primary' : 'bg-brand-light'}`}>{plan.name}</button>)}
                            </div>
                        </div>
                        {selectedPlan && (
                        <div className="md:col-span-2 space-y-4">
                             <h3 className="text-lg font-semibold mb-2">Gerenciar Plano: {selectedPlan.name}</h3>
                             <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-300">Créditos Iniciais</label>
                                    <input type="number" value={selectedPlan.initial_credits} onChange={(e) => setPlans(prev => prev.map(p => p.id === selectedPlanId ? {...p, initial_credits: Number(e.target.value)} : p))} className="w-full bg-brand-light p-2 rounded mt-1"/>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-300">Link de Pagamento Stripe</label>
                                    <input type="text" value={selectedPlan.stripe_payment_link || ''} onChange={(e) => setPlans(prev => prev.map(p => p.id === selectedPlanId ? {...p, stripe_payment_link: e.target.value} : p))} className="w-full bg-brand-light p-2 rounded mt-1"/>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-300 mb-2">Módulos Acessíveis</h4>
                                    <div className="space-y-2">
                                        {features.map(feature => (
                                            <label key={feature.id} className="flex items-center gap-2">
                                                <input type="checkbox" checked={planFeatures[selectedPlanId]?.includes(feature.id) || false} onChange={(e) => handlePlanFeatureChange(selectedPlanId, feature.id, e.target.checked)} className="w-4 h-4 rounded"/>
                                                <span>{feature.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                             </div>
                             <Button onClick={() => handleSavePlan(selectedPlan)} primary>Salvar Alterações</Button>
                        </div>
                        )}
                    </div>
                );
            default: return null;
        }
    };

    const TABS: { id: AdminTab, label: string }[] = [
        { id: 'users', label: 'Utilizadores' },
        { id: 'media', label: 'Galeria Mídias' },
        { id: 'fonts', label: 'Galeria Fontes' },
        { id: 'presets', label: 'Galeria Pre-Definições' },
        { id: 'publicProjects', label: 'Modelos Públicos' },
        { id: 'plans', label: 'Planos e Permissões' }
    ];

    return (
        <>
            <EditUserModal user={editingUser} plans={plans} onClose={() => setEditingUser(null)} onSave={handleSaveUser} />
            <EditAssetModal
                asset={editingAsset}
                isOpen={!!editingAsset}
                onClose={() => setEditingAsset(null)}
                onSave={handleSaveAsset}
                categories={
                    activeTab === 'media' ? mediaCategories :
                    activeTab === 'fonts' ? fontCategories :
                    activeTab === 'presets' ? presetCategories :
                    activeTab === 'publicProjects' ? (publicProjectCategories as any) :
                    []
                }
            />
            <div className="h-full w-full flex flex-col p-8 bg-brand-dark text-white">
                <header className="flex-shrink-0 mb-6">
                    <h1 className="text-3xl font-bold">Painel de Administração</h1>
                </header>
                 <nav className="flex items-center border-b border-brand-accent mb-6 overflow-x-auto flex-shrink-0">
                     {TABS.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 font-semibold whitespace-nowrap ${activeTab === tab.id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>{tab.label}</button>))}
                </nav>

                {isLoading ? (
                    <div className="flex-grow flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                    </div>
                ) : error ? (
                    <div className="flex-grow flex items-center justify-center text-center text-red-400">{error}</div>
                ) : (
                    <div className="flex-grow overflow-y-auto pr-2 min-h-0">
                        {renderCurrentTab()}
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminView;