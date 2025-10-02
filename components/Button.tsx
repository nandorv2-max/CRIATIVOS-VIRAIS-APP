import React from 'react';

// FIX: Extend from ButtonHTMLAttributes to allow standard attributes like 'title'.
interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, onClick, disabled = false, primary = false, className = '', ...props }) => {
    const baseClass = "flex items-center justify-center px-6 py-2 rounded-md font-semibold tracking-wider uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
    const themeClass = primary ? "bg-brand-primary text-white hover:bg-brand-secondary" : "bg-transparent border border-brand-accent text-gray-200 hover:bg-brand-light hover:text-white";
    return <button onClick={onClick} disabled={disabled} className={`${baseClass} ${themeClass} ${className}`} {...props}>{children}</button>;
};

export default Button;
