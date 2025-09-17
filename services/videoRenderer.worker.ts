import { Muxer } from 'mp4-muxer';

let muxer: any = null;
let videoEncoder: any = null;
let audioEncoder: any = null;
let videoFramesWritten = 0;

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    try {
        if (type === 'start') {
            // FIX: Add firstAudioTrackSettings to destructuring
            const { canvasSize, options, audioStreams, firstAudioTrackSettings } = payload;
            
            const videoEncoderConfig = {
                codec: 'avc1.42001f', // H.264
                width: canvasSize.w,
                height: canvasSize.h,
                bitrate: options.bitrate * 1000,
                framerate: options.frameRate,
            };
            
            // FIX: Cast to (self as any) to access VideoEncoder
            if (!(await (self as any).VideoEncoder.isConfigSupported(videoEncoderConfig))) {
                throw new Error('A configuração do codificador de vídeo (H.264) não é suportada neste navegador.');
            }

            muxer = new Muxer({
                target: {
                    // FIX: The 'mp4-muxer' library expects an 'onData' method on the target, not 'write'.
                    onData: (chunk: any) => {
                        self.postMessage({ type: 'chunk', payload: { chunk } });
                    },
                    onDone: () => {},
                },
                // FIX: Changed 'in-order' to 'in-memory' which is a valid option for fast start.
                fastStart: 'in-memory',
                video: {
                    codec: 'avc',
                    width: canvasSize.w,
                    height: canvasSize.h,
                },
                audio: audioStreams.length > 0 && firstAudioTrackSettings ? {
                    codec: 'aac',
                    sampleRate: firstAudioTrackSettings.sampleRate,
                    numberOfChannels: firstAudioTrackSettings.channelCount,
                } : undefined,
            });
            
            // FIX: Cast to (self as any) to access VideoEncoder
            videoEncoder = new (self as any).VideoEncoder({
                output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
                error: (err: any) => { throw err; },
            });
            videoEncoder.configure(videoEncoderConfig);

            if (audioStreams.length > 0 && firstAudioTrackSettings) {
                const audioEncoderConfig = {
                    codec: 'mp4a.40.2', // AAC
                    sampleRate: firstAudioTrackSettings.sampleRate,
                    numberOfChannels: firstAudioTrackSettings.channelCount,
                    bitrate: 128_000, // 128 kbps
                };
                 // FIX: Cast to (self as any) to access AudioEncoder
                 if (!(await (self as any).AudioEncoder.isConfigSupported(audioEncoderConfig))) {
                    console.warn('Audio encoder config not supported, video will be silent.');
                } else {
                    // FIX: Cast to (self as any) to access AudioEncoder
                    audioEncoder = new (self as any).AudioEncoder({
                        output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
                        error: (err: any) => { throw err; },
                    });
                    audioEncoder.configure(audioEncoderConfig);

                    // Process each audio stream
                    for (const readable of audioStreams) {
                        const reader = readable.getReader();
                        (async () => {
                            while (true) {
                                const { value, done } = await reader.read();
                                if (done) break;
                                if (audioEncoder.state === 'configured') {
                                    audioEncoder.encode(value);
                                }
                                value.close();
                            }
                        })();
                    }
                }
            }
            
            self.postMessage({ type: 'ready' });

        } else if (type === 'frame') {
            if (videoEncoder && videoEncoder.state === 'configured') {
                videoEncoder.encode(payload.frame);
                videoFramesWritten++;
                self.postMessage({ type: 'progress', payload: { frames: videoFramesWritten }});
            }
            payload.frame.close();

        } else if (type === 'finish') {
            if (videoEncoder) await videoEncoder.flush();
            if (audioEncoder) await audioEncoder.flush();
            if (muxer) muxer.finalize();
            
            self.postMessage({ type: 'done' });
            videoEncoder = null;
            audioEncoder = null;
            muxer = null;
            videoFramesWritten = 0;
        }
    } catch (err) {
        self.postMessage({ type: 'error', payload: { message: err instanceof Error ? err.message : 'Erro desconhecido no worker' } });
    }
};