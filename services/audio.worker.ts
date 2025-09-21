// This worker is responsible for fetching, decoding, and mixing all audio sources
// into a single buffer, off the main thread, to prevent UI freezes.

const ctx = self as any;

/**
 * Centralized function to format and post error messages back to the main thread.
 * This ensures all errors are reported consistently.
 * @param message A descriptive message of where the error occurred.
 * @param error The actual error object or reason.
 */
function postError(message: string, error?: any) {
    console.error(message, error);
    // Directly post a structured error message. This is the most reliable way.
    ctx.postMessage({
        type: 'error',
        payload: { message: message + (error ? `: ${error.message || String(error)}` : '') }
    });
}

// Global handler for any uncaught exceptions in the worker's scope.
// This is a safety net for errors not caught by try/catch blocks.
self.onerror = (event: ErrorEvent) => {
    postError('Erro não capturado no worker', event.error || event.message);
    event.preventDefault(); // Prevent the default browser error handling
};

// Global handler for any unhandled promise rejections.
// This is crucial for catching errors in async operations.
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
    postError('Rejeição de promessa não tratada no worker', event.reason);
    event.preventDefault(); // Prevent the default browser error handling
};

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;
    if (type !== 'process') return;
    
    const { audioSources, maxDuration } = payload;
    
    try {
        // Compatibility Check: Ensure the necessary Audio API is available in the worker context.
        if (typeof (self as any).OfflineAudioContext === 'undefined' && typeof (self as any).webkitOfflineAudioContext === 'undefined') {
            throw new Error('O seu navegador não suporta o processamento de áudio em segundo plano, necessário para exportar vídeos com som. Por favor, tente usar o Google Chrome ou Microsoft Edge.');
        }

        if (!audioSources || audioSources.length === 0) {
             ctx.postMessage({ type: 'done', payload: null });
             return;
        }

        // Use a high-quality sample rate standard for audio production
        const SAMPLE_RATE = 48000;
        const AudioContext = (self as any).OfflineAudioContext || (self as any).webkitOfflineAudioContext;
        const offlineContext = new AudioContext(2, Math.ceil(maxDuration * SAMPLE_RATE), SAMPLE_RATE);

        let sourcesProcessed = 0;
        for (const src of audioSources) {
            try {
                // Fetch the audio data as an ArrayBuffer
                const response = await fetch(src);
                if (!response.ok) {
                    console.warn(`Failed to fetch audio source: ${src}, status: ${response.status}`);
                    continue; // Skip this audio source
                }
                const arrayBuffer = await response.arrayBuffer();

                // Decode the audio data
                const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

                // Create a source node, connect it to the destination, and schedule it to play
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(0);
                sourcesProcessed++; // Mark as successfully processed
            } catch (err) {
                 console.warn(`Não foi possível processar ou decodificar o áudio para ${src}, a saltar.`, err);
            }
        }
        
        // CRITICAL CHECK: If no audio sources were successfully loaded, abort before rendering.
        if (sourcesProcessed === 0 && audioSources.length > 0) {
            throw new Error("Nenhuma das fontes de áudio pôde ser carregada ou decodificada. Verifique se os ficheiros não estão corrompidos.");
        }
        
        // Render the audio graph. This is the heavy part that's now off the main thread.
        const renderedBuffer = await offlineContext.startRendering();
        
        // Extract the raw channel data (planar Float32Arrays)
        const channels = [];
        for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
            channels.push(renderedBuffer.getChannelData(i));
        }

        const audioPayload = {
            sampleRate: renderedBuffer.sampleRate,
            numberOfChannels: renderedBuffer.numberOfChannels,
            channels,
        };
        
        // Post the final payload back to the main thread.
        // The ArrayBuffers within the channels are marked as "transferable" for performance.
        ctx.postMessage({ type: 'done', payload: audioPayload }, channels.map(c => c.buffer));

    } catch (err) {
        // This catch block now uses the centralized reporter for consistency.
        postError('Falha durante o processamento de áudio', err);
    }
};