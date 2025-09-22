import React from 'react';
import Button from './Button.tsx';

const AdminSetupInstructions: React.FC = () => {
    const sqlScript = `-- SCRIPT DE CONFIGURAÇÃO MESTRE UNIFICADO v27.0 - GESTÃO DE RECURSOS E CATEGORIAS
-- Este script APAGA a configuração antiga e cria TUDO do zero.
-- É a única coisa que precisa de ser executada no seu Editor SQL do Supabase.

-- ======= PARTE 1: LIMPEZA COMPLETA (para garantir um estado limpo) =======
-- Apagar políticas antigas DE ARMAZENAMENTO se existirem (ignorar erros se não existirem)
DROP POLICY IF EXISTS "Permitir upload de administradores para public_assets" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura pública de public_assets" ON storage.objects;
DROP POLICY IF EXISTS "Permitir que utilizadores autenticados gerenciem os seus próprios ficheiros" ON storage.objects;

-- Apagar funções antigas
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.admin_get_all_users() CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_add_public_asset(text,text,text,text,text,text,uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_public_asset(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_public_asset(uuid, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_get_categories(text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_create_category(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_category(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_category(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_delete_asset(uuid) CASCADE;

-- Apagar tabelas antigas (a ordem importa devido às chaves estrangeiras)
DROP TABLE IF EXISTS public.user_favorite_public_assets CASCADE;
DROP TABLE IF EXISTS public.public_assets CASCADE;
DROP TABLE IF EXISTS public.public_asset_categories CASCADE;
DROP TABLE IF EXISTS public.user_assets CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.plan_features CASCADE;
DROP TABLE IF EXISTS public.features CASCADE;
DROP TABLE IF EXISTS public.credit_costs CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;


-- ======= PARTE 2: CRIAR TODAS AS TABELAS =======

-- Tabela de Planos
CREATE TABLE public.plans (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    stripe_payment_link text NULL,
    initial_credits INT NOT NULL DEFAULT 0
);

-- Tabela de Perfis de Usuário
CREATE TABLE public.user_profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    role text DEFAULT 'starter'::text NOT NULL,
    credits integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    plan_id uuid NULL REFERENCES public.plans(id) ON DELETE SET NULL
);

-- Tabela de Recursos/Módulos da Aplicação
CREATE TABLE public.features (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    description text
);

-- Tabela de Junção para Planos e Recursos
CREATE TABLE public.plan_features (
    plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    feature_id text NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, feature_id)
);

-- Tabela para Custos de Crédito
CREATE TABLE public.credit_costs (
    action text NOT NULL PRIMARY KEY REFERENCES public.features(id) ON DELETE CASCADE,
    cost integer NOT NULL DEFAULT 1
);

-- Tabela de Categorias para Recursos Públicos (Atualizada com tipo)
CREATE TABLE public.public_asset_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    category_type text NOT NULL, -- 'media', 'font', 'preset'
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(name, category_type)
);

-- Tabela de Recursos Públicos (Atualizada com ON DELETE SET NULL)
CREATE TABLE public.public_assets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    asset_type text NOT NULL,
    storage_path text NOT NULL UNIQUE,
    asset_url text NOT NULL,
    thumbnail_url text,
    thumbnail_storage_path text,
    visibility text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    owner_id uuid REFERENCES auth.users(id),
    category_id uuid REFERENCES public.public_asset_categories(id) ON DELETE SET NULL
);

-- Tabela de Favoritos de Recursos Públicos
CREATE TABLE public.user_favorite_public_assets (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    public_asset_id uuid NOT NULL REFERENCES public.public_assets(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, public_asset_id)
);

-- Tabela de Recursos de Utilizador
CREATE TABLE public.user_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    thumbnail_storage_path TEXT,
    is_favorite BOOLEAN DEFAULT false,
    folder_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ======= PARTE 3: GATILHOS E DADOS INICIAIS =======

-- Gatilho para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, role, status, plan_id)
    VALUES (
        NEW.id,
        NEW.email,
        CASE WHEN NEW.email IN ('helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com') THEN 'admin' ELSE 'starter' END,
        CASE WHEN NEW.email IN ('helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com') THEN 'active' ELSE 'pending_approval' END,
        NULL
    );
    RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sincronizar perfis de usuários existentes
INSERT INTO public.user_profiles (id, email, role, status, plan_id)
SELECT id, email, 
    CASE WHEN email IN ('helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com') THEN 'admin' ELSE 'starter' END as role,
    'active' as status,
    NULL as plan_id
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Inserir Dados Padrão
INSERT INTO public.plans (name) VALUES ('Starter'), ('Premium'), ('Professional'), ('BeeLegacy'), ('Admin') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.features (id, name, description) VALUES
    ('imageGenerator', 'Gerador de Imagem', 'Crie imagens a partir de descrições de texto.'),
    ('mockupGenerator', 'Gerador de Mockups', 'Crie mockups de produtos com a sua arte.'),
    ('productStudio', 'Estúdio de Produto', 'Crie cenas de produtos com um clique.'),
    ('studioCriativo', 'Studio Criativo', 'Um editor completo para criar designs com fotos, vídeos, texto e IA.'),
    ('video', 'Gerador de Vídeo', 'Crie sequências de vídeos a partir de uma foto.'),
    ('cenasDoInstagram', 'Cenas do Instagram', 'Descreva uma cena e crie 6 fotos para as suas redes.'),
    ('worldTour', 'Viagem pelo Mundo', 'Escolha um destino e veja-se lá.'),
    ('editor', 'Editor Profissional', 'Ajustes manuais e edições com IA.'),
    ('cleanAndSwap', 'Limpar e Trocar', 'Remova itens de interface e troque a pessoa da foto.'),
    ('unir', 'Unir (Image Blender)', 'Combine elementos de várias imagens em uma só.')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.credit_costs (action, cost) VALUES
    ('video', 20),
    ('imageGenerator', 1),
    ('mockupGenerator', 2)
ON CONFLICT (action) DO NOTHING;


-- ======= PARTE 4: FUNÇÃO AUXILIAR DE RLS E POLÍTICAS DE SEGURANÇA (BASE DE DADOS) =======
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role FROM public.user_profiles WHERE id = auth.uid());
END;
$$;

-- Ativar RLS em todas as tabelas
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorite_public_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

-- Políticas da Base de Dados
CREATE POLICY "Public data is viewable by everyone" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage plans" ON public.plans FOR ALL USING (public.get_my_role() = 'admin');
CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.user_profiles FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "Public data is viewable by everyone" ON public.features FOR SELECT USING (true);
CREATE POLICY "Admins can manage features" ON public.features FOR ALL USING (public.get_my_role() = 'admin');
CREATE POLICY "Public data is viewable by everyone" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "Admins can manage plan features" ON public.plan_features FOR ALL USING (public.get_my_role() = 'admin');
CREATE POLICY "Public data is viewable by everyone" ON public.credit_costs FOR SELECT USING (true);
CREATE POLICY "Admins can manage credit costs" ON public.credit_costs FOR ALL USING (public.get_my_role() = 'admin');
CREATE POLICY "Public categories are viewable by everyone" ON public.public_asset_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.public_asset_categories FOR ALL USING (public.get_my_role() = 'admin');
CREATE POLICY "Public assets are viewable by everyone" ON public.public_assets FOR SELECT USING (true);
CREATE POLICY "Admins can manage public assets" ON public.public_assets FOR ALL USING (public.get_my_role() = 'admin');
CREATE POLICY "Users can manage their own favorites" ON public.user_favorite_public_assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own assets" ON public.user_assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ======= PARTE 5: FUNÇÕES RPC (PROCEDIMENTOS REMOTOS) =======

-- Funções de utilizador
CREATE OR REPLACE FUNCTION public.admin_get_all_users() RETURNS TABLE(id uuid, email text, role text, credits integer, status text, plan_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN QUERY SELECT p.id, p.email, p.role, p.credits, p.status, p.plan_id FROM public.user_profiles p; END; $$;
CREATE OR REPLACE FUNCTION public.admin_update_user_details(p_user_id uuid, p_role text, p_credits integer, p_status text, p_plan_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; UPDATE public.user_profiles SET role = COALESCE(p_role, role), credits = COALESCE(p_credits, credits), status = COALESCE(p_status, status), plan_id = p_plan_id WHERE id = p_user_id; END; $$;
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; DELETE FROM auth.users WHERE id = p_user_id; END; $$;
CREATE OR REPLACE FUNCTION user_delete_asset(p_asset_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$ DECLARE v_asset_record RECORD; v_invoker_uid uuid := auth.uid(); BEGIN SELECT * INTO v_asset_record FROM public.user_assets WHERE id = p_asset_id; IF v_asset_record IS NULL THEN RAISE EXCEPTION 'ASSET_NOT_FOUND'; END IF; IF v_asset_record.user_id != v_invoker_uid THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset_record.storage_path; IF v_asset_record.thumbnail_storage_path IS NOT NULL THEN DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset_record.thumbnail_storage_path; END IF; DELETE FROM public.user_assets WHERE id = p_asset_id; RETURN; END; $$;

-- Funções de plano
CREATE OR REPLACE FUNCTION public.admin_get_plans() RETURNS SETOF public.plans LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN QUERY SELECT * FROM public.plans; END; $$;
CREATE OR REPLACE FUNCTION public.admin_get_features() RETURNS SETOF public.features LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN QUERY SELECT * FROM public.features; END; $$;
CREATE OR REPLACE FUNCTION public.admin_get_plan_features(p_plan_id uuid) RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN ARRAY(SELECT feature_id FROM public.plan_features WHERE plan_id = p_plan_id); END; $$;
CREATE OR REPLACE FUNCTION public.admin_update_plan(p_plan_id uuid, p_updates jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; UPDATE public.plans SET name = p_updates->>'name', stripe_payment_link = p_updates->>'stripe_payment_link', initial_credits = (p_updates->>'initial_credits')::INT WHERE id = p_plan_id; END; $$;
CREATE OR REPLACE FUNCTION public.admin_set_plan_features(p_plan_id uuid, p_feature_ids text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; DELETE FROM public.plan_features WHERE plan_id = p_plan_id; INSERT INTO public.plan_features (plan_id, feature_id) SELECT p_plan_id, unnest(p_feature_ids); END; $$;
CREATE OR REPLACE FUNCTION public.admin_get_credit_costs() RETURNS SETOF public.credit_costs LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN QUERY SELECT * FROM public.credit_costs; END; $$;
CREATE OR REPLACE FUNCTION public.admin_update_credit_cost(p_action text, p_cost integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; INSERT INTO public.credit_costs (action, cost) VALUES (p_action, p_cost) ON CONFLICT (action) DO UPDATE SET cost = p_cost; END; $$;

-- Funções de gestão de galeria (NOVAS E ATUALIZADAS)
CREATE OR REPLACE FUNCTION public.admin_get_categories(p_category_type text) RETURNS SETOF public.public_asset_categories LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; RETURN QUERY SELECT * FROM public.public_asset_categories WHERE category_type = p_category_type ORDER BY name; END; $$;
CREATE OR REPLACE FUNCTION public.admin_create_category(p_name text, p_category_type text) RETURNS public.public_asset_categories LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE new_category public.public_asset_categories; BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; INSERT INTO public.public_asset_categories(name, category_type) VALUES (p_name, p_category_type) RETURNING * INTO new_category; RETURN new_category; END; $$;
CREATE OR REPLACE FUNCTION public.admin_update_category(p_category_id uuid, p_new_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; UPDATE public.public_asset_categories SET name = p_new_name WHERE id = p_category_id; END; $$;
CREATE OR REPLACE FUNCTION public.admin_delete_category(p_category_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; DELETE FROM public.public_asset_categories WHERE id = p_category_id; END; $$;
CREATE OR REPLACE FUNCTION public.admin_add_public_asset(p_name text, p_asset_type text, p_storage_path text, p_asset_url text, p_thumbnail_url text, p_visibility text, p_owner_id uuid, p_category_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; INSERT INTO public.public_assets(name, asset_type, storage_path, asset_url, thumbnail_url, thumbnail_storage_path, visibility, owner_id, category_id) VALUES (p_name, p_asset_type, p_storage_path, p_asset_url, p_thumbnail_url, p_storage_path, p_visibility, p_owner_id, p_category_id); END; $$;
CREATE OR REPLACE FUNCTION public.admin_update_public_asset(p_asset_id uuid, p_new_name text, p_new_category_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; UPDATE public.public_assets SET name = p_new_name, category_id = p_new_category_id WHERE id = p_asset_id; END; $$;
CREATE OR REPLACE FUNCTION public.admin_delete_public_asset(p_asset_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$ DECLARE v_asset_record RECORD; BEGIN IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF; SELECT * INTO v_asset_record FROM public.public_assets WHERE id = p_asset_id; IF v_asset_record IS NULL THEN RAISE EXCEPTION 'ASSET_NOT_FOUND'; END IF; DELETE FROM storage.objects WHERE bucket_id = 'public_assets' AND name = v_asset_record.storage_path; IF v_asset_record.thumbnail_storage_path IS NOT NULL AND v_asset_record.thumbnail_storage_path <> v_asset_record.storage_path THEN DELETE FROM storage.objects WHERE bucket_id = 'public_assets' AND name = v_asset_record.thumbnail_storage_path; END IF; DELETE FROM public.public_assets WHERE id = p_asset_id; END; $$;


-- ======= PARTE 6: POLÍTICAS DE ARMAZENAMENTO (STORAGE RLS) =======
CREATE POLICY "Permitir upload de administradores para public_assets" ON storage.objects FOR ALL TO authenticated USING ( bucket_id = 'public_assets' AND public.get_my_role() = 'admin' ) WITH CHECK ( bucket_id = 'public_assets' AND public.get_my_role() = 'admin' );
CREATE POLICY "Permitir leitura pública de public_assets" ON storage.objects FOR SELECT USING ( bucket_id = 'public_assets' );
CREATE POLICY "Permitir que utilizadores autenticados gerenciem os seus próprios ficheiros" ON storage.objects FOR ALL TO authenticated USING ( bucket_id = 'user_assets' AND owner = auth.uid() AND (storage.foldername(name))[1]::uuid = auth.uid() ) WITH CHECK ( bucket_id = 'user_assets' AND owner = auth.uid() AND (storage.foldername(name))[1]::uuid = auth.uid() );
`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sqlScript);
        alert('Script copiado para a área de transferência!');
    };

    return (
        <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-4xl w-full bg-brand-dark/50 p-8 rounded-2xl border border-yellow-500/50 text-center">
                <h1 className="text-3xl font-bold text-yellow-400">Configuração de Administrador Necessária</h1>
                <p className="mt-4 text-lg text-gray-300">
                    Parece que algumas tabelas ou funções necessárias para as funcionalidades de administração não existem ou estão desatualizadas.
                    Por favor, execute o script SQL abaixo no seu editor SQL do Supabase para configurar ou atualizar a sua base de dados.
                </p>
                <div className="mt-6 text-left">
                    <div className="relative bg-black p-4 rounded-lg border border-brand-accent">
                        <pre className="text-xs text-gray-200 whitespace-pre-wrap overflow-x-auto max-h-64">
                            <code>{sqlScript}</code>
                        </pre>
                        <Button onClick={copyToClipboard} className="absolute top-2 right-2 !px-3 !py-1 text-xs">
                            Copiar
                        </Button>
                    </div>
                </div>
                <div className="mt-8">
                    <Button onClick={() => window.location.reload()} primary>
                        Recarregar Após a Configuração
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AdminSetupInstructions;
