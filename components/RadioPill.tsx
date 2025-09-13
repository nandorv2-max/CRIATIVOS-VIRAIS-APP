
import React from 'react';

interface RadioPillProps {
    name: string;
    value: string;
    label: string;
    checked: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const RadioPill: React.FC<RadioPillProps> = ({ name, value, label, checked, onChange }) => (
    <label className={`cursor-pointer px-3 py-1.5 text-sm rounded-full transition-colors font-semibold ${checked ? 'bg-yellow-400 text-black' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="hidden" />
        {label}
    </label>
);

export default RadioPill;
