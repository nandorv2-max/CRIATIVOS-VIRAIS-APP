import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconChevronDown } from '../Icons.tsx';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-12">
        <h2 className="text-3xl font-bold text-brand-primary mb-6 pb-3 border-b-2 border-brand-accent">{title}</h2>
        <div className="space-y-4">{children}</div>
    </div>
);

const FaqItem: React.FC<{ question: string; children: React.ReactNode }> = ({ question, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="bg-brand-light/50 border border-brand-accent/50 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-left font-semibold text-lg"
            >
                <span>{question}</span>
                <IconChevronDown className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                        <div className="p-4 pt-0 text-gray-300 leading-relaxed space-y-4 border-t border-brand-accent/50">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="bg-brand-dark p-3 rounded-md text-sm overflow-x-auto font-mono border border-brand-accent">
        <code>{children}</code>
    </pre>
);

export const helpContent = `
# Configuração Essencial
## Como obter minha Chave de API do Google?
Para usar os recursos de IA, você precisa de uma chave de API do Google. É grátis para começar.
1. Acesse o Google AI Studio.
2. Faça login com sua conta Google.
3. Clique em "Get API Key".
4. Clique em "Create API key in new project".
5. Copie a chave gerada.
6. No nosso app, cole a chave quando solicitado.

## Por que e como configurar o faturamento no Google?
O nível gratuito da API do Google tem limites. Para uso contínuo, ative o faturamento no Google Cloud Console. Você só paga pelo que usar acima do limite gratuito.
1. Acesse o Google Cloud Console Billing.
2. Selecione o projeto criado pelo AI Studio.
3. Siga as instruções para vincular uma conta de faturamento.

# Guia dos Módulos
## Gerador de Imagem
Cria imagens a partir de texto (prompt).
- Como Usar: Escreva uma descrição em inglês no campo "Comando". Use "Potenciadores" para refinar o estilo. Escolha o tamanho e clique em "Gerar".
- Exemplo de Prompt: "A photorealistic portrait of an ancient warrior queen, intricate silver armor, piercing blue eyes, cinematic lighting."

## Cenas do Instagram / Viagem pelo Mundo
Coloca a pessoa da sua foto em um novo cenário.
- Como Usar: Carregue sua foto. Para "Viagem pelo Mundo", escolha um destino. Para "Cenas do Instagram", descreva a cena. Use "Potenciadores" e clique em "Gerar".
- Exemplo de Prompt (Cenas do Instagram): "Trabalhando em um café moderno e elegante, com um laptop."

## Editor Profissional
Oferece ajustes manuais e edições com IA.
- Como Usar: Carregue uma imagem. Use os sliders em "Ajustes" para edições manuais. Para IA, descreva a alteração em "Edição com IA" (em inglês) e clique em "Editar com IA".
- Exemplo de Prompt (Edição com IA): "Remove the watch from the person's left wrist."

## Studio Criativo
Editor completo para designs com múltiplas camadas.
- Como Usar:
  1. Adicionar Elementos: Use a barra lateral esquerda (Uploads, Galeria, Texto, Elementos).
  2. Manipular Camadas: Clique para selecionar, arraste para mover, use as alças para redimensionar/rotacionar.
  3. Editar Propriedades: Use o painel da direita para ajustes finos (tamanho, posição, opacidade).
  4. Ferramentas de IA: Na barra lateral, use "IA Mágica" para gerar imagens ou remover fundos.
  5. Salvar/Carregar: No painel da direita (sem nada selecionado), salve seu projeto como um arquivo .brmp.
  6. Download: Exporte o resultado final como PNG, JPG ou MP4.

## Gerador de Mockups
Aplica sua arte em produtos como camisetas, canecas, etc.
- Como Usar: Selecione o produto, carregue sua arte (logo, estampa), adicione instruções se necessário e clique em "Gerar Mockup".

## Estúdio de Produto
Cria fotos de produto profissionais em cenários virtuais.
- Como Usar: Carregue a imagem do seu produto. Descreva a cena, escolha a perspectiva e a iluminação. Clique em "Gerar Cena".
- Exemplo de Cena: "Um frasco de perfume sobre uma mesa de mármore preto, com pétalas de rosa ao redor."

## Vídeo
Anima uma foto, criando um vídeo curto.
- Como Usar: Carregue uma foto. Descreva a animação desejada (em inglês). Escolha a proporção e clique em "Gerar Sequência".
- Exemplo de Prompt: "Animate the person in the image. They should be talking to the camera, as if explaining something in a UGC style."

## Limpar e Trocar
Remove a interface de capturas de tela de jogos e troca o personagem.
- Como Usar: Carregue a captura de tela. Selecione as características da nova pessoa. Clique em "Gerar".

## Unir (Image Blender)
Combina elementos de várias imagens em uma só.
- Como Usar: Carregue uma "Imagem Base" e "Imagens para Misturar". Descreva a cena final no "Prompt" e clique em "Gerar".
- Exemplo: Imagem Base (homem no sofá) + Imagem para Misturar (chapéu) + Prompt "O homem no sofá agora está usando o chapéu".
`;

const HelpView: React.FC = () => {
    return (
        <div className="h-full w-full overflow-y-auto p-6 md:p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
            >
                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-bold">Central de Ajuda e Tutoriais</h1>
                    <p className="mt-2 text-lg text-gray-400">Tudo o que você precisa para começar a criar com IA.</p>
                </header>

                <Section title="Configuração Essencial">
                    <FaqItem question="Como obter minha Chave de API do Google?">
                        <p>Para usar os recursos de IA, você precisa de uma chave de API do Google. É grátis para começar.</p>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-secondary underline font-semibold">Google AI Studio clicando aqui</a>.</li>
                            <li>Faça login com sua conta Google.</li>
                            <li>Clique em <strong>"Get API Key"</strong> (Obter chave de API).</li>
                            <li>Clique em <strong>"Create API key in new project"</strong> (Criar chave de API em um novo projeto).</li>
                            <li>Copie a chave gerada (um longo código de letras e números).</li>
                            <li>No nosso app, quando a tela de "Chave de API" aparecer, cole a chave no campo indicado e continue.</li>
                        </ol>
                    </FaqItem>
                    <FaqItem question="Por que e como configurar o faturamento no Google?">
                        <p>O nível gratuito da API do Google é generoso, mas possui limites de uso. Para evitar interrupções e ter acesso a mais capacidade, você pode ativar o faturamento no seu projeto Google Cloud. Você só será cobrado pelo que usar acima do limite gratuito.</p>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Acesse o <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="text-brand-secondary underline font-semibold">Google Cloud Console Billing clicando aqui</a>.</li>
                            <li>No topo da página, certifique-se de que o projeto selecionado é o mesmo que foi criado pelo AI Studio (geralmente chamado "Generative Language Client...").</li>
                            <li>Siga as instruções para criar ou vincular uma conta de faturamento ao seu projeto. Você precisará de um cartão de crédito.</li>
                            <li>Após a configuração, a API continuará funcionando sem os limites do nível gratuito.</li>
                        </ol>
                    </FaqItem>
                </Section>

                <Section title="Guia dos Módulos">
                    <FaqItem question="Gerador de Imagem">
                        <p>Cria imagens do zero a partir de uma descrição em texto (prompt).</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>No campo "Comando", escreva uma descrição detalhada da imagem que você quer criar (em inglês).</li>
                            <li>Opcional: Expanda as seções de "Potenciadores" para adicionar estilos específicos (iluminação, tipo de câmera, etc.).</li>
                            <li>Selecione o "Tamanho da Imagem" desejado.</li>
                            <li>Clique em "Gerar Imagem" e aguarde o resultado.</li>
                        </ol>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts:</h4>
                        <CodeBlock>{`A photorealistic portrait of an ancient warrior queen, intricate silver armor, piercing blue eyes, cinematic lighting.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Cenas do Instagram / Viagem pelo Mundo">
                        <p>Coloca a pessoa da sua foto em um novo cenário. Ideal para criar conteúdo para redes sociais.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Clique em "Carregar Foto" e envie uma imagem sua.</li>
                            <li>Para "Viagem pelo Mundo", selecione um destino na lista.</li>
                            <li>Para "Cenas do Instagram", descreva o cenário onde você quer que a pessoa esteja.</li>
                            <li>Opcional: Use os "Potenciadores" para refinar o estilo da imagem final.</li>
                            <li>Ajuste o "Número de Imagens" que deseja gerar.</li>
                            <li>Clique em "Gerar Imagens".</li>
                        </ol>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts (para Cenas do Instagram):</h4>
                        <CodeBlock>{`Trabalhando em um café moderno e elegante, com um laptop e uma xícara de café na mesa.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Editor Profissional">
                        <p>Oferece controle manual sobre ajustes de luz, cor e efeitos, além de ferramentas de edição com IA.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Clique em "Carregar Imagem" para enviar a foto que deseja editar.</li>
                            <li><strong>Para ajustes manuais:</strong> Na aba "Ajustes", use os sliders para controlar exposição, contraste, cores, etc.</li>
                            <li><strong>Para edições com IA:</strong> No campo "Edição com IA", descreva a alteração que você quer fazer (em inglês).</li>
                            <li>Clique em "Editar com IA".</li>
                            <li><strong>Para aplicar efeitos rápidos:</strong> Use a barra de ferramentas na parte inferior da imagem para aplicar efeitos como "Desfocar Fundo".</li>
                        </ol>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts (para Edição com IA):</h4>
                        <CodeBlock>{`Remove the watch from the person's left wrist.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Studio Criativo">
                        <p>Sua tela em branco para projetos complexos. Crie designs com imagens, vídeos, textos e IA.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                         <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li><strong>Adicionar Mídia:</strong> Na barra lateral esquerda, clique em "Uploads" para enviar suas imagens/vídeos ou "Galeria" para usar mídias prontas. Arraste o item desejado para a tela.</li>
                            <li><strong>Adicionar Texto/Formas:</strong> Use as abas "Texto" e "Elementos" na barra lateral para adicionar esses itens.</li>
                            <li><strong>Manipular Camadas:</strong> Clique em um item na tela para selecioná-lo. Arraste para mover. Use as alças para redimensionar e rotacionar.</li>
                            <li><strong>Editar Propriedades:</strong> Com um item selecionado, o painel da direita mostrará suas propriedades (tamanho, posição, etc.). A barra superior mostrará opções de contexto (cor do texto, fonte, etc.).</li>
                            <li><strong>Remover Fundo:</strong> Selecione uma imagem, vá para "IA Mágica" na barra lateral e clique em "Removedor de Fundo".</li>
                            <li><strong>Adicionar Fontes/Presets:</strong> Na barra superior, com uma camada de texto selecionada, clique no seletor de fontes e depois em "Adicionar Fonte".</li>
                            <li><strong>Salvar Projeto:</strong> No painel da direita (sem nada selecionado), clique em "Salvar Projeto" para salvá-lo na nuvem ou no seu computador (arquivo .brmp).</li>
                            <li><strong>Carregar Projeto:</strong> No mesmo painel, clique em "Carregar Projeto" para abrir um projeto salvo.</li>
                            <li><strong>Exportar:</strong> Clique em "Fazer Download" para exportar seu trabalho final como imagem ou vídeo.</li>
                        </ol>
                    </FaqItem>
                    <FaqItem question="Gerador de Mockups">
                        <p>Cria mockups de produtos (camisetas, canecas, etc.) aplicando sua arte de forma realista.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Selecione o tipo de produto que deseja criar.</li>
                            <li>Na janela que abrir, clique para carregar sua arte (ex: seu logo, uma estampa).</li>
                            <li>Opcionalmente, adicione instruções extras para a IA (ex: "coloque a arte um pouco mais para cima").</li>
                            <li>Clique em "Gerar Mockup".</li>
                        </ol>
                    </FaqItem>
                    <FaqItem question="Estúdio de Produto">
                        <p>Cria fotos de produto profissionais, colocando seu item em um cenário virtual com iluminação de estúdio.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Carregue uma imagem do seu produto (de preferência com fundo neutro).</li>
                            <li>Descreva a cena onde o produto deve ser inserido.</li>
                            <li>Escolha a perspectiva da câmera e o tipo de iluminação.</li>
                            <li>Clique em "Gerar Cena".</li>
                        </ol>
                        <h4 className="font-semibold mt-3 text-white">Exemplo de Descrição de Cena:</h4>
                        <CodeBlock>{`Um frasco de perfume sobre uma mesa de mármore preto, com algumas pétalas de rosa vermelha espalhadas ao redor e uma iluminação suave vindo da lateral.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Vídeo">
                        <p>Anima uma foto sua, criando um vídeo curto com movimentos sutis.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Carregue uma foto da pessoa que será animada.</li>
                            <li>No campo de prompt, descreva em inglês como a pessoa deve se mover.</li>
                            <li>Escolha a "Proporção" (ex: 9:16 para Stories).</li>
                            <li>Defina o "Número de Vídeos" para criar uma sequência.</li>
                            <li>Clique em "Gerar Sequência".</li>
                        </ol>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts:</h4>
                        <CodeBlock>{`Animate the person in the image. They should be talking to the camera, as if explaining something in a UGC style.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Limpar e Trocar">
                        <p>Limpa a interface de capturas de tela de jogos e, opcionalmente, troca o personagem principal.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                         <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Carregue a captura de tela do jogo.</li>
                            <li>Selecione as características da nova pessoa que você quer que apareça na imagem.</li>
                            <li>Clique em "Gerar". A IA irá remover a interface e substituir o personagem.</li>
                        </ol>
                    </FaqItem>
                    <FaqItem question="Unir (Image Blender)">
                        <p>Combina elementos de várias imagens em uma única criação coesa, guiada por um prompt.</p>
                        <h4 className="font-semibold mt-3 text-white">Passo a Passo:</h4>
                         <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Carregue a "Imagem Base" (a imagem principal).</li>
                            <li>Carregue uma ou mais "Imagens para Misturar" (com os elementos a adicionar).</li>
                            <li>No campo "Prompt", descreva a cena final, explicando como combinar os elementos.</li>
                            <li>Ajuste as "Definições" e clique em "Gerar".</li>
                        </ol>
                        <h4 className="font-semibold mt-3 text-white">Exemplo de Uso:</h4>
                        <p><strong>Imagem Base:</strong> Foto de um homem em um sofá. <br/><strong>Imagem para Misturar:</strong> Foto de um chapéu de cowboy. <br/><strong>Prompt:</strong> "O homem no sofá agora está usando o chapéu de cowboy."</p>
                    </FaqItem>
                </Section>
            </motion.div>
        </div>
    );
};

export default HelpView;