import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, onClick, disabled = false, primary = false, className = '' }) => {
    const baseClass = "flex items-center justify-center px-6 py-2 rounded-md font-semibold tracking-wider uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
    const themeClass = primary ? "bg-yellow-400 text-black hover:bg-yellow-300" : "bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white";
    return <button onClick={onClick} disabled={disabled} className={`${baseClass} ${themeClass} ${className}`}>{children}</button>;
};

export default Button;