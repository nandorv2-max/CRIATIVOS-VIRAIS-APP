
import React from 'react';

interface SkeletonLoaderProps {
    className: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className }) => {
    return <div className={`animate-pulse bg-brand-light ${className}`}></div>;
};

export default SkeletonLoader;