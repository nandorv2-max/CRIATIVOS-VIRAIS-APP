

import { GoogleGenAI, Modality, GenerateContentResponse, Part } from "@google/genai";
import type { ModelInstructionOptions, Prompt } from '../types';
import { toBase64, delay } from "../utils/imageUtils";

// Initialize AI client conditionally to prevent app crash on load if API key is missing.
const API_KEY = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (!API_KEY) {
    console.error("API_KEY environment variable not set. AI features will be disabled.");
} else {
    ai = new GoogleGenAI({ apiKey: API_KEY });
}

/**
 * Strips the base64 prefix from a data URL string using a regular expression,
 * making it robust for any image type (png, jpeg, webp, etc.).
 */
const stripPrefix = (b64: string): string => {
    const match = b64.match(/;base64,(.*)$/);
    if (match) {
        return match[1];
    }
    return b64; // Return as-is if no prefix is found.
};

/**
 * Determines the MIME type from a base64 data URL string using a regular expression.
 */
const getMimeType = (b64: string): string => {
    const match = b64.match(/^data:(image\/[a-zA-Z]+);/);
    if (match) {
        return match[1];
    }
    return 'image/png'; // Default MIME type if not found in prefix.
};


interface GenerateImageOptions {
    prompt: string;
    base64ImageData: string;
    base64Mask?: string;
    detailImages?: string[];
    retries?: number;
}
/**
 * Generates an image using the Gemini API with retry logic.
 * This function is designed for image editing tasks based on a prompt and a source image.
 */
export const generateImageWithRetry = async ({
    prompt,
    base64ImageData,
    base64Mask,
    detailImages = [],
    retries = 3
}: GenerateImageOptions): Promise<string> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Please set the API_KEY environment variable.");
    }
    
    const parts: Part[] = [];

    // The order of parts can be critical for vision models.
    // Generally, image data should precede the text prompt that describes the desired manipulation.
    
    // 1. Main Image
    parts.push({
        inlineData: {
            data: stripPrefix(base64ImageData),
            mimeType: getMimeType(base64ImageData),
        },
    });

    // 2. Mask (if provided)
    if(base64Mask) {
        parts.push({
            inlineData: {
                data: stripPrefix(base64Mask),
                mimeType: getMimeType(base64Mask),
            }
        });
    }

    // 3. Detail/Reference Images
    for(const detailImage of detailImages) {
        parts.push({
            inlineData: {
                data: stripPrefix(detailImage),
                mimeType: getMimeType(detailImage),
            }
        });
    }

    // 4. Text Prompt (after all image parts)
    parts.push({ text: prompt });

    for (let i = 0; i < retries; i++) {
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
            
            if (response.promptFeedback?.blockReason) {
                const reason = response.promptFeedback.blockReason;
                console.error(`Request blocked due to: ${reason}`);
                const safetyRatings = response.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ');
                if (safetyRatings) console.error(`Safety ratings: ${safetyRatings}`);
                throw new Error(`Request was blocked due to safety concerns (${reason}). Please try a different prompt.`);
            }

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    return `data:image/png;base64,${base64ImageBytes}`;
                }
            }
            // FIX: Use response.text to get the text response, instead of manually searching for text parts.
            const textResponse = response.text;
            if (textResponse) {
                console.warn("API returned a text response instead of an image:", textResponse);
                throw new Error(`Image generation failed. The API responded with text: "${textResponse}"`);
            }
            
            throw new Error("No image found in API response.");

        } catch (error) {
            console.error(`Attempt ${i + 1} failed for prompt "${prompt.substring(0, 50)}...":`, error);
            if (i === retries - 1) {
                throw new Error(`Image generation failed after ${retries} attempts. ${error instanceof Error ? error.message : String(error)}`);
            }
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
        }
    }
    throw new Error("Image generation failed after multiple retries.");
};


/**
 * Generates an image from a text prompt using the Imagen model.
 */
export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Please set the API_KEY environment variable.");
    }
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
        
        throw new Error("No image found in API response from Imagen.");
    } catch (error) {
        console.error(`Image generation from prompt failed:`, error);
        throw new Error(`Image generation failed. ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Generates a video using the Veo model.
 */
export const generateVideo = async (
  prompt: string,
  imageBytes: string | null,
  mimeType: string,
  aspectRatio: string
): Promise<Blob> => {
  if (!ai) {
      throw new Error("Gemini AI client is not initialized. Please set the API_KEY environment variable.");
  }

  const config: any = {
    model: 'veo-2.0-generate-001',
    prompt,
    config: {
      aspectRatio,
      numberOfVideos: 1,
    },
  };

  if (imageBytes && mimeType) {
    config.image = {
      imageBytes,
      mimeType,
    };
  }

  let operation = await ai.models.generateVideos(config);

  while (!operation.done) {
    // Re-check status every 10 seconds
    await delay(10000);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos were generated in the response.');
  }

  const v = videos[0];
  if (!v.video?.uri) {
      throw new Error('Video URI is missing in the response.');
  }
  const url = `${v.video.uri}&key=${API_KEY}`;
  
  // FIX: Prefix `fetch` with `window.` to ensure it resolves in non-browser default environments.
  // FIX: Property 'fetch' does not exist on type 'Window'.
  const res = await window.fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch video: ${res.statusText}`);
  }
  const blob = await res.blob();
  return blob;
}

