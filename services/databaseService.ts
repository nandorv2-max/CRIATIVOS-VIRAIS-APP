import { supabase } from './supabaseClient.ts';
import type { UserProfile, PublicAsset, AssetVisibility, UploadedAssetType } from '../types.ts';
import { nanoid } from 'nanoid';

// User Management (Admin Only)
export async function adminGetUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase.rpc('admin_get_all_users');
    if (error) {
        console.error('Error fetching users (admin):', error);
        if (error.message.includes('function public.admin_get_all_users() does not exist')) {
            throw new Error('SETUP_REQUIRED: A função `admin_get_all_users` está em falta na base de dados.');
        }
        throw error;
    }
    return data as UserProfile[];
}

// Public Asset Management (For regular users - fetches only public assets)
export async function getPublicAssets(): Promise<PublicAsset[]> {
    const { data, error } = await supabase
        .from('public_assets')
        .select('*')
        .eq('visibility', 'Public')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching public assets:', error);
        // This could fail if RLS is misconfigured or the table doesn't exist
        if (error.message.includes('relation "public.public_assets" does not exist')) {
             throw new Error('SETUP_REQUIRED: A tabela `public_assets` está em falta na base de dados.');
        }
        throw error;
    }
    return data;
}

// Public Asset Management (Admin Only - fetches all assets)
export async function adminGetAllAssets(): Promise<PublicAsset[]> {
    const { data, error } = await supabase.rpc('admin_get_all_assets');
     if (error) {
        console.error('Error fetching all assets (admin):', error);
         if (error.message.includes('function public.admin_get_all_assets() does not exist')) {
            throw new Error('SETUP_REQUIRED: A função `admin_get_all_assets` está em falta na base de dados.');
        }
        throw error;
    }
    return data;
}

export async function uploadPublicAsset(file: File, visibility: AssetVisibility): Promise<void> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Utilizador não autenticado.");

    const fileExt = file.name.split('.').pop();
    const fileName = `${nanoid()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Error uploading asset to storage:', uploadError);
        if (uploadError.message.toLowerCase().includes('bucket not found')) {
             throw new Error('SETUP_REQUIRED: O bucket de armazenamento `public_assets` não foi encontrado.');
        }
        throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

    if (!publicUrlData) {
        throw new Error("Não foi possível obter o URL público para o recurso carregado.");
    }
    
    let assetType: UploadedAssetType = 'image';
    if(file.type.startsWith('video/')) assetType = 'video';
    if(file.type.startsWith('audio/')) assetType = 'audio';
    if(file.type.startsWith('font/')) assetType = 'font';
    if(file.name.endsWith('.dng')) assetType = 'dng';
    if(file.name.endsWith('.brmp')) assetType = 'brmp';

    const { error: dbError } = await supabase.rpc('admin_add_public_asset', {
        p_name: file.name,
        p_asset_type: assetType,
        p_asset_url: publicUrlData.publicUrl,
        p_thumbnail_url: publicUrlData.publicUrl,
        p_visibility: visibility,
        p_owner_id: user.id
    });

    if (dbError) {
        console.error('Error saving asset metadata:', dbError);
        if (dbError.message.includes('function public.admin_add_public_asset')) {
            throw new Error('SETUP_REQUIRED: A função `admin_add_public_asset` está em falta na base de dados.');
        }
        throw dbError;
    }
}
