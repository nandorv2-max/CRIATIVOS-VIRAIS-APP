import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { UserProfile, UserRole, Plan } from '../types.ts';
import Button from './Button.tsx';
import { IconX } from './Icons.tsx';

interface EditUserModalProps {
    user: UserProfile | null;
    plans: Plan[];
    onClose: () => void;
    onSave: (userId: string, updates: Partial<UserProfile>) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, plans, onClose, onSave }) => {
    const [role, setRole] = useState<UserRole>('free');
    const [credits, setCredits] = useState(0);
    const [status, setStatus] = useState<'active' | 'pending_approval' | 'suspended'>('pending_approval');
    const [planId, setPlanId] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState(''); // New state for expiration date


    useEffect(() => {
        if (user) {
            setRole(user.role);
            setCredits(user.credits);
            setStatus(user.status);
            setPlanId(user.plan_id);
            // Format the date for the input field
            setExpiresAt(user.access_expires_at ? new Date(user.access_expires_at).toISOString().split('T')[0] : '');
        }
    }, [user]);

    const handleSave = () => {
        if (user) {
            // No need to pass expiresAt here, as the backend calculates it.
            // We pass plan_id, which is what the RPC uses.
            onSave(user.id, { role, credits: Number(credits), status, plan_id: planId });
        }
    };

    if (!user) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-md relative text-white"
            >
                <h3 className="text-xl font-semibold mb-2 text-center">Editar Utilizador</h3>
                <p className="text-sm text-gray-400 mb-6 text-center truncate">{user.email}</p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Role (Função)</label>
                        <select 
                            value={role} 
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="premium">Premium</option>
                            <option value="professional">Professional</option>
                            <option value="bee">Bee</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                        <select 
                            value={status} 
                            onChange={(e) => setStatus(e.target.value as any)}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="pending_approval">Pendente de Aprovação</option>
                            <option value="active">Ativo</option>
                            <option value="suspended">Suspenso</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Plano</label>
                        <select 
                            value={planId || ''} 
                            onChange={(e) => setPlanId(e.target.value || null)}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="">Nenhum</option>
                            {plans.map(plan => (
                                <option key={plan.id} value={plan.id}>{plan.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Data de Expiração (Automático)</label>
                        <input
                            type="date"
                            value={expiresAt}
                            readOnly
                            className="w-full bg-brand-dark border border-brand-accent rounded-lg p-3 text-gray-400 cursor-not-allowed"
                        />
                         <p className="text-xs text-gray-500 mt-1">A data de expiração é definida automaticamente com base nos dias de teste do plano selecionado.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Créditos de Vídeo</label>
                        <input
                            type="number"
                            value={credits}
                            onChange={(e) => setCredits(Number(e.target.value))}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} primary>
                        Salvar Alterações
                    </Button>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-300" />
                </button>
            </motion.div>
        </div>
    );
};

export default EditUserModal;