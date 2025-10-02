import React from 'react';

interface RadioPillProps {
    name: string;
    value: string;
    label: string;
    checked: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const RadioPill: React.FC<RadioPillProps> = ({ name, value, label, checked, onChange }) => (
    <label className={`cursor-pointer px-3 py-1.5 text-sm rounded-full transition-colors font-semibold ${checked ? 'bg-brand-primary text-white' : 'bg-brand-light hover:bg-brand-accent text-gray-200'}`}>
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="hidden" />
        {label}
    </label>
);

export default RadioPill;