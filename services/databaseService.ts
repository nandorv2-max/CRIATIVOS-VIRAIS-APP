import { supabase } from './supabaseClient.ts';
import type { UploadedAsset, PublicAsset, UserProfile, Plan, UserRole, Category, Feature, CreditCost, AssetVisibility, UploadedAssetType, PublicProject, PublicProjectCategory, Theme } from '../types.ts';
import { nanoid } from 'nanoid';

// Helper to get user ID
const getUserId = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");
    return user.id;
};

// Helper to create a video thumbnail
const createVideoThumbnail = async (videoFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(videoFile);
        video.onloadedmetadata = () => {
            video.currentTime = 1; // Seek to 1 second in
        };
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('Could not create blob from canvas'));
                resolve(new File([blob], `thumb_${nanoid(8)}.jpg`, { type: 'image/jpeg' }));
                URL.revokeObjectURL(video.src);
            }, 'image/jpeg', 0.8);
        };
        video.onerror = (e) => reject(new Error('Failed to load video for thumbnail generation.'));
    });
};

// **NEW UTILITY FUNCTION**
// Generates a fresh signed URL for a user asset path. This is key to fixing the stale URL issue.
export const createSignedUrlForPath = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
        .from('user_assets')
        .createSignedUrl(path, 300); // 5-minute validity, more than enough for immediate use
    if (error) {
        console.error(`Error creating signed URL for ${path}:`, error);
        throw new Error('Não foi possível obter um URL seguro para o recurso.');
    }
    return data.signedUrl;
};

// Fetch user assets with signed URLs
export const getUserAssets = async (): Promise<UploadedAsset[]> => {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('user_assets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        if (error.code === '42P01' || error.message.includes('permission denied')) {
            throw new Error("USER_ASSETS_SETUP_REQUIRED: A tabela 'user_assets' não foi encontrada ou o acesso foi negado.");
        }
        console.error("Error fetching user assets:", error);
        throw error;
    }

    const assetsWithSignedUrls = await Promise.all(data.map(async (asset) => {
        let signedThumbnailUrl = asset.thumbnail_url;
        
        // **IMPORTANT**: We now only generate a thumbnail URL here for display in the gallery.
        // The main asset URL will be generated on-demand when the asset is actually used.
        if (asset.thumbnail_storage_path) {
            signedThumbnailUrl = await createSignedUrlForPath(asset.thumbnail_storage_path);
        } else if (asset.storage_path && asset.asset_type === 'image') {
            // For images without a separate thumbnail, generate a signed URL for the main image for the thumb display.
             try {
                signedThumbnailUrl = await createSignedUrlForPath(asset.storage_path);
             } catch (e) {
                 console.warn(`Could not generate initial thumbnail URL for ${asset.name}`);
                 signedThumbnailUrl = ''; // Fallback to an empty string if it fails
             }
        }

        // DEFINITIVE FIX: Destructure to remove the original 'asset_type' property,
        // which was causing user assets to be misidentified as public assets.
        const { asset_type, ...restOfAsset } = asset;

        return {
            ...restOfAsset,
            type: asset_type as UploadedAsset['type'], // Correctly map asset_type to type
            // The `url` field now holds the original storage path, which is more stable.
            // The `thumbnail` is the only signed URL we pre-fetch.
            url: asset.storage_path, // We will use storage_path to get a fresh URL later
            thumbnail: signedThumbnailUrl || '',
            storage_path: asset.storage_path, // Ensure storage_path is always present
        };
    }));

    return assetsWithSignedUrls;
};


