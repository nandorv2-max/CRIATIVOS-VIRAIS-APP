import React from 'react';
import { motion, Reorder } from 'framer-motion';
import { Page } from '../types.ts';
import { IconPlus, IconDuplicate, IconTrash } from './Icons.tsx';

interface PagesManagerProps {
    pages: Page[];
    activePageIndex: number;
    onSelectPage: (index: number) => void;
    onAddPage: () => void;
    onDeletePage: (index: number) => void;
    onDuplicatePage: (index: number) => void;
    onReorderPages: (pages: Page[]) => void;
    onPageDurationChange: (index: number, duration: number) => void;
    projectTime: number;
    isPlaying: boolean;
    onPlayPause: () => void;
}

const PagesManager: React.FC<PagesManagerProps> = ({
    pages, activePageIndex, onSelectPage, onAddPage, onDeletePage, onDuplicatePage,
    onReorderPages, onPageDurationChange, projectTime, isPlaying, onPlayPause
}) => {
    
    // We render a static thumbnail of the background color for simplicity and performance.
    // A full canvas snapshot would be more complex.
    const PageThumbnail: React.FC<{ page: Page, isActive: boolean }> = ({ page, isActive }) => (
        <div className={`aspect-video h-full rounded border-2 ${isActive ? 'border-brand-primary' : 'border-brand-accent/50'}`} style={{backgroundColor: page.backgroundColor}}>
        </div>
    );
    
    return (
        <div className="bg-brand-dark h-36 flex-shrink-0 border-t border-brand-accent z-20 flex flex-col p-2">
            <div className="flex-grow flex items-center gap-3 overflow-x-auto">
                <Reorder.Group axis="x" values={pages} onReorder={onReorderPages} className="flex items-center gap-3 h-full">
                    {pages.map((page, index) => (
                        <Reorder.Item key={page.id} value={page}>
                            <div className="relative h-24 group">
                                <div className="flex flex-col items-center h-full">
                                    <span className="text-xs text-gray-400 mb-1">{index + 1}</span>
                                    <div className="h-16 w-auto cursor-pointer" onClick={() => onSelectPage(index)}>
                                        <PageThumbnail page={page} isActive={index === activePageIndex} />
                                    </div>
                                    <input 
                                        type="number" 
                                        value={page.duration}
                                        onChange={(e) => onPageDurationChange(index, Number(e.target.value))}
                                        className="w-12 text-center bg-transparent text-xs mt-1 focus:outline-none focus:bg-brand-light rounded"
                                        step="0.1" min="0.1"
                                    />
                                </div>
                                 <div className="absolute top-2 -right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => onDuplicatePage(index)} className="p-1 bg-brand-light rounded-full text-gray-300 hover:bg-brand-primary"><IconDuplicate/></button>
                                    {pages.length > 1 && <button onClick={() => onDeletePage(index)} className="p-1 bg-brand-light rounded-full text-gray-300 hover:bg-red-500"><IconTrash/></button>}
                                </div>
                            </div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
                <button onClick={onAddPage} className="flex-shrink-0 h-16 w-28 bg-brand-light hover:border-brand-primary border-2 border-brand-accent/50 rounded flex flex-col items-center justify-center text-gray-300 hover:text-white">
                    <IconPlus className="w-6 h-6"/>
                    <span className="text-xs mt-1">Adicionar Página</span>
                </button>
            </div>
        </div>
    );
};

export default PagesManager;