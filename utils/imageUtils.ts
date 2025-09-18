

export const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

export const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

export const cropImage = (imageUrl: string, aspectRatio: string): Promise<string> => new Promise((resolve, reject) => {
    // FIX: Use `window.Image` to access the constructor in environments where DOM globals are not automatically available.
    // FIX: Property 'Image' does not exist on type 'Window'.
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
        // FIX: Use `window.document` to access the DOM in environments where it's not a global.
        // FIX: Property 'document' does not exist on type 'Window'.
        const canvas = window.document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Failed to get canvas context'));
        }
        
        let sourceX: number, sourceY: number, sourceWidth: number, sourceHeight: number;
        const originalWidth = img.width;
        const originalHeight = img.height;
        const originalAspectRatio = originalWidth / originalHeight;

        const [targetW, targetH] = aspectRatio.split(':').map(Number);
        const targetAspectRatio = targetW / targetH;

        if (originalAspectRatio > targetAspectRatio) {
            sourceHeight = originalHeight;
            sourceWidth = originalHeight * targetAspectRatio;
            sourceX = (originalWidth - sourceWidth) / 2;
            sourceY = 0;
        } else {
            sourceWidth = originalWidth;
            sourceHeight = originalWidth / targetAspectRatio;
            sourceY = (originalHeight - sourceHeight) / 2;
            sourceX = 0;
        }

        canvas.width = sourceWidth;
        canvas.height = sourceHeight;

        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
        resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
});


export const createSingleFramedImage = (imageUrl: string, cropRatio: string, labelText: string | null = null): Promise<string> => new Promise(async (resolve, reject) => {
    try {
        const croppedImgUrl = await cropImage(imageUrl, cropRatio);
        // FIX: Use `window.Image` to access the constructor in environments where DOM globals are not automatically available.
        // FIX: Property 'Image' does not exist on type 'Window'.
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = croppedImgUrl;
        img.onload = () => {
            // FIX: Use `window.document` to access the DOM in environments where it's not a global.
            // FIX: Property 'document' does not exist on type 'Window'.
            const canvas = window.document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Failed to get canvas context'));
            }

            const hasLabel = !!labelText;
            const sidePadding = img.width * 0.04;
            const topPadding = img.width * 0.04;
            let bottomPadding = img.width * 0.18;

            if(hasLabel) {
                bottomPadding = img.width * 0.24;
            }
            
            canvas.width = img.width + sidePadding * 2;
            canvas.height = img.height + topPadding + bottomPadding;

            ctx.fillStyle = '#FAFAFA'; // Light off-white for frame
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(img, sidePadding, topPadding);

            if (hasLabel) {
                  const labelFontSize = Math.max(24, Math.floor(img.width * 0.08));
                  ctx.font = `700 ${labelFontSize}px Caveat, cursive`;
                  ctx.fillStyle = "rgba(18, 18, 18, 0.9)"; // brand-dark
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(labelText, canvas.width / 2, img.height + topPadding + (bottomPadding - img.width * 0.1) / 2);
            }

            const fontSize = Math.max(12, Math.floor(img.width * 0.05));
            ctx.font = `600 ${fontSize}px Inter, sans-serif`;
            ctx.fillStyle = "rgba(18, 18, 18, 0.4)"; // brand-dark
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("Feito com GenIA", canvas.width / 2, canvas.height - (img.width * 0.11));

            const nanoFontSize = Math.max(8, Math.floor(img.width * 0.035));
            ctx.font = `600 ${nanoFontSize}px Inter, sans-serif`;
            ctx.fillText("Edite as suas imagens com Nano Banana em gemini.google", canvas.width / 2, canvas.height - (img.width * 0.05));

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
    } catch(err) {
        reject(err);
    }
});

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const extractLastFrame = (videoBlob: Blob): Promise<{ base64data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    // FIX: Use `window.document` to access the DOM in environments where it's not a global.
    // FIX: Property 'document' does not exist on type 'Window'.
    const video = window.document.createElement('video');
    // FIX: Use `window.document` to access the DOM in environments where it's not a global.
    // FIX: Property 'document' does not exist on type 'Window'.
    const canvas = window.document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // FIX: Use `window.URL` to access the URL API in environments where it's not a global.
    // FIX: Property 'URL' does not exist on type 'Window'.
    const url = window.URL.createObjectURL(videoBlob);

    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.currentTime = video.duration;
    };

    video.onseeked = () => {
      if (!ctx) {
        return reject(new Error('Could not get canvas context.'));
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, 0.9);
      const base64data = dataUrl.split(',')[1];

      // FIX: Use `window.URL` to access the URL API in environments where it's not a global.
      // FIX: Property 'URL' does not exist on type 'Window'.
      window.URL.revokeObjectURL(url);
      resolve({ base64data, mimeType });
    };

    video.onerror = (e) => {
      // FIX: Use `window.URL` to access the URL API in environments where it's not a global.
      // FIX: Property 'URL' does not exist on type 'Window'.
      window.URL.revokeObjectURL(url);
      reject(new Error('Failed to load video for frame extraction.'));
    };
    video.load();
  });
}