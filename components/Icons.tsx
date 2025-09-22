import React from 'react';

export const IconLogo: React.FC<{className?: string}> = ({className}) => (
    <img src="https://i.imgur.com/5KX47Hm.jpeg" alt="GenIA Logo" className={className} />
);

export const IconOptions: React.FC<{className?: string}> = ({className}) => (
    // FIX: Corrected a typo in the viewBox attribute from '0 0 24" 24"' to '0 0 24 24'.
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
);

export const IconEdit: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

// FIX: Added className prop to allow for custom styling from parent components.
export const IconDownload: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);

export const IconUpload: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 ${className}`}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);

export const IconSparkles: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 3L9.27 9.27L3 12l6.27 2.73L12 21l2.73-6.27L21 12l-6.27-2.73L12 3z" /></svg>
);

export const IconCamera: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
);

export const IconRotate: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
);

export const IconBrush: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.06 11.9 2 22l10.1-7.06 A3 3 0 0 0 12.5 14a3 3 0 0 0 2.44-1.06Z"></path><path d="M14 7.5c0-.97.2-1.92.59-2.79C15.42 2.98 17.48 2 19.5 2c2.21 0 4 1.79 4 4 0 1.5-.79 2.8-1.91 3.44"></path></svg>
);

export const IconTrash: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

export const IconUndo: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
);

export const IconRedo: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
);

export const IconLayout: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
);

export const IconImage: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
);

export const IconX: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export const IconFlipHorizontal: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3m8-16h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 21V3"/></svg>;
export const IconFlipVertical: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3m18 8v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="M3 12h18"/></svg>;
// FIX: Add className prop to allow styling.
export const IconType: React.FC<{className?: string}> = ({className}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>;
export const IconBold: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>;
export const IconItalic: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 4 10 4M14 20 5 20M15 4 9 20"/></svg>;
export const IconUnderline: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><path d="M4 21h16"/></svg>;
export const IconAlignLeft: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H3M21 6H3M21 14H3M21 18H3"/></svg>;
export const IconAlignCenter: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H3M21 6H3M17 14H7M17 18H7"/></svg>;
export const IconAlignRight: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H7M21 6H7M21 14H3M21 18H3"/></svg>;
// FIX: Add className prop to allow styling.
export const IconShapes: React.FC<{className?: string}> = ({className}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M8.3 10a.7.7 0 0 1-.7-.7 3.7 3.7 0 0 1 3.7-3.7.7.7 0 0 1 .7.7Z"/><path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"/><path d="M12 12v10h10a10 10 0 0 1-10-10Z"/></svg>;
export const IconChevronDown: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>;
export const IconLetterCase: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.5v-17"/><path d="M7 6.5h10"/><path d="M9 13.5h6"/><path d="M10 3.5v3"/><path d="M14 3.5v3"/></svg>;
export const IconBringForward: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
export const IconSendBackward: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="13" height="13" rx="2" ry="2"/><path d="M8 22H7a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
// FIX: Added className prop to allow custom styling from parent components.
export const IconDuplicate: React.FC<{className?: string}> = ({className}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
export const IconLine: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5" /></svg>;
export const IconArrow: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
export const IconPlus: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
export const IconMinus: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>;
export const IconMaximize: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m4.5 4.5h-4.5m4.5 0v4.5m0-4.5L15 15" /></svg>;

export const IconGoogleDrive: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className={className}>
        <path fill="#0066DA" d="M3.132 16.244l2.955 4.973L12 11.261L9.043 6.287L3.132 16.244z"/>
        <path fill="#00AC47" d="M9.043 6.287L12 1.313l2.957 4.974L12 11.261L9.043 6.287z"/>
        <path fill="#FFC107" d="M6.087 21.217l2.956-4.974H14.96l-2.96 4.974H6.087z"/>
        <path fill="#4285F4" d="m14.957 6.287l-2.957 4.974l5.913 9.956h2.956L14.957 6.287z"/>
    </svg>
);
export const IconFolder: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0A2.25 2.25 0 015.625 7.5h12.75c1.135 0 2.093.787 2.232 1.867l.217.928a2.25 2.25 0 01-1.883 2.542H3.25a2.25 2.25 0 01-1.883-2.542l.217-.928A2.25 2.25 0 013.75 9.776z" /></svg>;
export const IconInstagram: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.012 3.584-.07 4.85c-.148 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.85s.012-3.584.07-4.85c.149-3.227 1.664-4.771 4.919-4.919C8.416 2.175 8.796 2.163 12 2.163m0-1.001C8.729 1.162 8.316 1.173 7.053 1.23c-3.6.164-6.113 2.697-6.279 6.278-.057 1.263-.068 1.687-.068 4.848s.011 3.586.068 4.848c.166 3.581 2.679 6.115 6.279 6.279 1.264.057 1.688.068 4.948.068s3.684-.011 4.948-.068c3.599-.164 6.115-2.698 6.278-6.279.057-1.262.068-1.687.068-4.848s-.011-3.586-.068-4.848c-.163-3.581-2.679-6.115-6.278-6.278-1.264-.057-1.688-.068-4.948-.068zm0 5.838a5 5 0 100 10 5 5 0 000-10zm0 8.002a3 3 0 110-6 3 3 0 010 6zm4.965-8.243a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/></svg>;
export const IconFacebook: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#1877F2" className={className}><path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.35C0 23.407.593 24 1.325 24H12.82v-9.29H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.732 0 1.325-.593 1.325-1.325V1.325C24 .593 23.407 0 22.675 0z"/></svg>;
export const IconFrame: React.FC = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-3 3-8 3-8-3-8-3"/><path d="M4 22s3-3 8-3 8 3 8 3"/><path d="M4 4v18M22 4v18"/></svg>;

export const IconArrowsHorizontal: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 17l5-5-5-5M10 7L5 12l5 5"/>
    </svg>
);

export const IconLayers: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
    </svg>
);

// New Icons for Dashboard
export const IconUser: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
export const IconLogout: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>;
export const IconGoogle: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.19,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.19,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" /></svg>;
export const IconRocket: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M13.14,2.29a3.83,3.83,0,0,0-2.28,0L3,6.83A2,2,0,0,0,2,8.73V17a4,4,0,0,0,4,4H8v1a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1V21h2a4,4,0,0,0,4-4V8.73a2,2,0,0,0-1-1.9Z M8,11a1,1,0,1,1,1,1A1,1,0,0,1,8,11ZM16,11a1,1,0,1,1,1,1A1,1,0,0,1,16,11Z"/></svg>;
export const IconMovie: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>;
export const IconWorld: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20ZM12,4a7.91,7.91,0,0,1,4,1.06l-1.42,1.42A6,6,0,0,0,6.34,9.25L5.06,7.83A7.91,7.91,0,0,1,12,4Zm0,16a7.91,7.91,0,0,1-4-1.06l1.42-1.42A6,6,0,0,0,17.66,14.75l1.28,1.42A7.91,7.91,0,0,1,12,20Z"/></svg>;
export const IconTools: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6.3l-6.3-6.3L1.4 1.4 0 2.8l1.4 1.4L7.8 15l-6.3 6.3 1.4 1.4 1.4-1.4L15 17.8l6.3-6.3 1.4 1.4 1.4-1.4-1.4-1.4z"/></svg>;
export const IconBroom: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M19.78 2.22a.999.999 0 0 0-1.41 0l-9.62 9.62a.999.999 0 0 0 0 1.41L12.92 17.4a.999.999 0 0 0 1.41 0l9.62-9.62a.999.999 0 0 0 0-1.41L19.78 2.22zM4.71 14.29a1.002 1.002 0 0 0-1.42 1.42L5 17.41V20a2 2 0 0 0 2 2h2.59l1.7-1.71a1.002 1.002 0 0 0-1.42-1.42L8.16 20H7v-2.59l-1.71-1.7a1.002 1.002 0 0 0-1.42.01L2.29 17.29a1.002 1.002 0 0 0-1.42-1.42L3.29 13.4a1.002 1.002 0 0 0 .01-1.42L1.59 10.29a1.002 1.002 0 1 0-1.42-1.42l2.42-2.42a1.002 1.002 0 0 0 1.42 1.42L5.71 9.59a1.002 1.002 0 0 0 1.41.01l1.71-1.71a1.002 1.002 0 0 0-1.41-1.42L4.29 9.59a1.002 1.002 0 0 0-1.42-1.42L1.45 6.75a1.002 1.002 0 0 0-1.42 1.42l2.42 2.42a1.002 1.002 0 0 0 1.42 1.42l1.71 1.71a1.002 1.002 0 0 0-.01 1.41l-2.58 2.58z"/></svg>;
export const IconCombine: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h7v12H4zm9 0V6h7v12h-7z"/></svg>;
export const IconKey: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777z"/><path d="M15.5 7.5 18 10l3-3-3-3-2.5 2.5z"/><path d="m11 11 4.5 4.5"/><path d="m14 12.5 1.5 1.5"/></svg>;

// New Icons for Features
export const IconImageIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M21.9,4H2.1A2.1,2.1,0,0,0,0,6.1V17.9A2.1,2.1,0,0,0,2.1,20H21.9A2.1,2.1,0,0,0,24,17.9V6.1A2.1,2.1,0,0,0,21.9,4ZM2,17.9V6.1A.1.1,0,0,1,2.1,6H21.9a.1.1,0,0,1,.1.1V17.9a.1.1,0,0,1-.1.1H2.1A.1.1,0,0,1,2,17.9ZM6,10a2,2,0,1,0-2-2A2,2,0,0,0,6,10Z"/></svg>;
export const IconTshirt: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M21,3H3A1,1,0,0,0,2,4V17a1,1,0,0,0,1,1H7v2a1,1,0,0,0,1,1H16a1,1,0,0,0,1-1V18h4a1,1,0,0,0,1-1V4A1,1,0,0,0,21,3ZM15,19H9V17.47a3,3,0,0,0,1.21-.92L12,14.77l1.79,1.78a3,3,0,0,0,1.21.92Z"/></svg>;
export const IconPackage: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M21.9,5.2l-9-4.5a1,1,0,0,0-.8,0l-9,4.5A1,1,0,0,0,2,6.1v12a1,1,0,0,0,.5,.9l9,4.5a1,1,0,0,0,.9,0l9-4.5a1,1,0,0,0,.5-.9V6.1A1,1,0,0,0,21.9,5.2ZM12,21.4,4,17.2V7.9l8,4Zm1-9.5-9-4.5,9-4.5,9,4.5Z"/></svg>;
export const IconMagicWand: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 4V2m0 14v-2m-7.5-1.5L6 9m10.5 1.5L18 9m-5 4v2m0-14V2M3.5 10.5L2 9m1.5 7.5L2 18m18.5-7.5L22 9m-1.5 7.5L22 18M12 22v-2m0-14V2m0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M20 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z"/><path d="M8 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z"/></svg>;

export const IconTranslate: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 11a8 8 0 0 1 8 8"/><path d="M4 19a8 8 0 0 0 8-8"/><path d="m5 8 4 4 4-4"/><path d="m12 20 4-4 4 4"/><path d="M16 11.5a6 6 0 0 0-3.1-5.2 5.5 5.5 0 0 0-5.8 0"/><path d="M20 11.5a6 6 0 0 0-3.1-5.2 5.5 5.5 0 0 0-5.8 0"/></svg>;

// FIX: Added IconAudio, IconLock, IconUnlock, IconPlay, and IconPause.
export const IconAudio: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
export const IconLock: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
export const IconUnlock: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>;
export const IconPlay: React.FC<{className?: string}> = ({className}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M8 5v14l11-7z"/></svg>;
export const IconPause: React.FC<{className?: string}> = ({className}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
export const IconHeart: React.FC<{className?: string; filled?: boolean}> = ({className, filled}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
);
export const IconFile: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
);

export const IconSave: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
);

export const IconCrop: React.FC<{className?: string}> = ({className}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>;