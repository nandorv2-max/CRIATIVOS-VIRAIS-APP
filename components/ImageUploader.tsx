import React, { useState, useRef } from 'react';

const ImageUploader: React.FC<{ onUpload?: (files: FileList) => void, onClick?: () => void, children: React.ReactNode, className?: string, single?: boolean }> = ({ onUpload, onClick, children, className, single = false }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragIn = (e: React.DragEvent) => {
        handleDrag(e);
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragOver(true);
        }
    };

    const handleDragOut = (e: React.DragEvent) => {
        handleDrag(e);
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        handleDrag(e);
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUpload) {
            onUpload(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };
    
    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (onUpload) {
            inputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && onUpload) {
            onUpload(e.target.files);
            if (e.target) e.target.value = ''; // Reset input
        }
    };

    return (
        <div
            onClick={handleClick}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg transition-colors duration-200 ${className} ${isDragOver ? 'border-brand-primary bg-brand-primary/10' : 'border-brand-accent hover:border-brand-secondary'}`}
        >
            {onUpload && <input ref={inputRef} type="file" multiple={!single} accept="image/*" onChange={handleFileChange} className="hidden" />}
            {children}
        </div>
    );
};

export default ImageUploader;