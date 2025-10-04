import React from 'react';
import { motion } from 'framer-motion';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-12">
        <h2 className="text-2xl font-bold text-brand-primary mb-4 pb-2 border-b-2 border-brand-accent">{title}</h2>
        <div className="space-y-6 text-gray-300 leading-relaxed">{children}</div>
    </section>
);

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
                    <div>
                        <h3 className="text-xl font-semibold mb-2">Como Obter sua Chave de API do Google</h3>
                        <p>Para usar os recursos de IA, você precisa de uma chave de API do Google. É grátis para começar.</p>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-secondary underline">Google AI Studio</a>.</li>
                            <li>Faça login com sua conta Google.</li>
                            <li>Clique em <strong>"Get API Key"</strong> (Obter chave de API).</li>
                            <li>Clique em <strong>"Create API key in new project"</strong> (Criar chave de API em um novo projeto).</li>
                            <li>Copie a chave gerada.</li>
                            <li>No nosso app, cole a chave quando for solicitado.</li>
                        </ol>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-2">Como Configurar o Faturamento (Para Uso Avançado)</h3>
                        <p>O nível gratuito da API do Google é generoso, mas para evitar limites de uso, você pode ativar o faturamento no seu projeto.</p>
                        <ol className="list-decimal list-inside mt-2 space-y-1 pl-4">
                            <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-secondary underline">Google Cloud Console</a>.</li>
                            <li>No topo da página, selecione o projeto que foi criado pelo AI Studio (geralmente chamado "Generative Language Client...").</li>
                            <li>No menu de navegação (☰), vá para <strong>"Faturamento"</strong>.</li>
                            <li>Siga as instruções para vincular uma conta de faturamento ao seu projeto.</li>
                        </ol>
                    </div>
                </Section>

                <Section title="Guia dos Módulos">
                    <div>
                        <h3 className="text-xl font-semibold mb-2">Gerador de Imagem</h3>
                        <p>Cria imagens do zero a partir de uma descrição em texto. Quanto mais detalhado o seu prompt, melhor o resultado.</p>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts:</h4>
                        <CodeBlock>{`A photorealistic portrait of an ancient warrior queen, intricate silver armor, piercing blue eyes, cinematic lighting.`}</CodeBlock>
                        <CodeBlock>{`A cute, fluffy red panda wearing a tiny wizard hat, sitting on a pile of old books, magical glowing particles in the air, digital art.`}</CodeBlock>
                    </div>
                     <div>
                        <h3 className="text-xl font-semibold mb-2">Cenas do Instagram / Viagem pelo Mundo</h3>
                        <p>Coloca a pessoa da sua foto em um novo cenário. Ideal para criar conteúdo para redes sociais.</p>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts (para Cenas do Instagram):</h4>
                        <CodeBlock>{`Trabalhando em um café moderno e elegante, com um laptop e uma xícara de café na mesa.`}</CodeBlock>
                        <CodeBlock>{`Fazendo uma trilha em uma floresta exuberante, com raios de sol passando por entre as árvores.`}</CodeBlock>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-2">Editor Profissional</h3>
                        <p>Oferece controle manual sobre ajustes de luz, cor e efeitos, além de ferramentas de edição com IA para fazer alterações específicas na sua foto.</p>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts (para Edição com IA):</h4>
                        <CodeBlock>{`Remove the watch from the person's left wrist.`}</CodeBlock>
                        <CodeBlock>{`Change the color of the car to a metallic dark blue.`}</CodeBlock>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-2">Vídeo</h3>
                        <p>Anima uma foto sua, criando um vídeo curto. Ótimo para dar vida a retratos.</p>
                        <h4 className="font-semibold mt-2">Exemplos de Prompts:</h4>
                        <CodeBlock>{`Animate the person in the image. They should be talking to the camera, as if explaining something in a UGC style.`}</CodeBlock>
                        <CodeBlock>{`The person should smile gently and look around the room, with subtle, natural movements.`}</CodeBlock>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-2">Studio Criativo</h3>
                        <p>Sua tela em branco. Crie designs completos adicionando imagens, vídeos, textos e formas. Use as ferramentas de IA para gerar imagens ou remover fundos.</p>
                    </div>
                </Section>
            </motion.div>
        </div>
    );
};

export default HelpView;