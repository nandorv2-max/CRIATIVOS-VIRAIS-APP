import React, { useState, useRef } from 'react';
import Button from '../Button.tsx';
import { IconUpload, IconImage, IconDownload, IconImageIcon } from '../Icons.tsx';
import { toBase64, base64ToFile, blobToBase64 } from '../../utils/imageUtils.ts';
// FIX: Corrected import path for geminiService to point to the correct file in the services directory.
import { generateImageWithRetry, getModelInstruction } from '../../services/geminiService.ts';
import { uploadUserAsset, createSignedUrlForPath } from '../../services/databaseService.ts';
import { nanoid } from 'nanoid';
import { Prompt, UploadedAsset } from '../../types.ts';
import UploadOptionsModal from '../UploadOptionsModal.tsx';
import GalleryPickerModal from '../GalleryPickerModal.tsx';
import { showGoogleDrivePicker } from '../../services/googleDriveService.ts';

const ProductStudioView: React.FC = () => {
    const [productImage, setProductImage] = useState<string | null>(null);
    const [sceneDescription, setSceneDescription] = useState('');
    const [cameraPerspective, setCameraPerspective] = useState('Eye-level (straight-on)');
    const [lighting, setLighting] = useState('Softbox diffused lighting');
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const productImageRef = useRef<HTMLInputElement>(null);

    const [isUploadOptionsModalOpen, setIsUploadOptionsModalOpen] = useState(false);
    const [isGalleryPickerModalOpen, setIsGalleryPickerModalOpen] = useState(false);

    const handleProductImageUpload = async (file: File | null) => {
        if (!file) return;
        try {
            const base64 = await toBase64(file);
            setProductImage(base64);
        } catch (err) { setError("Falha ao carregar a imagem do produto."); }
    };

    const handleSelectFromGallery = async (asset: UploadedAsset) => {
        setIsGalleryPickerModalOpen(false);
        setError(null);
        try {
            const signedUrl = await createSignedUrlForPath(asset.storage_path);
            const response = await fetch(signedUrl);
            if (!response.ok) throw new Error('Falha ao buscar imagem da galeria.');
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);
            setProductImage(base64);
        } catch (err) {
            setError("Falha ao carregar a imagem da galeria.");
        }
    };

    const handleGoogleDriveUpload = async () => {
        setIsUploadOptionsModalOpen(false);
        setError(null);
        try {
            const images = await showGoogleDrivePicker();
            if (images.length > 0) {
                setProductImage(images[0]);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`Falha ao importar do Google Drive: ${msg}`);
        }
    };

    const handleGenerate = async () => {
        if (!productImage || !sceneDescription) {
            setError("Por favor, carregue uma imagem do produto e descreva a cena.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);

        const prompt: Prompt = { id: 'product_studio', base: sceneDescription };
        const options = { cameraAngle: cameraPerspective, lookbookStyle: lighting };
        const modelInstruction = getModelInstruction('productStudio', prompt, options as any);

        try {
            const imageUrl = await generateImageWithRetry({
                prompt: modelInstruction,
                base64ImageData: productImage,
            });
            setResultImage(imageUrl);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError(`A geração falhou: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        if (!resultImage) return;
        const link = document.createElement('a');
        link.href = resultImage;
        link.download = `GenIA_ProductScene_${nanoid(6)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveToGallery = async () => {
        if (!resultImage) return;
        setIsSaving(true);
        setError(null);
        try {
            const fileName = `ProductScene_${nanoid(6)}.png`;
            const file = base64ToFile(resultImage, fileName);
            await uploadUserAsset(file);
            alert('Cena de produto salva na sua galeria com sucesso!');
        } catch (err) {
            setError('Falha ao salvar na galeria.');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <>
            <UploadOptionsModal
                isOpen={isUploadOptionsModalOpen}
                onClose={() => setIsUploadOptionsModalOpen(false)}
                onLocalUpload={() => {
                    setIsUploadOptionsModalOpen(false);
                    productImageRef.current?.click();
                }}
                onGalleryUpload={() => {
                    setIsUploadOptionsModalOpen(false);
                    setIsGalleryPickerModalOpen(true);
                }}
                onGoogleDriveUpload={handleGoogleDriveUpload}
                galleryEnabled={true}
                title="Carregar Imagem do Produto"
            />
            <GalleryPickerModal
                isOpen={isGalleryPickerModalOpen}
                onClose={() => setIsGalleryPickerModalOpen(false)}
                onSelectAsset={handleSelectFromGallery}
                assetTypeFilter="image"
            />
            <div className="h-full flex flex-col md:flex-row gap-8 p-6">
                 {/* Left Panel */}
                <div className="w-full md:w-1/2 lg:w-2/5 bg-brand-dark/50 p-6 rounded-2xl border border-brand-accent/50 flex flex-col">
                    <h1 className="text-2xl font-bold text-white mb-6">Estúdio de Produto</h1>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">1. Imagem do Produto *</label>
                            <div onClick={() => setIsUploadOptionsModalOpen(true)} className="cursor-pointer aspect-square w-full bg-brand-light border-2 border-dashed border-brand-accent rounded-lg flex items-center justify-center text-center text-gray-400 hover:border-brand-primary">
                                {productImage ? <img src={productImage} className="max-w-full max-h-full object-contain p-2" /> : <div><IconUpload className="mx-auto" /><p>Clique para carregar</p><p className="text-xs">Do Dispositivo, Galeria, etc.</p></div>}
                            </div>
                            <input type="file" ref={productImageRef} onChange={(e) => handleProductImageUpload(e.target.files?.[0] || null)} accept="image/*" className="hidden" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">2. Descreva a Cena *</label>
                            <textarea value={sceneDescription} onChange={e => setSceneDescription(e.target.value)} placeholder="Ex: Um perfume em uma mesa de mármore com pétalas de rosa ao redor..." className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">3. Perspectiva da Câmera</label>
                            <select value={cameraPerspective} onChange={e => setCameraPerspective(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                                <option>Eye-level (straight-on)</option>
                                <option>Low-angle</option>
                                <option>High-angle</option>
                                <option>Overhead (top-down)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">4. Iluminação</label>
                             <select value={lighting} onChange={e => setLighting(e.target.value)} className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 text-white">
                                <option>Softbox diffused lighting</option>
                                <option>Natural daylight</option>
                                <option>Dramatic studio lighting</option>
                                <option>Golden hour sunlight</option>
                            </select>
                        </div>
                         {error && <div className="text-red-400 bg-red-900/50 p-2 rounded text-sm text-center">{error}</div>}
                    </div>
                     <div className="mt-6 flex-shrink-0 flex justify-end gap-4">
                        <Button onClick={handleGenerate} primary disabled={isLoading}>
                            {isLoading ? 'A gerar...' : 'Gerar Cena'}
                        </Button>
                    </div>
                </div>
                 {/* Right Panel */}
                <div className="flex-grow flex flex-col items-center justify-center bg-black rounded-2xl p-4 border border-brand-accent/50 min-h-[300px] md:min-h-0">
                    {isLoading && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>}
                    {resultImage && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                            <img src={resultImage} alt="Resultado do estúdio de produto" className="max-w-full max-h-[85%] object-contain rounded-lg" />
                            <div className="flex items-center gap-2">
                               <Button onClick={handleDownload}><div className="flex items-center gap-2"><IconDownload/> Baixar</div></Button>
                               <Button onClick={handleSaveToGallery} disabled={isSaving}><div className="flex items-center gap-2"><IconImageIcon className="w-4 h-4" />{isSaving ? 'Salvando...' : 'Salvar na Galeria'}</div></Button>
                            </div>
                        </div>
                    )}
                    {!isLoading && !resultImage && <div className="text-center text-gray-500"><IconImage /><p className="mt-2">O seu resultado aparecerá aqui.</p></div>}
                </div>
            </div>
        </>
    );
};

export default ProductStudioView;