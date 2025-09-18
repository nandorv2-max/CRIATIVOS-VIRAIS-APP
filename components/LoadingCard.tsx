import React from 'react';
import SkeletonLoader from './SkeletonLoader.tsx';

interface LoadingCardProps {
    era: string;
    isPolaroid?: boolean;
    showLabel?: boolean;
}

const LoadingCard: React.FC<LoadingCardProps> = ({ isPolaroid = true, showLabel = true }) => {
    const containerClass = isPolaroid ? 'relative bg-brand-polaroid p-3 pb-12 shadow-md' : 'pb-4 bg-brand-light rounded-xl shadow-md';
    const loaderClass = isPolaroid ? 'aspect-square' : 'aspect-[3/4] rounded-t-xl';
    return (
        <div className={containerClass}>
            <SkeletonLoader className={loaderClass} />
            {isPolaroid && showLabel && (<div className="absolute bottom-3 left-0 right-0 flex justify-center"><SkeletonLoader className="h-6 w-3/4 rounded-md bg-gray-300" /></div>)}
            {!isPolaroid && showLabel && (<div className="mt-3 flex justify-center"><SkeletonLoader className="h-5 w-1/2 rounded-md" /></div>)}
            <div className="absolute inset-0 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-primary"></div></div>
        </div>
    );
};

export default LoadingCard;