import React from 'react';
import Button from './Button';

interface ErrorCardProps {
    era: string;
    isPolaroid?: boolean;
    onRegenerate?: () => void;
    showLabel?: boolean;
}

// Destructured the `era` prop, which was missing and causing a reference error below.
const ErrorCard: React.FC<ErrorCardProps> = ({ era, isPolaroid = true, onRegenerate, showLabel = true }) => {
     const containerClass = isPolaroid ? 'relative group bg-gray-100 p-3 pb-12 shadow-md' : 'pb-4 bg-gray-900 rounded-xl shadow-md';
    const errorContainerClass = isPolaroid ? 'aspect-square bg-gray-200 border-2 border-dashed border-red-500/50' : 'rounded-t-xl bg-gray-800 border-2 border-dashed border-red-500/50 aspect-[3/4]';
    const textClass = isPolaroid ? 'text-center mt-4 font-caveat text-3xl text-gray-900 absolute bottom-3 left-0 right-0' : 'text-center mt-3 text-lg font-semibold text-gray-300 px-3';
    return (
        <div className={`relative transition-all duration-500 ease-in-out group ${containerClass}`}>
            <div className={`flex flex-col items-center justify-center text-center p-4 ${errorContainerClass}`}>
                <p className="text-red-400 font-medium mb-4">A geração falhou</p>
                {onRegenerate && (<Button onClick={onRegenerate} primary>Tentar Novamente</Button>)}
            </div>
            {showLabel && <p className={textClass}>{era}</p>}
        </div>
    );
};
export default ErrorCard;