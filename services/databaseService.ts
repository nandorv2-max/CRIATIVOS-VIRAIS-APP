import { supabase } from './supabaseClient.ts';
import type { UserProfile, PublicAsset, AssetVisibility, UploadedAssetType, UploadedAsset, UserRole } from '../types.ts';
import { nanoid } from 'nanoid';
import { base64ToFile, extractLastFrame } from '../utils/imageUtils.ts';

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

export async function adminUpdateUser(userId: string, updates: { role?: UserRole; credits?: number }): Promise<void> {
    const { error } = await supabase.rpc('admin_update_user', {
        p_user_id: userId,
        p_role: updates.role,
        p_credits: updates.credits,
    });
    if (error) {
        console.error('Error updating user (admin):', error);
        throw error;
    }
}

export async function adminDeleteUser(userId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
    if (error) {
        console.error('Error deleting user (admin):', error);
        throw error;
    }
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
         if (uploadError.message.toLowerCase().includes('violates row-level security policy')) {
            throw new Error('SETUP_REQUIRED: A sua conta não tem permissões de admin no backend. Execute o script de configuração para corrigir automaticamente as permissões de admin.');
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
        p_storage_path: filePath,
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

export async function adminUpdatePublicAsset(assetId: string, updates: { name?: string; visibility?: AssetVisibility }): Promise<void> {
    const { error } = await supabase
        .from('public_assets')
        .update(updates)
        .eq('id', assetId);

    if (error) {
        console.error('Error updating public asset:', error);
        throw error;
    }
}

export async function adminDeletePublicAsset(asset: PublicAsset): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_public_asset', {
        p_asset_id: asset.id
    });

    if (error) {
        console.error('Error deleting public asset via RPC:', error);
        throw error;
    }
}


export async function publishAssetFromBase64(base64Data: string, name: string): Promise<void> {
    const fileName = `${name.replace(/\s/g, '_')}_${nanoid(8)}.png`;
    const file = base64ToFile(base64Data, fileName);
    // This function implicitly requires admin rights because the underlying RPC call does.
    // The UI should guard against calling this for non-admins.
    await uploadPublicAsset(file, 'Public');
}

// User-specific Asset Management
function getAssetTypeFromFile(file: File): UploadedAssetType {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension!)) return 'image';
    if (['mp4', 'mov', 'webm'].includes(extension!)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(extension!)) return 'audio';
    if (['otf', 'ttf', 'woff'].includes(extension!)) return 'font';
    if (extension === 'dng') return 'dng';
    if (extension === 'brmp') return 'brmp';
    return 'image'; // Default fallback
}

