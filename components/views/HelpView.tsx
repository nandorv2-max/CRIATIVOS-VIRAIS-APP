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
                        <p>Cria imagens do zero a partir de uma descrição em texto (prompt). Quanto mais detalhado o seu prompt, melhor o resultado.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                        <p>Escreva o que você quer ver, em inglês, no campo "Comando". Use os "Potenciadores" para refinar o estilo. Escolha o tamanho e clique em "Gerar".</p>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts:</h4>
                        <CodeBlock>{`A photorealistic portrait of an ancient warrior queen, intricate silver armor, piercing blue eyes, cinematic lighting.`}</CodeBlock>
                        <CodeBlock>{`A cute, fluffy red panda wearing a tiny wizard hat, sitting on a pile of old books, magical glowing particles in the air, digital art.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Cenas do Instagram / Viagem pelo Mundo">
                        <p>Estes módulos colocam a pessoa da sua foto em um novo cenário. Ideal para criar conteúdo para redes sociais de forma rápida e criativa.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                        <p>Carregue sua foto. Para "Viagem pelo Mundo", escolha um destino. Para "Cenas do Instagram", descreva a cena desejada. Use os "Potenciadores" para melhorar o estilo e clique em "Gerar".</p>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts (para Cenas do Instagram):</h4>
                        <CodeBlock>{`Trabalhando em um café moderno e elegante, com um laptop e uma xícara de café na mesa.`}</CodeBlock>
                        <CodeBlock>{`Fazendo uma trilha em uma floresta exuberante, com raios de sol passando por entre as árvores.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Editor Profissional">
                        <p>Oferece controle manual sobre ajustes de luz, cor e efeitos, além de ferramentas de edição com IA para fazer alterações específicas na sua foto.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                        <p>Carregue uma imagem. Use os sliders na aba "Ajustes" para edições manuais. Para edições com IA, escreva um comando no campo "Edição com IA" (ex: "mude a cor da camisa para vermelho") e clique em "Editar com IA".</p>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts (para Edição com IA):</h4>
                        <CodeBlock>{`Remove the watch from the person's left wrist.`}</CodeBlock>
                        <CodeBlock>{`Change the color of the car to a metallic dark blue.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Studio Criativo">
                        <p>Sua tela em branco para projetos complexos. Crie designs completos adicionando imagens, vídeos, textos e formas em camadas. Use as ferramentas de IA para gerar imagens ou remover fundos diretamente na tela.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                         <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li><strong>Adicionar Elementos:</strong> Use a barra lateral esquerda para adicionar Texto, Formas, ou mídias da Galeria e seus Uploads.</li>
                            <li><strong>Manipular Camadas:</strong> Clique para selecionar um elemento na tela. Arraste para mover. Use as alças nos cantos para redimensionar e a alça superior para rotacionar.</li>
                            <li><strong>Painel de Propriedades (Direita):</strong> Com uma camada selecionada, ajuste sua posição (X, Y), tamanho, opacidade e outras propriedades específicas.</li>
                            <li><strong>Barra Superior:</strong> As ferramentas mudam com a seleção. Para texto, você pode mudar a fonte, cor e alinhamento. Para formas, pode alterar o preenchimento.</li>
                            <li><strong>Ferramentas de IA:</strong> Na barra lateral, use "IA Mágica" para gerar imagens a partir de um prompt ou usar o "Removedor de Fundo" em uma imagem selecionada.</li>
                            <li><strong>Salvar/Carregar:</strong> No painel de Propriedades (quando nada está selecionado), use os botões para salvar seu projeto no computador/nuvem ou carregar um projeto existente.</li>
                            <li><strong>Download:</strong> Use o botão "Fazer Download" para exportar seu design final como PNG, JPG ou MP4.</li>
                        </ol>
                    </FaqItem>
                    <FaqItem question="Gerador de Mockups">
                        <p>Cria mockups de produtos (camisetas, canecas, etc.) aplicando sua arte de forma realista.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Selecione o tipo de produto que deseja criar.</li>
                            <li>Na janela que abrir, clique para carregar sua arte (ex: seu logo, uma estampa).</li>
                            <li>Opcionalmente, adicione instruções extras para a IA.</li>
                            <li>Clique em "Gerar Mockup".</li>
                        </ol>
                    </FaqItem>
                    <FaqItem question="Estúdio de Produto">
                        <p>Cria fotos de produto profissionais, colocando seu item em um cenário virtual com iluminação de estúdio.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
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
                        <p>Anima uma foto sua, criando um vídeo curto com movimentos sutis. Ótimo para dar vida a retratos e posts.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                        <p>Carregue uma foto da pessoa. Descreva a animação desejada no campo de prompt. Escolha a proporção e o número de vídeos a serem gerados em sequência.</p>
                        <h4 className="font-semibold mt-3 text-white">Exemplos de Prompts:</h4>
                        <CodeBlock>{`Animate the person in the image. They should be talking to the camera, as if explaining something in a UGC style.`}</CodeBlock>
                        <CodeBlock>{`The person should smile gently and look around the room, with subtle, natural movements.`}</CodeBlock>
                    </FaqItem>
                    <FaqItem question="Limpar e Trocar">
                        <p>Uma ferramenta especializada para limpar a interface de capturas de tela de jogos e, opcionalmente, trocar o personagem principal por outro com características diferentes.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                         <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Carregue a captura de tela do jogo.</li>
                            <li>Selecione as características da pessoa que você quer que apareça na imagem (gênero, etnia, etc.).</li>
                            <li>Clique em "Gerar". A IA irá remover a interface e substituir o personagem automaticamente.</li>
                        </ol>
                    </FaqItem>
                    <FaqItem question="Unir (Image Blender)">
                        <p>Combina elementos de várias imagens em uma única criação coesa, guiada por um prompt.</p>
                        <h4 className="font-semibold mt-3 text-white">Como Usar:</h4>
                         <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Carregue a "Imagem Base", que servirá como referência principal de estilo e assunto.</li>
                            <li>Carregue uma ou mais "Imagens para Misturar", que contêm elementos que você quer adicionar (ex: um chapéu, um animal, um objeto).</li>
                            <li>Escreva um prompt descrevendo a cena final que você imagina.</li>
                            <li>Ajuste as configurações e clique em "Gerar".</li>
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