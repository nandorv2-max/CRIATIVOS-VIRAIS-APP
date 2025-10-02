import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';
import { IconX } from './Icons.tsx';

interface ApiKeyManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => void;
}

const ApiKeyManagerModal: React.FC<ApiKeyManagerModalProps> = ({ isOpen, onClose, onSave }) => {
    const [currentKey, setCurrentKey] = useState('');
    const [newKey, setNewKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            const savedKey = window.localStorage.getItem('user_gemini_api_key') || '';
            setCurrentKey(savedKey);
            setNewKey(''); // Reset input field on open
        }
    }, [isOpen]);

    const handleSave = () => {
        if (newKey.trim()) {
            onSave(newKey.trim());
            onClose();
        }
    };

    const maskApiKey = (key: string) => {
        if (key.length <= 8) return '****';
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-light rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-md relative text-white"
            >
                <h3 className="text-xl font-semibold mb-4 text-center">Gerir Chave de API</h3>
                <p className="text-sm text-gray-300 mb-6 text-center">
                    A sua chave de API está guardada localmente no seu navegador e não é enviada para os nossos servidores.
                </p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Chave Atual</label>
                        <div className="w-full bg-brand-dark border border-brand-accent rounded-lg p-3 text-gray-200 font-mono text-sm">
                            {currentKey ? maskApiKey(currentKey) : 'Nenhuma chave guardada'}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nova Chave de API (opcional)</label>
                         <input
                            type="password"
                            placeholder="Cole a sua nova chave aqui para atualizar"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            className="w-full bg-brand-dark border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} primary disabled={!newKey.trim()}>
                        Guardar
                    </Button>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-brand-accent transition-colors">
                    <IconX className="w-5 h-5 text-gray-300" />
                </button>
            </motion.div>
        </div>
    );
};

export default ApiKeyManagerModal;