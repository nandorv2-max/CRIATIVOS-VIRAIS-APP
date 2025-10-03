/**
 * Calculates whether black or white has a better contrast against a given hex color.
 * @param hexColor The background color in hex format (e.g., "#RRGGBB").
 * @returns "#000000" (black) or "#FFFFFF" (white).
 */
export function getContrastingColor(hexColor: string): string {
    if (!hexColor) return '#000000';

    // Remove the hash at the start if it's there
    const color = hexColor.charAt(0) === '#' ? hexColor.substring(1, 7) : hexColor;

    // Convert hex to RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    // Calculate luminance (per ITU-R BT.709)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Use a threshold of 0.5 to decide on black or white text
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}