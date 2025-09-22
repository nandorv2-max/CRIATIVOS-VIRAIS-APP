import React from 'react';
import Button from './Button.tsx';

const SQL_SCRIPT = `-- SCRIPT DE CONFIGURAÇÃO MESTRE UNIFICADO v19.1 (CORRIGE EDIÇÃO DE RECURSOS PÚBLICOS)
-- Este script APAGA a configuração antiga e cria TUDO do zero.
-- É a única coisa que precisa de ser executada no seu Editor SQL do Supabase.

-- ======= PARTE 1: APAGAR CONFIGURAÇÃO ANTIGA (para garantir um estado limpo) =======
DROP POLICY IF EXISTS "Permitir acesso público de leitura aos recursos públicos" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem gerir todos os ficheiros em public_assets" ON storage.objects;
DROP POLICY IF EXISTS "Os utilizadores podem gerir os seus próprios ficheiros" ON storage.objects;
DROP POLICY IF EXISTS "Acesso público de leitura para public_assets" ON storage.objects;
DROP POLICY IF EXISTS "Acesso total de admin para public_assets" ON storage.objects;
DROP POLICY IF EXISTS "Acesso total do utilizador aos seus próprios ficheiros" ON storage.objects;
DROP TRIGGER IF EXISTS on_user_asset_created ON public.user_assets;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.admin_get_all_users() CASCADE;
DROP FUNCTION IF EXISTS public.admin_get_all_assets() CASCADE;
DROP FUNCTION IF EXISTS public.admin_add_public_asset(text, text, text, text, text, text, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_public_asset(uuid, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_public_asset(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_delete_asset(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_uid() CASCADE;
DROP FUNCTION IF EXISTS public.set_user_id_on_asset() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TABLE IF EXISTS public.user_favorite_public_assets CASCADE;
DROP TABLE IF EXISTS public.user_assets CASCADE;
DROP TABLE IF EXISTS public.public_assets CASCADE;
DROP TABLE IF EXISTS public.public_asset_categories CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- ======= PARTE 2: CRIAR TABELAS DA BASE DE DADOS =======
CREATE TABLE public.user_profiles ( id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text, role text DEFAULT 'starter'::text, credits integer DEFAULT 10 );
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.public_asset_categories ( id uuid default gen_random_uuid() not null primary key, name text not null unique, created_at timestamp with time zone default timezone('utc'::text, now()) not null );
ALTER TABLE public.public_asset_categories ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.public_assets ( id uuid default gen_random_uuid() not null primary key, name text not null, asset_type text not null, storage_path text not null, asset_url text not null, thumbnail_url text, visibility text default 'Public'::text not null, owner_id uuid references auth.users(id) on delete set null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, category_id uuid );
ALTER TABLE public.public_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_assets ADD CONSTRAINT public_assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.public_asset_categories(id) ON DELETE SET NULL;
CREATE TABLE public.folders ( id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, parent_id uuid NULL REFERENCES public.folders(id) ON DELETE CASCADE, created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()) );
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_assets ( id uuid default gen_random_uuid() not null primary key, user_id uuid not null references auth.users(id) on delete cascade, name text not null, asset_type text not null, storage_path text not null, url text not null, thumbnail_url text, thumbnail_storage_path text, is_favorite boolean default false not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, folder_id uuid NULL REFERENCES public.folders(id) ON DELETE SET NULL );
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_favorite_public_assets ( user_id uuid not null references auth.users(id) on delete cascade, public_asset_id uuid not null references public.public_assets(id) on delete cascade, created_at timestamp with time zone not null default timezone('utc'::text, now()), primary key (user_id, public_asset_id) );
ALTER TABLE public.user_favorite_public_assets ENABLE ROW LEVEL SECURITY;

-- ======= PARTE 3: CRIAR FUNÇÕES HELPER E GATILHOS =======
CREATE OR REPLACE FUNCTION public.get_my_uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $$ select auth.uid(); $$;
CREATE OR REPLACE FUNCTION public.set_user_id_on_asset() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.user_id := auth.uid(); RETURN NEW; END; $$;
CREATE TRIGGER on_user_asset_created BEFORE INSERT ON public.user_assets FOR EACH ROW EXECUTE PROCEDURE public.set_user_id_on_asset();
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.user_profiles (id, email, role) VALUES ( NEW.id, NEW.email, CASE WHEN NEW.email IN ('helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com', 'sadesginerperfeito@gmail.com') THEN 'admin' ELSE 'starter' END ); RETURN NEW; END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ======= PARTE 4: SINCRONIZAR PERFIS DE UTILIZADORES EXISTENTES =======
INSERT INTO public.user_profiles (id, email, role) SELECT id, email, CASE WHEN email IN ('helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com', 'sadesginerperfeito@gmail.com') THEN 'admin' ELSE 'starter' END FROM auth.users ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email;

-- ======= PARTE 5: CRIAR POLÍTICAS DE SEGURANÇA (RLS) PARA TABELAS =======
CREATE POLICY "Os utilizadores podem gerir o seu próprio perfil." ON public.user_profiles FOR ALL USING ( auth.uid() = id ) WITH CHECK ( auth.uid() = id );
CREATE POLICY "Recursos públicos são visíveis por todos." ON public.public_assets FOR SELECT USING ( visibility = 'Public' );
CREATE POLICY "Admins têm acesso total aos recursos públicos." ON public.public_assets FOR ALL USING ( (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' ) WITH CHECK ( (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' );
CREATE POLICY "Qualquer utilizador pode ver as categorias." ON public.public_asset_categories FOR SELECT USING (true);
CREATE POLICY "Admins podem gerir todas as categorias." ON public.public_asset_categories FOR ALL USING ((SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Os utilizadores podem gerir os seus próprios recursos." ON public.user_assets FOR ALL USING ( auth.uid() = user_id ) WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Os utilizadores podem gerir as suas próprias pastas." ON public.folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Os utilizadores podem gerir os seus próprios recursos favoritos." ON public.user_favorite_public_assets FOR ALL USING ( auth.uid() = user_id ) WITH CHECK ( auth.uid() = user_id );

-- ======= PARTE 6: CRIAR FUNÇÕES RPC (COM SEGURANÇA REFORÇADA) =======
CREATE OR REPLACE FUNCTION public.admin_get_all_users() RETURNS TABLE(id uuid, email text, role text, credits integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ DECLARE v_invoker_is_admin boolean; BEGIN SELECT p.role = 'admin' INTO v_invoker_is_admin FROM public.user_profiles p WHERE p.id = auth.uid(); IF NOT COALESCE(v_invoker_is_admin, false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN QUERY SELECT p.id, p.email, p.role, p.credits FROM public.user_profiles p; END; $$;
CREATE OR REPLACE FUNCTION public.admin_get_all_assets() RETURNS SETOF public.public_assets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ DECLARE v_invoker_is_admin boolean; BEGIN SELECT p.role = 'admin' INTO v_invoker_is_admin FROM public.user_profiles p WHERE p.id = auth.uid(); IF NOT COALESCE(v_invoker_is_admin, false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN QUERY SELECT * FROM public.public_assets ORDER BY created_at DESC; END; $$;
CREATE OR REPLACE FUNCTION public.admin_add_public_asset(p_name text, p_asset_type text, p_storage_path text, p_asset_url text, p_thumbnail_url text, p_visibility text, p_owner_id uuid, p_category_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ DECLARE v_invoker_uid uuid := auth.uid(); v_invoker_is_admin boolean; BEGIN SELECT role = 'admin' INTO v_invoker_is_admin FROM public.user_profiles WHERE id = v_invoker_uid; IF NOT COALESCE(v_invoker_is_admin, false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; INSERT INTO public.public_assets (name, asset_type, storage_path, asset_url, thumbnail_url, visibility, owner_id, category_id) VALUES (p_name, p_asset_type, p_storage_path, p_asset_url, p_thumbnail_url, p_visibility, p_owner_id, p_category_id); END; $$;
CREATE OR REPLACE FUNCTION public.admin_update_user(p_user_id uuid, p_role text, p_credits integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ DECLARE v_invoker_uid uuid := auth.uid(); v_invoker_is_admin boolean; BEGIN SELECT role = 'admin' INTO v_invoker_is_admin FROM public.user_profiles WHERE id = v_invoker_uid; IF NOT COALESCE(v_invoker_is_admin, false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; UPDATE public.user_profiles SET role = COALESCE(p_role, role), credits = COALESCE(p_credits, credits) WHERE id = p_user_id; END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage, auth AS $$
DECLARE
    v_invoker_uid uuid := auth.uid();
    v_invoker_is_admin boolean;
    asset_record RECORD;
BEGIN
    SELECT role = 'admin' INTO v_invoker_is_admin FROM public.user_profiles WHERE id = v_invoker_uid;
    IF NOT COALESCE(v_invoker_is_admin, false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    FOR asset_record IN SELECT storage_path, thumbnail_storage_path FROM public.user_assets WHERE user_id = p_user_id LOOP
        DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = asset_record.storage_path;
        IF asset_record.thumbnail_storage_path IS NOT NULL THEN
            DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = asset_record.thumbnail_storage_path;
        END IF;
    END LOOP;
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_public_asset(p_asset_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage, auth AS $$
DECLARE
    v_invoker_uid uuid := auth.uid();
    v_invoker_is_admin boolean;
    v_storage_path text;
BEGIN
    SELECT role = 'admin' INTO v_invoker_is_admin FROM public.user_profiles WHERE id = v_invoker_uid;
    IF NOT COALESCE(v_invoker_is_admin, false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    SELECT storage_path INTO v_storage_path FROM public.public_assets WHERE id = p_asset_id;
    IF v_storage_path IS NULL THEN RAISE EXCEPTION 'ASSET_NOT_FOUND: Recurso público com ID % não encontrado.', p_asset_id; END IF;
    DELETE FROM storage.objects WHERE bucket_id = 'public_assets' AND name = v_storage_path;
    DELETE FROM public.public_assets WHERE id = p_asset_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_delete_asset(p_asset_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage, auth AS $$
DECLARE
    v_asset_record RECORD;
    v_invoker_uid uuid := auth.uid();
BEGIN
    SELECT * INTO v_asset_record FROM public.user_assets WHERE id = p_asset_id;
    IF v_asset_record IS NULL THEN RAISE EXCEPTION 'ASSET_NOT_FOUND: Recurso de utilizador com ID % não encontrado.', p_asset_id; END IF;
    IF v_asset_record.user_id != v_invoker_uid THEN RAISE EXCEPTION 'PERMISSION_DENIED: Você não é o proprietário deste recurso.'; END IF;
    DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset_record.storage_path;
    IF v_asset_record.thumbnail_storage_path IS NOT NULL THEN
        DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset_record.thumbnail_storage_path;
    END IF;
    DELETE FROM public.user_assets WHERE id = p_asset_id;
    RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_public_asset(p_asset_id uuid, p_new_name text, p_new_category_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
    v_invoker_uid uuid := auth.uid();
    v_invoker_is_admin boolean;
BEGIN
    SELECT role = 'admin' INTO v_invoker_is_admin FROM public.user_profiles WHERE id = v_invoker_uid;
    IF NOT COALESCE(v_invoker_is_admin, false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;

    UPDATE public.public_assets
    SET
        name = p_new_name,
        category_id = p_new_category_id
    WHERE id = p_asset_id;
END;
$$;


-- ======= PARTE 7: CRIAR POLÍTICAS DE ARMAZENAMENTO (STORAGE) =======
CREATE POLICY "Acesso público de leitura para public_assets" ON storage.objects FOR SELECT USING ( bucket_id = 'public_assets' );
CREATE POLICY "Acesso total de admin para public_assets" ON storage.objects FOR ALL USING ( bucket_id = 'public_assets' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' ) WITH CHECK ( bucket_id = 'public_assets' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' );
CREATE POLICY "Acesso total do utilizador aos seus próprios ficheiros" ON storage.objects FOR ALL USING ( bucket_id = 'user_assets' AND public.get_my_uid() = (storage.foldername(name))[1]::uuid ) WITH CHECK ( bucket_id = 'user_assets' AND public.get_my_uid() = (storage.foldername(name))[1]::uuid );`;

