import React from 'react';

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
    sidebarIcon: React.ComponentType<{ className?: string }>;
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
export type LayerType = 'image' | 'text' | 'shape' | 'video';

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
}

export interface ImageLayer extends BaseLayer {
    type: 'image';
    src: string;
    originalSrc?: string;
    mediaNaturalWidth: number;
    mediaNaturalHeight: number;
    scale: number; 
    crop: { x: number; y: number; width: number; height: number };
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
}

export interface ShapeLayer extends BaseLayer {
    type: 'shape';
    shape: 'rectangle' | 'ellipse';
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
    crop: { x: number; y: number; width: number; height: number };
}

export type AnyLayer = ImageLayer | TextLayer | ShapeLayer | VideoLayer;

export interface AudioTrack {
    id: string;
    name: string;
    src: string;
    startTime: number;
    volume: number;
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

export type UserRole = 'admin' | 'starter' | 'premium' | 'professional';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  credits: number;
}

export interface Folder {
    id: string;
    name: string;
    user_id: string;
    parent_id: string | null;
    created_at: string;
}