// Upload a user asset
export const uploadUserAsset = async (file: File, folderId: string | null = null): Promise<UploadedAsset> => {
    const userId = await getUserId();
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const fileName = `${userId}/${nanoid()}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user_assets')
        .upload(fileName, file);
    
    if (uploadError) throw uploadError;

    // We don't use public URLs for user assets anymore, but we need a placeholder
    const placeholderUrl = supabase.storage.from('user_assets').getPublicUrl(fileName).data.publicUrl;

    let thumbnailUrl: string | null = null;
    let thumbnailPath: string | null = null;
    if (file.type.startsWith('video/')) {
        try {
            const thumbFile = await createVideoThumbnail(file);
            const thumbFileName = `${userId}/thumbs/${nanoid()}.jpg`;
            const { data: thumbUploadData, error: thumbUploadError } = await supabase.storage
                .from('user_assets')
                .upload(thumbFileName, thumbFile);
            if (thumbUploadError) throw thumbUploadError;
            thumbnailPath = thumbUploadData.path;
            thumbnailUrl = supabase.storage.from('user_assets').getPublicUrl(thumbFileName).data.publicUrl;
        } catch (thumbError) {
            console.error("Could not generate video thumbnail:", thumbError);
        }
    } else {
        thumbnailUrl = placeholderUrl;
    }

    const getAssetType = (file: File, ext: string): UploadedAssetType => {
        const fontExtensions = ['ttf', 'otf', 'woff', 'woff2'];
        if (ext === 'dng') return 'dng';
        if (ext === 'brmp') return 'brmp';
        if (fontExtensions.includes(ext)) return 'font';
        return file.type.split('/')[0] as UploadedAssetType;
    };
    
    const assetType = getAssetType(file, fileExt);

    const { data: dbData, error: dbError } = await supabase
        .from('user_assets')
        .insert({
            user_id: userId,
            name: file.name,
            asset_type: assetType,
            storage_path: uploadData.path,
            url: placeholderUrl, // Store the base path, not the public URL
            thumbnail_url: thumbnailUrl,
            thumbnail_storage_path: thumbnailPath,
            file_size_bytes: file.size, // <-- THE FIX IS HERE
        })
        .select()
        .single();
        
    if (dbError) {
        await supabase.storage.from('user_assets').remove([fileName]);
        if (thumbnailPath) await supabase.storage.from('user_assets').remove([thumbnailPath]);
        throw dbError;
    }
    
    return { ...dbData, type: dbData.asset_type as UploadedAsset['type'], thumbnail: dbData.thumbnail_url, url: dbData.url };
};

// Delete a user asset
export const deleteUserAsset = async (asset: UploadedAsset): Promise<void> => {
    const { error } = await supabase.rpc('user_delete_asset', { p_asset_id: asset.id });
    if (error) throw error;
};

// Rename asset
export const renameUserAsset = async (assetId: string, newName: string): Promise<void> => {
    const { error } = await supabase
        .from('user_assets')
        .update({ name: newName })
        .eq('id', assetId);
    if (error) throw error;
};

// Toggle favorite
export const toggleAssetFavorite = async (assetId: string, isFavorite: boolean): Promise<void> => {
    const { error } = await supabase
        .from('user_assets')
        .update({ is_favorite: !isFavorite })
        .eq('id', assetId);
    if (error) throw error;
};

// Update user profile metadata
export const updateUserProfile = async (updates: { name?: string; avatar_url?: string }): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
        data: updates
    });
    if (error) throw error;
};

// =========================================================================================
// THEME & CUSTOMIZATION FUNCTIONS
// =========================================================================================
export const getThemeSettings = async (): Promise<Theme | null> => {
    const { data, error } = await supabase.rpc('get_theme_settings');

    if (error) {
        // A 42883 error code indicates the function does not exist, which is expected before the admin runs the setup script.
        if (error.code === '42883' || error.message.includes('function get_theme_settings() does not exist')) {
            console.warn("Theme settings function not found. Admin needs to run the setup script.");
            return null; // Return null gracefully so the app can handle it
        }
        throw error;
    }
    // The RPC returns an array, even for a single row. We take the first element.
    return data?.[0] || null;
};

export const updateThemeSettings = async (updates: Partial<Theme>): Promise<void> => {
    // The RPC expects a JSON object. The `id` is not part of the update payload.
    const { id, ...themeUpdates } = updates;
    const { error } = await supabase.rpc('admin_update_theme_settings', { p_updates: themeUpdates });
    if (error) throw error;
};

export const adminUploadThemeAsset = async (file: File): Promise<string> => {
    // Uploads theme assets (logo, background) to a dedicated folder in the public bucket.
    const fileName = `theme/${nanoid()}_${file.name.replace(/\s/g, '_')}`;
    
    const { data, error } = await supabase.storage
        .from('public_assets') // Use the public bucket for simplicity
        .upload(fileName, file, {
            cacheControl: '3600', // Cache for 1 hour
            upsert: true, // Overwrite if a file with the same name exists
        });

    if (error) throw error;
    
    // Get the public URL to store in the theme_settings table.
    const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(fileName);
    return publicUrl;
};

// PUBLIC ASSETS (Media, Fonts, Non-Project Presets)
export const getPublicAssets = async (): Promise<PublicAsset[]> => {
    const { data, error } = await supabase
        .from('public_assets')
        .select('*, public_asset_categories(name)')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

// PUBLIC PROJECTS (New, separated logic)
export const getPublicProjects = async (): Promise<PublicProject[]> => {
    const { data, error } = await supabase
        .from('public_projects')
        .select('*, public_project_categories(name)')
        .order('created_at', { ascending: false });

    if (error) {
        // Handle case where table might not exist yet
        if (error.code === '42P01') {
            console.warn("Tabela 'public_projects' não encontrada. Pode ser necessário executar o script de configuração.");
            return [];
        }
        throw error;
    }
    return data;
};

// Favorites for public assets
export const getFavoritePublicAssetIds = async (): Promise<string[]> => {
    const userId = await getUserId();
    const { data, error } = await supabase.from('user_favorite_public_assets').select('public_asset_id').eq('user_id', userId);
    if (error) throw error;
    return data.map(fav => fav.public_asset_id);
};

export const addFavoritePublicAsset = async (assetId: string): Promise<void> => {
    const userId = await getUserId();
    const { error } = await supabase.from('user_favorite_public_assets').insert({ user_id: userId, public_asset_id: assetId });
    if (error && error.code !== '23505') throw error; // ignore duplicate errors
};

export const removeFavoritePublicAsset = async (assetId: string): Promise<void> => {
    const userId = await getUserId();
    const { error } = await supabase.from('user_favorite_public_assets').delete().match({ user_id: userId, public_asset_id: assetId });
    if (error) throw error;
};

export const deductVideoCredits = async (amount: number): Promise<void> => {
    const { error } = await supabase.rpc('deduct_video_credits', { amount_to_deduct: amount });
    if (error) throw error;
};

// =========================================================================================
// ADMIN FUNCTIONS (RPC-based for security and robustness)
// =========================================================================================

export const getAdminApiKey = async (): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke('get-admin-api-key');
    if (error) {
        console.error("Error fetching admin API key:", error.message);
        throw new Error("Não foi possível obter a chave de API de administrador.");
    }
    return data.apiKey;
};

export const adminGetAllUserProfiles = async (): Promise<UserProfile[]> => {
    const { data, error } = await supabase.rpc('admin_get_all_users');
    if (error) throw error;
    return data;
};

export const adminUpdateUserDetails = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_user_details', {
        p_user_id: userId,
        p_role: updates.role,
        p_credits: updates.credits,
        p_status: updates.status,
        p_plan_id: updates.plan_id
    });
    if (error) throw error;
};

export const adminGetPlans = async (): Promise<Plan[]> => {
    const { data, error } = await supabase.rpc('admin_get_plans');
    if (error) throw error;
    return data;
};

export const adminGetFeatures = async (): Promise<Feature[]> => {
    const { data, error } = await supabase.rpc('admin_get_features');
    if (error) throw error;
    return data;
};

export const adminGetPlanFeatures = async (planId: string): Promise<string[]> => {
    const { data, error } = await supabase.rpc('admin_get_plan_features', { p_plan_id: planId });
    if (error) throw error;
    return data;
};

export const adminUpdatePlan = async (planId: string, updates: Partial<Pick<Plan, 'name' | 'stripe_payment_link' | 'video_credits_monthly' | 'storage_limit_gb' | 'download_limit_gb' | 'trial_days'>>): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_plan', { p_plan_id: planId, p_updates: updates });
    if (error) throw error;
};

export const adminSetPlanFeatures = async (planId: string, featureIds: string[]): Promise<void> => {
    const { error } = await supabase.rpc('admin_set_plan_features', { p_plan_id: planId, p_feature_ids: featureIds });
    if (error) throw error;
};

export const adminGetCreditCosts = async (): Promise<CreditCost[]> => {
    const { data, error } = await supabase.rpc('admin_get_credit_costs');
    if (error) throw error;
    return data;
};

export const adminUpdateCreditCost = async (action: string, cost: number): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_credit_cost', { p_action: action, p_cost: cost });
    if (error) throw error;
};

export const adminGetCategories = async (type: 'media' | 'font' | 'preset'): Promise<Category[]> => {
    const { data, error } = await supabase.rpc('admin_get_categories', { p_category_type: type });
    if (error) throw error;
    return data;
};

export const adminCreateCategory = async (name: string, type: 'media' | 'font' | 'preset'): Promise<Category> => {
    const { data, error } = await supabase.rpc('admin_create_category', { p_name: name, p_category_type: type });
    if (error) throw error;
    return data;
};

export const adminUpdateCategory = async (id: string, newName: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_category', { p_category_id: id, p_new_name: newName });
    if (error) throw error;
};

export const adminDeleteCategory = async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_delete_category', { p_category_id: id });
    if (error) throw error;
};

export const adminUploadPublicAsset = async (file: File, assetName: string, visibility: AssetVisibility, categoryId: string | null): Promise<void> => {
    const userId = await getUserId();
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const fileName = `public/${nanoid()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage.from('public_assets').upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(fileName);
    
    let assetType: PublicAsset['asset_type'];
    const fontExtensions = ['ttf', 'otf', 'woff', 'woff2'];
    if (fileExt === 'dng') {
        assetType = 'dng';
    } else if (fileExt === 'brmp') {
        assetType = 'brmp';
    } else if (fontExtensions.includes(fileExt)) {
        assetType = 'font';
    } else {
        assetType = file.type.split('/')[0] as 'image' | 'video' | 'audio';
    }
    
    // Ensure thumbnail logic is sound
    let thumbnailUrl = publicUrl;
    if (file.type.startsWith('video/')) {
        try {
            const thumbFile = await createVideoThumbnail(file);
            const thumbFileName = `public/thumbs/${nanoid()}.jpg`;
            const { data: thumbUploadData, error: thumbUploadError } = await supabase.storage.from('public_assets').upload(thumbFileName, thumbFile);
            if(thumbUploadError) throw thumbUploadError;
            thumbnailUrl = supabase.storage.from('public_assets').getPublicUrl(thumbFileName).data.publicUrl;
        } catch (thumbError) {
             console.error("Could not generate video thumbnail for public asset:", thumbError);
        }
    }

    const { error } = await supabase.rpc('admin_add_public_asset', {
        p_name: assetName,
        p_asset_type: assetType,
        p_storage_path: uploadData.path,
        p_asset_url: publicUrl,
        p_thumbnail_url: thumbnailUrl,
        p_visibility: visibility,
        p_owner_id: userId,
        p_category_id: categoryId,
    });

    if (error) {
        // Cleanup on failure
        await supabase.storage.from('public_assets').remove([uploadData.path]);
        throw error;
    }
};

export const adminDeletePublicAsset = async (assetId: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_delete_public_asset', { p_asset_id: assetId });
    if (error) throw error;
};

export const adminUpdatePublicAsset = async (assetId: string, newName: string, newCategoryId: string | null): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_public_asset', { p_asset_id: assetId, p_new_name: newName, p_new_category_id: newCategoryId });
    if (error) throw error;
};