const UserAssetsSetupInstructions: React.FC<{
    isAdminContext?: boolean;
    onRetry?: () => void;
    error?: string;
}> = ({ isAdminContext = false, onRetry, error }) => {
    
    const handleCopy = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(SQL_SCRIPT).then(() => {
                alert('Script copiado para a área de transferência!');
            }, () => {
                alert('Falha ao copiar o script.');
            });
        }
    };

    return (
        <div className="h-full flex items-center justify-center bg-brand-dark text-white p-4">
            <div className="w-full max-w-4xl bg-brand-light p-8 rounded-2xl border border-brand-accent/50 shadow-2xl">
                <h1 className="text-2xl font-bold text-red-400">
                    {isAdminContext ? 'Configuração de Administrador Incompleta' : 'Configuração de Recursos Necessária'}
                </h1>
                <p className="mt-2 text-gray-300">
                    {error || 'Ocorreu um erro ao aceder aos seus recursos. Parece que a base de dados precisa de ser configurada ou atualizada.'}
                </p>
                <p className="mt-4 text-gray-300">
                    Para corrigir isto, por favor, execute o seguinte script SQL no seu editor de SQL do Supabase. Isto irá criar as tabelas e funções necessárias para que a aplicação funcione corretamente.
                </p>
                <div className="mt-4 bg-brand-dark p-4 rounded-lg overflow-auto max-h-[50vh] relative">
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                        <code>{SQL_SCRIPT}</code>
                    </pre>
                    <Button onClick={handleCopy} className="absolute top-2 right-2 !px-3 !py-1 text-xs">Copiar</Button>
                </div>
                {onRetry && (
                    <div className="mt-6 flex justify-center">
                        <Button onClick={onRetry} primary>
                            Tentar Novamente
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserAssetsSetupInstructions;
