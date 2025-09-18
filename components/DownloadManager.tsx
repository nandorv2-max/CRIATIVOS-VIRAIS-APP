import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DownloadJob } from '../types.ts';
import { IconX, IconDownload, IconSparkles } from './Icons.tsx';

interface DownloadJobCardProps {
    job: DownloadJob;
    onRemove: (id: string) => void;
}

const DownloadJobCard: React.FC<DownloadJobCardProps> = ({ job, onRemove }) => {
    
    useEffect(() => {
        if (job.status === 'done' && job.resultUrl) {
            // FIX: Use `window.document` to access the DOM.
            const a = window.document.createElement('a');
            a.href = job.resultUrl;
            a.download = job.fileName;
            // FIX: Use `window.document` to access the DOM.
            window.document.body.appendChild(a);
            a.click();
            // FIX: Use `window.document` to access the DOM.
            window.document.body.removeChild(a);
        }
    }, [job.status, job.resultUrl, job.fileName]);

    const getStatusLabel = () => {
        switch(job.status) {
            case 'rendering':
            case 'encoding':
            case 'preparing':
                return 'Baixando';
            case 'done':
                return 'Concluído';
            case 'error':
                return 'Falha';
            default:
                return job.status;
        }
    }

    const title = job.fileName.endsWith('.mp4')
        ? `Vídeo MP4 - Design sem nome...`
        : `Imagem - Design sem nome...`

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.5 }}
            className="bg-gray-100 border border-gray-200 rounded-xl shadow-lg p-3 flex items-center gap-4 text-brand-dark relative"
        >
            <div className="flex-shrink-0 w-14 h-14 bg-gray-200 rounded-md overflow-hidden flex items-center justify-center">
                {job.thumbnail ? (
                    <img src={job.thumbnail} alt="Pré-visualização do design" className="w-full h-full object-cover" />
                ) : (
                    <IconSparkles className="text-gray-400" />
                )}
            </div>

            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-start">
                    <p className="font-semibold text-gray-800 truncate text-base">{title}</p>
                    <p className="text-sm text-gray-500 flex-shrink-0 ml-2">{getStatusLabel()}</p>
                </div>
                
                {job.status === 'done' && job.resultUrl ? (
                     <p className="text-sm text-gray-600 mt-1">
                        Se o download não começar,{' '}
                        <a href={job.resultUrl} download={job.fileName} className="text-indigo-600 font-semibold underline">
                            clique aqui
                        </a>.
                    </p>
                ) : job.status === 'error' ? (
                     <p className="text-sm text-red-600 mt-1">{job.error}</p>
                ) : (
                    <>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${job.progress}%` }}></div>
                        </div>
                        {job.statusText && <p className="text-xs text-gray-500 mt-1">{job.statusText}</p>}
                    </>
                )}
            </div>
             <button onClick={() => onRemove(job.id)} className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                <IconX className="w-4 h-4" />
            </button>
        </motion.div>
    );
};


interface DownloadManagerProps {
    jobs: DownloadJob[];
    setJobs: React.Dispatch<React.SetStateAction<DownloadJob[]>>;
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ jobs, setJobs }) => {
    const removeJob = (id: string) => {
        setJobs(prev => prev.filter(job => job.id !== id));
    };

    return (
        <div className="fixed bottom-4 right-4 z-[100] w-full max-w-sm space-y-3">
            <AnimatePresence>
                {jobs.map(job => (
                    <DownloadJobCard key={job.id} job={job} onRemove={removeJob} />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default DownloadManager;