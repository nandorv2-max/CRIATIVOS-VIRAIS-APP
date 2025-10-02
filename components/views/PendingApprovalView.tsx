import React from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabaseClient.ts';
import { IconLogout } from '../Icons.tsx';

// Ícone de verificação para a lista de benefícios
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
);


interface Plan {
    name: string;
    price: string;
    description: string;
    features: string[];
    link: string;
    popular?: boolean;
}

const plans: Plan[] = [
    {
        name: 'Starter',
        price: 'R$ 34,90',
        description: 'Ideal para começar a explorar o poder da IA.',
        features: [
            '10 GB de armazenamento',
            '10 GB de downloads/mês',
            'Backups semanais',
            'Logs por 7 dias',
            'Suporte por e-mail',
            'Acesso ilimitado a Fontes Premium',
            'Acesso ilimitado à Galeria Premium de Mídias',
            'Acesso ilimitado a Presets Premium',
            'Upload de Fontes Externas e Presets Personalizados',
            '0 créditos para geração de vídeo'
        ],
        link: 'https://pay.kiwify.com.br/OFFu5iy'
    },
    {
        name: 'Premium',
        price: 'R$ 79,90',
        description: 'O plano perfeito para criadores de conteúdo e profissionais.',
        features: [
            '50 GB de armazenamento',
            '30 GB de downloads/mês',
            'Backups diários (retenção de 7 dias)',
            'Logs por 7 dias',
            'Suporte prioritário por e-mail',
            'Acesso ilimitado a Fontes Premium',
            'Acesso ilimitado à Galeria Premium de Mídias',
            'Acesso ilimitado a Presets Premium',
            'Upload de Fontes Externas e Presets Personalizados',
            '600 créditos para geração de vídeo'
        ],
        link: 'https://pay.kiwify.com.br/zhM9eXp',
        popular: true
    },
    {
        name: 'Professional',
        price: 'R$ 199,90',
        description: 'Para agências e utilizadores com alto volume de trabalho.',
        features: [
            '200 GB de armazenamento',
            '150 GB de downloads/mês',
            'Backups diários (retenção de 14 dias)',
            'Logs avançados de uso',
            'Suporte prioritário via e-mail + chat',
            'Acesso ilimitado a Fontes Premium',
            'Acesso ilimitado à Galeria Premium de Mídias',
            'Acesso ilimitado a Presets Premium',
            'Upload de Fontes Externas e Presets Personalizados',
            '1000 créditos para geração de vídeo'
        ],
        link: 'https://pay.kiwify.com.br/cr1dQTZ'
    }
];

interface UpgradePlanViewProps {
    showLogout?: boolean;
}

const UpgradePlanView: React.FC<UpgradePlanViewProps> = ({ showLogout = true }) => {
    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-gradient-main overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="w-full max-w-6xl text-center"
            >
                <h1 className="text-4xl sm:text-5xl font-bold text-white">Escolha o Plano Ideal para Você</h1>
                <p className="mt-4 text-lg text-gray-300 max-w-3xl mx-auto">
                    Desbloqueie todo o potencial da criação com IA. Faça um upgrade agora para aceder a funcionalidades exclusivas, mais armazenamento e suporte prioritário.
                </p>

                <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {plans.map((plan) => (
                        <div key={plan.name} className={`relative rounded-2xl p-8 border transition-all duration-300 flex flex-col ${plan.popular ? 'bg-brand-primary/10 border-brand-primary lg:scale-105' : 'bg-brand-dark/50 border-brand-accent hover:border-brand-accent/70'}`}>
                            {plan.popular && (
                                <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-xs font-bold px-4 py-1 rounded-full">MAIS POPULAR</div>
                            )}
                            <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
                            <p className="mt-2 text-gray-400 min-h-[40px]">{plan.description}</p>
                            <div className="my-6">
                                <span className="text-5xl font-bold text-white">{plan.price}</span>
                                <span className="text-gray-400">/mês</span>
                            </div>
                            <ul className="space-y-4 text-left flex-grow">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start gap-3">
                                        <CheckIcon className="w-5 h-5 text-brand-primary flex-shrink-0 mt-1" />
                                        <span className="text-gray-300">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <a 
                                href={plan.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={`block w-full mt-8 px-6 py-3 rounded-lg font-semibold transition-colors duration-300 ${plan.popular ? 'bg-brand-primary text-white hover:bg-brand-secondary' : 'bg-brand-accent text-white hover:bg-brand-light'}`}
                            >
                                Assinar {plan.name}
                            </a>
                        </div>
                    ))}
                </div>

                 {showLogout && (
                    <div className="mt-12">
                        <button 
                            onClick={handleLogout} 
                            className="flex items-center justify-center gap-2 max-w-xs mx-auto px-4 py-2 bg-brand-light/50 border border-brand-accent rounded-lg text-white font-semibold hover:bg-brand-accent/50 transition-colors"
                        >
                            <IconLogout className="w-5 h-5" />
                            <span>Sair</span>
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default UpgradePlanView;