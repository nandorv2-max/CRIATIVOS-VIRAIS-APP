import React from 'react';
import { motion } from 'framer-motion';
import { IconBlur, IconGrain, IconDivineRays, IconSparkles, IconPalette, IconLongExposure } from './Icons.tsx';

type AiEffectType = 'bgBlur' | 'grain' | 'rays' | 'magicFocus' | 'vibrantColor' | 'longExposure';

interface EffectsToolbarProps {
    onApplyEffect: (effect: AiEffectType) => void;
    isLoadingAI: boolean;
}

const EffectButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; disabled: boolean; }> = ({ icon, label, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors text-gray-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed w-24 h-20"
    >
        <div className="w-6 h-6 mb-1 flex items-center justify-center">
            {icon}
        </div>
        <span className="text-xs font-semibold text-center leading-tight">{label}</span>
    </button>
);

const EffectsToolbar: React.FC<EffectsToolbarProps> = ({ onApplyEffect, isLoadingAI }) => {

    const aiEffects: { id: AiEffectType; icon: React.ReactNode; label: string; }[] = [
        { id: 'bgBlur', icon: <IconBlur />, label: 'Desfocar Fundo' },
        { id: 'grain', icon: <IconGrain />, label: 'Granulado IA' },
        { id: 'rays', icon: <IconDivineRays />, label: 'Raios Divinos' },
        { id: 'magicFocus', icon: <IconSparkles />, label: 'Foco Mágico' },
        { id: 'vibrantColor', icon: <IconPalette />, label: 'Cor Vibrante' },
        { id: 'longExposure', icon: <IconLongExposure />, label: 'Exposição Longa' },
    ];

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 inset-x-0 z-20 flex justify-center"
        >
             <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-xl p-1 border border-white/20 shadow-lg">
                {aiEffects.map(effect => (
                    <EffectButton
                        key={effect.id}
                        icon={effect.icon}
                        label={effect.label}
                        onClick={() => onApplyEffect(effect.id)}
                        disabled={isLoadingAI}
                    />
                ))}
            </div>
        </motion.div>
    );
};

export default EffectsToolbar;