// FIX: Implemented the full geminiService module to resolve multiple "Cannot find name" and "is not a module" errors across the application.
import { GoogleGenAI, Modality, Part, GenerateContentResponse } from "@google/genai";
// FIX: Corrected import path for a root-level file.
import type { Prompt, ModelInstructionOptions } from './types.ts';
// FIX: Corrected import path for a root-level file.
import { delay } from './utils/imageUtils.ts';

let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export const initializeGeminiClient = (apiKey: string) => {
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
    } else {
        ai = null;
        currentApiKey = null;
    }
};

const getClient = (): GoogleGenAI => {
    if (!ai) {
        throw new Error("Gemini API client has not been initialized. Please provide an API key.");
    }
    return ai;
};

const base64ToPart = (base64Data: string): Part => {
    const match = base64Data.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (match) {
        return {
            inlineData: {
                mimeType: match[1],
                data: match[2],
            },
        };
    }
    return {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
        }
    };
};

interface GenerateImageParams {
    prompt: string;
    base64ImageData?: string;
    base64Mask?: string;
    detailImages?: string[];
}

export const generateImageWithRetry = async (params: GenerateImageParams, retries = 3): Promise<string> => {
    const client = getClient();
    for (let i = 0; i < retries; i++) {
        try {
            const { prompt, base64ImageData, base64Mask, detailImages } = params;
            
            const parts: Part[] = [];

            if (base64ImageData) {
                parts.push(base64ToPart(base64ImageData));
            }
            
            if (detailImages) {
                detailImages.forEach(imgData => {
                    parts.push(base64ToPart(imgData));
                });
            }
            
            if (base64Mask) {
                 parts.push(base64ToPart(base64Mask));
            }

            parts.push({ text: prompt });

            const response: GenerateContentResponse = await client.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: parts },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }

            throw new Error("No image was generated in the response.");

        } catch (error) {
            console.error(`Attempt ${i + 1} failed for generateImageWithRetry:`, error);
            if (i === retries - 1) {
                throw error;
            }
            await delay(2000 * (i + 1));
        }
    }
    throw new Error("Image generation failed after multiple retries.");
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    const client = getClient();
    try {
        const response = await client.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        
        throw new Error("No image was generated.");

    } catch (error) {
        console.error("Image generation from prompt failed:", error);
        throw error;
    }
};

export const generateVideo = async (
    prompt: string,
    base64ImageBytes: string | null,
    mimeType: string,
    aspectRatio: string
): Promise<Blob> => {
    const client = getClient();
    
    let operation = await client.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        image: base64ImageBytes ? {
            imageBytes: base64ImageBytes,
            mimeType: mimeType,
        } : undefined,
        config: {
            numberOfVideos: 1,
            aspectRatio: aspectRatio,
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await client.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation succeeded but no download link was found.");
    }
    
    if (!currentApiKey) {
        throw new Error("API Key not available to download video. Please re-initialize the client.");
    }

    const response = await fetch(`${downloadLink}&key=${currentApiKey}`);
    if (!response.ok) {
        throw new Error(`Failed to download the generated video. Status: ${response.status}`);
    }
    
    const videoBlob = await response.blob();
    return videoBlob;
};

export const removeBackground = async (base64ImageData: string): Promise<string> => {
    const prompt = "CRITICAL TASK: Your only function is to remove the background from the provided image. Identify the primary subject(s) and perfectly isolate them. The output MUST be a high-resolution PNG of ONLY the subject(s) on a fully transparent background. Do not add shadows, reflections, or any other elements. Do not alter the subject in any way.";
    return generateImageWithRetry({ prompt, base64ImageData });
};

export const magicExpand = async (base64ImageData: string, prompt: string): Promise<string> => {
    const fullPrompt = `CRITICAL TASK: You are a professional photo editor. The user has provided an image and wants to expand it. Your task is to intelligently fill the new, empty areas around the original image content. The generated areas must seamlessly blend with the original image in terms of style, lighting, texture, and content. The expansion should feel like a natural continuation of the scene. User's creative direction: "${prompt}"`;
    return generateImageWithRetry({ prompt: fullPrompt, base64ImageData });
};

export const magicCapture = async (base64ImageData: string, objectToCapture: string): Promise<string> => {
    const prompt = `CRITICAL TASK: From the provided image, precisely extract ONLY the object described as: "${objectToCapture}". The output MUST be a high-resolution PNG of the extracted object on a fully transparent background. Ensure the edges are clean and accurate. Do not include any part of the original background or other objects.`;
    return generateImageWithRetry({ prompt, base64ImageData });
};

export const getModelInstruction = (
    templateKey: string, 
    prompt: Prompt, 
    options: ModelInstructionOptions,
    aspectRatio?: string
): string => {
    const { cameraAngle, swapGender, swapEthnicity, swapHairColor, swapAge, lookbookStyle } = options;
    let instruction = '';

    switch (templateKey) {
        case 'worldTour':
            instruction = `A photorealistic image of a person, closely resembling the person in the provided reference image. The person is now at a new location: ${prompt.id}. The specific scene is: "${prompt.base}". The person must be seamlessly integrated into the new environment, matching lighting, shadows, and perspective. Maintain the person's identity from the reference.`;
            if (cameraAngle && cameraAngle !== 'Padrão') {
                instruction += ` The photo should be taken from a ${cameraAngle.toLowerCase()} perspective.`;
            }
            break;
        
        case 'cenasDoInstagram':
            instruction = `Generate a photorealistic image for a social media post, based on this scene: "${prompt.base}". The image must look high-quality and authentic. The person in the reference image must be the subject.`;
            if (aspectRatio) {
                instruction += ` The image aspect ratio must be strictly ${aspectRatio}.`;
            }
            if (cameraAngle && cameraAngle !== 'Padrão') {
                instruction += ` Use a ${cameraAngle.toLowerCase()} camera angle.`;
            }
            break;

        case 'cleanAndSwap':
             instruction = `CRITICAL TASK: First, remove any UI elements or text overlays from the provided image to get a clean background. Second, identify the main person and replace them with a new person with these exact traits: gender: ${swapGender}, ethnicity: ${swapEthnicity}, hair color: ${swapHairColor}, age: ${swapAge}. The new person must be photorealistically integrated into the cleaned background, matching the original's lighting and pose as closely as possible. The final output must be a single, cohesive, high-resolution image.`;
            break;
            
        case 'mockupGenerator':
             instruction = `**TASK: Create a photorealistic mockup.**
             1. Use the provided artwork (the main input image).
             2. Apply this artwork realistically onto a "${prompt.base}".
             3. The final image must be a high-quality product photo. The artwork must perfectly conform to the product's shape, texture, lighting, and shadows.`;
            break;
        
        case 'productStudio':
            instruction = `**TASK: Create a professional product photograph.**
            1. Take the provided product image. You MUST perfectly remove its original background.
            2. Place the isolated product into a new, photorealistic scene described as: "${prompt.base}".
            3. The lighting on the product must perfectly match the new scene's lighting, which is: "${lookbookStyle}".
            4. The camera perspective for the final shot must be: "${cameraAngle}".
            The final image must be indistinguishable from a real, high-end product advertisement photo.`;
            break;

        default:
            instruction = prompt.base;
            break;
    }
    
    return instruction.trim().trim();
};