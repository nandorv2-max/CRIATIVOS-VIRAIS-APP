import { GoogleGenAI, Part, GenerateContentResponse } from "@google/genai";
import type { Prompt, ModelInstructionOptions, UserRole } from '../types.ts';
import { delay } from '../utils/imageUtils.ts';
import { deductVideoCredits } from './databaseService.ts';

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
    apiKey: string;
    base64ImageData?: string;
    base64Mask?: string;
    detailImages?: string[];
}

export const getChatResponse = async (history: { role: 'user' | 'model', parts: string }[], knowledgeBase: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("A chave de API é necessária para o chat.");
    }
    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemInstruction = `You are a helpful and friendly support agent for an application called AuraStudio. Your knowledge base is provided below. Answer the user's questions based ONLY on this information. Be concise and clear. If the user asks something not covered in the knowledge base, politely state that you don't have information on that topic and suggest they escalate to a human support agent.

    **KNOWLEDGE BASE:**
    ${knowledgeBase}`;

    const chat = model.startChat({
        history: history.map(h => ({ role: h.role, parts: [{ text: h.parts }] })),
        systemInstruction: {
            role: "system",
            parts: [{ text: systemInstruction }],
        },
    });

    const lastMessage = history[history.length - 1].parts;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    return response.text();
};


export const generateImageWithRetry = async (params: GenerateImageParams, retries = 3): Promise<string> => {
    if (!params.apiKey) {
        throw new Error("A chave de API é necessária para gerar imagens.");
    }
    const client = new GoogleGenAI({ apiKey: params.apiKey });

    for (let i = 0; i < retries; i++) {
        try {
            const { prompt, base64ImageData, base64Mask, detailImages } = params;
            
            const parts: Part[] = [{ text: prompt }];

            if (base64ImageData) {
                parts.unshift(base64ToPart(base64ImageData));
            }
            
            if (detailImages) {
                detailImages.forEach(imgData => {
                    parts.unshift(base64ToPart(imgData));
                });
            }
            
            if (base64Mask) {
                 parts.push(base64ToPart(base64Mask));
            }

            const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts }],
            });

            const response = result.response;

            if (response?.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }
            
            let failureReason = "Nenhuma imagem foi gerada na resposta.";
            if (response?.promptFeedback?.blockReason) {
                failureReason = `A geração de imagem foi bloqueada. Motivo: ${response.promptFeedback.blockReason}.`;
            } else if (!response?.candidates || response.candidates.length === 0) {
                 failureReason = "A geração de imagem falhou: Nenhum resultado válido foi retornado pelo modelo.";
            }

            throw new Error(failureReason);

        } catch (error) {
            console.error(`Attempt ${i + 1} failed for generateImageWithRetry:`, error);
            if (i === retries - 1) {
                throw error;
            }
            await delay(2000 * (i + 1));
        }
    }
    throw new Error("A geração de imagem falhou após várias tentativas.");
};

export const generateImageFromPrompt = async (prompt: string, aspectRatio: string = '1:1', apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("A chave de API é necessária para gerar imagens.");
    }
    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
    try {
        const result = await model.generateContent(`--aspect_ratio ${aspectRatio} ${prompt}`);
        const response = result.response;

        if (response?.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        throw new Error("Nenhuma imagem foi gerada.");

    } catch (error) {
        console.error("Image generation from prompt failed:", error);
        throw error;
    }
};

