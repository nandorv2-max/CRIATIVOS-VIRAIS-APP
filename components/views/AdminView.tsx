import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { UserProfile, PublicAsset, AssetVisibility } from '../../types.ts';
import { adminGetUsers, adminGetAllAssets, uploadPublicAsset } from '../../services/databaseService.ts';
import Button from '../Button.tsx';
import AdminSetupInstructions from '../AdminSetupInstructions.tsx';

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleAssetUpload = async () => {
        if (!uploadFile) return;
        setIsUploading(true);
        setError(null);
        try {
            await uploadPublicAsset(uploadFile, uploadVisibility);
            setUploadFile(null);
            const assetsData = await adminGetAllAssets(); // Refresh asset list
            setPublicAssets(assetsData);
        } catch (err: any) {
            console.error("Failed to upload asset:", err);
            if (err.message && err.message.startsWith('SETUP_REQUIRED')) {
                 setRequiresSetup(true);
                 setError(err.message);
            } else {
                setError("O upload falhou. Verifique as permissões do bucket de armazenamento.");
            }
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
            </div>
        );
    }
    
    if (requiresSetup) {
        return <AdminSetupInstructions error={error} onRetry={fetchData} />;
    }

    const UserManagementPanel = () => (
        <div className="space-y-4">
             <h2 className="text-2xl font-bold text-white">Gerenciar Usuários</h2>
             <div className="bg-brand-dark/50 rounded-lg border border-brand-accent/50 overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-brand-light">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Créditos</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-accent">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{user.credits}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
    
     const GalleryManagementPanel = () => (
        <div className="space-y-6">
             <h2 className="text-2xl font-bold text-white">Gerenciar Galeria Pública</h2>
             <div className="bg-brand-dark/50 p-4 rounded-lg border border-brand-accent/50 space-y-3">
                 <h3 className="font-semibold">Fazer Upload de Novo Recurso</h3>
                 <input type="file" onChange={handleFileUpload} className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-secondary"/>
                 {uploadFile && (
                     <div className="flex items-center gap-4">
                        <select value={uploadVisibility} onChange={e => setUploadVisibility(e.target.value as AssetVisibility)} className="bg-brand-light border border-brand-accent rounded-lg p-2 text-white">
                            <option value="Public">Público</option>
                            <option value="Restricted">Restrito</option>
                        </select>
                        <Button onClick={handleAssetUpload} primary disabled={isUploading}>
                            {isUploading ? 'Enviando...' : 'Enviar'}
                        </Button>
                     </div>
                 )}
             </div>
             <div>
                <h3 className="font-semibold mb-2">Recursos existentes</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {publicAssets.map(asset => (
                        <div key={asset.id} className="bg-brand-light p-2 rounded-lg">
                           <img src={asset.thumbnail_url || asset.asset_url} className="w-full h-24 object-cover rounded-md mb-2" />
                           <p className="text-xs truncate">{asset.name}</p>
                           <p className={`text-xs font-bold ${asset.visibility === 'Public' ? 'text-green-400' : 'text-yellow-400'}`}>{asset.visibility}</p>
                        </div>
                    ))}
                </div>
             </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col text-center p-8 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-7xl mx-auto text-left"
            >
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                    Painel de Administração
                </h1>

                <div className="my-6 border-b border-brand-accent/50 flex space-x-4">
                    <button onClick={() => setActiveTab('users')} className={`py-2 px-4 font-semibold ${activeTab === 'users' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Usuários</button>
                    <button onClick={() => setActiveTab('gallery')} className={`py-2 px-4 font-semibold ${activeTab === 'gallery' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>Galeria</button>
                </div>
                
                {error ? <p className="text-red-400">{error}</p> : (
                    <div>
                        {activeTab === 'users' ? <UserManagementPanel /> : <GalleryManagementPanel />}
                    </div>
                )}
                
            </motion.div>
        </div>
    );
};

export default AdminView;
