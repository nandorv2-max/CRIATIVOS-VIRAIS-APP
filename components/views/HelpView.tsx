' character.">
import React from 'react';
import { motion } from 'framer-motion';
import { IconChevronDown } from '../Icons.tsx';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-12">
        <h2 className="text-2xl font-bold text-brand-primary mb-4 pb-2 border-b-2 border-brand-accent">{title}</h2>
        <div className="space-y-4">{children}</div>
    </section>
);

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="bg-brand-dark p-3 rounded-md text-sm overflow-x-auto font-mono border border-brand-accent">
        <code>{children}</code>
    </pre>
);

const AccordionItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <details className="bg-brand-light/50 border border-brand-accent/50 rounded-lg overflow-hidden group">
        <summary className="p-4 font-semibold cursor-pointer hover:bg-brand-accent/50 flex justify-between items-center">
            {title}
            <IconChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="p-4 border-t border-brand-accent/50 text-gray-300 leading-relaxed space-y-4">
            {children}
        </div>
    </details>
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
                    <AccordionItem title="Como Obter sua Chave de API do Google (Passo a Passo Detalhado)">
                        <p>Para usar os recursos de IA, você precisa de uma chave de API do Google. O processo é simples e gratuito para começar.</p>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-secondary underline">Google AI Studio</a> e faça login com sua conta Google.</li>
                            <li>Na página principal, você verá a seção "API key". Clique no botão <strong>"Get API Key"</strong> (Obter chave de API).</li>
                            <li>Uma nova janela se abrirá. Clique em <strong>"Create API key in new project"</strong> (Criar chave de API em um novo projeto).</li>
                            <li>Sua chave será gerada e exibida. Ela é uma longa sequência de letras e números. Clique no ícone de cópia ao lado dela.</li>
                            <li>Volte para o nosso aplicativo. Se for seu primeiro acesso, uma tela solicitará a chave. Cole-a no campo indicado e clique em "Continuar".</li>
                            <li>Se você já estiver logado, vá para <strong>Configurações</strong> (no menu do seu perfil) &gt; <strong>Conta e Plano</strong> e clique em <strong>"Gerir Chave de API"</strong> para colar sua nova chave.</li>
                        </ol>
                        <p className="mt-4 text-sm text-yellow-400"><strong>Importante:</strong> Sua chave de API é secreta. Não a compartilhe publicamente. Ela fica salva apenas no seu navegador.</p>
                    </AccordionItem>
                    <AccordionItem title="Como Configurar o Faturamento (Opcional, para Uso Avançado)">
                        <p>A API do Google oferece um limite generoso de uso gratuito. No entanto, para uso intensivo ou para garantir que você nunca seja interrompido por limites, você pode ativar o faturamento no seu projeto do Google Cloud.</p>
                        <ol className="list-decimal list-inside mt-2 space-y-2 pl-4">
                            <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-secondary underline">Google Cloud Console</a>.</li>
                            <li>No topo da página, clique no seletor de projetos (geralmente ao lado do logo do Google Cloud).</li>
                            <li>Encontre e selecione o projeto que foi criado automaticamente pelo AI Studio. O nome geralmente começa com "Generative Language Client...".</li>
                            <li>Com o projeto selecionado, clique no menu de navegação (☰) no canto superior esquerdo e selecione <strong>"Faturamento"</strong>.</li>
                            <li>Siga as instruções para "Vincular uma conta de faturamento" ou "Criar conta de faturamento". Você precisará de um cartão de crédito.</li>
                        </ol>
                        <p className="mt-4 text-sm text-yellow-400"><strong>Nota:</strong> Ativar o faturamento não significa que você será cobrado imediatamente. Você ainda se beneficia dos limites gratuitos, e só será cobrado pelo uso que exceder esses limites.</p>
                    </AccordionItem>
                </Section>

                <Section title="Guia dos Módulos">
                    <AccordionItem title="Gerador de Imagem">
                        <p>Cria imagens de alta qualidade a partir de uma descrição em texto (prompt). Você pode especificar o estilo, cores, iluminação e muito mais.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Escreva seu prompt em inglês no campo "Comando".</li>
                            <li>Escolha o tamanho da imagem desejada (quadrado, retrato, etc.).</li>
                            <li>Use os "Potenciadores" para refinar o estilo da imagem (opcional).</li>
                            <li>Clique em "Gerar Imagem".</li>
                        </ol>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts:</h4>
                        <CodeBlock>{`A cinematic, wide-angle shot of a futuristic city at night, neon lights reflecting on wet streets, flying cars, Blade Runner style.`}</CodeBlock>
                        <CodeBlock>{`Macro photograph of a single raindrop on a leaf, showing intricate details and reflections, soft morning light.`}</CodeBlock>
                    </AccordionItem>

                    <AccordionItem title="Cenas do Instagram / Viagem pelo Mundo">
                        <p>Estes módulos usam sua foto como base para criar novas imagens. A IA identifica a pessoa na sua foto e a coloca em um novo cenário descrito por você.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Carregue uma foto sua de boa qualidade, onde seu rosto esteja bem visível.</li>
                            <li>Para "Viagem pelo Mundo", selecione um destino.</li>
                            <li>Para "Cenas do Instagram", descreva a cena que você quer criar.</li>
                            <li>Ajuste o número de imagens e o tamanho.</li>
                            <li>Clique em "Gerar Imagens".</li>
                        </ol>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts (Cenas do Instagram):</h4>
                        <CodeBlock>{`Relaxando em uma rede em uma praia tropical, com um coco na mão.`}</CodeBlock>
                        <CodeBlock>{`Lendo um livro em uma biblioteca antiga e majestosa, com prateleiras altas cheias de livros.`}</CodeBlock>
                    </AccordionItem>

                    <AccordionItem title="Editor Profissional">
                        <p>Uma ferramenta poderosa para edição de fotos. Permite ajustes manuais finos (luz, cor, etc.) e edições complexas usando IA.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Carregue a imagem que deseja editar.</li>
                            <li>Use os sliders na aba "Ajustes" para corrigir cores e luz.</li>
                            <li>Na seção "Edição com IA", descreva a alteração que deseja fazer (em inglês).</li>
                            <li>Clique em "Editar com IA" para aplicar a mudança.</li>
                            <li>Use a aba "Predefinições" para aplicar filtros prontos ou importar os seus.</li>
                        </ol>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts (Edição com IA):</h4>
                        <CodeBlock>{`Make the sky look like a dramatic sunset.`}</CodeBlock>
                        <CodeBlock>{`Add a small, subtle tattoo of a dragon on the person's arm.`}</CodeBlock>
                    </AccordionItem>

                    <AccordionItem title="Vídeo">
                        <p>Anima uma foto estática para criar um pequeno clipe de vídeo. Ideal para dar vida a retratos e avatares.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Carregue uma foto de rosto (frontal e bem iluminada funciona melhor).</li>
                            <li>Descreva a animação desejada no campo de prompt.</li>
                            <li>Escolha a proporção e o número de vídeos a serem gerados em sequência.</li>
                            <li>Clique em "Gerar Sequência".</li>
                        </ol>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts:</h4>
                        <CodeBlock>{`The person should smile gently and nod, as if agreeing with someone.`}</CodeBlock>
                        <CodeBlock>{`A subtle animation of the person looking from side to side, with natural eye movement.`}</CodeBlock>
                    </AccordionItem>

                    <AccordionItem title="Studio Criativo">
                        <p>Seu editor de design completo. Crie composições do zero usando imagens, vídeos, textos, formas e elementos gerados por IA. É como um Canva com superpoderes.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Comece com uma tela em branco ou carregue um projeto.</li>
                            <li>Use a barra lateral esquerda para adicionar elementos: faça upload de suas mídias, adicione textos, formas ou gere imagens com IA.</li>
                            <li>Selecione qualquer elemento na tela para ver suas propriedades na barra lateral direita.</li>
                            <li>Use a linha do tempo na parte inferior para criar designs com múltiplas páginas ou vídeos.</li>
                            <li>Quando terminar, clique em "Fazer Download" para exportar seu projeto.</li>
                        </ol>
                    </AccordionItem>
                    
                    <AccordionItem title="Gerador de Mockups">
                        <p>Aplique sua arte, logo ou design em uma variedade de produtos, como camisetas, canecas e capas de celular, criando fotos de produto realistas.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Selecione o tipo de produto que deseja usar como mockup.</li>
                            <li>Na janela que abrir, carregue sua arte (imagem com fundo transparente funciona melhor).</li>
                            <li>Adicione instruções opcionais, se necessário (ex: "coloque a logo no centro do peito").</li>
                            <li>Clique em "Gerar Mockup".</li>
                        </ol>
                    </AccordionItem>

                    <AccordionItem title="Estúdio de Produto">
                        <p>Tire uma foto do seu produto (mesmo com um fundo ruim) e a IA irá recortá-lo e colocá-lo em um cenário profissional descrito por você.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Carregue uma imagem do seu produto.</li>
                            <li>Descreva a cena onde o produto deve ser inserido.</li>
                            <li>Escolha a perspectiva da câmera e o tipo de iluminação.</li>
                            <li>Clique em "Gerar Cena".</li>
                        </ol>
                        <h4 className="font-semibold mt-2">Exemplos de Descrição de Cena:</h4>
                        <CodeBlock>{`A bottle of wine on a rustic wooden table, with grapes and a block of cheese next to it.`}</CodeBlock>
                        <CodeBlock>{`A sneaker placed on a glowing neon pedestal in a dark, futuristic room.`}</CodeBlock>
                    </AccordionItem>

                    <AccordionItem title="Unir (Image Blender)">
                        <p>Combine elementos de várias imagens em uma única criação. A IA entende o que há em cada foto e os funde de forma coesa.</p>
                        <h4 className="font-semibold mt-2">Como Usar:</h4>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Carregue a "Imagem Base", que servirá como referência principal de estilo e assunto.</li>
                            <li>Carregue uma ou mais "Imagens para Misturar", contendo os elementos que você quer adicionar.</li>
                            <li>Escreva um prompt descrevendo a cena final que você imagina.</li>
                            <li>Clique em "Gerar".</li>
                        </ol>
                        <h4 className="font-semibold mt-2">Exemplo de Uso:</h4>
                        <p><strong>Imagem Base:</strong> Foto de um gato. <br/> <strong>Imagem para Misturar:</strong> Foto de um chapéu de pirata. <br/> <strong>Prompt:</strong> "Um gato usando um chapéu de pirata, em um navio antigo."</p>
                    </AccordionItem>
                </Section>
            </motion.div>
        </div>
    );
};

export default HelpView;