import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import Button from '../Button.tsx';
import { IconSparkles, IconImage, IconChevronDown, IconOptions, IconDownload, IconImageIcon } from '../Icons.tsx';
import { generateImageFromPrompt } from '../../services/geminiService.ts';
import ErrorNotification from '../ErrorNotification.tsx';
import LoadingCard from '../LoadingCard.tsx';
import { ENHANCER_CATEGORIES } from '../../constants.ts';
import { cropImage, base64ToFile } from '../../utils/imageUtils.ts';
import { uploadUserAsset } from '../../services/databaseService.ts';

const ImageGeneratorView: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [numImages, setNumImages] = useState(1);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);

    const [openSections, setOpenSections] = useState<Set<string>>(new Set());
    const [selectedEnhancers, setSelectedEnhancers] = useState<Set<string>>(new Set());
    
    // State for result image actions
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as any)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, []);

    const toggleSection = (sectionName: string) => {
        setOpenSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionName)) {
                newSet.delete(sectionName);
            } else {
                newSet.add(sectionName);
            }
            return newSet;
        });
    };

    const handleEnhancerChange = (term: string, isChecked: boolean) => {
        setSelectedEnhancers(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(term);
            } else {
                newSet.delete(term);
            }
            return newSet;
        });
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Por favor, insira um comando.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);

        const finalPrompt = [prompt.trim(), ...Array.from(selectedEnhancers)].join(', ');

        try {
            const imageUrl = await generateImageFromPrompt(finalPrompt, aspectRatio);
            setResultImage(imageUrl);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`A geração falhou: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = async (ratio: string) => {
        if (!resultImage) return;
        setIsMenuOpen(false);
        try {
            const croppedImgUrl = await cropImage(resultImage, ratio);
            const link = document.createElement('a');
            link.href = croppedImgUrl;
            link.download = `GenIA_Image_${nanoid(8)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Failed to crop/download image:', err);
            setError('Falha ao processar a imagem para download.');
        }
    };
    
    const handleSaveToGallery = async () => {
        if (!resultImage || isSaving) return;
        setIsSaving(true);
        setIsMenuOpen(false);
        setError(null);
        try {
            const fileName = `GenIA_${prompt.substring(0, 20)}_${nanoid(4)}.png`;
            const file = base64ToFile(resultImage, fileName);
            await uploadUserAsset(file);
            alert('Imagem salva na sua galeria com sucesso!');
        } catch (err) {
            console.error("Failed to save to gallery:", err);
            setError("Falha ao salvar na galeria. Por favor, tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-8 p-6">
            <ErrorNotification message={error} onDismiss={() => setError(null)} />
            {/* Left Panel */}
            <div className="w-full md:w-1/2 lg:w-2/5 xl:w-1/3 bg-brand-dark/50 p-6 rounded-2xl border border-brand-accent/50 flex flex-col">
                <h1 className="text-2xl font-bold text-white mb-6">Gerador de Imagem por IA</h1>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Comando (em inglês)</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ex: 'Um astronauta andando a cavalo na lua'"
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nº de Imagens</label>
                        <select
                            value={numImages}
                            onChange={(e) => setNumImages(Number(e.target.value))}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value={1}>1</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="aspect-ratio-select" className="block text-sm font-medium text-gray-300 mb-1">Tamanho da Imagem</label>
                        <select
                            id="aspect-ratio-select"
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="1:1">Quadrado (1:1)</option>
                            <option value="3:4">Retrato (3:4)</option>
                            <option value="4:3">Paisagem (4:3)</option>
                            <option value="9:16">Stories (9:16)</option>
                            <option value="16:9">Paisagem Larga (16:9)</option>
                        </select>
                    </div>
                    
                    {/* Enhancers Accordion */}
                    <div className="space-y-2 pt-2">
                        <h3 className="text-lg font-semibold text-gray-200">Potenciadores (Opcional)</h3>
                        {ENHANCER_CATEGORIES.map(category => (
                            <div key={category.name} className="bg-brand-light/50 rounded-lg border border-brand-accent/50 overflow-hidden">
                                <button
                                    onClick={() => toggleSection(category.name)}
                                    className="w-full flex justify-between items-center p-3 text-left font-semibold"
                                >
                                    <span>{category.name}</span>
                                    <IconChevronDown className={`w-5 h-5 transition-transform ${openSections.has(category.name) ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openSections.has(category.name) && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-3 border-t border-brand-accent/50 space-y-2 max-h-48 overflow-y-auto">
                                                {category.options.map(option => (
                                                    <label key={option.term} className="flex items-center gap-2 cursor-pointer text-sm p-1 rounded hover:bg-brand-accent/50">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEnhancers.has(option.term)}
                                                            onChange={(e) => handleEnhancerChange(option.term, e.target.checked)}
                                                            className="w-4 h-4 rounded bg-brand-dark border-brand-accent text-brand-primary focus:ring-brand-secondary"
                                                        />
                                                        <span>{option.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-auto pt-6 flex-shrink-0">
                    <Button onClick={handleGenerate} primary disabled={isLoading} className="w-full">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-dark"></div><span>A gerar...</span></div>
                        ) : (
                            <div className="flex items-center justify-center gap-2"><IconSparkles className="w-6 h-6" /><span>Gerar Imagem</span></div>
                        )}
                    </Button>
                </div>
            </div>
            {/* Right Panel */}
            <div className="flex-grow flex items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px] overflow-hidden">
                {isLoading && <LoadingCard era="" isPolaroid={false} showLabel={false} />}
                {resultImage && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="relative w-full h-full flex items-center justify-center"
                    >
                        <div className="relative max-w-full max-h-full">
                            <img src={resultImage} alt="Imagem gerada" className="block max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                            <div className="absolute top-3 right-3 z-10" ref={menuRef}>
                                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full bg-brand-dark/60 text-white hover:bg-brand-dark/80 transition-colors backdrop-blur-sm shadow-lg" aria-label="Opções"><IconOptions /></button>
                                <AnimatePresence>
                                {isMenuOpen && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.1 }} className="absolute right-0 top-12 mt-2 w-52 origin-top-right bg-brand-dark/80 backdrop-blur-md rounded-lg shadow-2xl ring-1 ring-white/10 text-white text-sm flex flex-col p-1">
                                        <button onClick={handleSaveToGallery} disabled={isSaving} className="w-full text-left px-3 py-2 hover:bg-brand-primary/20 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50">
                                            <IconImageIcon className="w-4 h-4" /> {isSaving ? 'A Salvar...' : 'Salvar na Galeria'}
                                        </button>
                                        <div className="my-1 h-px bg-white/10"></div>
                                        <span className="w-full text-left px-3 pt-1 pb-1 text-xs text-gray-400 uppercase tracking-wider">Download (com corte)</span>
                                        <button onClick={() => handleDownload('1:1')} className="w-full text-left px-3 py-2 hover:bg-brand-primary/20 rounded-md transition-colors">Quadrado (1:1)</button>
                                        <button onClick={() => handleDownload('4:5')} className="w-full text-left px-3 py-2 hover:bg-brand-primary/20 rounded-md transition-colors">Feed Retrato (4:5)</button>
                                        <button onClick={() => handleDownload('9:16')} className="w-full text-left px-3 py-2 hover:bg-brand-primary/20 rounded-md transition-colors">Stories (9:16)</button>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}
                {!isLoading && !resultImage && (
                    <div className="text-center text-gray-500">
                        <IconImage />
                        <p className="mt-2">O seu resultado aparecerá aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGeneratorView;
