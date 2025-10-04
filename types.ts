import React, { createContext } from 'react';

export interface Prompt {
    id: string;
    base: string;
}

export interface Destination {
    id:string;
    prompts: Prompt[];
}

export interface Template {
    name: string;
    description: string;
    icon: string;
    sidebarIcon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    isPolaroid: boolean;
    prompts: Prompt[];
    destinations?: Destination[];
}

export interface Templates {
    [key: string]: Template;
}

export interface ModelInstructionOptions {
    cameraAngle?: string;
    swapGender?: string;
    swapEthnicity?: string;
    swapHairColor?: string;
    swapAge?: string;
    lookbookStyle?: string;
    customLookbookStyle?: string;
}

export interface GeneratedImage {
    id: string;
    status: 'pending' | 'success' | 'failed';
    imageUrl: string | null;
}

// Creative Editor Types
export type LayerType = 'image' | 'text' | 'shape' | 'video' | 'frame';

interface BaseLayer {
    id: string;
    name: string;
    type: LayerType;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    isLocked: boolean;
    isVisible: boolean;
    flipH?: boolean;
    flipV?: boolean;
    isLoading?: boolean;
}

export interface ImageLayer extends BaseLayer {
    type: 'image';
    src: string;
    originalSrc?: string;
    mediaNaturalWidth: number;
    mediaNaturalHeight: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    crop: { x: number; y: number; width: number; height: number };
    _imageElement?: HTMLImageElement; // Runtime element, not saved in project JSON
    originalImage?: HTMLImageElement;
    assetId?: string;
}

export interface TextLayer extends BaseLayer {
    type: 'text';
    text: string;
    fontFamily: string;
    fontSize: number;
    color: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline';
    textAlign: 'left' | 'center' | 'right';
    lineHeight: number;
    letterSpacing: number;
    textTransform: 'none' | 'uppercase' | 'lowercase';
    letterCase?: 'normal' | 'uppercase' | 'lowercase';
}

export interface ShapeLayer extends BaseLayer {
    type: 'shape';
    shape: 'rectangle' | 'ellipse' | 'line' | 'arrow';
    fill: string;
    stroke: string;
    strokeWidth: number;
}

export interface VideoLayer extends BaseLayer {
    type: 'video';
    src: string;
    startTime: number;
    endTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    mediaNaturalWidth: number;
    mediaNaturalHeight: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    crop: { x: number; y: number; width: number; height: number };
    _videoElement?: HTMLVideoElement; // Runtime element, not saved in project JSON
    assetId?: string;
}

export interface FrameFillContent {
    type: 'image' | 'video';
    src: string;
    assetId?: string;
    scale: number;
    offsetX: number;
    offsetY: number;
}

export interface ImageFrameFill extends FrameFillContent {
    type: 'image';
    image?: HTMLImageElement;
}

export interface VideoFrameFill extends FrameFillContent {
    type: 'video';
    videoElement?: HTMLVideoElement;
}

export type FrameFill = ImageFrameFill | VideoFrameFill;


export interface FrameLayer extends BaseLayer {
    type: 'frame';
    shape: 'rectangle' | 'ellipse';
    fill: FrameFill | null;
}


export type AnyLayer = ImageLayer | TextLayer | ShapeLayer | VideoLayer | FrameLayer;
export type Layer = AnyLayer;
export type LayerUpdateProps = Partial<AnyLayer>;


export interface AudioTrack {
    id: string;
    name: string;
    src: string;
    startTime: number;
    volume: number;
    audioElement?: HTMLAudioElement;
    assetId?: string;
}

export interface Page {
    id: string;
    name: string;
    layers: AnyLayer[];
    duration: number;
    backgroundColor: string;
    width: number;
    height: number;
}

export interface ProjectState {
    name: string;
    pages: Page[];
    audioTracks: AudioTrack[];
}

export interface Project extends ProjectState {
    id: string;
    thumbnail: string;
    lastModified: number;
    user_id?: string;
}

export type UploadedAssetType = 'image' | 'video' | 'audio' | 'font' | 'dng' | 'brmp';
export type AssetVisibility = 'Public' | 'Restricted';

export interface UploadedAsset {
    id: string;
    name: string;
    type: UploadedAssetType;
    url: string;
    storage_path: string;
    thumbnail: string;
    thumbnail_storage_path?: string;
    duration?: number;
    originalWidth?: number;
    originalHeight?: number;
    is_favorite?: boolean;
    folder_id?: string | null;
    src?: string; // For compatibility with new editor
    projectId?: string; // For compatibility with new editor
}

