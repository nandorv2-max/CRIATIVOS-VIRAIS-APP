import React, { useState } from 'react';
import Button from './Button';
import { IconX } from './Icons';

export type AdjustmentGroup = 'Luz' | 'Cor' | 'Efeitos';

interface SavePresetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, groups: AdjustmentGroup[]) => void;
}

const ADJUSTMENT_GROUPS: AdjustmentGroup[] = ['Luz', 'Cor', 'Efeitos'];

const SavePresetModal: React.FC<SavePresetModalProps> = ({ isOpen, onClose, onSave }) => {
    const [presetName, setPresetName] = useState('Predefinição sem título');
    const [selectedGroups, setSelectedGroups] = useState<Set<AdjustmentGroup>>(new Set(ADJUSTMENT_GROUPS));

    const handleToggleGroup = (group: AdjustmentGroup) => {
        setSelectedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(group)) {
                newSet.delete(group);
            } else {
                newSet.add(group);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        if (presetName.trim() && selectedGroups.size > 0) {
            onSave(presetName.trim(), Array.from(selectedGroups));
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-2xl w-full max-w-md relative text-white">
                <h3 className="text-xl font-semibold mb-6 text-center">Criar predefinição</h3>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="preset-name" className="block text-sm font-medium text-gray-400 mb-1">Nome da predefinição</label>
                        <input
                            id="preset-name"
                            type="text"
                            value={presetName}
                            onChange={e => setPresetName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                    </div>
                    <div>
                        <p className="block text-sm font-medium text-gray-400 mb-2">Selecionar Ajustes para Incluir</p>
                        <div className="space-y-2">
                            {ADJUSTMENT_GROUPS.map(group => (
                                <label key={group} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-700/50">
                                    <input
                                        type="checkbox"
                                        checked={selectedGroups.has(group)}
                                        onChange={() => handleToggleGroup(group)}
                                        className="w-5 h-5 rounded bg-gray-900 border-gray-600 text-yellow-400 focus:ring-yellow-500"
                                    />
                                    <span className="font-medium">{group}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} primary disabled={!presetName.trim() || selectedGroups.size === 0}>
                        Criar
                    </Button>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 transition-colors">
                    <IconX className="w-5 h-5 text-gray-400" />
                </button>
            </div>
        </div>
    );
};

export default SavePresetModal;