export async function uploadUserAsset(file: File): Promise<UploadedAsset> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Usuário não autenticado.");

    const fileExt = file.name.split('.').pop();
    const fileName = `${nanoid()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // First, upload the main asset
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user_assets')
        .upload(filePath, file);

    if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket not found')) {
            throw new Error('USER_ASSETS_SETUP_REQUIRED: O bucket de armazenamento `user_assets` não foi encontrado.');
        }
        throw uploadError;
    }

    const { data: urlData } = supabase.storage.from('user_assets').getPublicUrl(filePath);

    const assetType = getAssetTypeFromFile(file);
    let thumbnailUrl: string | null = null;
    let thumbnailStoragePath: string | null = null;

    if (assetType === 'image') {
        thumbnailUrl = urlData.publicUrl;
        thumbnailStoragePath = uploadData.path; // For images, thumbnail is the image itself
    } else if (assetType === 'video') {
        try {
            const { base64data, mimeType } = await extractLastFrame(file);
            const thumbName = `thumb_${fileName.split('.')[0]}.jpg`;
            const thumbPath = `${user.id}/${thumbName}`;
            const thumbFile = base64ToFile(`data:${mimeType};base64,${base64data}`, thumbName);
            
            const { data: thumbUploadData, error: thumbUploadError } = await supabase.storage
                .from('user_assets')
                .upload(thumbPath, thumbFile);

            if (thumbUploadError) {
                console.error('Video thumbnail upload failed:', thumbUploadError);
            } else {
                thumbnailUrl = supabase.storage.from('user_assets').getPublicUrl(thumbPath).data.publicUrl;
                thumbnailStoragePath = thumbUploadData.path;
            }
        } catch (e) {
            console.error('Video thumbnail generation failed:', e);
        }
    }

    const assetData = {
        user_id: user.id,
        name: file.name,
        asset_type: assetType,
        storage_path: uploadData.path,
        url: urlData.publicUrl,
        thumbnail_url: thumbnailUrl,
        thumbnail_storage_path: thumbnailStoragePath,
    };
    
    const { data: dbData, error: dbError } = await supabase
        .from('user_assets')
        .insert(assetData)
        .select()
        .single();
        
    if (dbError) {
        if (dbError.message.toLowerCase().includes('relation "public.user_assets" does not exist')) {
            throw new Error('USER_ASSETS_SETUP_REQUIRED: A tabela `user_assets` não foi encontrada.');
        }
        throw dbError;
    }

    // This simplified return is sufficient as the UI will refetch with getUserAssets, which handles signed URLs properly.
    return {
        id: dbData.id,
        name: dbData.name,
        type: dbData.asset_type,
        url: dbData.url,
        thumbnail: dbData.thumbnail_url || dbData.url,
        is_favorite: dbData.is_favorite,
        storage_path: dbData.storage_path,
        thumbnail_storage_path: dbData.thumbnail_storage_path,
    };
}

export async function getUserAssets(): Promise<UploadedAsset[]> {
    const { data: assets, error } = await supabase
        .from('user_assets')
        .select('*')
        .order('created_at', { ascending: false });
        
    if (error) {
        if (error.message.toLowerCase().includes('relation "public.user_assets" does not exist')) {
            throw new Error('USER_ASSETS_SETUP_REQUIRED: A tabela `user_assets` não foi encontrada.');
        }
        throw error;
    }
    
    if (!assets || assets.length === 0) {
        return [];
    }

    const mainPaths = assets.map(asset => asset.storage_path);
    const thumbnailPaths = assets
        .map(asset => asset.thumbnail_storage_path)
        .filter((path): path is string => !!path); // Filter out null/undefined paths safely
    const uniqueThumbnailPaths = [...new Set(thumbnailPaths)];
    
    const allPaths = [...new Set([...mainPaths, ...uniqueThumbnailPaths])];

    if (allPaths.length === 0) return [];

    const { data: signedUrls, error: urlError } = await supabase.storage
        .from('user_assets')
        .createSignedUrls(allPaths, 3600);
    
    if (urlError) {
        console.error("Failed to get signed URLs", urlError);
        throw urlError;
    }
    
    const urlMap = new Map(signedUrls.map(item => [item.path, item.signedUrl]));

    return assets.map(asset => {
        const signedUrl = urlMap.get(asset.storage_path) || asset.url;
        let signedThumbnailUrl = signedUrl; 
        
        if (asset.thumbnail_storage_path) {
            signedThumbnailUrl = urlMap.get(asset.thumbnail_storage_path) || asset.thumbnail_url || signedUrl;
        }

        return {
            id: asset.id,
            name: asset.name,
            type: asset.asset_type as UploadedAssetType,
            url: signedUrl,
            thumbnail: signedThumbnailUrl,
            is_favorite: asset.is_favorite,
            storage_path: asset.storage_path,
            thumbnail_storage_path: asset.thumbnail_storage_path,
        };
    });
}

export async function renameUserAsset(assetId: string, newName: string): Promise<void> {
    const { error } = await supabase
        .from('user_assets')
        .update({ name: newName })
        .eq('id', assetId);

    if (error) {
        console.error('Error renaming asset:', error);
        throw error;
    }
}

export async function toggleAssetFavorite(assetId: string, isFavorite: boolean): Promise<void> {
    const { error } = await supabase
        .from('user_assets')
        .update({ is_favorite: isFavorite })
        .eq('id', assetId);
        
    if (error) throw error;
}

export async function deleteUserAsset(asset: UploadedAsset): Promise<void> {
    const { error } = await supabase.rpc('user_delete_asset', {
        p_asset_id: asset.id
    });

    if (error) {
        console.error('Error deleting user asset via RPC:', error);
        throw error;
    }
}