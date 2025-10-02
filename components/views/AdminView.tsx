import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabaseClient.ts';
import {
    adminGetAllUserProfiles,
    adminGetPlans,
    adminUpdateUserDetails,
    getPublicAssets,
    adminGetCategories,
    adminCreateCategory,
    adminDeleteCategory,
    adminUpdateCategory,
    adminUploadPublicAsset,
    adminDeletePublicAsset,
    adminUpdatePublicAsset,
    adminGetFeatures,
    adminGetPlanFeatures,
    adminUpdatePlan,
    adminSetPlanFeatures,
    adminGetCreditCosts,
    adminUpdateCreditCost,
    getPublicProjects,
    adminGetPublicProjectCategories,
    adminCreatePublicProjectCategory,
    adminUpdatePublicProjectCategory,
    adminDeletePublicProjectCategory,
    adminUploadPublicProject,
    adminDeletePublicProject,
    adminUpdatePublicProject,
    adminGetSetting, // Importa a nova função
} from '../../services/databaseService.ts';
import type { UserProfile, Plan, PublicAsset, Category, Feature, CreditCost, AssetVisibility, PublicProject, PublicProjectCategory, WebhookLog } from '../../types.ts';
import EditUserModal from '../EditUserModal.tsx';
import Button from '../Button.tsx';
import AdminSetupInstructions from '../AdminSetupInstructions.tsx';
import { IconTrash, IconEdit, IconRocket } from '../Icons.tsx';
import EditAssetModal from '../EditAssetModal.tsx';
import UploadConfirmationModal from '../UploadConfirmationModal.tsx';

type AdminTab = 'users' | 'media' | 'fonts' | 'presets' | 'publicProjects' | 'plans' | 'kiwify' | 'personalizacao';
type AssetTypeFilter = 'media' | 'font' | 'preset';


// =========================================================================================
// KIWIFY MANAGER COMPONENT
// =========================================================================================
const SUPABASE_PROJECT_URL = 'https://opodtvqjobolbsesmwzx.supabase.co';
const WEBHOOK_URL = `${SUPABASE_PROJECT_URL}/functions/v1/kiwify-webhook`;

const EDGE_FUNCTION_CODE = `// Salve este código como supabase/functions/kiwify-webhook/index.ts
// [FIX v4] Lógica corrigida para usar HMAC-SHA1 e ler a assinatura da query string, conforme a documentação da Kiwify.
// FIX: Replaced 'import' with a string concatenation inside the EDGE_FUNCTION_CODE template literal to prevent module parsing errors that were causing the default export to fail.
${'i'}mport { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// FIX: Replaced 'import' with a string concatenation inside the EDGE_FUNCTION_CODE template literal to prevent module parsing errors that were causing the default export to fail.
${'i'}mport { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// FIX: Replaced 'import' with a string concatenation inside the EDGE_FUNCTION_CODE template literal to prevent module parsing errors that were causing the default export to fail.
${'i'}mport { timingSafeEqual } from "https://deno.land/std@0.177.0/crypto/timing_safe_equal.ts";
// FIX: Replaced 'import' with a string concatenation inside the EDGE_FUNCTION_CODE template literal to prevent module parsing errors that were causing the default export to fail.
${'i'}mport { encode } from "https://deno.land/std@0.177.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyKiwifySignature(req: Request, secret: string): Promise<{isValid: boolean, bodyText: string}> {
  const url = new URL(req.url);
  const signature = url.searchParams.get('signature');
  
  const bodyText = await req.clone().text();
  
  if (!signature) {
    console.error("ERRO CRÍTICO: Parâmetro 'signature' não encontrado na URL. Verifique a configuração do webhook na Kiwify.");
    return {isValid: false, bodyText};
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" }, // <-- ALGORITMO CORRIGIDO PARA SHA-1
    false,
    ["sign"]
  );
  
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const expectedSignature = new TextDecoder().decode(encode(new Uint8Array(mac)));

  const isValid = timingSafeEqual(encoder.encode(signature), encoder.encode(expectedSignature));
  
  if (!isValid) {
    console.warn('Falha na verificação da assinatura.', {
      recebido: signature,
      esperado: expectedSignature,
    });
  }
  
  return {isValid, bodyText};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const KIWIFY_WEBHOOK_SECRET = Deno.env.get('KIWIFY_WEBHOOK_SECRET');
  if (!KIWIFY_WEBHOOK_SECRET) {
      console.error("ERRO CRÍTICO: A variável de ambiente KIWIFY_WEBHOOK_SECRET não está definida.");
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  
  const {isValid, bodyText} = await verifyKiwifySignature(req, KIWIFY_WEBHOOK_SECRET);

  if (!isValid) {
      return new Response(JSON.stringify({ error: 'Incorrect signature' }), {
          status: 400, // Usar 400 para assinatura incorreta conforme exemplo da Kiwify
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }

  try {
    const data = JSON.parse(bodyText);

    const email = data.customer?.email || data.Customer?.email;
    const evento = data.webhook_event_type || data.order?.webhook_event_type || data.order_status;
    const produto = data.Subscription?.plan?.name || data.product?.name || data.Product?.product_name;

    if (!email || !evento || !produto) {
        console.log('Webhook recebido com campos em falta:', { email, evento, produto });
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: rpcData, error } = await supabaseClient.rpc('admin_process_webhook', {
      p_email: email,
      p_evento: evento,
      p_produto: produto,
    });

    if (error) {
      console.error('Erro ao executar a RPC admin_process_webhook:', error.message);
      return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify(rpcData || { status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Erro ao processar o corpo do webhook:', e.message);
    return new Response(JSON.stringify({ error: 'Bad Request', details: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
`;

