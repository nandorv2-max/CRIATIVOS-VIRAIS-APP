
import React from 'react';

interface SkeletonLoaderProps {
    className: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className }) => {
    return <div className={`animate-pulse bg-gray-800 ${className}`}></div>;
};

export default SkeletonLoader;
