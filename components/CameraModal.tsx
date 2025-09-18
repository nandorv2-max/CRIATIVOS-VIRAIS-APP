import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Button from './Button.tsx';

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageDataUrl: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            // FIX: Cast to any to access getTracks, for environments with incomplete MediaStream types.
            (streamRef.current as any).getTracks().forEach((track: any) => track.stop());
            streamRef.current = null;
        }
        // FIX: Cast to any to access srcObject, for environments with incomplete HTMLVideoElement types.
        if (videoRef.current) { (videoRef.current as any).srcObject = null; }
    }, []);

    const startCamera = useCallback(async () => {
        if (videoRef.current) {
            setCameraError(null);
            setCapturedImage(null);
            // FIX: Use `(window as any).navigator` to access mediaDevices in environments where DOM globals are not available.
            if (!(window as any).navigator.mediaDevices || !(window as any).navigator.mediaDevices.getUserMedia) {
                setCameraError("O seu navegador não suporta o acesso à câmara. Por favor, tente um navegador diferente.");
                return;
            }
            try {
                stopCamera();
                // FIX: Use `(window as any).navigator` to access mediaDevices.
                const stream = await (window as any).navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1024 }, height: { ideal: 1024 }, facingMode: 'user' } });
                // FIX: Cast to any to access srcObject for wider compatibility.
                (videoRef.current as any).srcObject = stream;
                streamRef.current = stream;
            } catch (err: any) {
                console.warn("Aviso ao aceder à câmara (isto pode ser normal se o utilizador negar a permissão):", err);
                if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    setCameraError("Permissão da câmara negada. Para usar esta funcionalidade, por favor, permita o acesso à câmara nas definições do seu navegador e atualize a página.");
                } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                    setCameraError("Nenhuma câmara encontrada. Por favor, certifique-se de que uma câmara está conectada e ativada.");
                } else {
                    setCameraError("Ocorreu um erro ao iniciar a câmara. Por favor, tente novamente.");
                }
            }
        }
    }, [stopCamera]);

    useEffect(() => {
        if (isOpen && !capturedImage) { startCamera(); } else { stopCamera(); }
        return () => { stopCamera(); };
    }, [isOpen, capturedImage, startCamera, stopCamera]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            // FIX: Cast to any to access video/canvas properties in environments with incomplete DOM types.
            (canvas as any).width = (video as any).videoWidth;
            (canvas as any).height = (video as any).videoHeight;
            const context = (canvas as any).getContext('2d');
            if(context) {
                context.scale(-1, 1);
                context.drawImage(video, -(canvas as any).width, 0, (canvas as any).width, (canvas as any).height);
                const dataUrl = (canvas as any).toDataURL('image/png');
                setCapturedImage(dataUrl);
            }
        }
    };
    const handleConfirm = () => { if (capturedImage) { onCapture(capturedImage); onClose(); } };
    const handleRetake = () => { setCapturedImage(null); };
    const handleClose = () => {
        setCapturedImage(null);
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="bg-brand-dark rounded-2xl p-6 border border-brand-accent shadow-2xl w-full max-w-2xl text-center relative">
                <h3 className="text-2xl font-semibold mb-4 text-white">Câmara</h3>
                <div className="aspect-square bg-black rounded-lg overflow-hidden relative mb-4 flex items-center justify-center">
                    {cameraError ? (<div className="p-4 text-red-400">{cameraError}</div>) : (
                        <>
                            {capturedImage ? <img src={capturedImage} alt="Pré-visualização capturada" className="w-full h-full object-cover" /> : <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform -scale-x-100"></video>}
                        </>
                    )}
                </div>
                <div className="flex justify-center gap-4">
                    {capturedImage ? (
                        <><Button onClick={handleRetake}>Tirar Outra</Button><Button onClick={handleConfirm} primary>Usar Foto</Button></>
                    ) : (
                         <button onClick={handleCapture} disabled={!!cameraError} className="w-20 h-20 rounded-full bg-white border-4 border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-primary transition-all hover:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"></button>
                    )}
                </div>
                <button onClick={handleClose} className="absolute top-4 right-4 p-2 rounded-full bg-brand-light/70 text-white hover:bg-brand-accent transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                <canvas ref={canvasRef} className="hidden"></canvas>
            </motion.div>
        </div>
    );
};

export default CameraModal;