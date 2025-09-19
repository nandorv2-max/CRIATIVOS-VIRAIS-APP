import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { UserProfile, PublicAsset, AssetVisibility, UserRole, UploadedAssetType } from '../../types.ts';
import { adminGetUsers, adminGetAllAssets, uploadPublicAsset, adminUpdateUser, adminDeleteUser, adminUpdatePublicAsset, adminDeletePublicAsset } from '../../services/databaseService.ts';
import Button from '../Button.tsx';
import AdminSetupInstructions from '../AdminSetupInstructions.tsx';
import EditUserModal from '../EditUserModal.tsx';
import { IconEdit, IconTrash, IconFile, IconType } from '../Icons.tsx';

const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'gallery'>('users');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [publicAssets, setPublicAssets] = useState<PublicAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requiresSetup, setRequiresSetup] = useState(false);

    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadVisibility, setUploadVisibility] = useState<AssetVisibility>('Public');
    const [isUploading, setIsUploading] = useState(false);
    
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [galleryFilter, setGalleryFilter] = useState<UploadedAssetType | 'all'>('all');


    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        setRequiresSetup(false);
        try {
            const [usersData, assetsData] = await Promise.all([adminGetUsers(), adminGetAllAssets()]);
            setUsers(usersData);
            setPublicAssets(assetsData);
        } catch (err: any) {
            console.error("Failed to fetch admin data:", err.message || err);
            if (err.message && err.message.startsWith('SETUP_REQUIRED')) {
                setRequiresSetup(true);
                setError(err.message);
            } else {
                setError("Ocorreu um erro ao buscar dados de administração.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const handleSaveUser = async (userId: string, updates: { role: UserRole; credits: number }) => {
        try {
            await adminUpdateUser(userId, updates);
            setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, ...updates } : u));
            setEditingUser(null);
        } catch (err) {
            setError("Falha ao atualizar o utilizador.");
            console.error(err);
        }
    };

    const handleDeleteUser = async (userId: string, userEmail: string) => {
        if (window.confirm(`Tem a certeza que quer apagar o utilizador ${userEmail}? Esta ação é irreversível.`)) {
            try {
                await adminDeleteUser(userId);
                setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
            } catch (err) {
                setError("Falha ao apagar o utilizador.");
                console.error(err);
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleAssetUpload = async () => {
        if (!uploadFile) return;
        setIsUploading(true);
        setError(null);
        setRequiresSetup(false);
        try {
            await uploadPublicAsset(uploadFile, uploadVisibility);
            setUploadFile(null);
            await fetchData();
        } catch (err: any) {
            console.error("Failed to upload asset:", err);
             if (err.message && err.message.startsWith('SETUP_REQUIRED')) {
                setRequiresSetup(true);
                setError(err.message.replace('SETUP_REQUIRED:', ''));
            } else {
                setError(`Ocorreu um erro durante o upload. Erro original: ${err.message || 'Erro desconhecido.'}`);
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleStartRename = (asset: PublicAsset) => {
        setRenamingAssetId(asset.id);
        setRenameValue(asset.name);
    };

    const handleRenameCancel = () => {
        setRenamingAssetId(null);
        setRenameValue('');
    };

    const handleRenameConfirm = async () => {
        if (!renamingAssetId) return;
        const assetToRename = publicAssets.find(a => a.id === renamingAssetId);
        const newName = renameValue.trim();

        if (!assetToRename || !newName || newName === assetToRename.name) {
            handleRenameCancel();
            return;
        }
        const originalName = assetToRename.name;
        setPublicAssets(prev => prev.map(a => a.id === renamingAssetId ? { ...a, name: newName } : a));
        handleRenameCancel();

        try {
            await adminUpdatePublicAsset(renamingAssetId, { name: newName });
        } catch (err) {
            setError("Falha ao renomear o recurso.");
            setPublicAssets(prev => prev.map(a => a.id === renamingAssetId ? { ...a, name: originalName } : a));
        }
    };
    
    const handleToggleVisibility = async (asset: PublicAsset) => {
        const newVisibility = asset.visibility === 'Public' ? 'Restricted' : 'Public';
        const originalVisibility = asset.visibility;
        setPublicAssets(prev => prev.map(a => a.id === asset.id ? { ...a, visibility: newVisibility } : a));
        try {
            await adminUpdatePublicAsset(asset.id, { visibility: newVisibility });
        } catch (err) {
             setError("Falha ao alterar a visibilidade.");
            setPublicAssets(prev => prev.map(a => a.id === asset.id ? { ...a, visibility: originalVisibility } : a));
        }
    };

    const handleDeleteAsset = async (asset: PublicAsset) => {
        if (window.confirm(`Tem a certeza de que quer apagar "${asset.name}"?`)) {
            setPublicAssets(prev => prev.filter(a => a.id !== asset.id));
            try {
                await adminDeletePublicAsset(asset);
            } catch (err) {
                setError("Falha ao apagar o recurso.");
                fetchData();
            }
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div></div>;
    }
    
    if (requiresSetup) {
        return <AdminSetupInstructions error={error} onRetry={fetchData} />;
    }

    const UserManagementPanel = () => (
        <div className="space-y-4">
             <h2 className="text-2xl font-bold text-white">Gerenciar Usuários</h2>
             <div className="bg-brand-dark/50 rounded-lg border border-brand-accent/50 overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-brand-light">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Créditos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-accent">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200 truncate max-w-xs">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{user.credits}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button onClick={() => setEditingUser(user)} className="text-brand-secondary hover:text-brand-primary">Editar</button>
                                    <button onClick={() => handleDeleteUser(user.id, user.email)} className="text-red-500 hover:text-red-700">Excluir</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
    
    const PublicAssetCard: React.FC<{asset: PublicAsset}> = ({asset}) => {
         const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') handleRenameConfirm();
            else if (e.key === 'Escape') handleRenameCancel();
        };

        return (
            <div className="relative group aspect-[4/3] bg-brand-light rounded-lg overflow-hidden">
                <img src={asset.thumbnail_url || asset.asset_url} alt={asset.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 p-2 flex flex-col justify-end">
                    {renamingAssetId === asset.id ? (
                        <input
                            type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleKeyDown} onBlur={handleRenameConfirm} autoFocus
                            className="w-full bg-black/80 text-white text-xs p-1 rounded border border-brand-primary outline-none"
                        />
                    ) : (
                        <p className="text-xs font-semibold text-white truncate">{asset.name}</p>
                    )}
                    <p className={`text-xs font-bold ${asset.visibility === 'Public' ? 'text-green-400' : 'text-yellow-400'}`}>{asset.visibility}</p>

                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleStartRename(asset)} className="p-1.5 bg-black/50 rounded-full backdrop-blur-sm hover:bg-blue-500"><IconEdit className="w-4 h-4" /></button>
                        <button onClick={() => handleToggleVisibility(asset)} className="p-1.5 bg-black/50 rounded-full backdrop-blur-sm hover:bg-yellow-500" title={`Mudar para ${asset.visibility === 'Public' ? 'Restrito' : 'Público'}`}><IconFile className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteAsset(asset)} className="p-1.5 bg-black/50 rounded-full backdrop-blur-sm hover:bg-red-600"><IconTrash className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        )
    };
    
     const GalleryManagementPanel = () => {
        const galleryTabs: { id: UploadedAssetType | 'all', label: string }[] = [
            { id: 'all', label: 'Todos' }, { id: 'image', label: 'Imagens' }, { id: 'video', label: 'Vídeos' },
            { id: 'audio', label: 'Áudios' }, { id: 'font', label: 'Fontes' },
        ];
        const filteredAssets = useMemo(() => galleryFilter === 'all' ? publicAssets : publicAssets.filter(a => a.asset_type === galleryFilter), [publicAssets, galleryFilter]);

        return (
            <div className="space-y-6">
                 <h2 className="text-2xl font-bold text-white">Gerenciar Galeria Pública</h2>
                 <div className="bg-brand-dark/50 p-4 rounded-lg border border-brand-accent/50 space-y-3">
                     <h3 className="font-semibold">Fazer Upload de Novo Recurso</h3>
                     <div className="flex items-center gap-4">
                        <label htmlFor="gallery-upload" className="cursor-pointer px-4 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors whitespace-nowrap">Escolher arquivo</label>
                        <input id="gallery-upload" type="file" onChange={handleFileUpload} className="hidden" />
                        <span className="text-sm text-gray-400 truncate">{uploadFile ? uploadFile.name : 'Nenhum arquivo escolhido'}</span>
                     </div>
                     {uploadFile && (
                         <div className="flex items-center gap-4 pt-2">
                            <select value={uploadVisibility} onChange={e => setUploadVisibility(e.target.value as AssetVisibility)} className="bg-brand-light border border-brand-accent rounded-lg p-2 text-white">
                                <option value="Public">Público</option>
                                <option value="Restricted">Restrito</option>
                            </select>
                            <Button onClick={handleAssetUpload} primary disabled={isUploading}>{isUploading ? 'Enviando...' : 'Enviar'}</Button>
                         </div>
                     )}
                 </div>
                 <div>
                    <div className="border-b border-brand-accent/50 flex space-x-2 overflow-x-auto mb-4">
                        {galleryTabs.map(tab => <button key={tab.id} onClick={() => setGalleryFilter(tab.id)} className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${galleryFilter === tab.id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>{tab.label}</button>)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {filteredAssets.map(asset => <PublicAssetCard key={asset.id} asset={asset} />)}
                    </div>
                 </div>
            </div>
        )
    };

    return (
        <>
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveUser}/>
        <div className="h-full flex flex-col p-8 overflow-y-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-7xl mx-auto text-left">
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Painel de Administração</h1>
                <div className="my-6 border-b border-brand-accent/50 flex space-x-4">
                    <button onClick={() => setActiveTab('users')} className={`py-2 px-4 font-semibold ${activeTab === 'users' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Usuários</button>
                    <button onClick={() => setActiveTab('gallery')} className={`py-2 px-4 font-semibold ${activeTab === 'gallery' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Galeria</button>
                </div>
                {error && !requiresSetup ? <p className="text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p> : (
                    <div>{activeTab === 'users' ? <UserManagementPanel /> : <GalleryManagementPanel />}</div>
                )}
            </motion.div>
        </div>
        </>
    );
};

export default AdminView;
