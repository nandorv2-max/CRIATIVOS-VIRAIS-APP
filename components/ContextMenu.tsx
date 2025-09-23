import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { IconDuplicate, IconTrash, IconBringForward, IconSendBackward } from './Icons.tsx';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onBringForward: () => void;
    onSendBackward: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onDuplicate, onDelete, onBringForward, onSendBackward }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        // Atrasar a adição do listener para evitar que ele dispare no mesmo clique que abriu o menu
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const performAction = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <motion.div
            ref={menuRef}
            style={{ top: y, left: x }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute z-50 w-56 bg-brand-dark border border-brand-accent rounded-lg shadow-2xl p-2 text-white"
        >
            <button onClick={() => performAction(onDuplicate)} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-light rounded-md transition-colors">
                <IconDuplicate className="w-4 h-4" /> Duplicar
            </button>
            <div className="my-1 h-px bg-brand-accent/50" />
            <button onClick={() => performAction(onBringForward)} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-light rounded-md transition-colors">
                <IconBringForward /> Trazer para a Frente
            </button>
            <button onClick={() => performAction(onSendBackward)} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-light rounded-md transition-colors">
                <IconSendBackward /> Enviar para Trás
            </button>
            <div className="my-1 h-px bg-brand-accent/50" />
            <button onClick={() => performAction(onDelete)} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                <IconTrash className="w-4 h-4" /> Apagar
            </button>
        </motion.div>
    );
};

export default ContextMenu;
