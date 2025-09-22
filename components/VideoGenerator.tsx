import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { nanoid } from 'nanoid';
import Button from './Button.tsx';
import { generateVideo } from '../geminiService.ts';
import { extractLastFrame, toBase64, blobToBase64 } from '../utils/imageUtils.ts';
import { IconUpload, IconCamera, IconImageIcon } from './Icons.tsx';
import CameraModal from './CameraModal.tsx';
import UploadOptionsModal from './UploadOptionsModal.tsx';
import GalleryPickerModal from './GalleryPickerModal.tsx';
import { uploadUserAsset, createSignedUrlForPath } from '../services/databaseService.ts';
import type { UploadedAsset, UserProfile } from '../types.ts';
import { showGoogleDrivePicker } from '../services/googleDriveService.ts';

interface VideoGeneratorProps {
    userProfile: UserProfile;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ userProfile }) => {
    const [prompt, setPrompt] = useState(`Animate the person in the image. They should be talking to the camera, as if explaining something in a user-generated content (UGC) style. The animation should be subtle and natural. Maintain the original image's high-definition, photorealistic quality, details, and colors. Do not change the background, zoom, or camera angle.`);
    const [status, setStatus] = useState('Pronto.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<{ message: string, details: string } | null>(null);
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [sequenceLength, setSequenceLength] = useState(3);
    const [videos, setVideos] = useState<{url: string, blob: Blob}[]>([]);
    
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isGalleryPickerModalOpen, setIsGalleryPickerModalOpen] = useState(false);
    const [savingVideoIndex, setSavingVideoIndex] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    
    const handleImageUpload = async (file: File | null) => {
        if (!file) return;
        setIsUploading(true);
        try {
            const base64 = await toBase64(file);
            setUploadedImage(base64);
        } catch (err) {
            console.error("Upload error", err);
            setError({ message: "Upload falhou", details: "Não foi possível carregar o ficheiro de imagem." });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleSelectFromGallery = async (asset: UploadedAsset) => {
        setIsGalleryPickerModalOpen(false);
        setIsUploading(true);
        setError(null);
        try {
            const signedUrl = await createSignedUrlForPath(asset.storage_path);
            const response = await fetch(signedUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
            }
            const blob = await response.blob();
            const base64Image = await blobToBase64(blob);
            setUploadedImage(base64Image);
        } catch (err) {
            console.error("Error loading image from gallery:", err);
            setError({ message: "Não foi possível carregar a imagem da galeria.", details: err instanceof Error ? err.message : '' });
        } finally {
            setIsUploading(false);
        }
    };

    // FIX: Added handler for Google Drive uploads to pass to the modal.
    const handleGoogleDriveUpload = async () => {
        setIsUploadModalOpen(false);
        setIsUploading(true);
        setError(null);
        try {
            const images = await showGoogleDrivePicker();
            if (images.length > 0) {
                setUploadedImage(images[0]);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            console.error("Google Drive Picker Error:", err);
            setError({ message: "Falha ao importar do Google Drive.", details: msg });
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt) { setStatus('Por favor, introduza um prompt.'); return; }
        if (!uploadedImage) { setStatus('Por favor, carregue uma imagem inicial.'); return; }

        setIsLoading(true);
        setStatus('A iniciar a geração da sequência...');
        setVideos([]);
        setError(null);
        
        const parts = uploadedImage.split(',');
        const mimeType = parts[0].split(':')[1].split(';')[0];
        const bytes = parts[1];

        let currentImageBytes: string | null = bytes;
        let currentMimeType: string = mimeType;

        try {
            const newVideos = [];
            for (let i = 1; i <= sequenceLength; i++) {
                setStatus(`A gerar vídeo ${i} de ${sequenceLength}... Isto pode demorar alguns minutos.`);
                
                const fullPrompt = `An 8-second video of: ${prompt}`;
                const videoBlob = await generateVideo(
                    fullPrompt,
                    currentImageBytes,
                    currentMimeType,
                    aspectRatio,
                    userProfile.role
                );

                const videoUrl = URL.createObjectURL(videoBlob);
                newVideos.push({ url: videoUrl, blob: videoBlob });
                setVideos([...newVideos]);

                await new Promise(resolve => setTimeout(resolve, 100));
                // FIX: Use optional chaining and cast to `any` to safely call scrollIntoView.
                // FIX: Property 'lastElementChild' does not exist on type 'HTMLDivElement'.
                (videoContainerRef.current?.lastElementChild as any)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                
                if (i < sequenceLength) {
                    setStatus(`A extrair fotograma do vídeo ${i} para continuar a sequência...`);
                    const frame = await extractLastFrame(videoBlob);
                    currentImageBytes = frame.base64data;
                    currentMimeType = frame.mimeType;
                }
            }
            setStatus('Geração da sequência concluída.');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error('Erro de Geração:', e);
            setStatus('Ocorreu um erro durante a geração.');
            setError({ message: "Erro de Geração:", details: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveToGallery = async (videoBlob: Blob, index: number) => {
        setSavingVideoIndex(index);
        setError(null);
        try {
            const videoFile = new File([videoBlob], `GenIA_Video_${nanoid(6)}.mp4`, { type: 'video/mp4' });
            await uploadUserAsset(videoFile);
            alert(`Vídeo ${index + 1} salvo na galeria com sucesso!`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
            setError({ message: "Falha ao salvar o vídeo.", details: errorMessage });
        } finally {
            setSavingVideoIndex(null);
        }
    };


    return (
        <>
            <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={setUploadedImage} />
            <UploadOptionsModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onLocalUpload={() => {
                    setIsUploadModalOpen(false);
                    fileInputRef.current?.click();
                }}
                onGalleryUpload={() => {
                    setIsUploadModalOpen(false);
                    setIsGalleryPickerModalOpen(true);
                }}
                // FIX: Added missing 'onGoogleDriveUpload' prop to satisfy the component's interface.
                onGoogleDriveUpload={handleGoogleDriveUpload}
                galleryEnabled={true}
            />
            <GalleryPickerModal
                isOpen={isGalleryPickerModalOpen}
                onClose={() => setIsGalleryPickerModalOpen(false)}
                onSelectAsset={handleSelectFromGallery}
            />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col md:flex-row gap-6 w-full h-full p-6">
                {/* Left Column: Controls */}
                <div className="md:w-1/3 xl:w-1/4 flex flex-col gap-6 overflow-y-auto pr-4">
                    <h2 className="text-2xl font-semibold text-white">Gerador de Vídeo</h2>
                    
                    {/* 1. Upload */}
                    <div className="p-6 border border-brand-accent rounded-xl bg-brand-dark/50">
                        <h3 className='text-xl font-semibold text-white mb-4'>1. A Sua Foto</h3>
                        <div 
                            className="w-full aspect-square border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-brand-primary bg-brand-dark overflow-hidden"
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            {isUploading ? <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-primary"></div> 
                            : uploadedImage ? <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" /> 
                            : <div className="text-center text-gray-400"><IconUpload className="w-10 h-10 mx-auto" /><p className="mt-2 text-sm">Carregar Foto</p></div>}
                        </div>
                        <div className="flex justify-center gap-2 mt-4">
                            <Button onClick={() => setIsCameraOpen(true)}><div className="flex items-center gap-2 text-sm"><IconCamera /><span>Câmara</span></div></Button>
                            {uploadedImage && <Button onClick={() => setIsUploadModalOpen(true)}>Mudar</Button>}
                        </div>
                        {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                        <input type="file" ref={fileInputRef} onChange={(e) => handleImageUpload((e.target as any).files?.[0] ?? null)} accept="image/*" className="hidden" />
                    </div>

                    {/* 2. Describe */}
                     <div className="p-6 border border-brand-accent rounded-xl space-y-4 bg-brand-dark/50">
                        <h3 className='text-xl font-semibold text-white'>2. Descreva a Cena</h3>
                        <textarea 
                            value={prompt}
                            // FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings.
                            onChange={e => setPrompt((e.target as any).value)}
                            placeholder="Descreva a animação para a sequência de vídeo..."
                            className="w-full bg-brand-light border border-brand-accent rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white resize-y"
                        />
                    </div>

                    {/* 3. Define Stage */}
                    <div className="p-6 border border-brand-accent rounded-xl space-y-4 bg-brand-dark/50">
                         <h3 className='text-xl font-semibold text-white'>3. Defina o Palco</h3>
                         <div className="grid grid-cols-1 gap-4">
                            <div>
                                 <label className="block text-sm font-medium text-gray-400 mb-2">Proporção:</label>
                                 {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                 <select value={aspectRatio} onChange={e => setAspectRatio((e.target as any).value)} className="w-full bg-brand-light border border-brand-accent rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white">
                                     <option value="9:16">9:16 (Retrato)</option>
                                     <option value="16:9">16:9 (Paisagem)</option>
                                     <option value="1:1">1:1 (Quadrado)</option>
                                 </select>
                            </div>
                            <div>
                                 <label className="block text-sm font-medium text-gray-400 mb-2">Número de Vídeos:</label>
                                 {/* FIX: Cast event target to `any` to access properties in environments with incomplete DOM typings. */}
                                 <input type="number" value={sequenceLength} onChange={e => setSequenceLength(Math.max(1, Math.min(10, parseInt((e.target as any).value, 10))))} min="1" max="10" className="w-full bg-brand-light border border-brand-accent rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary text-white" />
                            </div>
                         </div>
                    </div>
                    
                    <div className="mt-auto">
                        <Button onClick={handleGenerate} primary disabled={isLoading || !uploadedImage} className="w-full text-lg px-8 py-3">
                             {isLoading ? (
                                <div className="flex items-center justify-center gap-3"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div><span>A gerar...</span></div>
                            ) : 'Gerar Sequência'}
                        </Button>
                        <p className="text-gray-400 mt-2 text-sm text-center">{status}</p>
                    </div>

                </div>

                {/* Right Column: Results */}
                <div className="flex-1 flex flex-col min-w-0">
                    <h3 className='text-xl font-semibold text-white mb-4'>A Sua Linha do Tempo</h3>
                    <div className="bg-brand-dark/50 p-4 rounded-xl flex-grow flex items-center justify-center border border-brand-accent overflow-hidden relative">
                        {error && (
                            <div className="absolute top-4 left-4 right-4 z-10 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-center text-red-300">
                                <p className="font-semibold">{error.message}</p>
                                <p className="text-xs mt-2 text-red-400">{error.details}</p>
                            </div>
                        )}
                        <div ref={videoContainerRef} className="flex flex-row items-center gap-10 overflow-x-auto p-4 w-full h-full">
                            {videos.map((video, index) => (
                                <div key={index} className="relative flex-shrink-0 w-64 h-full">
                                    <figure className="m-0 w-full h-full flex flex-col items-center justify-center">
                                        <video src={video.url} controls autoPlay={index > 0} muted loop={false} className="max-w-full max-h-full rounded-lg bg-black" />
                                        <figcaption className="mt-4 bg-gray-900 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                                            Vídeo {index + 1}
                                        </figcaption>
                                        <Button 
                                            onClick={() => handleSaveToGallery(video.blob, index)} 
                                            disabled={savingVideoIndex === index}
                                            className="mt-2 text-xs !py-1 !px-3"
                                        >
                                            <div className="flex items-center gap-1">
                                                <IconImageIcon className="w-3 h-3" />
                                                <span>{savingVideoIndex === index ? 'A salvar...' : 'Salvar na Galeria'}</span>
                                            </div>
                                        </Button>
                                    </figure>
                                    {index < videos.length - 1 && (
                                        <div className="absolute h-0.5 w-10 bg-gray-600 top-1/2 -right-10"></div>
                                    )}
                                </div>
                            ))}
                            {videos.length === 0 && !isLoading && <p className="text-gray-500 w-full text-center">Os seus vídeos gerados aparecerão aqui.</p>}
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
};

export default VideoGenerator;