export const generateVideo = async (
    prompt: string,
    base64ImageBytes: string | null,
    mimeType: string,
    aspectRatio: string,
    userRole: UserRole
): Promise<Blob> => {
    // 1. Authorization check - Fail fast for unauthorized users
    const authorizedRoles: UserRole[] = ['premium', 'professional', 'admin'];
    if (!authorizedRoles.includes(userRole)) {
         throw new Error("O seu plano atual não permite a geração de vídeos. Faça um upgrade para aceder a esta funcionalidade.");
    }
    
    // 2. Main logic wrapped in a try/catch to handle errors gracefully without deducting credits
    try {
        const masterApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!masterApiKey) {
            throw new Error("A chave de API principal para geração de vídeo não está configurada no ambiente da aplicação. Por favor, contacte o administrador.");
        }
        
        // Use a dedicated, local client for video generation to ensure it always uses the master key.
        const videoClient = new GoogleGenAI({ apiKey: masterApiKey });

        let operation = await videoClient.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: base64ImageBytes ? { imageBytes: base64ImageBytes, mimeType: mimeType } : undefined,
            config: { numberOfVideos: 1, aspectRatio: aspectRatio }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await videoClient.operations.getVideosOperation({ operation: operation });
        }

        if (operation.error) {
            throw new Error(`A API de geração de vídeo retornou um erro: ${operation.error.message} (Código: ${operation.error.code})`);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("A geração de vídeo foi bem-sucedida, mas não foi encontrado nenhum link para download na resposta da API.");
        }
        
        // The downloadLink is a pre-signed URL and does NOT need the API key appended.
        const response = await fetch(downloadLink);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Failed to download video. Status:", response.status, "Body:", errorBody);
            throw new Error(`Falha ao baixar o vídeo gerado. Estado: ${response.status}`);
        }
        
        const videoBlob = await response.blob();

        // 3. Deduct credits ONLY after the entire process is successful.
        if (userRole !== 'admin') {
            try {
                await deductVideoCredits(20);
            } catch (deductionError: any) {
                // This is an edge case: video is created but credits couldn't be deducted (e.g., user ran out mid-generation).
                // Log it, but let the user have the video.
                console.error(`CRITICAL: Video successfully generated for user, but credit deduction failed. Reason: ${deductionError.message}`);
            }
        }
        
        return videoBlob;

    } catch (error: any) {
        console.error('Video generation process failed:', error);
        // Re-throw the original error. No credits were deducted if we land here.
        if (error.message && error.message.includes('INSUFFICIENT_CREDITS')) {
            throw new Error("Créditos de vídeo insuficientes. A sua cota será renovada no próximo ciclo de faturação ou pode fazer um upgrade de plano.");
        }
        throw error;
    }
};

export const translateText = async (text: string, targetLanguage: string = 'English', apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("A chave de API é necessária para tradução.");
    }
    const client = new GoogleGenAI({ apiKey });
    if (!text.trim()) return text;
    try {
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Translate the following text to ${targetLanguage}. Return only the translated text, without any preamble or explanation. Text to translate: "${text}"`);
        const response = result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Translation failed:", error);
        throw new Error("Failed to translate text.");
    }
};

export const getModelInstruction = (
    templateKey: string, 
    prompt: Prompt, 
    options: ModelInstructionOptions,
    aspectRatio?: string
): string => {
    const { swapGender, swapEthnicity, swapHairColor, swapAge, lookbookStyle } = options;
    let instruction = '';

    switch (templateKey) {
        case 'worldTour':
            instruction = `A photorealistic image of a person, closely resembling the person in the provided reference image. The person is now at a new location: ${prompt.id}. The specific scene is: "${prompt.base}". The person must be seamlessly integrated into the new environment, matching lighting, shadows, and perspective. Maintain the person's identity from the reference.`;
            break;
        
        case 'cenasDoInstagram':
            instruction = `Generate a photorealistic image for a social media post, based on this scene: "${prompt.base}". The image must look high-quality and authentic. The person in the reference image must be the subject. CRITICAL: The final image must NOT contain any text, watermarks, or captions written on it.`;
            if (aspectRatio) {
                instruction += ` The image aspect ratio must be strictly ${aspectRatio}.`;
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
            4. The camera perspective for the final shot must be: "${options.cameraAngle}".
            The final image must be indistinguishable from a real, high-end product advertisement photo.`;
            break;

        default:
            instruction = prompt.base;
            break;
    }
    
    return instruction.trim();
};