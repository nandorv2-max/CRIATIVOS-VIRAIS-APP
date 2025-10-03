// This is a simplified parser for DNG/XMP presets.
// It uses regex to find common Lightroom adjustment tags within the XMP metadata block.
// A full XML parser would be more robust but also much larger. This is a pragmatic approach.

const XMP_TO_ADJUSTMENT_MAP: { [key in string]: string } = {
    'crs:Exposure2012': 'exposure',
    'crs:Contrast2012': 'contrast',
    'crs:Highlights2012': 'highlights',
    'crs:Shadows2012': 'shadows',
    'crs:Whites2012': 'whites',
    'crs:Blacks2012': 'blacks',
    'crs:Texture': 'texture',
    'crs:Clarity2012': 'clarity',
    'crs:Dehaze': 'dehaze',
    'crs:Vibrance': 'vibrance',
    'crs:Saturation': 'saturation',
    'crs:Temperature': 'temperature',
    'crs:Tint': 'tint',
    'crs:Sharpness': 'sharpness',
    'crs:GrainAmount': 'grain',
    'crs:VignetteAmount': 'vignette',
};

// Converts adjustment values from Lightroom's typical range to our simple -100 to 100 scale.
// Note: This is an approximation as Lightroom's ranges can vary.
const convertValue = (key: string, value: number): number => {
    switch (key) {
        case 'crs:Exposure2012':
            return value * 20; // LR is often -5 to +5
        // Most other values in LR are already in a -100 to 100 range, so no conversion is needed
        default:
            return value;
    }
};

export const parseDngPreset = (dngContent: string): { [key: string]: number } | null => {
    try {
        const xmpMetaMatch = dngContent.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/);
        if (!xmpMetaMatch) {
            console.warn("Nenhum bloco XMP encontrado no ficheiro.");
            return null;
        }
        
        const xmpContent = xmpMetaMatch[0];
        const adjustments: { [key: string]: number } = {};
        let found = false;

        for (const [xmpKey, appKey] of Object.entries(XMP_TO_ADJUSTMENT_MAP)) {
            // Regex to find attributes like `crs:Exposure2012="+1.25"` OR element content like `<crs:Exposure2012>+1.25</crs:Exposure2012>`
            // This version is more robust to whitespace.
            const regex = new RegExp(`${xmpKey}\\s*(?:=\\s*"([\\d.+-]+)"|>[\\s\\r\\n]*([\\d.+-]+)[\\s\\r\\n]*<\\/${xmpKey})`, 'i');

            const match = xmpContent.match(regex);
            
            if (match) {
                // Check capture group 1 (for attribute) or group 2 (for element content)
                const valueStr = match[1] || match[2];
                if (valueStr) {
                    const rawValue = parseFloat(valueStr);
                    if (!isNaN(rawValue)) {
                        adjustments[appKey] = convertValue(xmpKey, rawValue);
                        found = true;
                    }
                }
            }
        }
        
        if (!found) {
            console.warn("Nenhum ajuste reconhecível encontrado no bloco XMP.");
            return null;
        }

        return adjustments;

    } catch (error) {
        console.error("Erro ao analisar o ficheiro DNG:", error);
        return null;
    }
};