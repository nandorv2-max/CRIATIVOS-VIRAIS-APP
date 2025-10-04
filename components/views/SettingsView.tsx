import React, { useState, useEffect } from 'react';
import type { UserProfile } from '../../types.ts';
import Button from '../Button.tsx';
import ApiKeyManagerModal from '../ApiKeyManagerModal.tsx';
import { updateUserProfile } from '../../services/databaseService.ts';

interface SettingsViewProps {
    userProfile: UserProfile | null;
    refetchUserProfile: () => void;
    setActiveView: (view: string) => void;
}

const UsageMeter: React.FC<{ label: string; used: number; total: number; unit: string; }> = ({ label, used, total, unit }) => {
    const percentage = total > 0 ? (used / total) * 100 : 0;
    
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    const formattedUsed = unit === 'GB' ? formatBytes(used) : used;
    const formattedTotal = unit === 'GB' ? `${(total / (1024*1024*1024)).toFixed(2)} GB` : total;
    
    return (
        <div className="bg-brand-light p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs font-semibold">{formattedUsed} / {formattedTotal}</span>
            </div>
            <div className="w-full bg-brand-accent rounded-full h-2.5">
                <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ userProfile, refetchUserProfile, setActiveView }) => {
    const [name, setName] = useState(userProfile?.user_metadata?.name || '');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [theme, setTheme] = useState(localStorage.getItem('user-theme') || 'system');

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('dark-mode');
            root.classList.remove('light-mode');
        } else {
            root.classList.add('light-mode');
            root.classList.remove('dark-mode');
        }
        localStorage.setItem('user-theme', theme);
    }, [theme]);

    if (!userProfile) {
        return <div className="p-8">A carregar perfil...</div>;
    }

    const handleProfileSave = async () => {
        setIsSaving(true);
        setNotification(null);
        try {
            await updateUserProfile({ name });
            await refetchUserProfile();
            setNotification('Perfil atualizado com sucesso!');
        } catch (error) {
            console.error(error);
            setNotification('Falha ao atualizar o perfil.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveApiKey = (apiKey: string) => {
        window.localStorage.setItem('user_gemini_api_key', apiKey);
        // The app will automatically pick up the new key on the next reload/session change.
        // For immediate effect, we could force a reload, but it's better to let the context handle it.
        alert('Chave de API guardada! A alteração terá efeito total ao recarregar a aplicação.');
    };

    const storageUsedBytes = userProfile.storage_used_bytes;
    const storageTotalBytes = (userProfile.plan?.storage_limit_gb || 0) * 1024 * 1024 * 1024;
    
    return (
        <>
            <ApiKeyManagerModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleSaveApiKey} />
            <div className="h-full w-full overflow-y-auto p-6 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold">Configurações</h1>
                    </header>

                    {notification && (
                        <div className="bg-brand-primary/20 border border-brand-primary text-brand-secondary p-3 rounded-lg mb-6 text-center">
                            {notification}
                        </div>
                    )}

                    <div className="space-y-8">
                        {/* Profile Section */}
                        <section className="bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                            <h2 className="text-xl font-semibold mb-4">Perfil</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Nome de Exibição</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-2"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                                    <input type="email" value={userProfile.email} disabled className="w-full bg-brand-dark border border-brand-accent rounded-lg p-2 text-gray-500 cursor-not-allowed"/>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button onClick={handleProfileSave} primary disabled={isSaving}>{isSaving ? 'A guardar...' : 'Guardar Perfil'}</Button>
                            </div>
                        </section>

                        {/* Appearance Section */}
                        <section className="bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                            <h2 className="text-xl font-semibold mb-4">Aparência</h2>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Tema</label>
                                <div className="flex gap-2 rounded-lg bg-brand-light p-1">
                                    <Button onClick={() => setTheme('light')} primary={theme === 'light'} className="flex-1">Claro</Button>
                                    <Button onClick={() => setTheme('dark')} primary={theme === 'dark'} className="flex-1">Escuro</Button>
                                    <Button onClick={() => setTheme('system')} primary={theme === 'system'} className="flex-1">Sistema</Button>
                                </div>
                            </div>
                        </section>

                        {/* Account Section */}
                        <section className="bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                            <h2 className="text-xl font-semibold mb-4">Conta e Plano</h2>
                            <div className="space-y-4">
                                <p><strong>Plano Atual:</strong> {userProfile.plan?.name || userProfile.role}</p>
                                <UsageMeter label="Créditos de Vídeo" used={userProfile.credits} total={userProfile.plan?.video_credits_monthly || 0} unit="créditos"/>
                                <UsageMeter label="Armazenamento" used={storageUsedBytes} total={storageTotalBytes} unit="GB"/>
                                <div className="flex flex-wrap gap-4 pt-4">
                                    <Button onClick={() => setActiveView('upgrade')}>Gerir Plano</Button>
                                    {!userProfile.isAdmin && (
                                        <Button onClick={() => setIsApiKeyModalOpen(true)}>Gerir Chave de API</Button>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SettingsView;