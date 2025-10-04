import React from 'react';

// SCRIPT DE MIGRAÇÃO NÃO DESTRUTIVO v1
// Este script é seguro para ser executado numa base de dados com dados existentes.
// Ele NÃO apaga nenhuma tabela ou dado. Apenas altera funções e adiciona uma coluna.
const MIGRATION_SCRIPT_001 = `-- =====================================================================================
-- SCRIPT DE MIGRAÇÃO NÃO DESTRUTIVO v1
-- OBJETIVO: Corrigir funcionalidades centrais de planos, créditos e armazenamento.
--
-- INSTRUÇÕES:
-- 1. Execute este script UMA ÚNICA VEZ no seu SQL Editor do Supabase.
-- 2. Este script é SEGURO para ser executado numa base de dados com dados existentes.
--    Ele NÃO apaga nenhuma tabela ou dado de utilizador. Apenas altera funções
--    e adiciona uma coluna.
-- =====================================================================================

-- ======= PASSO 1: Adicionar coluna para rastrear o tamanho dos ficheiros =======
-- Adiciona a coluna 'file_size_bytes' à tabela de recursos do utilizador, se ainda não existir.
-- Isto é essencial para contabilizar o uso de armazenamento.
ALTER TABLE public.user_assets ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT NOT NULL DEFAULT 0;


-- ======= PASSO 2: Automatizar a contabilização do armazenamento =======
-- Cria uma função de gatilho que atualiza o 'storage_used_bytes' do utilizador
-- sempre que um recurso é adicionado ou removido.
CREATE OR REPLACE FUNCTION public.handle_asset_storage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Se um novo ficheiro é inserido, adiciona o seu tamanho ao total do utilizador.
        UPDATE public.user_profiles
        SET storage_used_bytes = storage_used_bytes + NEW.file_size_bytes
        WHERE id = NEW.user_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        -- Se um ficheiro é apagado, subtrai o seu tamanho do total do utilizador.
        UPDATE public.user_profiles
        SET storage_used_bytes = storage_used_bytes - OLD.file_size_bytes
        WHERE id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Apaga os gatilhos antigos, se existirem, para evitar duplicados.
DROP TRIGGER IF EXISTS on_asset_insert_update_storage ON public.user_assets;
DROP TRIGGER IF EXISTS on_asset_delete_update_storage ON public.user_assets;

-- Associa a função de gatilho aos eventos de INSERT e DELETE na tabela 'user_assets'.
CREATE TRIGGER on_asset_insert_update_storage
AFTER INSERT ON public.user_assets
FOR EACH ROW EXECUTE FUNCTION public.handle_asset_storage_change();

CREATE TRIGGER on_asset_delete_update_storage
AFTER DELETE ON public.user_assets
FOR EACH ROW EXECUTE FUNCTION public.handle_asset_storage_change();


-- ======= PASSO 3: Simplificar a função de apagar recursos =======
-- A função de apagar recursos agora apenas precisa de apagar o registo.
-- O gatilho acima irá tratar da atualização do armazenamento e do ficheiro no storage.
-- Esta função já existia, mas a lógica foi simplificada pois o gatilho faz o trabalho pesado.
CREATE OR REPLACE FUNCTION public.user_delete_asset(p_asset_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset public.user_assets;
BEGIN
    -- Verifica se o recurso pertence ao utilizador atual
    SELECT * INTO v_asset FROM public.user_assets WHERE id = p_asset_id AND user_id = auth.uid();
    IF v_asset IS NULL THEN
        RAISE EXCEPTION 'Asset not found or permission denied';
    END IF;

    -- Apaga o ficheiro do Storage. A política de RLS irá permitir isto.
    DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset.storage_path;
    IF v_asset.thumbnail_storage_path IS NOT NULL THEN
       DELETE FROM storage.objects WHERE bucket_id = 'user_assets' AND name = v_asset.thumbnail_storage_path;
    END IF;
    
    -- Apaga o registo da tabela. O gatilho 'on_asset_delete_update_storage' será disparado
    -- para subtrair o tamanho do ficheiro do total do utilizador.
    DELETE FROM public.user_assets WHERE id = p_asset_id;
END;
$$;


-- ======= PASSO 4: Corrigir a atribuição de planos e créditos no painel de admin =======
-- Esta é a correção principal. A função agora define corretamente os créditos, status e data de expiração
-- com base no plano atribuído pelo administrador.
CREATE OR REPLACE FUNCTION public.admin_update_user_details(p_user_id uuid, p_role text, p_credits integer, p_status text, p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_plan RECORD;
    v_expiration_date timestamptz;
    v_new_credits integer;
    v_new_status text;
BEGIN
    -- Apenas administradores podem executar esta função.
    IF public.get_my_role() <> 'admin' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;

    -- Se um plano foi especificado, busca os seus detalhes.
    IF p_plan_id IS NOT NULL THEN
        SELECT * INTO v_new_plan FROM public.plans WHERE id = p_plan_id;

        -- Define os créditos com base no plano
        v_new_credits := v_new_plan.video_credits_monthly;
        
        -- Define o status como 'active' se for um plano pago.
        IF v_new_plan.name ILIKE 'Free' THEN
            v_new_status := 'pending_approval'; -- Mantém pendente se for o plano Free
        ELSE
            v_new_status := 'active';
        END IF;

        -- Lógica para a data de expiração, mantida das correções anteriores
        IF v_new_plan.name ILIKE 'Bee' THEN
            v_expiration_date := now() + interval '365 days';
        ELSEIF v_new_plan.trial_days IS NOT NULL AND v_new_plan.trial_days > 0 THEN
            v_expiration_date := now() + (v_new_plan.trial_days || ' days')::interval;
        ELSEIF v_new_plan.name NOT ILIKE 'Free' THEN
            v_expiration_date := now() + interval '31 days';
        ELSE
            v_expiration_date := NULL;
        END IF;
    ELSE
        -- Se nenhum plano for atribuído, reseta os valores.
        v_new_credits := p_credits; -- Mantém os créditos passados se não houver plano
        v_expiration_date := NULL;
        v_new_status := p_status; -- Mantém o status passado se não houver plano
    END IF;

    -- Atualiza o perfil do utilizador com os novos valores.
    UPDATE public.user_profiles SET
        role = COALESCE(p_role, role),
        credits = COALESCE(v_new_credits, p_credits, credits),
        status = COALESCE(v_new_status, p_status, status),
        plan_id = p_plan_id,
        access_expires_at = v_expiration_date
    WHERE id = p_user_id;
END;
$$;


-- ======= PASSO 5: Implementar controlo de acesso por funcionalidade =======
-- Cria uma função que devolve as funcionalidades permitidas para o utilizador atual,
-- com base no seu plano. O frontend usará isto para mostrar/ocultar módulos.
CREATE OR REPLACE FUNCTION public.get_user_features()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_id uuid;
BEGIN
    -- Obtém o plano do utilizador atual.
    SELECT plan_id INTO v_plan_id FROM public.user_profiles WHERE id = auth.uid();
    
    IF v_plan_id IS NULL THEN
        RETURN ARRAY[]::text[];
    END IF;

    -- Devolve a lista de IDs de funcionalidades associadas ao plano.
    RETURN ARRAY(
        SELECT feature_id
        FROM public.plan_features
        WHERE plan_features.plan_id = v_plan_id
    );
END;
$$;


-- ======= PASSO 6: Garantir que a dedução de créditos está correta =======
-- A função de dedução de créditos já estava funcionalmente correta, mas
-- a incluímos aqui para garantir consistência. O problema principal (utilizadores sem
-- créditos) foi resolvido no PASSO 4.
CREATE OR REPLACE FUNCTION public.deduct_video_credits(amount_to_deduct integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Essencial para permitir que a função modifique a própria linha do utilizador
AS $$
DECLARE
    current_credits integer;
    v_user_id uuid := auth.uid();
BEGIN
    -- Obtém os créditos atuais do utilizador que está a chamar a função.
    SELECT credits INTO current_credits FROM public.user_profiles WHERE id = v_user_id;

    -- Verifica se o utilizador tem créditos suficientes.
    IF current_credits < amount_to_deduct THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;

    -- Subtrai os créditos.
    UPDATE public.user_profiles
    SET credits = credits - amount_to_deduct
    WHERE id = v_user_id;
END;
$$;


-- ======= FIM DO SCRIPT DE MIGRAÇÃO =======
-- Uma vez executado, pode recarregar a aplicação.
`;

