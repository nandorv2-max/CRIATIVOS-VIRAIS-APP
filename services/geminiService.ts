import { GoogleGenAI, Modality, Part, GenerateContentResponse } from "@google/genai";
import type { Prompt, ModelInstructionOptions, UserRole } from '../types.ts';
import { delay } from '../utils/imageUtils.ts';
import { deductVideoCredits } from './databaseService.ts';

let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export const initializeGeminiClient = (apiKey: string) => {
    if (apiKey) {
        // FIX: The API key should be passed as a named parameter to the GoogleGenAI constructor.
        ai = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
    } else {
        ai = null;
        currentApiKey = null;
    }
};

const getClient = (): GoogleGenAI => {
    if (!ai) {
        throw new Error("O cliente da API não foi inicializado. Por favor, forneça uma chave de API.");
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

export const describeImage = async (base64ImageData: string): Promise<string> => {
    const client = getClient();
    try {
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = "Descreva esta imagem em detalhes para um prompt de gerador de imagens de IA. Foque nas roupas, pose, ambiente, iluminação, cores e estilo geral do sujeito. Seja descritivo e conciso.";
        const imagePart = base64ToPart(base64ImageData);

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();
        return text.trim();
    } catch (error) {
        console.error("Image description failed:", error);
        throw new Error("Failed to generate a description for the image.");
    }
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

            if (response?.candidates?.[0]?.content?.parts) {
                let textResponse = '';
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                    if (part.text) {
                        textResponse += part.text + ' ';
                    }
                }
                if (textResponse.trim()) {
                     throw new Error(`A geração de imagem falhou. O modelo respondeu com: "${textResponse.trim()}"`);
                }
            }
            
            let failureReason = "Nenhuma imagem foi gerada na resposta.";
            if (response?.promptFeedback?.blockReason) {
                failureReason = `A geração de imagem foi bloqueada. Motivo: ${response.promptFeedback.blockReason}.`;
                if (response.promptFeedback.blockReasonMessage) {
                    failureReason += ` Detalhes: ${response.promptFeedback.blockReasonMessage}`;
                }
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

export const generateImageFromPrompt = async (prompt: string, aspectRatio: string = '1:1'): Promise<string> => {
    const client = getClient();
    for (let i = 0; i < 3; i++) { // 3 total attempts
        try {
            const fullPrompt = `${prompt}. A imagem deve ter uma proporção de ${aspectRatio}.`;
            
            const response: GenerateContentResponse = await client.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [{ text: fullPrompt }] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            if (response?.candidates?.[0]?.content?.parts) {
                let textResponse = '';
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                    if (part.text) {
                        textResponse += part.text + ' ';
                    }
                }
                if (textResponse.trim()) {
                     throw new Error(`A geração de imagem falhou. O modelo respondeu com: "${textResponse.trim()}"`);
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
            console.error(`Attempt ${i + 1} failed for generateImageFromPrompt:`, error);
            if (i === 2) { // Last attempt
                throw error;
            }
            await delay(2000 * (i + 1)); // Wait before retrying
        }
    }
    throw new Error("A geração de imagem falhou após várias tentativas.");
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


export const removeBackground = async (base64ImageData: string): Promise<string> => {
    const prompt = "TAREFA CRÍTICA: Sua única função é remover o fundo da imagem fornecida. Identifique o(s) sujeito(s) principal(is) e isole-o(s) perfeitamente. O resultado DEVE ser um PNG de alta resolução APENAS do(s) sujeito(s) em um fundo totalmente transparente. Não adicione sombras, reflexos ou quaisquer outros elementos. Não altere o sujeito de forma alguma.";
    return generateImageWithRetry({ prompt, base64ImageData });
};

export const magicExpand = async (base64ImageData: string, prompt: string): Promise<string> => {
    const fullPrompt = `TAREFA CRÍTICA: Você é um editor de fotos profissional. O usuário forneceu uma imagem e deseja expandi-la. Sua tarefa é preencher inteligentemente as novas áreas vazias ao redor do conteúdo da imagem original. As áreas geradas devem se misturar perfeitamente com a imagem original em termos de estilo, iluminação, textura e conteúdo. A expansão deve parecer uma continuação natural da cena. Direção criativa do usuário: "${prompt}"`;
    return generateImageWithRetry({ prompt: fullPrompt, base64ImageData });
};

export const magicCapture = async (base64ImageData: string, objectToCapture: string): Promise<string> => {
    const prompt = `TAREFA CRÍTICA: Da imagem fornecida, extraia precisamente APENAS o objeto descrito como: "${objectToCapture}". O resultado DEVE ser um PNG de alta resolução do objeto extraído em um fundo totalmente transparente. Garanta que as bordas estejam limpas e precisas. Não inclua nenhuma parte do fundo original ou outros objetos.`;
    return generateImageWithRetry({ prompt, base64ImageData });
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
            instruction = `Uma imagem fotorrealista de uma pessoa, muito parecida com a pessoa na imagem de referência fornecida. A pessoa está agora em um novo local: ${prompt.id}. A cena específica é: "${prompt.base}". A pessoa deve ser perfeitamente integrada ao novo ambiente, combinando iluminação, sombras e perspectiva. Mantenha a identidade da pessoa da referência.`;
            break;
        
        case 'cenasDoInstagram':
            instruction = `Gerar uma imagem fotorrealista para um post de rede social, baseada nesta cena: "${prompt.base}". A imagem deve parecer de alta qualidade e autêntica. A pessoa na imagem de referência deve ser o sujeito. CRÍTICO: A imagem final NÃO deve conter nenhum texto, marca d'água ou legendas escritas nela.`;
            if (aspectRatio) {
                instruction += ` A proporção da imagem deve ser estritamente ${aspectRatio}.`;
            }
            break;

        case 'cleanAndSwap':
             instruction = `TAREFA CRÍTICA: Primeiro, remova quaisquer elementos de interface ou sobreposições de texto da imagem fornecida para obter um fundo limpo. Segundo, identifique a pessoa principal e substitua-a por uma nova pessoa com estas características exatas: gênero: ${swapGender}, etnia: ${swapEthnicity}, cor do cabelo: ${swapHairColor}, idade: ${swapAge}. A nova pessoa deve ser integrada de forma fotorrealista no fundo limpo, combinando a iluminação e a pose do original o mais próximo possível. O resultado final deve ser uma única imagem coesa e de alta resolução.`;
            break;
            
        case 'mockupGenerator':
             instruction = `**TAREFA: Criar um mockup fotorrealista.**
             1. Use a arte fornecida (a imagem de entrada principal).
             2. Aplique esta arte de forma realista em um(a) "${prompt.base}".
             3. A imagem final deve ser uma foto de produto de alta qualidade. A arte deve se conformar perfeitamente à forma, textura, iluminação e sombras do produto.`;
            break;
        
        case 'productStudio':
            instruction = `**TAREFA: Criar uma fotografia de produto profissional.**
            1. Pegue a imagem do produto fornecida. Você DEVE remover perfeitamente o fundo original.
            2. Coloque o produto isolado em uma nova cena fotorrealista descrita como: "${prompt.base}".
            3. A iluminação no produto deve corresponder perfeitamente à iluminação da nova cena, que é: "${lookbookStyle}".
            4. A perspectiva da câmera para a foto final deve ser: "${options.cameraAngle}".
            A imagem final deve ser indistinguível de uma foto de anúncio de produto de alta qualidade real.`;
            break;

        default:
            instruction = prompt.base;
            break;
    }
    
    return instruction.trim();
};