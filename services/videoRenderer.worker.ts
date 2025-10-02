import { Muxer, ArrayBufferTarget } from 'https://aistudiocdn.com/mp4-muxer@^2.0.2';

declare var VideoEncoder: any;
declare var AudioEncoder: any;
declare var VideoFrame: any;
declare var AudioData: any;
declare type AudioEncoderConfig = any;
declare type VideoEncoderConfig = any;

let muxer: any | null = null;
let videoEncoder: any | null = null;
let audioEncoder: any | null = null;

const ctx = self as any;

const encodeFullAudio = async (channels: Float32Array[], sampleRate: number, numberOfChannels: number) => {
    if (!audioEncoder) return;

    const totalSamples = channels[0].length;
    const samplesPerChunk = sampleRate; // 1 second of audio at a time

    for (let i = 0; i < totalSamples; i += samplesPerChunk) {
        const chunkEnd = Math.min(i + samplesPerChunk, totalSamples);
        const chunkNumSamples = chunkEnd - i;
        
        const interleavedData = new Float32Array(chunkNumSamples * numberOfChannels);
        for (let chan = 0; chan < numberOfChannels; chan++) {
            const channelData = channels[chan];
            for (let j = 0; j < chunkNumSamples; j++) {
                interleavedData[j * numberOfChannels + chan] = channelData[i + j];
            }
        }
        
        const timestamp = (i / sampleRate) * 1_000_000; // in microseconds

        const audioDataChunk = new AudioData({
            format: 'f32',
            sampleRate: sampleRate,
            numberOfFrames: chunkNumSamples,
            numberOfChannels: numberOfChannels,
            timestamp: timestamp,
            data: interleavedData
        });

        audioEncoder.encode(audioDataChunk);
    }
};


ctx.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === 'start') {
      const { exportWidth, exportHeight, options, audio } = payload;
      
      const videoCodecString =
        options.codec === 'hevc'
          ? 'hvc1.1.6.L120.90'
          : 'avc1.640028'; // H.264 High Profile, Level 4.0

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
        throw new Error(`Configuração de vídeo não suportada: ${JSON.stringify(videoSupport.config)}`);
      }

      muxer = new Muxer({
        target: new ArrayBufferTarget(),
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
        output: (chunk: any, meta: any) => muxer!.addVideoChunk(chunk, meta),
        error: (err: any) => {
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
            throw new Error(`Configuração de áudio não suportada: ${JSON.stringify(audioSupport.config)}`);
        }
        audioEncoder = new AudioEncoder({
            output: (chunk: any, meta: any) => muxer!.addAudioChunk(chunk, meta),
            error: (err: any) => {
                console.error('AudioEncoder error:', err);
                ctx.postMessage({ type: 'error', payload: { message: `Erro do AudioEncoder: ${err.message}` }});
            }
        });
        audioEncoder.configure(audioEncoderConfig);
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

      const { buffer } = muxer.target;
      
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Buffer MP4 vazio. Verifique se os frames foram enviados.');
      }

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