const MIGRATION_SCRIPT_002_SUPPORT = `-- =====================================================================================
-- SCRIPT DE MIGRAÇÃO v2 - SISTEMA DE SUPORTE
-- OBJETIVO: Adicionar as tabelas e funções necessárias para o sistema de tickets de suporte.
--
-- INSTRUÇÕES:
-- 1. Execute este script UMA ÚNICA VEZ no seu SQL Editor do Supabase.
-- 2. Este script é SEGURO e NÃO apaga nenhuma tabela ou dado existente.
-- =====================================================================================

-- ======= PASSO 1: Criar tabelas para os tickets e mensagens =======
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL, -- 'new', 'in_progress', 'resolved'
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.support_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    content text NOT NULL,
    sender text NOT NULL, -- 'user', 'ai', or admin's user_id
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ======= PASSO 2: Ativar Row Level Security (RLS) e definir políticas =======
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Apaga políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Allow users to see their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow users to see messages for their own tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Allow admin full access to tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow admin full access to messages" ON public.support_messages;

-- Novas políticas
CREATE POLICY "Allow users to see their own tickets" ON public.support_tickets
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow users to see messages for their own tickets" ON public.support_messages
FOR SELECT USING (
    (SELECT user_id FROM public.support_tickets WHERE id = ticket_id) = auth.uid()
);

CREATE POLICY "Allow admin full access to tickets" ON public.support_tickets
FOR ALL USING (public.get_my_role() = 'admin');

CREATE POLICY "Allow admin full access to messages" ON public.support_messages
FOR ALL USING (public.get_my_role() = 'admin');

-- ======= PASSO 3: Criar Funções RPC (Remote Procedure Call) =======

-- Função para um utilizador criar um novo ticket de suporte
CREATE OR REPLACE FUNCTION public.create_support_ticket(p_subject text, p_messages jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_id uuid;
    v_message jsonb;
BEGIN
    INSERT INTO public.support_tickets (user_id, user_email, subject)
    VALUES (auth.uid(), auth.jwt()->>'email', p_subject)
    RETURNING id INTO v_ticket_id;

    FOR v_message IN SELECT * FROM jsonb_array_elements(p_messages)
    LOOP
        INSERT INTO public.support_messages (ticket_id, content, sender)
        VALUES (v_ticket_id, v_message->>'content', v_message->>'sender');
    END LOOP;
END;
$$;

-- Função para administradores obterem todos os tickets com as respetivas mensagens
CREATE OR REPLACE FUNCTION public.admin_get_all_support_tickets_with_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF public.get_my_role() <> 'admin' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;

    RETURN (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'user_id', t.user_id,
                'user_email', t.user_email,
                'subject', t.subject,
                'status', t.status,
                'created_at', t.created_at,
                'messages', (
                    SELECT jsonb_agg(m ORDER BY m.created_at ASC)
                    FROM public.support_messages m
                    WHERE m.ticket_id = t.id
                )
            )
        )
        FROM public.support_tickets t
    );
END;
$$;

-- Função para administradores atualizarem o status de um ticket
CREATE OR REPLACE FUNCTION public.admin_update_ticket_status(p_ticket_id uuid, p_new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF public.get_my_role() <> 'admin' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;

    UPDATE public.support_tickets
    SET status = p_new_status
    WHERE id = p_ticket_id;
END;
$$;

-- ======= FIM DO SCRIPT DE MIGRAÇÃO v2 =======
`;

