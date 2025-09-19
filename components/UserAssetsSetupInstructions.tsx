import React from 'react';
import Button from './Button.tsx';

interface UserAssetsSetupInstructionsProps {
    error: string | null;
    onRetry: () => void;
}

const UserAssetsSetupInstructions: React.FC<UserAssetsSetupInstructionsProps> = ({ error, onRetry }) => {

    const sqlScript = `-- Execute o seguinte script no seu Editor SQL do Supabase.
-- Visite: https://app.supabase.com/project/_/sql/new
-- Este script adiciona a coluna thumbnail_storage_path para corrigir as miniaturas de vídeo
-- e melhora a função de exclusão para remover também as miniaturas.

-- 1. Crie o bucket de armazenamento para os recursos do utilizador (se ainda não existir)
-- Visite: https://app.supabase.com/project/_/storage/buckets
-- Clique em "Criar novo bucket", nomeie-o 'user_assets' e deixe-o como PRIVADO.

-- 2. Crie ou atualize a tabela para armazenar metadados dos recursos do utilizador
CREATE TABLE IF NOT EXISTS public.user_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    thumbnail_storage_path TEXT, -- Nova coluna para miniaturas
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adiciona a nova coluna se a tabela já existir
ALTER TABLE public.user_assets ADD COLUMN IF NOT EXISTS thumbnail_storage_path TEXT;


-- 3. Ative a Segurança a Nível de Linha (RLS) (se ainda não estiver ativada)
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

-- 4. Crie/Substitua Políticas de RLS para permitir que os utilizadores gerenciem os seus próprios recursos
DROP POLICY IF EXISTS "Utilizadores podem gerir os seus próprios recursos" ON public.user_assets;
CREATE POLICY "Utilizadores podem gerir os seus próprios recursos" ON public.user_assets
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Crie/Substitua a função para apagar recursos (CORRIGIDA E MELHORADA)
CREATE OR REPLACE FUNCTION user_delete_asset(p_asset_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_asset_record RECORD;
    v_invoker_uid uuid := auth.uid();
BEGIN
    SELECT * INTO v_asset_record FROM public.user_assets WHERE id = p_asset_id;
    
    IF v_asset_record IS NULL THEN
        RAISE EXCEPTION 'ASSET_NOT_FOUND: Recurso de utilizador com ID % não encontrado.', p_asset_id;
    END IF;
    
    IF v_asset_record.user_id != v_invoker_uid THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Você não é o proprietário deste recurso.';
    END IF;
    
    -- Apaga o recurso principal do armazenamento
    DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset_record.storage_path;
    
    -- Apaga também a miniatura, se existir
    IF v_asset_record.thumbnail_storage_path IS NOT NULL THEN
        DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset_record.thumbnail_storage_path;
    END IF;
    
    -- Finalmente, apaga o registo da tabela
    DELETE FROM public.user_assets WHERE id = p_asset_id;
    
    RETURN;
END;
$$;
`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sqlScript);
        alert('Script copiado para a área de transferência!');
    };

    return (
        <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-4xl w-full bg-brand-dark/50 p-8 rounded-2xl border border-yellow-500/50 text-center">
                <h1 className="text-3xl font-bold text-yellow-400">Configuração de Recursos de Utilizador Necessária</h1>
                <p className="mt-4 text-lg text-gray-300">
                    A sua aplicação precisa de ser configurada para permitir que os utilizadores carreguem e gerenciem os seus próprios ficheiros.
                    Por favor, execute o script SQL abaixo no seu editor SQL do Supabase.
                </p>
                 {error && (
                    <div className="mt-4 p-3 bg-yellow-900/50 rounded-lg text-yellow-300 text-sm text-left font-mono">
                        <strong>Erro Detetado:</strong> {error.replace('USER_ASSETS_SETUP_REQUIRED:', '').trim()}
                    </div>
                )}
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
                    <Button onClick={onRetry} primary>
                        Tentar Novamente Após a Configuração
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default UserAssetsSetupInstructions;