import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { motion } from 'framer-motion';
import { ThemeContext } from '../../types.ts';
import type { Theme } from '../../types.ts';
import { updateThemeSettings, adminUploadThemeAsset } from '../../services/databaseService.ts';
import Button from '../Button.tsx';
import { TEMPLATES } from '../../constants.ts';

const ColorInput: React.FC<{ label: string; value: string; onChange: (value: string) => void; }> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <div className="flex items-center gap-2 bg-brand-light border border-brand-accent rounded-lg p-2">
            <input
                type="color"
                value={value || '#000000'}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                style={{ appearance: 'none', padding: 0 } as any}
            />
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent focus:outline-none"
                placeholder="#RRGGBB"
            />
        </div>
    </div>
);

const ImageUploader: React.FC<{ label: string; value?: string; onFileSelect: (file: File) => void; onClear: () => void; recommendation: string; }> = ({ label, value, onFileSelect, onClear, recommendation }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div className="bg-brand-light p-4 rounded-lg border border-brand-accent/50 space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold">{label}</h4>
                    <p className="text-xs text-gray-400">{recommendation}</p>
                </div>
                {value && <img src={value} alt="Preview" className="w-16 h-16 rounded-md object-contain bg-black/20" />}
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={() => ref.current?.click()} className="flex-1 text-sm">{value ? 'Mudar Imagem' : 'Carregar Imagem'}</Button>
                <input type="file" ref={ref} onChange={e => e.target.files && onFileSelect(e.target.files[0])} className="hidden" accept="image/*" />
                {value && <Button onClick={onClear} className="!bg-red-600/50 hover:!bg-red-600 text-sm">Remover</Button>}
            </div>
        </div>
    );
};


