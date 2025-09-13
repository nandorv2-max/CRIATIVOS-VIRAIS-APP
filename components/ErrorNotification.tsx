
import React from 'react';

interface ErrorNotificationProps {
    message: string | null;
    onDismiss: () => void;
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ message, onDismiss }) => {
    if (!message) return null;
    return (
        <div className="fixed top-5 left-1/2 z-50 w-full max-w-md p-4 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg shadow-2xl flex items-center justify-between animate-fade-in-down">
            <span>{message}</span>
            <button onClick={onDismiss} className="p-1 rounded-full hover:bg-gray-800 transition-colors ml-4"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
    );
};

export default ErrorNotification;
