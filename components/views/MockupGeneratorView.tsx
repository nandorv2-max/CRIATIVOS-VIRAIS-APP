import React, { useState } from 'react';
import MockupDetailModal from '../MockupDetailModal';

const MOCKUP_TYPES = [
    { id: 'tshirt', name: 'Camiseta', prompt: 't-shirt' },
    { id: 'mug', name: 'Caneca', prompt: 'mug' },
    { id: 'bag', name: 'Sacola', prompt: 'tote bag' },
    { id: 'phone_case', name: 'Capa Celular', prompt: 'phone case' },
    { id: 'pillow', name: 'Almofada', prompt: 'pillow' },
    { id: 'hoodie', name: 'Moletom', prompt: 'hoodie' },
    { id: 'cap', name: 'Boné', prompt: 'cap' },
    { id: 'book_cover', name: 'Capa Livro', prompt: 'book cover' },
    { id: 'poster', name: 'Pôster', prompt: 'poster on a wall' },
    { id: 'sticker', name: 'Adesivo', prompt: 'sticker' },
    { id: 'laptop_sleeve', name: 'Capa Laptop', prompt: 'laptop sleeve' },
    { id: 'socks', name: 'Meias', prompt: 'pair of socks' },
    { id: 'bottle', name: 'Garrafa', prompt: 'water bottle' },
    { id: 'desktop', name: 'Desktop', prompt: 'desktop computer screen' },
    { id: 'laptop', name: 'Laptop', prompt: 'laptop screen' },
    { id: 'tablet', name: 'Tablet', prompt: 'tablet screen' },
    { id: 'smartphone', name: 'Smartphone', prompt: 'smartphone screen' },
    { id: 'premium_box', name: 'Caixa Box Premium', prompt: 'premium product box' },
];

const MockupGeneratorView: React.FC = () => {
    const [selectedMockup, setSelectedMockup] = useState<{ id: string, name: string, prompt: string } | null>(null);

    return (
        <>
            <div className="h-full flex flex-col p-6">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white">Gerador de Mockups</h1>
                    <p className="text-gray-300 mt-1">Selecione um produto para aplicar a sua arte.</p>
                </header>
                <div className="flex-grow overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {MOCKUP_TYPES.map(mockup => (
                            <button
                                key={mockup.id}
                                onClick={() => setSelectedMockup(mockup)}
                                className="p-4 bg-brand-light border border-brand-accent rounded-lg text-center font-semibold text-gray-200 hover:border-brand-primary hover:bg-brand-primary/10 transition-all"
                            >
                                {mockup.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            {selectedMockup && (
                <MockupDetailModal
                    isOpen={!!selectedMockup}
                    onClose={() => setSelectedMockup(null)}
                    mockupType={selectedMockup}
                />
            )}
        </>
    );
};

export default MockupGeneratorView;