const KiwifyManager: React.FC = () => {
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    // Estado para o simulador
    const [simEmail, setSimEmail] = useState('cliente@exemplo.com');
    const [simEvent, setSimEvent] = useState('Compra Aprovada');
    const [simProduct, setSimProduct] = useState('Plano Premium');
    const [isSimulating, setIsSimulating] = useState(false);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.rpc('admin_get_webhook_logs');
            if (error) throw error;
            setLogs(data);
        } catch (err: any) {
            setError('Falha ao buscar os logs da Kiwify.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setNotification('Copiado para a área de transferência!');
            setTimeout(() => setNotification(null), 2000);
        });
    };

    const handleSimulateWebhook = async () => {
        setIsSimulating(true);
        setError(null);
        setNotification(null);
        try {
            const secret = await adminGetSetting('kiwify_webhook_token');

            if (!secret) {
                throw new Error("O Token/Chave Secreta da Kiwify não parece estar configurado nos Secrets do Supabase (KIWIFY_WEBHOOK_SECRET). A simulação pode falhar se a função não conseguir encontrá-lo.");
            }

            const payload = {
                "Customer": { "email": simEmail },
                "Product": { "product_name": simProduct },
                "webhook_event_type": simEvent
            };
            const body = JSON.stringify(payload);

            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                "raw", encoder.encode(secret),
                { name: "HMAC", hash: "SHA-1" }, // <-- ALGORITMO CORRIGIDO PARA SHA-1
                false, ["sign"]
            );
            const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
            
            const hashArray = Array.from(new Uint8Array(signature));
            const hexSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // A assinatura agora é um parâmetro da URL
            const urlComAssinatura = `${WEBHOOK_URL}?signature=${hexSignature}`;

            const response = await fetch(urlComAssinatura, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });

            const responseText = await response.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch {
                responseData = { error: 'A resposta não era um JSON válido.', details: responseText };
            }

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${responseData.error || 'Erro desconhecido'}. Detalhes: ${responseData.details}`);
            }

            setNotification('Webhook simulado com sucesso! Verifique os logs abaixo.');
            await fetchLogs();

        } catch (err: any) {
            setError(`Falha na simulação: ${err.message}`);
        } finally {
            setIsSimulating(false);
        }
    };

    return (
        <div className="space-y-8">
            {notification && <div className="p-3 bg-brand-secondary/80 text-white rounded-md text-center">{notification}</div>}
            {error && <div className="p-3 bg-red-800 text-white rounded-md text-center">{error}</div>}

            <section>
                <h3 className="text-xl font-semibold mb-3">1. Configuração do Webhook (HMAC)</h3>
                <div className="bg-brand-light p-4 rounded-lg border border-brand-accent space-y-4">
                    <p className="text-gray-300">Para automatizar as atualizações de plano, configure um webhook na sua conta Kiwify. A verificação agora usa HMAC, que é mais seguro.</p>
                    <div>
                        <label className="text-sm font-semibold text-gray-200">URL do Webhook (POST)</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input type="text" readOnly value={WEBHOOK_URL} className="w-full bg-brand-dark p-2 rounded-md font-mono text-sm" />
                            <Button onClick={() => copyToClipboard(WEBHOOK_URL)}>Copiar</Button>
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-semibold text-gray-200">Configuração da Chave Secreta (Token)</label>
                        <div className="text-xs text-gray-400 mt-1 space-y-2">
                            <p>O <strong>Token</strong> gerado pela Kiwify no painel do webhook é a sua chave secreta. Siga estes passos para configurá-lo corretamente:</p>
                            <ol className="list-decimal list-inside pl-4 space-y-1 bg-brand-dark/50 p-3 rounded-md">
                                <li>Vá para o seu painel na <strong>Kiwify</strong>, encontre o seu webhook e copie o valor do campo <strong>"Token"</strong>.</li>
                                <li>Acesse o seu projeto no <strong>Supabase</strong>.</li>
                                <li>No menu lateral, vá para <strong>Edge Functions</strong>, e depois clique em <strong>Secrets</strong>.</li>
                                <li>Clique em <strong>'Create a new secret'</strong>.</li>
                                <li>Preencha os campos:
                                    <ul className="list-disc list-inside pl-4">
                                        <li><strong>Name:</strong> <code className="bg-brand-dark px-1 rounded text-yellow-300">KIWIFY_WEBHOOK_SECRET</code></li>
                                        <li><strong>Value:</strong> Cole o <strong>Token</strong> que você copiou da Kiwify.</li>
                                    </ul>
                                </li>
                                <li>Clique em <strong>Create Secret</strong>. A sua função será reiniciada com a nova configuração.</li>
                            </ol>
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-semibold text-gray-200">Código da Supabase Edge Function</label>
                         <p className="text-xs text-gray-400 mb-2">O código da sua Edge Function ('kiwify-webhook') precisa ser atualizado para usar a verificação HMAC. Copie e cole o código abaixo.</p>
                         <div className="relative">
                            <pre className="bg-brand-dark p-3 rounded-md text-xs overflow-auto max-h-48 font-mono">{EDGE_FUNCTION_CODE}</pre>
                            <Button onClick={() => copyToClipboard(EDGE_FUNCTION_CODE)} className="absolute top-2 right-2 !px-2 !py-1 text-xs">Copiar Código</Button>
                         </div>
                    </div>
                </div>
            </section>
            
             <section>
                <h3 className="text-xl font-semibold mb-3">2. Simulador de Webhook</h3>
                <div className="bg-brand-light p-4 rounded-lg border border-brand-accent space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-200 block mb-1">Email do usuário</label>
                            <input type="email" value={simEmail} onChange={e => setSimEmail(e.target.value)} className="w-full bg-brand-dark p-2 rounded-md" />
                        </div>
                        <div>
                             <label className="text-sm font-semibold text-gray-200 block mb-1">Evento</label>
                             <select value={simEvent} onChange={e => setSimEvent(e.target.value)} className="w-full bg-brand-dark p-2 rounded-md">
                                <option>Compra Aprovada</option>
                                <option>Assinatura Cancelada</option>
                                <option>Boleto Gerado</option>
                             </select>
                        </div>
                        <div>
                             <label className="text-sm font-semibold text-gray-200 block mb-1">Produto</label>
                             <select value={simProduct} onChange={e => setSimProduct(e.target.value)} className="w-full bg-brand-dark p-2 rounded-md">
                                <option>Plano Starter</option>
                                <option>Plano Premium</option>
                                <option>Plano Professional</option>
                                <option>Plano Bee</option>
                             </select>
                        </div>
                    </div>
                    <Button onClick={handleSimulateWebhook} primary disabled={isSimulating}>
                        {isSimulating ? 'A simular...' : 'Simular Webhook'}
                    </Button>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-semibold mb-3">3. Últimos Eventos Recebidos (Logs)</h3>
                 <div className="overflow-x-auto bg-brand-light rounded-lg border border-brand-accent">
                    <table className="min-w-full divide-y divide-brand-accent">
                        <thead className="bg-brand-accent/20">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data/Hora</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">Email</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">Evento Recebido</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">Detalhes (Plano Aplicado)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-accent">
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center p-4">Carregando logs...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={4} className="text-center p-4 text-gray-400">Nenhum evento registrado ainda.</td></tr>
                            ) : (
                                logs.map((log, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{log.email}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{log.evento}</td>
                                        <td className={`px-4 py-2 whitespace-nowrap text-sm ${log.detalhes.startsWith('Erro:') ? 'text-red-400' : ''}`}>{log.detalhes}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};


// AssetGallery Component
const AssetGallery: React.FC<{
    assets: PublicAsset[];
    categories: Category[];
    assetTypeFilter: AssetTypeFilter;
    onUpload: (file: File, assetName: string, categoryId: string | null, visibility: AssetVisibility) => void;
    onDelete: (asset: PublicAsset) => void;
    onEdit: (asset: PublicAsset) => void;
    onNewCategory: (name: string) => void;
    onDeleteCategory: (id: string) => void;
    onUpdateCategory: (id: string, newName: string) => void;
}> = ({ assets, categories, assetTypeFilter, onUpload, onDelete, onEdit, onNewCategory, onDeleteCategory, onUpdateCategory }) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [visibility, setVisibility] = useState<AssetVisibility>('Public');
    const [uploadCandidate, setUploadCandidate] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadCandidate(file);
        }
        if (e.target) e.target.value = '';
    };

    const handleNewCategory = () => {
        const name = prompt("Nome da nova categoria:");
        if (name) onNewCategory(name);
    };

    const handleUpdateCategory = (id: string) => {
        if (editingCategoryName.trim()) {
            onUpdateCategory(id, editingCategoryName.trim());
        }
        setEditingCategoryId(null);
        setEditingCategoryName('');
    };

    const filteredAssets = selectedCategory ? assets.filter(a => a.category_id === selectedCategory) : assets;
    
    const getAcceptableFileTypes = () => {
        switch(assetTypeFilter) {
            case 'media': return 'image/*,video/*';
            case 'font': return '.otf,.ttf,.woff,.woff2';
            case 'preset': return '.dng'; // Note: .brmp is now handled separately
            default: return '*/*';
        }
    };

    return (
        <>
            <UploadConfirmationModal
                isOpen={!!uploadCandidate}
                onClose={() => setUploadCandidate(null)}
                file={uploadCandidate}
                categories={categories}
                onConfirm={(assetName, categoryId) => {
                    if (uploadCandidate) {
                        onUpload(uploadCandidate, assetName, categoryId, visibility);
                    }
                    setUploadCandidate(null);
                }}
            />
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Fazer Upload de Novo Recurso</h3>
                    <div className="bg-brand-light p-4 rounded-lg border border-brand-accent flex items-center gap-4">
                        <label htmlFor={`file-upload-${assetTypeFilter}`} className="cursor-pointer bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-brand-secondary transition-colors">
                            Escolher arquivo
                        </label>
                        <input id={`file-upload-${assetTypeFilter}`} type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept={getAcceptableFileTypes()}/>
                        <div>
                            <label className="text-xs font-medium text-gray-400 mb-1 block">Visibilidade</label>
                            <select value={visibility} onChange={e => setVisibility(e.target.value as AssetVisibility)} className="bg-brand-dark border border-brand-accent rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary">
                                <option value="Public">Público</option>
                                <option value="Restricted">Restrito</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Gerenciar Categorias</h3>
                        <Button onClick={handleNewCategory} className="!px-3 !py-1 text-xs">Nova Categoria</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 p-2 bg-brand-light rounded-lg border border-brand-accent">
                        <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1 rounded-md text-sm ${!selectedCategory ? 'bg-brand-primary text-white' : 'bg-brand-accent hover:bg-brand-light'}`}>Todas</button>
                        {categories.map(cat => (
                            <div key={cat.id} className="relative group flex items-center gap-1">
                                {editingCategoryId === cat.id ? (
                                    <input
                                        type="text"
                                        value={editingCategoryName}
                                        onChange={(e) => setEditingCategoryName(e.target.value)}
                                        onBlur={() => handleUpdateCategory(cat.id)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory(cat.id)}
                                        className="bg-brand-dark border border-brand-primary rounded-md px-3 py-1 text-sm outline-none"
                                        autoFocus
                                    />
                                ) : (
                                    <button onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1 rounded-md text-sm ${selectedCategory === cat.id ? 'bg-brand-primary text-white' : 'bg-brand-accent hover:bg-brand-light'}`}>{cat.name}</button>
                                )}
                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }} className="p-1 hover:text-white"><IconEdit className="w-3 h-3" /></button>
                                    <button onClick={() => onDeleteCategory(cat.id)} className="p-1 hover:text-red-400"><IconTrash className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {filteredAssets.map(asset => (
                        <div key={asset.id} className="relative group aspect-square bg-brand-light rounded-lg">
                             {['image', 'video'].includes(asset.asset_type) ? (
                                <img src={asset.thumbnail_url || asset.asset_url} alt={asset.name} className="w-full h-full object-contain p-2" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2">
                                    <IconRocket className="w-12 h-12" />
                                    <span className="text-xs mt-2 text-center break-all">{asset.name.replace('.brmp', '').replace('.dng', '')}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                                <p className="text-xs text-white truncate">{asset.name}</p>
                                <div className="flex justify-end gap-2">
                                    <Button onClick={() => onEdit(asset)} className="!p-2"><IconEdit className="w-4 h-4" /></Button>
                                    <Button onClick={() => onDelete(asset)} className="!p-2 !bg-red-600 hover:!bg-red-500"><IconTrash className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};


// Main Admin View
const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    
    // Data states
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [creditCosts, setCreditCosts] = useState<CreditCost[]>([]);
    const [publicAssets, setPublicAssets] = useState<PublicAsset[]>([]);
    const [mediaCategories, setMediaCategories] = useState<Category[]>([]);
    const [fontCategories, setFontCategories] = useState<Category[]>([]);
    const [presetCategories, setPresetCategories] = useState<Category[]>([]);
    const [planFeatures, setPlanFeatures] = useState<Record<string, string[]>>({});
    const [publicProjects, setPublicProjects] = useState<PublicProject[]>([]);
    const [publicProjectCategories, setPublicProjectCategories] = useState<PublicProjectCategory[]>([]);
    const [projectUploadCandidate, setProjectUploadCandidate] = useState<File | null>(null);

    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [editingAsset, setEditingAsset] = useState<PublicAsset | PublicProject | null>(null);
    const [requiresSetup, setRequiresSetup] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setRequiresSetup(false);
        try {
            const [
                userProfiles, planData, publicAssetData,
                mediaCats, fontCats, presetCats,
                featureData, creditCostData,
                publicProjectData, publicProjectCats
            ] = await Promise.all([
                adminGetAllUserProfiles(), adminGetPlans(), getPublicAssets(),
                adminGetCategories('media'), adminGetCategories('font'), adminGetCategories('preset'),
                adminGetFeatures(), adminGetCreditCosts(),
                getPublicProjects(), adminGetPublicProjectCategories()
            ]);
            
            setUsers(userProfiles);
            setPlans(planData);
            setPublicAssets(publicAssetData);
            setMediaCategories(mediaCats);
            setFontCategories(fontCats);
            setPresetCategories(presetCats);
            setFeatures(featureData);
            setCreditCosts(creditCostData);
            setPublicProjects(publicProjectData);
            setPublicProjectCategories(publicProjectCats);

            if (planData.length > 0) {
                const firstPlanId = planData[0].id;
                setSelectedPlanId(firstPlanId);
                const featuresForPlans: Record<string, string[]> = {};
                for (const plan of planData) {
                    featuresForPlans[plan.id] = await adminGetPlanFeatures(plan.id);
                }
                setPlanFeatures(featuresForPlans);
            }

        } catch (err: any) {
            console.error("Admin data fetch failed:", err);
            const errorMessage = err?.message || 'Ocorreu um erro desconhecido.';
            if (errorMessage.includes('relation') || errorMessage.includes('does not exist') || errorMessage.includes('permission denied') || errorMessage.includes('could not find the function')) {
                setRequiresSetup(true);
            } else {
                setError(`Falha ao carregar dados de administrador: ${errorMessage}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveUser = async (userId: string, updates: any) => {
        try {
            await adminUpdateUserDetails(userId, updates);
            setEditingUser(null);
            await fetchData();
        } catch (err: any) { setError(`Falha ao atualizar o utilizador: ${err.message}`); }
    };
    
    const handleUploadPublicAsset = async (file: File, assetName: string, categoryId: string | null, visibility: AssetVisibility) => {
        try {
            await adminUploadPublicAsset(file, assetName, visibility, categoryId);
            await fetchData();
        } catch(err: any) { setError(`Falha ao fazer upload do recurso público: ${err.message}`); }
    };

    const handleDeletePublicAsset = async (asset: PublicAsset) => {
        if (window.confirm(`Tem a certeza que quer apagar "${asset.name}"?`)) {
            try {
                await adminDeletePublicAsset(asset.id);
                await fetchData();
            } catch(err: any) { setError(`Falha ao apagar o recurso público: ${err.message}`); }
        }
    };
    
    const handleSaveAsset = async (assetId: string, newName: string, newCategoryId: string | null) => {
        try {
            if (!editingAsset) return;
            // Check if it's a project or a regular asset
            if ('asset_type' in editingAsset) {
                await adminUpdatePublicAsset(assetId, newName, newCategoryId);
            } else {
                await adminUpdatePublicProject(assetId, newName, newCategoryId);
            }
            setEditingAsset(null);
            await fetchData();
        } catch(err: any) { setError(`Falha ao atualizar o recurso: ${err.message}`); }
    };
    
    const handleCategoryAction = async (action: 'create' | 'update' | 'delete', type: AssetTypeFilter, nameOrId: string, newName?: string) => {
        try {
            if (action === 'create') await adminCreateCategory(nameOrId, type);
            if (action === 'update' && newName) await adminUpdateCategory(nameOrId, newName);
            if (action === 'delete') {
                if(window.confirm('Tem a certeza que quer apagar esta categoria? Os recursos associados não serão apagados, mas ficarão sem categoria.')) {
                    await adminDeleteCategory(nameOrId);
                }
            }
            await fetchData();
        } catch(err: any) { setError(`Falha na operação da categoria: ${err.message}`); }
    };
    
    const handlePlanFeatureChange = (planId: string, featureId: string, isChecked: boolean) => {
        setPlanFeatures(prev => {
            const currentFeatures = prev[planId] || [];
            const newFeatures = isChecked 
                ? [...currentFeatures, featureId]
                : currentFeatures.filter(id => id !== featureId);
            return { ...prev, [planId]: newFeatures };
        });
    };
    
    const handleSavePlan = async (plan: Plan) => {
        try {
            const featuresToSave = planFeatures[plan.id] || [];
            await Promise.all([
                adminUpdatePlan(plan.id, { 
                    name: plan.name, 
                    stripe_payment_link: plan.stripe_payment_link, 
                    video_credits_monthly: plan.video_credits_monthly,
                    storage_limit_gb: plan.storage_limit_gb,
                    download_limit_gb: plan.download_limit_gb,
                    trial_days: plan.trial_days
                }),
                adminSetPlanFeatures(plan.id, featuresToSave)
            ]);
            alert('Plano salvo!');
            await fetchData();
        } catch(err: any) { setError(`Falha ao salvar o plano: ${err.message}`); }
    };
    
    const handleCreditCostChange = async (action: string, cost: number) => {
        try {
            await adminUpdateCreditCost(action, cost);
            await fetchData();
        } catch(err: any) { setError(`Falha ao atualizar o custo de crédito: ${err.message}`); }
    };

    const handlePublicProjectCategoryAction = async (action: 'create' | 'update' | 'delete', nameOrId: string, newName?: string) => {
        try {
            if (action === 'create') await adminCreatePublicProjectCategory(nameOrId);
            if (action === 'update' && newName) await adminUpdatePublicProjectCategory(nameOrId, newName);
            if (action === 'delete') await adminDeletePublicProjectCategory(nameOrId);
            await fetchData();
        } catch(err: any) { setError(`Falha na operação da categoria de projeto: ${err.message}`); }
    };

    const handleUploadPublicProject = async (file: File, assetName: string, categoryId: string | null, visibility: AssetVisibility) => {
        try {
            await adminUploadPublicProject(file, assetName, visibility, categoryId);
            await fetchData();
        } catch(err: any) { setError(`Falha ao fazer upload do modelo de projeto: ${err.message}`); }
    };

    const handleDeletePublicProject = async (project: PublicProject) => {
        if (window.confirm(`Tem a certeza que quer apagar o modelo "${project.name}"?`)) {
            try {
                await adminDeletePublicProject(project.id);
                await fetchData();
            } catch(err: any) { setError(`Falha ao apagar o modelo de projeto: ${err.message}`); }
        }
    };

    if (requiresSetup) return <AdminSetupInstructions />;
    
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const renderCurrentTab = () => {
        switch (activeTab) {
            case 'users':
                const filteredUsers = users.filter(user => 
                    user.email.toLowerCase().includes(searchTerm.toLowerCase())
                );
                return (
                    <div className="space-y-4">
                        <div className="flex-shrink-0">
                            <input
                                type="text"
                                placeholder="Pesquisar por email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full max-w-sm bg-brand-light border border-brand-accent rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                            />
                        </div>
                        <div className="overflow-auto">
                            <table className="min-w-full divide-y divide-brand-accent">
                                <thead className="bg-brand-light">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Plano</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Créditos Vídeo</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Armazenamento</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Expira em</th>
                                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Editar</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-brand-dark divide-y divide-brand-accent">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <tr key={user.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{user.email}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.plan_name || user.role}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.credits}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatBytes(user.storage_used_bytes)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                    {user.access_expires_at ? new Date(user.access_expires_at).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <Button onClick={() => setEditingUser(user)} className="!px-3 !py-1 text-xs">Editar</Button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center p-4 text-gray-400">Nenhum utilizador encontrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'media': return <AssetGallery assets={publicAssets.filter(a => ['image', 'video'].includes(a.asset_type))} categories={mediaCategories} assetTypeFilter="media" onUpload={handleUploadPublicAsset} onDelete={handleDeletePublicAsset} onEdit={setEditingAsset} onNewCategory={(name) => handleCategoryAction('create', 'media', name)} onDeleteCategory={(id) => handleCategoryAction('delete', 'media', id)} onUpdateCategory={(id, name) => handleCategoryAction('update', 'media', id, name)} />;
            case 'fonts': return <AssetGallery assets={publicAssets.filter(a => a.asset_type === 'font')} categories={fontCategories} assetTypeFilter="font" onUpload={handleUploadPublicAsset} onDelete={handleDeletePublicAsset} onEdit={setEditingAsset} onNewCategory={(name) => handleCategoryAction('create', 'font', name)} onDeleteCategory={(id) => handleCategoryAction('delete', 'font', id)} onUpdateCategory={(id, name) => handleCategoryAction('update', 'font', id, name)} />;
            case 'presets': return <AssetGallery assets={publicAssets.filter(a => a.asset_type === 'dng')} categories={presetCategories} assetTypeFilter="preset" onUpload={handleUploadPublicAsset} onDelete={handleDeletePublicAsset} onEdit={setEditingAsset} onNewCategory={(name) => handleCategoryAction('create', 'preset', name)} onDeleteCategory={(id) => handleCategoryAction('delete', 'preset', id)} onUpdateCategory={(id, name) => handleCategoryAction('update', 'preset', id, name)} />;
            case 'publicProjects': return (
                <>
                    <UploadConfirmationModal
                        isOpen={!!projectUploadCandidate}
                        onClose={() => setProjectUploadCandidate(null)}
                        file={projectUploadCandidate}
                        categories={publicProjectCategories}
                        onConfirm={(assetName, categoryId) => {
                            if (projectUploadCandidate) {
                                handleUploadPublicProject(projectUploadCandidate, assetName, categoryId, 'Public');
                            }
                            setProjectUploadCandidate(null);
                        }}
                    />
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold mb-2">Fazer Upload de Novo Modelo</h3>
                        <div className="bg-brand-light p-4 rounded-lg border border-brand-accent">
                             <input type="file" accept=".brmp" onChange={e => {
                                 const file = e.target.files?.[0];
                                 if (file) setProjectUploadCandidate(file);
                                 if (e.target) e.target.value = '';
                             }} className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-secondary"/>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {publicProjects.map(project => (
                                 <div key={project.id} className="relative group aspect-video bg-brand-light rounded-lg flex flex-col items-center justify-center text-gray-400 p-2">
                                    <IconRocket className="w-12 h-12" />
                                    <span className="text-xs mt-2 text-center break-all">{project.name.replace('.brmp', '')}</span>
                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                                        <p className="text-xs text-white truncate">{project.name}</p>
                                        <div className="flex justify-end gap-2">
                                            <Button onClick={() => setEditingAsset(project)} className="!p-2"><IconEdit className="w-4 h-4" /></Button>
                                            <Button onClick={() => handleDeletePublicProject(project)} className="!p-2 !bg-red-600 hover:!bg-red-500"><IconTrash className="w-4 h-4" /></Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            );
            case 'plans': 
                const selectedPlan = plans.find(p => p.id === selectedPlanId);
                return (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-semibold mb-2">Planos</h3>
                            <div className="space-y-2">
                                {plans.sort((a,b) => a.name.localeCompare(b.name)).map(plan => <button key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className={`w-full text-left p-3 rounded-md ${selectedPlanId === plan.id ? 'bg-brand-primary' : 'bg-brand-light'}`}>{plan.name}</button>)}
                            </div>
                        </div>
                        {selectedPlan && (
                        <div className="md:col-span-2 space-y-4">
                             <h3 className="text-lg font-semibold mb-2">Gerenciar Plano: {selectedPlan.name}</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-300">Créditos de Vídeo (Mensal)</label>
                                    <input type="number" value={selectedPlan.video_credits_monthly} onChange={(e) => setPlans(prev => prev.map(p => p.id === selectedPlanId ? {...p, video_credits_monthly: Number(e.target.value)} : p))} className="w-full bg-brand-light p-2 rounded mt-1"/>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-300">Armazenamento (GB)</label>
                                    <input type="number" value={selectedPlan.storage_limit_gb} onChange={(e) => setPlans(prev => prev.map(p => p.id === selectedPlanId ? {...p, storage_limit_gb: Number(e.target.value)} : p))} className="w-full bg-brand-light p-2 rounded mt-1"/>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-300">Download (GB/Mês)</label>
                                    <input type="number" value={selectedPlan.download_limit_gb} onChange={(e) => setPlans(prev => prev.map(p => p.id === selectedPlanId ? {...p, download_limit_gb: Number(e.target.value)} : p))} className="w-full bg-brand-light p-2 rounded mt-1"/>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-300">Dias de Teste (0 para ilimitado)</label>
                                    <input type="number" value={selectedPlan.trial_days || ''} onChange={(e) => setPlans(prev => prev.map(p => p.id === selectedPlanId ? {...p, trial_days: e.target.value ? Number(e.target.value) : null} : p))} className="w-full bg-brand-light p-2 rounded mt-1"/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-gray-300">Link de Pagamento Stripe</label>
                                    <input type="text" value={selectedPlan.stripe_payment_link || ''} onChange={(e) => setPlans(prev => prev.map(p => p.id === selectedPlanId ? {...p, stripe_payment_link: e.target.value} : p))} className="w-full bg-brand-light p-2 rounded mt-1"/>
                                </div>
                                <div className="md:col-span-2">
                                    <h4 className="font-semibold text-gray-300 mb-2">Módulos Acessíveis</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto bg-brand-dark p-2 rounded">
                                        {features.map(feature => (
                                            <label key={feature.id} className="flex items-center gap-2 p-1">
                                                <input type="checkbox" checked={planFeatures[selectedPlanId]?.includes(feature.id) || false} onChange={(e) => handlePlanFeatureChange(selectedPlanId, feature.id, e.target.checked)} className="w-4 h-4 rounded"/>
                                                <span>{feature.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                             </div>
                             <Button onClick={() => handleSavePlan(selectedPlan)} primary>Salvar Alterações</Button>
                        </div>
                        )}
                    </div>
                );
            case 'kiwify':
                return <KiwifyManager />;
            case 'personalizacao':
                // O conteúdo real será movido para ThemeCustomizationView
                return <div>Carregando personalização...</div>;
            default: return null;
        }
    };

    const TABS: { id: AdminTab, label: string }[] = [
        { id: 'users', label: 'Utilizadores' },
        { id: 'media', label: 'Galeria Mídias' },
        { id: 'fonts', label: 'Galeria Fontes' },
        { id: 'presets', label: 'Galeria Pre-Definições' },
        { id: 'publicProjects', label: 'Modelos Públicos' },
        { id: 'plans', label: 'Planos e Permissões' },
        { id: 'kiwify', label: 'Kiwify' },
    ];

    return (
        <>
            <EditUserModal user={editingUser} plans={plans} onClose={() => setEditingUser(null)} onSave={handleSaveUser} />
            <EditAssetModal
                asset={editingAsset}
                isOpen={!!editingAsset}
                onClose={() => setEditingAsset(null)}
                onSave={handleSaveAsset}
                categories={
                    activeTab === 'media' ? mediaCategories :
                    activeTab === 'fonts' ? fontCategories :
                    activeTab === 'presets' ? presetCategories :
                    activeTab === 'publicProjects' ? (publicProjectCategories as any) :
                    []
                }
            />
            <div className="h-full w-full flex flex-col p-8 bg-brand-dark text-white">
                <header className="flex-shrink-0 mb-6">
                    <h1 className="text-3xl font-bold">Painel de Administração</h1>
                </header>
                 <nav className="flex items-center border-b border-brand-accent mb-6 overflow-x-auto flex-shrink-0">
                     {TABS.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 font-semibold whitespace-nowrap ${activeTab === tab.id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>{tab.label}</button>))}
                </nav>

                {isLoading ? (
                    <div className="flex-grow flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                    </div>
                ) : error ? (
                    <div className="flex-grow flex items-center justify-center text-center text-red-400">{error}</div>
                ) : (
                    <div className="flex-grow overflow-y-auto pr-2 min-h-0">
                        {renderCurrentTab()}
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminView;