const ThemeCustomizationView: React.FC = () => {
    const themeContext = useContext(ThemeContext);
    const [theme, setTheme] = useState<Partial<Theme>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    
    const iconFileInputRef = useRef<HTMLInputElement>(null);
    const [currentTargetModuleId, setCurrentTargetModuleId] = useState<string | null>(null);


    useEffect(() => {
        if (themeContext?.theme) {
            setTheme(themeContext.theme);
        }
    }, [themeContext?.theme]);

    const handleFieldChange = (field: keyof Theme, value: any) => {
        setTheme(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = async (field: 'logo_url' | 'background_image_url' | 'login_background_image_url', file: File) => {
        setIsLoading(true);
        setNotification('A carregar imagem...');
        try {
            const newUrl = await adminUploadThemeAsset(file);
            handleFieldChange(field, newUrl);
            setNotification('Imagem carregada! Clique em "Salvar Alterações" para aplicar.');
        } catch (error) {
            console.error("File upload failed:", error);
            setNotification('Falha no upload da imagem.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        setNotification(null);
        try {
            await updateThemeSettings(theme);
            await themeContext?.loadTheme();
            setNotification('Tema salvo com sucesso!');
        } catch (error) {
            console.error("Failed to save theme:", error);
            setNotification('Falha ao salvar o tema.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleIconColorChange = (moduleId: string, color: string) => {
        setTheme(prev => ({
            ...prev,
            module_icons: {
                ...prev.module_icons,
                [moduleId]: {
                    ...prev.module_icons?.[moduleId],
                    color: color
                }
            }
        }));
    };

    const triggerIconUpload = (moduleId: string) => {
        setCurrentTargetModuleId(moduleId);
        iconFileInputRef.current?.click();
    };

    const handleIconFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && currentTargetModuleId) {
            if (file.type !== 'image/svg+xml') {
                setNotification('Por favor, selecione um arquivo SVG válido.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const svgContent = e.target?.result as string;
                 setTheme(prev => ({
                    ...prev,
                    module_icons: {
                        ...prev.module_icons,
                        [currentTargetModuleId]: {
                            ...prev.module_icons?.[currentTargetModuleId],
                            svg_content: svgContent
                        }
                    }
                }));
            };
            reader.readAsText(file);
        }
        if(event.target) event.target.value = '';
    };
    
    const handleRemoveCustomIcon = (moduleId: string) => {
        setTheme(prev => {
            const newIcons = { ...prev.module_icons };
            if (newIcons[moduleId]) {
                delete (newIcons[moduleId] as any).svg_content;
                if (!(newIcons[moduleId] as any).color) {
                    delete newIcons[moduleId];
                }
            }
            return { ...prev, module_icons: newIcons };
        });
    };
    
    const IconPreview: React.FC<{ moduleId: string, template: any }> = ({ moduleId, template }) => {
        const customIconData = theme.module_icons?.[moduleId];
        const DefaultIcon = template.sidebarIcon;
        const iconProps = {
            className: "w-full h-full text-white",
            style: { color: customIconData?.color || 'currentColor' }
        };
    
        if (customIconData?.svg_content) {
            const processedSvg = customIconData.svg_content
                .replace(/width=".*?"/, `width="100%"`)
                .replace(/height=".*?"/, `height="100%"`)
                .replace(/fill=".*?"/g, `fill="${customIconData.color || 'currentColor'}"`)
                .replace(/stroke=".*?"/g, `stroke="${customIconData.color || 'currentColor'}"`);
            return <div className="w-full h-full" style={{ color: customIconData.color || 'white' }} dangerouslySetInnerHTML={{ __html: processedSvg }} />;
        }
        return <DefaultIcon {...iconProps} />;
    };


    return (
        <div className="h-full w-full overflow-y-auto p-6 md:p-8">
            <input type="file" ref={iconFileInputRef} onChange={handleIconFileSelect} className="hidden" accept=".svg" />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto space-y-8"
            >
                <header>
                    <h1 className="text-3xl font-bold">Personalização da Aparência</h1>
                    <p className="mt-2 text-gray-300">Ajuste as cores, fontes e imagens para combinar com a sua marca.</p>
                </header>

                {notification && (
                    <div className="p-3 bg-brand-secondary/80 text-white rounded-md text-center">{notification}</div>
                )}

                <div className="space-y-6 bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                    <h2 className="text-xl font-semibold border-b border-brand-accent pb-2">Cores Principais</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ColorInput label="Primária" value={theme.color_primary || ''} onChange={v => handleFieldChange('color_primary', v)} />
                        <ColorInput label="Secundária" value={theme.color_secondary || ''} onChange={v => handleFieldChange('color_secondary', v)} />
                        <ColorInput label="Acento" value={theme.color_accent || ''} onChange={v => handleFieldChange('color_accent', v)} />
                        <ColorInput label="Escuro (Fundo)" value={theme.color_dark || ''} onChange={v => handleFieldChange('color_dark', v)} />
                        <ColorInput label="Claro (Painéis)" value={theme.color_light || ''} onChange={v => handleFieldChange('color_light', v)} />
                    </div>
                    
                    <h2 className="text-xl font-semibold border-b border-brand-accent pb-2 pt-4">Cores do Texto (Opcional)</h2>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ColorInput label="Cor Base do Texto" value={theme.color_text_base || ''} onChange={v => handleFieldChange('color_text_base', v)} />
                        <ColorInput label="Cor de Texto Secundário" value={theme.color_text_muted || ''} onChange={v => handleFieldChange('color_text_muted', v)} />
                    </div>
                </div>

                <div className="space-y-6 bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                    <h2 className="text-xl font-semibold border-b border-brand-accent pb-2">Imagens e Logo</h2>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ImageUploader label="Logo" value={theme.logo_url} onFileSelect={file => handleFileChange('logo_url', file)} onClear={() => handleFieldChange('logo_url', '')} recommendation="Rec: 256x256 pixels"/>
                        <ImageUploader label="Imagem de Fundo (Dashboard)" value={theme.background_image_url} onFileSelect={file => handleFileChange('background_image_url', file)} onClear={() => handleFieldChange('background_image_url', '')} recommendation="Rec: 1920x1080 pixels"/>
                        <ImageUploader label="Imagem de Fundo (Login)" value={theme.login_background_image_url} onFileSelect={file => handleFileChange('login_background_image_url', file)} onClear={() => handleFieldChange('login_background_image_url', '')} recommendation="Rec: 1920x1080 pixels"/>
                    </div>
                </div>

                <div className="space-y-6 bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                     <h2 className="text-xl font-semibold border-b border-brand-accent pb-2">Tipografia</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">URL da Fonte Principal (Google Fonts)</label>
                            <input type="text" value={theme.font_family_url || ''} onChange={e => handleFieldChange('font_family_url', e.target.value)} className="w-full bg-brand-light p-2 rounded border border-brand-accent" placeholder="https://fonts.googleapis.com/css2?family=..."/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Fonte Principal (CSS)</label>
                            <input type="text" value={theme.font_family_main || ''} onChange={e => handleFieldChange('font_family_main', e.target.value)} className="w-full bg-brand-light p-2 rounded border border-brand-accent" placeholder="'Roboto', sans-serif"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Fonte Manuscrita (CSS)</label>
                            <input type="text" value={theme.font_family_handwriting || ''} onChange={e => handleFieldChange('font_family_handwriting', e.target.value)} className="w-full bg-brand-light p-2 rounded border border-brand-accent" placeholder="'Caveat', cursive"/>
                        </div>
                     </div>
                </div>
                
                 <div className="space-y-6 bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                    <h2 className="text-xl font-semibold border-b border-brand-accent pb-2">Ícones dos Módulos</h2>
                     <p className="text-xs text-gray-400">Personalize os ícones para cada módulo. Pode carregar um ficheiro SVG e/ou alterar a cor.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(TEMPLATES).map(([key, template]) => (
                            <div key={key} className="bg-brand-light p-4 rounded-lg border border-brand-accent/50">
                                <h4 className="font-semibold mb-3">{template.name}</h4>
                                <div className="flex gap-4 items-start">
                                    <div className="flex-shrink-0">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Prévia</label>
                                        <div className="w-16 h-16 bg-brand-dark rounded-md flex items-center justify-center p-2 border border-brand-accent/50">
                                            <IconPreview moduleId={key} template={template} />
                                        </div>
                                    </div>
                                    <div className="flex-grow space-y-3">
                                        <ColorInput label="Cor do Ícone" value={theme.module_icons?.[key]?.color || ''} onChange={v => handleIconColorChange(key, v)} />
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1">Ícone SVG (Opcional)</label>
                                            <div className="flex gap-2">
                                                <Button onClick={() => triggerIconUpload(key)} className="flex-1 text-sm">Carregar SVG</Button>
                                                {theme.module_icons?.[key]?.svg_content && (
                                                    <Button onClick={() => handleRemoveCustomIcon(key)} className="!bg-red-600/50 hover:!bg-red-600 text-sm">Remover</Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>

                <div className="space-y-6 bg-brand-dark/50 p-6 rounded-lg border border-brand-accent">
                    <h2 className="text-xl font-semibold border-b border-brand-accent pb-2">Anúncio Global</h2>
                    <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Texto do Anúncio</label>
                            <textarea value={theme.announcement_text || ''} onChange={e => handleFieldChange('announcement_text', e.target.value)} rows={3} className="w-full bg-brand-light p-2 rounded border border-brand-accent" placeholder="Ex: Manutenção agendada para domingo às 22h."/>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-brand-light/50 w-fit">
                            <div className="relative">
                                <input type="checkbox" checked={theme.announcement_active || false} onChange={e => handleFieldChange('announcement_active', e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-brand-accent rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                            </div>
                            <span className="font-medium">Ativar Anúncio</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} primary disabled={isLoading} className="text-lg px-8 py-3">
                        {isLoading ? 'A salvar...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default ThemeCustomizationView;