export interface Category {
    id: string;
    name: string;
    created_at: string;
    category_type: 'media' | 'font' | 'preset';
}

export interface PublicAsset {
    id: string;
    name: string;
    asset_type: UploadedAssetType;
    asset_url: string;
    storage_path: string;
    thumbnail_url?: string;
    visibility: AssetVisibility;
    created_at: string;
    owner_id: string;
    category_id: string | null;
    public_asset_categories: { name: string } | null;
}

export interface PublicProjectCategory {
    id: string;
    name: string;
    created_at: string;
}

export interface PublicProject {
    id: string;
    name: string;
    asset_url: string;
    storage_path: string;
    thumbnail_url?: string;
    visibility: AssetVisibility;
    created_at: string;
    owner_id: string;
    category_id: string | null;
    public_project_categories: { name: string } | null;
}


export interface DownloadJob {
    id: string;
    fileName: string;
    status: 'preparing' | 'rendering' | 'encoding' | 'done' | 'error';
    progress: number;
    statusText?: string;
    thumbnail?: string;
    resultUrl?: string;
    error?: string;
}

export interface Creation {
    id: string;
    timestamp: number;
    finalImage: string;
    thumbnail: string;
    baseImage: string;
    blendImages: string[];
    prompt: string;
    negativePrompt: string;
    settings: {
        matchColor: boolean;
        strength: number;
    };
}

export type UserRole = 'admin' | 'free' | 'starter' | 'premium' | 'professional' | 'bee';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  credits: number; // Renamed to represent video credits
  status: 'active' | 'pending_approval' | 'suspended';
  plan_id: string | null;
  access_expires_at: string | null;
  storage_used_bytes: number;
  plan?: Plan; // Include full plan details
  plan_name?: string; // Add plan_name for direct display
  features?: string[];
}

export interface Folder {
    id: string;
    name: string;
    user_id: string;
    parent_id: string | null;
    created_at: string;
}

export interface Adjustments {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
    temperature: number;
    tint: number;
    vibrance: number;
    saturation: number;
    texture: number;
    clarity: number;
    dehaze: number;
    grain: number;
    vignette: number;
    sharpness: number;
}

export interface Preset {
    name: string;
    adjustments: Partial<Adjustments>;
    sourceAssetId?: string;
}


// New types for Plans and Permissions
export interface Plan {
    id: string;
    name: string;
    stripe_payment_link: string | null;
    video_credits_monthly: number;
    storage_limit_gb: number;
    download_limit_gb: number;
    trial_days: number | null;
}

export interface Feature {
    id: string;
    name: string;
    description: string;
}

export interface CreditCost {
    action: string; // Corresponds to a feature ID
    cost: number;
}

export interface WebhookLog {
  created_at: string;
  email: string;
  evento: string;
  detalhes: string;
}
// FIX: Moved Theme interface from App.tsx to types.ts to fix circular dependency.
export interface Theme {
    id: number;
    logo_url?: string;
    background_image_url?: string;
    login_background_image_url?: string;
    color_primary?: string;
    color_secondary?: string;
    color_dark?: string;
    color_light?: string;
    color_accent?: string;
    font_family_url?: string;
    font_family_main?: string;
    font_family_handwriting?: string;
    announcement_text?: string;
    announcement_active?: boolean;
    color_text_base?: string;
    color_text_muted?: string;
    module_icons?: {
        [key: string]: {
            svg_content?: string;
            color?: string;
        }
    };
}

// Support System Types
export type TicketStatus = 'new' | 'in_progress' | 'resolved';

export interface SupportMessage {
    id: string;
    ticket_id: string;
    content: string;
    sender: 'user' | 'ai';
    created_at: string;
}

export interface SupportTicket {
    id: string;
    user_id: string;
    user_email: string;
    subject: string;
    status: TicketStatus;
    created_at: string;
    messages: SupportMessage[];
}


// FIX: Moved ThemeContext definition here from App.tsx to break a circular dependency.
export interface ThemeContextType {
    theme: Theme | null;
    loadTheme: () => Promise<void>;
}
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);


// Asset Context for Caching
export interface AssetContextType {
    assets: UploadedAsset[];
    setAssets: React.Dispatch<React.SetStateAction<UploadedAsset[]>>;
    isLoading: boolean;
    error: string | null;
    requiresSetup: boolean;
    refetchAssets: () => Promise<void>;
}
export const AssetContext = createContext<AssetContextType | undefined>(undefined);