export const AI_PROMPTS = {
    MAGIC_EXPAND: `PRIORIDADE MÁXIMA - TAREFA DE OUTPAINTING (EXPANSÃO MÁGICA). Você recebeu uma imagem que contém um conteúdo fotográfico central cercado por áreas vazias/transparentes. Sua única tarefa é preencher as áreas vazias de forma fotorrealista, estendendo o conteúdo existente da imagem de maneira contínua e crível. Analise a cena, iluminação, texturas e contexto da imagem central e continue-os perfeitamente para preencher toda a tela. O resultado DEVE ser uma imagem única e coesa, sem bordas ou transições visíveis entre o conteúdo original e o expandido. A saída deve ser APENAS a imagem finalizada.`
};

/**
 * Constructs a detailed model instruction prompt based on user selections.
 */
export const getModelInstruction = (
    template: string,
    prompt: Prompt,
    options: Omit<ModelInstructionOptions, 'cameraType'>,
    aspectRatio?: string
): string => {
    const { cameraAngle, swapGender, swapEthnicity, swapHairColor } = options;
    
    let baseInstruction = '';
    const consistencyInstruction = " **HIGHEST PRIORITY FOR PERSONAL DETAILS:** The reference image is the single source of truth. It is of absolute, maximum priority to faithfully replicate all unique features of the person in the reference photo. This includes, without exception, tattoos, scars, and birthmarks. **TATTOO RULE:** Identify which arm(s) (right or left) the original person has tattoos on. Faithfully replicate ONLY the visible tattoos in their exact locations. It is strictly FORBIDDEN to add tattoos to arms or body parts that are clean in the reference photo. If an arm has no tattoo in the original, it MUST remain clean in the generated photo. Do not invent, alter, or add tattoos.";
    
    let organicLookInstruction = `**ESTILO VISUAL OBRIGATÓRIO (MÁXIMA PRIORIDADE):** A imagem final DEVE parecer uma fotografia 100% autêntica e realista, capturada espontaneamente com um smartphone de última geração (pense num iPhone 15 Pro Max). A estética deve ser orgânica e natural, como uma foto real de um feed do Instagram, não uma imagem de IA. **DETALHES CRÍTICOS PARA REALISMO:** 1. **Iluminação:** Use iluminação natural e crível, com sombras suaves e realces que correspondam ao ambiente. EVITE iluminação de estúdio artificial, dura ou excessivamente perfeita. 2. **Textura:** A pele DEVE ter textura real (poros, pequenas imperfeições), não um acabamento de plástico ou 'airbrushed'. As texturas das roupas e do ambiente devem ser detalhadas. 3. **Grão e Foco:** Incorpore um grão de filme muito sutil e natural. O foco deve ser nítido no assunto principal, com um desfoque de profundidade de campo (bokeh) natural e realista no fundo. 4. **Composição:** A cena deve parecer um momento espontâneo, não uma pose de estúdio. Evite composições perfeitamente simétricas. O objetivo é o realismo absoluto de uma memória capturada, não uma imagem polida e gerada por IA.`;
    if(aspectRatio) {
        organicLookInstruction += ` **A proporção da imagem DEVE SER ${aspectRatio}.**`;
    }


    switch (template) {
        case 'worldTour':
        case 'cenasDoInstagram':
            baseInstruction = `${organicLookInstruction}
    
**TAREFA:** Com a máxima prioridade, mantenha as feições exatas, a semelhança e o género percebido da pessoa na foto de referência. Mantendo a composição da foto original tanto quanto possível, insira a pessoa na seguinte cena, alterando a sua roupa, acessórios e fundo para combinar: ${prompt.base}. Não altere a estrutura facial principal da pessoa.` + consistencyInstruction;
            break;
        case 'cleanAndSwap':
             baseInstruction = `Execute the following tasks in order of priority. **HIGHEST PRIORITY (Step 1): UI Cleanup.** Your first and most important task is to perform an inpainting operation to completely remove all non-photographic graphical elements from the image. Identify, erase, and reconstruct the background behind ALL icons (like the volume icon and three-dot menu), text overlays, captions, usernames, and any other UI graphics. The result MUST be an image that looks like an original photograph with NO trace of an interface. **SECONDARY PRIORITY (Step 2): Scene Maintenance.** Keep the background, lighting, objects (donuts, bowl, etc.), and the person's clothing exactly as they are in the original image. DO NOT add new objects that were not there. **FINAL TASK (Step 3):** After the complete cleanup, replace the original person with a new photorealistic person with these features: ${swapGender}, ${swapEthnicity}, with ${swapHairColor} hair, maintaining the same pose and expression. O resultado final deve parecer uma fotografia genuína, espontânea e não editada, como se tivesse sido tirada com um smartphone de alta qualidade.`;
             break;
        default:
            baseInstruction = `Create an image based on the reference photo and this prompt: ${prompt.base}`;
    }

    let finalInstruction = baseInstruction;
    
    // Camera Angle Logic
    let angleInstruction = '';
    const effectiveAngle = cameraAngle === 'Padrão' 
        ? (template === 'cenasDoInstagram' ? 'Frontal' : 'Padrão')
        : cameraAngle;

    switch (effectiveAngle) {
        case 'Frontal':
            angleInstruction = " The person should be looking forward, as if speaking directly to the camera or viewer.";
            break;
        case 'Low Angle':
            angleInstruction = " The photo should be taken from a low angle looking up (worm's-eye view), making the person appear more imposing.";
            break;
        case 'High Angle':
            angleInstruction = " The photo should be taken from a high angle looking down (bird's-eye view) on the person.";
            break;
        case 'Extreme Close-up':
            angleInstruction = " The photo should be an extreme close-up, focusing intensely on one part of the face, like the eyes or mouth.";
            break;
    }
    finalInstruction += angleInstruction;

    return finalInstruction;
};