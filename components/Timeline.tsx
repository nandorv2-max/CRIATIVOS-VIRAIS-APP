
import React from 'react';
import { Reorder } from 'framer-motion';
import { Page } from '../types.ts';
import { IconPlus, IconDuplicate, IconTrash } from './Icons.tsx';

interface TimelineProps {
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

const PageThumbnail: React.FC<{ page: Page, isActive: boolean }> = ({ page, isActive }) => (
    <div className={`relative aspect-video h-full rounded border-2 ${isActive ? 'border-brand-primary ring-2 ring-brand-primary/50' : 'border-brand-accent/50'} overflow-hidden`} style={{backgroundColor: page.backgroundColor}}>
        {/* A full render of layers here would be too slow. This is a visual placeholder. */}
    </div>
);

const Timeline: React.FC<TimelineProps> = ({
    pages, activePageIndex, onSelectPage, onAddPage, onDeletePage, onDuplicatePage,
    onReorderPages
}) => {
    
    return (
        <div className="bg-brand-dark h-36 flex-shrink-0 border-t border-brand-accent z-20 flex p-2">
            <div className="flex-grow flex items-center gap-3 overflow-x-auto">
                <Reorder.Group axis="x" values={pages} onReorder={onReorderPages} className="flex items-center gap-3 h-full px-2">
                    {pages.map((page, index) => (
                        <Reorder.Item key={page.id} value={page}>
                            <div className="flex flex-col items-center h-24 group relative">
                                <span className="text-xs text-gray-400 mb-1">{index + 1}</span>
                                <div className="h-16 w-auto cursor-pointer" onClick={() => onSelectPage(index)}>
                                    <PageThumbnail page={page} isActive={index === activePageIndex} />
                                </div>
                                 <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button title="Duplicar Página" onClick={(e) => { e.stopPropagation(); onDuplicatePage(index); }} className="p-1 bg-brand-light/80 rounded-full text-gray-300 hover:bg-brand-primary"><IconDuplicate className="w-3 h-3"/></button>
                                    {pages.length > 1 && <button title="Apagar Página" onClick={(e) => { e.stopPropagation(); onDeletePage(index); }} className="p-1 bg-brand-light/80 rounded-full text-gray-300 hover:bg-red-500"><IconTrash className="w-3 h-3"/></button>}
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

export default Timeline;