// NEW ADMIN FUNCTIONS FOR PUBLIC PROJECTS
export const adminGetPublicProjectCategories = async (): Promise<PublicProjectCategory[]> => {
    const { data, error } = await supabase.rpc('admin_get_public_project_categories');
    if (error) throw error;
    return data;
};

export const getPublicProjectCategoriesForUser = async (): Promise<PublicProjectCategory[]> => {
    const { data, error } = await supabase.rpc('get_public_project_categories_for_user');
    if (error) throw error;
    return data;
};

export const adminCreatePublicProjectCategory = async (name: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_create_public_project_category', { p_name: name });
    if (error) throw error;
};

export const adminUpdatePublicProjectCategory = async (id: string, newName: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_public_project_category', { p_category_id: id, p_new_name: newName });
    if (error) throw error;
};

export const adminDeletePublicProjectCategory = async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_delete_public_project_category', { p_category_id: id });
    if (error) throw error;
};

export const adminUploadPublicProject = async (file: File, assetName: string, visibility: AssetVisibility, categoryId: string | null): Promise<void> => {
    const userId = await getUserId();
    const fileName = `public_projects/${nanoid()}.brmp`;

    // Use the 'public_assets' bucket, but a different folder for organization
    const { data: uploadData, error: uploadError } = await supabase.storage.from('public_assets').upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(fileName);

    const { error } = await supabase.rpc('admin_add_public_project', {
        p_name: assetName,
        p_storage_path: uploadData.path,
        p_asset_url: publicUrl,
        p_thumbnail_url: null, // Projects don't have thumbnails
        p_visibility: visibility,
        p_owner_id: userId,
        p_category_id: categoryId,
    });
    if (error) throw error;
};


export const adminDeletePublicProject = async (projectId: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_delete_public_project', { p_project_id: projectId });
    if (error) throw error;
};

export const adminUpdatePublicProject = async (projectId: string, newName: string, newCategoryId: string | null): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_public_project', { p_project_id: projectId, p_new_name: newName, p_new_category_id: newCategoryId });
    if (error) throw error;
};

// New functions for managing system settings like the webhook token
export const adminGetSetting = async (key: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('admin_get_setting', { p_key: key });
    if (error) throw error;
    return data;
};

export const adminSetSetting = async (key: string, value: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_set_setting', { p_key: key, p_value: value });
    if (error) throw error;
};