interface UserAssetsSetupInstructionsProps {
    error?: string | null;
    onRetry?: () => void;
    isAdminContext?: boolean;
}

const UserAssetsSetupInstructions: React.FC<UserAssetsSetupInstructionsProps> = ({ error, onRetry, isAdminContext = false }) => {
    
    const handleCopy = (script: string, name: string) => {
        navigator.clipboard.writeText(script)
            .then(() => alert(`Script '${name}' copiado para a área de transferência!`))
            .catch(err => console.error('Falha ao copiar script:', err));
    };
    
    return (
        <div className="h-full w-full flex items-center justify-center p-8 bg-brand-dark text-white">
            <div className="max-w-4xl text-left bg-brand-light p-8 rounded-lg border border-brand-accent">
                <h1 className="text-2xl font-bold text-yellow-300">Ação Necessária: Executar Migração da Base de Dados</h1>
                 <p className="mt-4 text-gray-300">
                    Detectámos que a sua base de dados precisa de uma ou mais atualizações para corrigir funcionalidades críticas.
                </p>
                 <p className="mt-2 text-gray-400">
                    Por favor, siga estes passos para aplicar as correções de forma segura:
                </p>
                <ol className="list-decimal list-inside mt-4 space-y-2 text-gray-300">
                    <li>Aceda ao seu projeto Supabase.</li>
                    <li>No menu lateral, vá para <strong>SQL Editor</strong>.</li>
                    <li>Clique em <strong>+ New query</strong>.</li>
                    <li>Copie e execute <strong>CADA UM</strong> dos scripts abaixo, um de cada vez.</li>
                </ol>

                <div className="mt-6 space-y-6">
                    <div className="border border-brand-accent p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-semibold">Script v1 (Funcionalidades Essenciais)</h2>
                            <button onClick={() => handleCopy(MIGRATION_SCRIPT_001, 'v1')} className="bg-brand-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-secondary transition-colors">
                                Copiar Script v1
                            </button>
                        </div>
                        <pre className="bg-brand-dark p-4 rounded-md text-xs overflow-auto max-h-40 font-mono border border-brand-accent">
                            <code>{MIGRATION_SCRIPT_001}</code>
                        </pre>
                    </div>
                    
                    <div className="border border-brand-accent p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-semibold">Script v2 (Sistema de Suporte)</h2>
                            <button onClick={() => handleCopy(MIGRATION_SCRIPT_002_SUPPORT, 'v2')} className="bg-brand-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-secondary transition-colors">
                                Copiar Script v2
                            </button>
                        </div>
                        <pre className="bg-brand-dark p-4 rounded-md text-xs overflow-auto max-h-40 font-mono border border-brand-accent">
                            <code>{MIGRATION_SCRIPT_002_SUPPORT}</code>
                        </pre>
                    </div>
                </div>

                 <p className="mt-6 text-sm text-yellow-400">
                    <strong>Importante:</strong> Estes são scripts de <strong>MIGRAÇÃO SEGUROS</strong>. Eles foram desenhados para serem executados <strong>UMA VEZ</strong> na sua base de dados existente. Eles <strong>NÃO</strong> irão apagar os seus utilizadores, ficheiros ou quaisquer outros dados.
                </p>

                {error && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-md text-red-300">
                        <p className="font-semibold">Detalhes do Erro:</p>
                        <p className="text-xs mt-1">{error}</p>
                    </div>
                )}
                
                {onRetry && (
                    <div className="mt-6 text-center">
                        <button onClick={onRetry} className="bg-brand-secondary text-black px-6 py-2 rounded-md font-bold hover:bg-white transition-colors">
                            Tentar Novamente Após Executar os Scripts
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserAssetsSetupInstructions;