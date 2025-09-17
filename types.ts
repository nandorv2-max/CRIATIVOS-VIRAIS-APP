

export type GeneratedImageStatus = 'pending' | 'success' | 'failed';

export interface GeneratedImage {
  id: string;
  status: GeneratedImageStatus;
  imageUrl: string | null;
}

export interface Prompt {
  id:string;
  base: string;
}

export interface TemplateStyle {
  id: string;
  prompts: Prompt[];
}

export interface Destination {
  id: string;
  prompts: Prompt[];
}

export interface BaseTemplate {
    name: string;
    description: string;
    icon: string;
    // FIX: Added sidebarIcon to the BaseTemplate interface to resolve errors in constants.ts and Sidebar.tsx.
    sidebarIcon: React.FC<{ className?: string }>;
    isPolaroid: boolean;
}

export interface PromptsOnlyTemplate extends BaseTemplate {
    prompts: Prompt[];
    styles?: never;
    destinations?: never;
}

export interface StylesTemplate extends BaseTemplate {
    styles: TemplateStyle[];
    prompts?: never;
    destinations?: never;
}

export interface DestinationsTemplate extends BaseTemplate {
    destinations: Destination[];
    prompts?: never;
    styles?: never;
}

export type Template = PromptsOnlyTemplate | StylesTemplate | DestinationsTemplate;

export type Templates = {
    [key: string]: Template;
};

export interface ModelInstructionOptions {
    hairColors: string[];
    cameraAngle: string;
    swapGender: string;
    swapEthnicity: string;
    swapHairColor: string;
    lookbookStyle: string;
    customLookbookStyle: string;
}

// Creative Editor Types
export type LayerType = 'image' | 'text' | 'shape' | 'frame' | 'video';

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  flipH?: boolean;
  flipV?: boolean;
  isLoading?: boolean;
}

export interface ImageLayer extends Layer {
  type: 'image';
  src: string;
  assetId?: string;
  image?: HTMLImageElement;
  originalSrc?: string;
  originalImage?: HTMLImageElement;
}

export interface VideoLayer extends Layer {
    type: 'video';
    src: string; // Blob URL
    assetId?: string;
    videoElement?: HTMLVideoElement;
    duration: number;
}

export interface TextLayer extends Layer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  letterCase: 'normal' | 'uppercase' | 'lowercase';
}

export interface ShapeLayer extends Layer {
    type: 'shape';
    shape: 'rectangle' | 'ellipse' | 'line' | 'arrow';
    fill: string; // For rectangle/ellipse, stroke for line/arrow
    stroke: string;
    strokeWidth: number;
}

export type FrameFillContent = {
    type: 'image';
    src: string;
    assetId?: string;
    image: HTMLImageElement;
} | {
    type: 'video';
    src: string;
    assetId?: string;
    videoElement: HTMLVideoElement;
};


// An interface can only extend an object type or intersection of object types with statically known members.
// Changed FrameFill from an interface to a type alias. Interfaces cannot extend union types.
// This now correctly represents a type that has the properties of FrameFillContent AND the new properties.
export type FrameFill = FrameFillContent & {
  scale: number; // zoom, 1 = cover
  offsetX: number; // pan x, 0 = centered
  offsetY: number; // pan y, 0 = centered
};

export interface FrameLayer extends Layer {
  type: 'frame';
  shape: 'rectangle' | 'ellipse';
  fill: FrameFill | null;
}

export type LayerUpdateProps = Partial<ImageLayer> | Partial<TextLayer> | Partial<ShapeLayer> | Partial<FrameLayer> | Partial<VideoLayer>;

export interface AudioTrack {
    id: string;
    assetId: string;
    src: string;
    audioElement: HTMLAudioElement;
    name: string;
}

export type UploadedAsset = {
    id: string;
    projectId: string; // The project this asset belongs to
    type: 'image' | 'video' | 'audio';
    src: string; // The blob or data URL
    thumbnail: string; // For display in the gallery
    name: string;
};

export interface DownloadJob {
  id: string;
  fileName: string;
  status: 'preparing' | 'rendering' | 'encoding' | 'done' | 'error';
  progress: number; // 0-100
  resultUrl?: string;
  error?: string;
  thumbnail?: string;
}
