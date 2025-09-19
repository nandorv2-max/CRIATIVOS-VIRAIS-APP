import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { UserProfile, UserRole } from '../types.ts';
import Button from './Button.tsx';
import { IconX } from './Icons.tsx';

interface EditUserModalProps {
    user: UserProfile | null;
    onClose: () => void;
    onSave: (userId: string, updates: { role: UserRole; credits: number }) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
    const [role, setRole] = useState<UserRole>('starter');
    const [credits, setCredits] = useState(0);

    useEffect(() => {
        if (user) {
            setRole(user.role);
            setCredits(user.credits);
        }
    }, [user]);

    const handleSave = () => {
        if (user) {
            onSave(user.id, { role, credits: Number(credits) });
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
                        <label className="block text-sm font-medium text-gray-300 mb-1">Plano</label>
                        <select 
                            value={role} 
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="starter">Starter</option>
                            <option value="premium">Premium</option>
                            <option value="professional">Professional</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Créditos</label>
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