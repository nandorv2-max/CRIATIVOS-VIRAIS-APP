import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import * as paletteDb from '../utils/paletteDb.ts';
import type { Palette } from '../utils/paletteDb.ts';
import { IconPlus, IconTrash, IconX, IconEdit } from './Icons.tsx';

const hexToRgb = (hex: string) => {
    let r = 0, g = 0, b = 0;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
    }
    return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
};

const hsvToRgb = (h: number, s: number, v: number) => {
    s /= 100; v /= 100;
    let r = 0, g = 0, b = 0;
    let i = Math.floor(h / 60);
    let f = h / 60 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

interface ColorPickerPopoverProps {
    color: string;
    onChange: (newColor: string) => void;
    onClose: () => void;
}

const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({ color, onChange, onClose }) => {
    const { r, g, b } = hexToRgb(color);
    const { h, s, v } = rgbToHsv(r, g, b);

    const [hue, setHue] = useState(h);
    const [saturation, setSaturation] = useState(s);
    const [value, setValue] = useState(v);
    const [hex, setHex] = useState(color);
    
    const saturationValueRef = useRef<HTMLDivElement>(null);

    // Palette state
    const [palettes, setPalettes] = useState<Palette[]>([]);
    const [activePaletteId, setActivePaletteId] = useState<string | null>(null);
    const [newPaletteName, setNewPaletteName] = useState('');

    useEffect(() => {
        paletteDb.getPalettes().then(p => {
            setPalettes(p);
            if (p.length > 0) {
                setActivePaletteId(p[0].id);
            }
        });
    }, []);

    const activePalette = palettes.find(p => p.id === activePaletteId);

    const updateColorFromUI = useCallback((newHue: number, newSaturation: number, newValue: number) => {
        const { r, g, b } = hsvToRgb(newHue, newSaturation, newValue);
        const newHex = rgbToHex(r, g, b);
        setHex(newHex);
        onChange(newHex);
    }, [onChange]);

    const updateColorFromPicker = useCallback((newColor: string) => {
        const { r, g, b } = hexToRgb(newColor);
        const { h, s, v } = rgbToHsv(r, g, b);
        setHue(h);
        setSaturation(s);
        setValue(v);
        setHex(newColor);
        onChange(newColor);
    }, [onChange]);

    const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHue = parseFloat(e.target.value);
        setHue(newHue);
        updateColorFromUI(newHue, saturation, value);
    };

    const handleSaturationValueChange = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
        if (!saturationValueRef.current) return;
        const rect = saturationValueRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        const newSaturation = (x / rect.width) * 100;
        const newValue = 100 - ((y / rect.height) * 100);
        setSaturation(newSaturation);
        setValue(newValue);
        updateColorFromUI(hue, newSaturation, newValue);
    };

    const handleSaturationValueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        handleSaturationValueChange(e.nativeEvent);
        const mouseMoveHandler = (moveEvent: MouseEvent) => {
             handleSaturationValueChange(moveEvent);
        };
        const mouseUpHandler = () => {
            window.document.removeEventListener('mousemove', mouseMoveHandler);
            window.document.removeEventListener('mouseup', mouseUpHandler);
        };
        window.document.addEventListener('mousemove', mouseMoveHandler);
        window.document.addEventListener('mouseup', mouseUpHandler);
    };

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newHex = e.target.value;
        setHex(newHex);
        if (/^#[0-9A-F]{6}$/i.test(newHex) || /^#([0-9A-F]{3})$/i.test(newHex)) {
             updateColorFromPicker(newHex);
        }
    };
    
    useEffect(() => {
        updateColorFromPicker(color);
    }, [color, updateColorFromPicker]);

    const handleCreatePalette = async () => {
        if (!newPaletteName.trim()) return;
        const newPalette: Palette = { id: nanoid(), name: newPaletteName.trim(), colors: [] };
        await paletteDb.savePalette(newPalette);
        setPalettes(prev => [...prev, newPalette]);
        setActivePaletteId(newPalette.id);
        setNewPaletteName('');
    };

    const handleDeletePalette = async () => {
        if (!activePaletteId || !window.confirm(`Tem a certeza que quer apagar a paleta "${activePalette?.name}"?`)) return;
        await paletteDb.deletePalette(activePaletteId);
        const newPalettes = palettes.filter(p => p.id !== activePaletteId);
        setPalettes(newPalettes);
        setActivePaletteId(newPalettes.length > 0 ? newPalettes[0].id : null);
    };

    const handleAddColor = async () => {
        if (!activePalette || activePalette.colors.find(c => c.toUpperCase() === hex.toUpperCase())) return;
        const newColors = [...activePalette.colors, hex];
        const updatedPalette = { ...activePalette, colors: newColors };
        await paletteDb.savePalette(updatedPalette);
        setPalettes(palettes.map(p => p.id === activePaletteId ? updatedPalette : p));
    };

    const handleRemoveColor = async (colorToRemove: string) => {
        if (!activePalette) return;
        const newColors = activePalette.colors.filter(c => c !== colorToRemove);
        const updatedPalette = { ...activePalette, colors: newColors };
        await paletteDb.savePalette(updatedPalette);
        setPalettes(palettes.map(p => p.id === activePaletteId ? updatedPalette : p));
    };

    const handleRenamePalette = async () => {
        if (!activePaletteId) return;
        const newName = prompt("Digite o novo nome da paleta:", activePalette?.name);
        if (newName && newName.trim() && activePalette) {
            const updatedPalette = { ...activePalette, name: newName.trim() };
            await paletteDb.savePalette(updatedPalette);
            setPalettes(palettes.map(p => p.id === activePaletteId ? updatedPalette : p));
        }
    };
    
    const saturationBg = `hsl(${hue}, 100%, 50%)`;
    const hueBg = `linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`;

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-2xl border border-gray-700 w-64 text-white">
            <div
                ref={saturationValueRef}
                onMouseDown={handleSaturationValueMouseDown}
                className="w-full h-40 rounded-md cursor-crosshair relative"
                style={{ backgroundColor: saturationBg }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent rounded-md" />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent rounded-md" />
                <div
                    className="absolute w-4 h-4 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${saturation}%`, top: `${100 - value}%`, borderColor: value > 50 ? 'black' : 'white' }}
                />
            </div>
            <div className="mt-4 relative h-4 flex items-center">
                 <div
                    className="absolute w-full h-2 rounded-full"
                    style={{ background: hueBg }}
                ></div>
                <input
                    type="range"
                    min="0"
                    max="360"
                    value={hue}
                    onChange={handleHueChange}
                    onMouseUp={() => onClose()}
                    className="w-full h-full appearance-none bg-transparent cursor-pointer focus:outline-none hue-range"
                />
            </div>
            <div className="mt-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-gray-600 flex-shrink-0" style={{ backgroundColor: hex }}></div>
                <input
                    type="text"
                    value={hex}
                    onChange={handleHexChange}
                    onBlur={() => onClose()}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-center font-mono"
                />
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                <h4 className="text-sm font-semibold">Paletas</h4>
                <div className="flex gap-2 items-center">
                    <select
                        value={activePaletteId || ''}
                        onChange={(e) => setActivePaletteId(e.target.value)}
                        className="flex-grow bg-gray-900 border border-gray-600 rounded-md p-2 text-sm"
                        disabled={palettes.length === 0}
                    >
                        {palettes.length === 0 && <option>Nenhuma paleta</option>}
                        {palettes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {activePalette && (
                         <div className="flex">
                             <button onClick={handleRenamePalette} className="p-1.5 text-gray-400 hover:text-white" title="Renomear Paleta"><IconEdit className="w-4 h-4"/></button>
                            <button onClick={handleDeletePalette} className="p-1.5 text-gray-400 hover:text-red-400" title="Apagar Paleta"><IconTrash className="w-4 h-4"/></button>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newPaletteName}
                        onChange={(e) => setNewPaletteName(e.target.value)}
                        placeholder="Nome da nova paleta..."
                        className="flex-grow bg-gray-900 border border-gray-600 rounded-md p-2 text-sm"
                        onKeyDown={e => e.key === 'Enter' && handleCreatePalette()}
                    />
                    <button onClick={handleCreatePalette} className="px-3 bg-brand-primary text-white rounded-md font-bold hover:bg-brand-secondary">+</button>
                </div>
                {activePalette && (
                    <div className="grid grid-cols-8 gap-2 mt-2 pt-2 border-t border-gray-700/50">
                        {activePalette.colors.map((c, i) => (
                            <div key={`${c}-${i}`} className="relative group">
                                <button
                                    onClick={() => updateColorFromPicker(c)}
                                    className="w-6 h-6 rounded-full border-2 border-gray-500"
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                                <button
                                    onClick={() => handleRemoveColor(c)}
                                    className="absolute -top-1 -right-1 p-0.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <IconX className="w-3 h-3 text-white" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={handleAddColor}
                            className="w-6 h-6 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center text-gray-400 hover:border-white hover:text-white"
                            title="Adicionar cor atual"
                        >
                            <IconPlus className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ColorPickerButtonProps {
    color: string;
    onChange: (color: string) => void;
    onInteractionEnd?: () => void;
    className?: string;
}

const ColorPicker: React.FC<ColorPickerButtonProps> = ({ color, onChange, onInteractionEnd, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left });
        }
    }, []);

    const handleToggle = () => {
        setIsOpen(prev => {
            if (!prev) {
                updatePosition();
            }
            return !prev;
        });
    };

    const handleClose = useCallback(() => {
        setIsOpen(false);
        if (onInteractionEnd) {
            onInteractionEnd();
        }
    }, [onInteractionEnd]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
                popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, handleClose, updatePosition]);


    return (
        <div className={`relative ${className}`}>
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="w-9 h-9 rounded-md border-2 border-gray-600 flex items-center justify-center"
                style={{ backgroundColor: color }}
            />
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={popoverRef}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        style={{
                            position: 'fixed',
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            zIndex: 100,
                        }}
                    >
                        <ColorPickerPopover
                            color={color}
                            onChange={onChange}
                            onClose={handleClose}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ColorPicker;