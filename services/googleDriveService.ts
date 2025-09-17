// A service to interact with the Google Drive Picker API using modern Google Identity Services.
import { toBase64 } from "../utils/imageUtils";

declare var gapi: any;
declare var google: any;

// IMPORTANT: A full Google Drive integration requires a GOOGLE_CLIENT_ID from the Google Cloud Console,
// with a configured OAuth 2.0 consent screen. Without a valid Client ID, the login pop-up may not complete successfully.
const DEVELOPER_KEY = process.env.API_KEY;
// Using `null` for CLIENT_ID to prevent a "process is not defined" error in the browser.
// The developer must configure this in their own environment.
const CLIENT_ID = null;
const APP_ID = CLIENT_ID ? CLIENT_ID.split('-')[0] : '';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let accessToken: any = null;
let pickerApiLoadedPromise: Promise<void> | null = null;

/**
 * Ensures that the Google Picker API is loaded and ready.
 * This function creates a singleton promise that resolves once the picker
 * library has been successfully loaded via `gapi.load`. All subsequent calls
 * will return the same promise, preventing multiple load attempts.
 */
const ensurePickerApiIsLoaded = (): Promise<void> => {
    if (!pickerApiLoadedPromise) {
        pickerApiLoadedPromise = new Promise((resolve) => {
            const checkGapi = () => {
                if (typeof gapi !== 'undefined' && gapi.load) {
                    gapi.load('picker', { 'callback': resolve });
                } else {
                    setTimeout(checkGapi, 100);
                }
            };
            checkGapi();
        });
    }
    return pickerApiLoadedPromise;
};


const fileToB64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

const authenticateAndShowPicker = async (viewId: any, mimeTypes: string): Promise<any[]> => {
    if (!CLIENT_ID || !DEVELOPER_KEY) {
        // Use an alert for a user-facing message, then throw for developer console.
        // FIX: Prefix 'alert' with 'window.' to ensure it is available in non-browser-default environments.
        // FIX: Property 'alert' does not exist on type 'Window'.
        window.alert("A integração com o Google Drive não está configurada. O proprietário do site precisa de configurar um 'Client ID' da API do Google para ativar esta funcionalidade.");
        throw new Error("A configuração da API do Google Drive está em falta. Por favor, configure um GOOGLE_CLIENT_ID e certifique-se de que a API_KEY está disponível.");
    }

    if (typeof google === 'undefined' || !google.accounts) {
        throw new Error("A biblioteca de autenticação do Google (GSI) não foi carregada. Verifique o script em index.html.");
    }

    accessToken = await new Promise<any>((resolve, reject) => {
        try {
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        resolve(tokenResponse);
                    } else {
                        reject(new Error("Falha ao adquirir o token de acesso. A resposta estava vazia."));
                    }
                },
                error_callback: (error: any) => {
                    reject(new Error(`Erro de autenticação: ${error.message || 'O pop-up foi fechado pelo utilizador.'}`));
                }
            });
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (err) {
            reject(err);
        }
    });

    if (!accessToken) {
        throw new Error("A autenticação com o Google falhou.");
    }

    await ensurePickerApiIsLoaded();

    return new Promise<any[]>((resolve) => {
        const view = new google.picker.View(viewId);
        view.setMimeTypes(mimeTypes);

        const picker = new google.picker.PickerBuilder()
            .enableFeature(google.picker.Feature.NAV_HIDDEN)
            .setAppId(APP_ID)
            .setOAuthToken(accessToken.access_token)
            .addView(view)
            .setDeveloperKey(DEVELOPER_KEY)
            .setCallback((data: any) => {
                if (data.action === google.picker.Action.PICKED) {
                    resolve(data.docs);
                } else if (data.action === google.picker.Action.CANCEL) {
                    resolve([]);
                }
            })
            .build();
        picker.setVisible(true);
    });
};

export const showGoogleDrivePicker = async (): Promise<string[]> => {
    await ensurePickerApiIsLoaded();
    const docs = await authenticateAndShowPicker(google.picker.ViewId.DOCS, "image/png,image/jpeg,image/jpg,image/webp");
    if (docs.length === 0) return [];

    const imagePromises = docs.map(async (doc) => {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken.access_token}` }
        });
        if (!response.ok) throw new Error(`Falha ao descarregar o ficheiro ${doc.name}`);
        const blob = await response.blob();
        return fileToB64(blob);
    });

    return Promise.all(imagePromises);
};

export const showGoogleDriveDngPicker = async (): Promise<{name: string, content: string}[]> => {
    await ensurePickerApiIsLoaded();
    const docs = await authenticateAndShowPicker(google.picker.ViewId.DOCS, "image/x-adobe-dng,application/octet-stream");
    if (docs.length === 0) return [];

    const dngPromises = docs.map(async (doc) => {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken.access_token}` }
        });
        if (!response.ok) throw new Error(`Falha ao descarregar o ficheiro ${doc.name}`);
        const blob = await response.blob();
        const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(blob, 'latin1');
        });
        return { name: doc.name, content };
    });

    return Promise.all(dngPromises);
};