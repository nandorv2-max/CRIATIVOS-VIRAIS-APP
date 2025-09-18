import { Muxer } from 'mp4-muxer';

// FIX: Declare WebCodec API types to resolve TypeScript errors.
declare var VideoEncoder: any;
declare var AudioEncoder: any;
declare var VideoFrame: any;
declare var AudioData: any;
declare type AudioEncoderConfig = any;
declare type VideoEncoderConfig = any;

let muxer: any | null = null;
let videoEncoder: VideoEncoder | null = null;
// FIX: Changed type from `AudioEncoder` to `any` because `declare var AudioEncoder: any` defines it as a value, not a type.
let audioEncoder: any | null = null;

const ctx = self as any;

const encodeFullAudio = async (channels: Float32Array[], sampleRate: number, numberOfChannels: number) => {
    if (!audioEncoder) return;

    const totalSamples = channels[0].length;
    // Process audio in chunks of a comfortable size to avoid creating huge AudioData objects
    const samplesPerChunk = sampleRate; // e.g., 1 second of audio at a time

    for (let i = 0; i < totalSamples; i += samplesPerChunk) {
        const chunkEnd = Math.min(i + samplesPerChunk, totalSamples);
        const chunkNumSamples = chunkEnd - i;
        
        // Interleave the planar channel data into a single buffer
        const interleavedData = new Float32Array(chunkNumSamples * numberOfChannels);
        for (let chan = 0; chan < numberOfChannels; chan++) {
            const channelData = channels[chan];
            for (let j = 0; j < chunkNumSamples; j++) {
                interleavedData[j * numberOfChannels + chan] = channelData[i + j];
            }
        }
        
        const timestamp = (i / sampleRate) * 1_000_000; // in microseconds

        const audioDataChunk = new AudioData({
            format: 'f32', // Interleaved Float32
            sampleRate: sampleRate,
            numberOfFrames: chunkNumSamples,
            numberOfChannels: numberOfChannels,
            timestamp: timestamp,
            data: interleavedData
        });

        audioEncoder.encode(audioDataChunk);
    }
};


ctx.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    if (type === 'start') {
      const { exportWidth, exportHeight, options, audio } = payload;
      
      const videoCodecString =
        options.codec === 'hevc'
          ? 'hvc1.1.6.L120.90'
          : 'avc1.42E01E'; // H.264 baseline, compatível

      const videoEncoderConfig: VideoEncoderConfig = {
        codec: videoCodecString,
        width: exportWidth,
        height: exportHeight,
        bitrate: options.bitrate * 1000,
        framerate: options.frameRate,
        latencyMode: 'quality',
      };

      const videoSupport = await VideoEncoder.isConfigSupported(videoEncoderConfig);
      if (!videoSupport.supported) {
        throw new Error(`Configuração de vídeo não suportada: ${JSON.stringify(videoSupport)}`);
      }

      muxer = new Muxer({
        target: 'buffer' as any,
        video: {
          codec: options.codec === 'hevc' ? 'hevc' : 'avc',
          width: exportWidth,
          height: exportHeight,
        },
        audio: audio ? {
            codec: 'aac',
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
        } : undefined,
        fastStart: 'in-memory',
      });

      videoEncoder = new VideoEncoder({
        output: (chunk, meta) => {
          try {
            muxer!.addVideoChunk(chunk, meta);
          } catch (err: any) {
            console.error('Muxer video error:', err);
            ctx.postMessage({ type: 'error', payload: { message: `Erro do Muxer de vídeo: ${err.message}` }});
          }
        },
        error: (err) => {
          console.error('VideoEncoder error:', err);
          ctx.postMessage({ type: 'error', payload: { message: `Erro do VideoEncoder: ${err.message}` }});
        },
      });
      videoEncoder.configure(videoEncoderConfig);
      
      if (audio) {
        const audioEncoderConfig: AudioEncoderConfig = {
            codec: 'mp4a.40.2', // AAC-LC, highly compatible
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
            bitrate: 128_000, // 128 kbps is a good default for stereo
        };
        const audioSupport = await AudioEncoder.isConfigSupported(audioEncoderConfig);
        if(!audioSupport.supported) {
            throw new Error(`Configuração de áudio não suportada: ${JSON.stringify(audioSupport)}`);
        }
        audioEncoder = new AudioEncoder({
            output: (chunk, meta) => {
                try {
                    muxer!.addAudioChunk(chunk, meta);
                } catch (err: any) {
                    console.error('Muxer audio error:', err);
                    ctx.postMessage({ type: 'error', payload: { message: `Erro do Muxer de áudio: ${err.message}` }});
                }
            },
            error: (err) => {
                console.error('AudioEncoder error:', err);
                ctx.postMessage({ type: 'error', payload: { message: `Erro do AudioEncoder: ${err.message}` }});
            }
        });
        audioEncoder.configure(audioEncoderConfig);
        // Start encoding the entire audio track immediately
        encodeFullAudio(audio.channels, audio.sampleRate, audio.numberOfChannels);
      }

      ctx.postMessage({ type: 'ready' });

    } else if (type === 'frame') {
      if (videoEncoder && videoEncoder.state === 'configured') {
        videoEncoder.encode(payload.frame);
      }
      payload.frame.close();

    } else if (type === 'finish') {
      if (!videoEncoder || !muxer) {
        throw new Error('Finish chamado antes do encoder ou muxer estar inicializado.');
      }

      await videoEncoder.flush();
      if(audioEncoder) {
          await audioEncoder.flush();
      }
      muxer.finalize();

      const { buffer } = muxer as { buffer: ArrayBuffer };
      
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Buffer MP4 vazio. Verifique se os frames foram enviados.');
      }

      // TRANSFERE o ArrayBuffer corretamente
      ctx.postMessage({ type: 'done', payload: buffer }, [buffer]);
      videoEncoder = null;
      audioEncoder = null;
      muxer = null;
    }
  } catch (err) {
    console.error('Error in video renderer worker:', err);
    ctx.postMessage({
      type: 'error',
      payload: {
        message:
          err instanceof Error
            ? `Erro no worker de vídeo: ${err.name} - ${err.message}`
            : 'Erro desconhecido no worker de vídeo.',
      },
    });
  }
};