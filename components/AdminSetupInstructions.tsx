import React from 'react';
import Button from './Button.tsx';

interface AdminSetupInstructionsProps {
    error: string | null;
    onRetry: () => void;
}

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-200 overflow-x-auto my-2 border border-gray-700">
        <code>{children}</code>
    </pre>
);

const AdminSetupInstructions: React.FC<AdminSetupInstructionsProps> = ({ error, onRetry }) => {

    const masterScript = `-- Este script é seguro para ser executado várias vezes.

-- ======= TABELA: public_assets =======
CREATE TABLE IF NOT EXISTS public.public_assets (
  id uuid default gen_random_uuid() not null primary key,
  name text not null,
  asset_type text not null,
  asset_url text not null,
  thumbnail_url text,
  visibility text not null check (visibility in ('Public', 'Restricted')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references auth.users(id)
);

-- ======= TABELA: user_profiles =======
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid not null references auth.users(id) on delete cascade primary key,
  role text not null default 'user',
  credits integer not null default 100
);

-- ======= ATIVAR SEGURANÇA (RLS) =======
ALTER TABLE public.public_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ======= POLÍTICAS DE SEGURANÇA (serão ignoradas se já existirem) =======
-- Policies for public_assets
DROP POLICY IF EXISTS "Os recursos públicos são visíveis para todos." ON public.public_assets;
CREATE POLICY "Os recursos públicos são visíveis para todos."
  ON public.public_assets FOR SELECT
  USING ( visibility = 'Public' );

DROP POLICY IF EXISTS "Os administradores podem ver todos os recursos." ON public.public_assets;
CREATE POLICY "Os administradores podem ver todos os recursos."
  ON public.public_assets FOR SELECT
  USING ( (select role from public.user_profiles where user_id = auth.uid()) = 'admin' );

DROP POLICY IF EXISTS "Os administradores podem inserir novos recursos." ON public.public_assets;
CREATE POLICY "Os administradores podem inserir novos recursos."
  ON public.public_assets FOR INSERT
  WITH CHECK ( (select role from public.user_profiles where user_id = auth.uid()) = 'admin' );

-- Policies for user_profiles
DROP POLICY IF EXISTS "Os utilizadores podem ver o seu próprio perfil." ON public.user_profiles;
CREATE POLICY "Os utilizadores podem ver o seu próprio perfil."
  ON public.user_profiles FOR SELECT
  USING ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Os administradores podem ver todos os perfis." ON public.user_profiles;
CREATE POLICY "Os administradores podem ver todos os perfis."
  ON public.user_profiles FOR SELECT
  USING ( (select role from public.user_profiles where user_id = auth.uid()) = 'admin' );


-- ======= GATILHO PARA NOVOS UTILIZADORES =======
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role, credits)
  VALUES (new.id, 'user', 100)
  ON CONFLICT (user_id) DO NOTHING; -- Evita erros se o perfil já existir
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ======= FUNÇÕES RPC PARA O PAINEL DE ADMIN =======
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS TABLE (id uuid, email text, role text, credits int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email,
    up.role,
    up.credits
  FROM auth.users u
  JOIN public.user_profiles up ON u.id = up.user_id
  WHERE auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION admin_get_all_assets()
RETURNS SETOF public.public_assets
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.public_assets
  WHERE auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION admin_add_public_asset(
    p_name text,
    p_asset_type text,
    p_asset_url text,
    p_thumbnail_url text,
    p_visibility text,
    p_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()) = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem adicionar recursos públicos';
  END IF;

  INSERT INTO public.public_assets(name, asset_type, asset_url, thumbnail_url, visibility, owner_id)
  VALUES (p_name, p_asset_type, p_asset_url, p_thumbnail_url, p_visibility, p_owner_id);
END;
$$;
`;

    const storageScript = `-- Apagar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Admin full access" ON storage.objects;

-- Criar novas políticas de armazenamento
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'public_assets' );

CREATE POLICY "Admin full access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'public_assets' AND
  (select role from public.user_profiles where user_id = auth.uid()) = 'admin'
)
WITH CHECK (
  bucket_id = 'public_assets' AND
  (select role from public.user_profiles where user_id = auth.uid()) = 'admin'
);`;

    return (
        <div className="p-8 text-left max-w-4xl mx-auto text-gray-200">
            <h1 className="text-3xl font-bold text-red-400 mb-4">Configuração do Backend Necessária</h1>
            <p className="mb-2">A aplicação detetou que o seu backend Supabase não está totalmente configurado. Isto é normal na primeira utilização do painel de administração.</p>
            {error && <p className="mb-6 bg-red-900/50 border border-red-500/50 p-3 rounded-lg text-sm"><strong>Erro Detetado:</strong> {error.replace('SETUP_REQUIRED:', '')}</p>}

            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold text-yellow-300 mb-2">Passo 1: Executar Script de Base de Dados Mestre</h2>
                    <p>Copie e cole todo o seguinte script SQL no <strong>SQL Editor</strong> do seu projeto Supabase e clique em "RUN". Este script é seguro para ser executado várias vezes.</p>
                    <CodeBlock>{masterScript}</CodeBlock>
                </div>
                
                <div>
                    <h2 className="text-xl font-semibold text-yellow-300 mb-2">Passo 2: Criar o Bucket de Armazenamento</h2>
                    <ol className="list-decimal list-inside space-y-1 pl-4">
                        <li>No seu painel Supabase, vá para a secção <strong>Storage</strong> (ícone de balde).</li>
                        <li>Clique em <strong>"Create a new bucket"</strong>.</li>
                        <li>Dê ao bucket o nome exato de <strong>`public_assets`</strong>.</li>
                        <li>Deixe todas as outras opções desmarcadas e clique em <strong>"Create"</strong>.</li>
                    </ol>
                </div>

                <div>
                    <h2 className="text-xl font-semibold text-yellow-300 mb-2">Passo 3: Executar Script de Políticas de Armazenamento</h2>
                    <p>Volte ao <strong>SQL Editor</strong>, crie uma nova query, copie e cole o seguinte script e clique em "RUN".</p>
                    <CodeBlock>{storageScript}</CodeBlock>
                </div>
            </div>

            <div className="mt-8 text-center">
                <p className="mb-4">Depois de completar todos os passos acima, clique no botão abaixo para tentar novamente.</p>
                <Button onClick={onRetry} primary className="!text-lg !px-8">Tentar Novamente</Button>
            </div>
        </div>
    );
};

export default AdminSetupInstructions;
