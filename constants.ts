import type { Templates } from './types.ts';
import { IconSparkles, IconRocket, IconMovie, IconInstagram, IconWorld, IconTools, IconBroom, IconCombine, IconImageIcon, IconTshirt, IconPackage, IconMagicWand, IconLayers, IconBrush, IconStyleTransfer } from './components/Icons.tsx';

export const MASTER_USERS = ['helioarreche@gmail.com', 'nandorv2@gmail.com', 'nandorv3@gmail.com'];

export const TEMPLATES: Templates = {
    imageGenerator: {
        name: 'Gerador de Imagem',
        description: 'Crie imagens a partir de descrições de texto.',
        icon: '🖼️',
        sidebarIcon: IconImageIcon,
        isPolaroid: false,
        prompts: []
    },
    mockupGenerator: {
        name: 'Gerador de Mockups',
        description: 'Crie mockups de produtos com a sua arte.',
        icon: '👕',
        sidebarIcon: IconLayers,
        isPolaroid: false,
        prompts: []
    },
    productStudio: {
        name: 'Estúdio de Produto',
        description: 'Crie cenas de produtos com um clique.',
        icon: '📦',
        sidebarIcon: IconPackage,
        isPolaroid: false,
        prompts: []
    },
    studioCriativo: {
        name: 'Studio Criativo',
        description: 'Um editor completo para criar designs com fotos, vídeos, texto e IA.',
        icon: '🚀',
        sidebarIcon: IconBrush,
        isPolaroid: false,
        prompts: []
    },
    video: {
        name: 'Vídeo',
        description: 'Crie sequências de vídeos a partir de uma foto.',
        icon: '🎬',
        sidebarIcon: IconMovie,
        isPolaroid: false,
        prompts: []
    },
    cenasDoInstagram: {
        name: 'Cenas do Instagram',
        description: 'Descreva uma cena e crie fotos para as suas Redes Sociais.',
        icon: '✨',
        sidebarIcon: IconInstagram,
        isPolaroid: false,
        prompts: []
    },
    sceneRecreator: {
        name: 'Recriador de Cenas',
        description: 'Recrie o estilo e a cena de uma foto de inspiração com a sua própria imagem.',
        icon: '🪄',
        sidebarIcon: IconStyleTransfer,
        isPolaroid: false,
        prompts: []
    },
    worldTour: { name: 'Viagem pelo Mundo', description: 'Escolha um destino e veja-se lá.', icon: '🌍', sidebarIcon: IconWorld, isPolaroid: true,
        // FIX: Added missing 'prompts' property to satisfy the 'Template' interface.
        prompts: [],
        destinations: [
            { id: 'Paris', prompts: [ { id: 'Torre Eiffel', base: 'a posar em frente à Torre Eiffel ao pôr do sol, com roupa de turista estilosa' }, { id: 'Museu do Louvre', base: 'a caminhar casualmente em frente à pirâmide do Museu do Louvre, segurando um café' }, { id: 'Rio Sena', base: 'num cruzeiro de barco no Rio Sena, com a Catedral de Notre-Dame ao fundo' }, { id: 'Montmartre', base: 'sentado num café pitoresco em Montmartre, com a Basílica de Sacré-Cœur visível na colina' }, { id: 'Arco do Trifo', base: 'uma foto espontânea atravessando a rua na Champs-Élysées com o Arco do Trifo ao fundo' }, { id: 'Jardim de Luxemburgo', base: 'a relaxar numa cadeira verde no Jardim de Luxemburgo, com o palácio ao fundo' } ] },
            { id: 'Roma', prompts: [ { id: 'Coliseu', base: 'a posar perto do Coliseu, com roupas leves de verão e óculos de sol' }, { id: 'Fonte de Trevi', base: 'a atirar uma moeda sobre o ombro na Fonte de Trevi, com uma multidão desfocada' }, { id: 'Vaticano', base: 'de pé na Praça de São Pedro no Vaticano, com a Basílica ao fundo' }, { id: 'Panteão', base: 'a olhar para o óculo do Panteão, com um raio de luz a iluminar' }, { id: 'Trastevere', base: 'a comer um gelado numa rua de paralelepípedos em Trastevere' }, { id: 'Fórum Romano', base: 'a caminhar por entre as ruínas antigas do Fórum Romano' } ] },
            { id: 'Nova Iorque', prompts: [ { id: 'Times Square', base: 'a posar em Times Square à noite, rodeado por ecrãs LED brilhantes' }, { id: 'Ponte do Brooklyn', base: 'a caminhar na Ponte do Brooklyn com o horizonte de Manhattan ao fundo' }, { id: 'Central Park', base: 'a fazer um piquenique no Central Park com arranha-céus visíveis por entre as árvores' }, { id: 'Estátua da Liberdade', base: 'numa balsa com a Estátua da Liberdade em primeiro plano' }, { id: 'Empire State Building', base: 'no topo do Empire State Building, a olhar para a cidade' }, { id: 'Grand Central', base: 'de pé no meio do átrio principal da Estação Grand Central, com pessoas a passar em movimento' } ] },
            { id: 'Dubai', prompts: [ { id: 'Burj Khalifa', base: 'de pé em frente ao Burj Khalifa no Dubai, com roupa de luxo' }, { id: 'Safari no Deserto', base: 'num safari no deserto ao pôr do sol, com um lenço na cabeça e dunas de areia à volta' }, { id: 'Dubai Mall', base: 'a fazer compras no Dubai Mall com o aquário ao fundo' }, { id: 'Palm Jumeirah', base: 'a relaxar numa praia em Palm Jumeirah com o hotel Atlantis ao fundo' }, { id: 'Dubai Marina', base: 'num iate na Dubai Marina à noite, com os arranha-céus iluminados' }, { id: 'Souk de Ouro', base: 'a olhar para as vitrinas brilhantes no Souk de Ouro' } ] },
            { id: 'Luxo no Brasil', prompts: [ { id: 'Rooftop em São Paulo', base: 'a socializar num bar de rooftop sofisticado em São Paulo, com o horizonte da cidade iluminado à noite ao fundo.' }, { id: 'Resort em Gaspar', base: 'a relaxar numa cabana privada à beira da piscina num resort de luxo em Gaspar, Santa Catarina.' }, { id: 'Iate em Florianópolis', base: 'a bordo de um iate na costa de Florianópolis, SC, a desfrutar da vista para o mar.' }, { id: 'Cabana em Garopaba', base: 'numa cabana de luxo em Garopaba, Santa Catarina, com vista para o mar e um deck de madeira.' }, { id: 'Inverno em Gramado', base: 'a desfrutar do clima de inverno em Gramado, RS, bem vestido, perto de uma lareira ou com a arquitetura europeia da cidade ao fundo.' }, { id: 'Supercarro em Balneário Camboriú', base: 'a posar com um supercarro desportivo cuja cor complementa a sua roupa, com os arranha-céus de Balneário Camboriú, Brasil, ao fundo.' } ] },
        ]
    },
    editor: {
        name: 'Editor Profissional',
        description: 'Ajustes manuais e edições com IA.',
        icon: '🛠️',
        sidebarIcon: IconTools,
        isPolaroid: false,
        prompts: []
    },
    cleanAndSwap: {
        name: 'Limpar e Trocar', description: 'Remova itens de interface e troque a pessoa da foto.', icon: '🧹', sidebarIcon: IconBroom, isPolaroid: false,
        prompts: [{ id: 'Resultado', base: 'Imagem limpa e com a pessoa trocada' }]
    },
    unir: {
        name: 'Unir',
        description: 'Combine elementos de várias imagens em uma só.',
        icon: '🔗',
        sidebarIcon: IconCombine,
        isPolaroid: false,
        prompts: []
    }
};

export const ENHANCER_CATEGORIES = [
    {
        name: 'Textura Fotográfica',
        options: [
            { term: 'photo-realistic', label: 'Realismo Fotográfico' },
            { term: 'high-resolution texture', label: 'Textura de Alta Resolução' },
            { term: 'sharp facial skin details', label: 'Detalhes Nítidos da Pele' },
            { term: 'visible pores, sweat, dirt', label: 'Poros, Suor, Sujidade Visíveis' },
            { term: 'realistic fabric folds', label: 'Dobras de Tecido Realistas' },
            { term: 'realistic hair strands', label: 'Fios de Cabelo Realistas' },
            { term: 'photographic lighting', label: 'Iluminação Fotográfica' },
            { term: 'natural surface imperfections', label: 'Imperfeições Naturais' },
            { term: 'subsurface scattering on skin', label: 'Translucidez da Pele (Subsurface Scattering)' },
            { term: 'film grain texture', label: 'Textura de Grão de Filme' },
        ]
    },
    {
        name: 'Iluminação Cinematográfica',
        options: [
            { term: 'cinematic lighting', label: 'Iluminação Cinematográfica' },
            { term: 'golden hour lighting', label: 'Luz da Golden Hour' },
            { term: 'backlighting', label: 'Contraluz (Backlighting)' },
            { term: 'soft diffused lighting', label: 'Luz Suave e Difusa' },
            { term: 'hard light with deep shadows', label: 'Luz Dura com Sombras Profundas' },
            { term: 'volumetric light beams', label: 'Feixes de Luz Volumétricos' },
            { term: 'neon lighting', label: 'Iluminação de Néon' },
            { term: 'color graded lighting', label: 'Iluminação com Correção de Cor' },
            { term: 'reflected lighting', label: 'Luz Refletida (Indireta)' },
            { term: 'realistic shadows and reflections', label: 'Sombras e Reflexos Realistas' },
        ]
    },
    {
        name: 'Direção de Câmera',
        options: [
            { term: 'shallow depth of field', label: 'Pouca Profundidade de Campo' },
            { term: 'low angle shot', label: 'Ângulo Baixo (Low Angle)' },
            { term: 'high angle shot', label: 'Ângulo Alto (High Angle)' },
            { term: 'over-the-shoulder shot', label: 'Câmera sobre o Ombro' },
            { term: 'wide-angle cinematic shot', label: 'Plano Amplo Cinematográfico' },
            { term: 'shot with ARRI Alexa', label: 'Estilo Câmera ARRI Alexa' },
            { term: 'shot with RED Komodo 6K', label: 'Estilo Câmera RED Komodo 6K' },
            { term: 'film grain', label: 'Grão de Filme' },
            { term: 'lens flare', label: 'Brilho de Lente (Lens Flare)' },
            { term: 'cinematic camera tilt', label: 'Inclinação de Câmera Cinematográfica' },
        ]
    },
    {
        name: 'Texturas de Ambiente',
        options: [
            { term: 'cracked concrete', label: 'Concreto Rachado' },
            { term: 'rusted metal surfaces', label: 'Superfícies de Metal Enferrujado' },
            { term: 'moss-covered buildings', label: 'Edifícios Cobertos de Musgo' },
            { term: 'broken glass reflecting light', label: 'Vidro Quebrado Refletindo Luz' },
            { term: 'wet asphalt texture', label: 'Textura de Asfalto Molhado' },
            { term: 'dust in the air', label: 'Poeira no Ar' },
            { term: 'muddy terrain', label: 'Terreno Lamacento' },
            { term: 'peeling paint walls', label: 'Paredes com Tinta a Descascar' },
            { term: 'fog or smoke layering', label: 'Névoa ou Fumaça em Camadas' },
            { term: 'burnt debris', label: 'Detritos Queimados' },
        ]
    },
    {
        name: 'Cores e Estilo Visual',
        options: [
            { term: 'desaturated warm color palette', label: 'Cores Quentes Dessaturadas' },
            { term: 'subtle cinematic color grading', label: 'Correção de Cor Cinematográfica' },
            { term: 'orange and teal tones', label: 'Tons Laranja e Azul' },
            { term: 'muted tones', label: 'Tons Suaves (Muted)' },
            { term: 'cold blue lighting', label: 'Iluminação Azul Fria' },
            { term: 'high contrast coloring', label: 'Cores de Alto Contraste' },
            { term: 'monochromatic color scheme', label: 'Esquema Monocromático' },
            { term: 'pastel cinematic tones', label: 'Tons Pastel Cinematográficos' },
            { term: 'natural color balance', label: 'Balanço de Cor Natural' },
            { term: 'sepia or aged film tone', label: 'Tom Sépia / Filme Envelhecido' },
        ]
    },
    {
        name: 'Tipo de Câmera e Lente',
        options: [
            { term: 'Shot on iPhone 15 Pro, professional photo', label: 'Câmera de iPhone 15 Pro' },
            { term: 'Canon EOS R5 with 50mm f/1.2 lens', label: 'Canon EOS R5, Lente 50mm' },
            { term: 'Sony A7R IV with 85mm f/1.4 G Master lens', label: 'Sony A7R IV, Lente 85mm' },
            { term: 'Leica M11 with 35mm Summilux lens', label: 'Leica M11, Lente 35mm' },
            { term: 'Hasselblad X2D 100C medium format', label: 'Hasselblad (Formato Médio)' },
            { term: 'Fujifilm X-T5, film simulation look', label: 'Fujifilm X-T5 (Sim. de Filme)' },
            { term: 'Cinematic Anamorphic Lens', label: 'Lente Anamórfica Cinematográfica' },
            { term: 'Telephoto Lens, compressed background', label: 'Lente Teleobjetiva (Fundo Comprimido)' },
            { term: 'Wide-Angle Lens', label: 'Lente Grande Angular' },
            { term: 'Drone Shot, aerial view', label: 'Foto de Drone, Vista Aérea' },
        ]
    },
    {
        name: 'Ângulo da Câmera e Ponto de Vista',
        options: [
            { term: 'Frontal shot', label: 'Frontal' },
            { term: 'Diagonal shot', label: 'Diagonal' },
            { term: 'Low-angle shot', label: 'Low-angle (de baixo)' },
            { term: 'High-angle shot', label: 'High-angle (de cima)' },
            { term: 'Overhead shot (90 degrees from above)', label: 'Overhead (90° de cima)' },
            { term: 'Dutch angle', label: 'Dutch angle (inclinada)' },
            { term: 'Close-up shot', label: 'Close-up' },
            { term: 'Wide shot', label: 'Wide shot (amplo)' },
            { term: 'POV (point of view)', label: 'POV (ponto de vista)' },
            { term: 'Tilted up shot', label: 'Tilted up (levemente de baixo)' },
            { term: 'Behind the subject shot', label: 'Por trás do sujeito' },
        ]
    },
    {
        name: 'Efeitos Visuais',
        options: [
            { term: 'Lens scratches', label: 'Arranhões na Lente' },
            { term: 'Bloom', label: 'Bloom (brilho suave)' },
            { term: 'Floating dust', label: 'Poeira Flutuante' },
            { term: 'Chromatic aberration', label: 'Aberração Cromática' },
            { term: 'Soft grain', label: 'Grão de Filme Suave' },
            { term: 'Vignette', label: 'Vignette (vinheta)' },
            { term: 'Light leaks', label: 'Light Leaks' },
            { term: 'Motion blur', label: 'Motion Blur (desfoque de movimento)' },
            { term: 'Color bleeding', label: 'Color Bleeding' },
            { term: 'Texture overlay', label: 'Sobreposição de Textura' },
            { term: 'Noise', label: 'Ruído (Noise)' },
            { term: 'Glow', label: 'Glow (brilho)' },
            { term: 'Bokeh', label: 'Bokeh' },
            { term: 'Double exposure', label: 'Dupla Exposição' },
            { term: 'Backlight flare', label: 'Backlight Flare' },
        ]
    },
    {
        name: 'Estilos Visuais',
        options: [
            { term: 'Minimalist modern', label: 'Moderno Minimalista' },
            { term: 'Brutalist elegant', label: 'Brutalista Elegante' },
            { term: 'Vintage cinematic', label: 'Cinematográfico Vintage' },
            { term: 'Cyberpunk futuristic', label: 'Cyberpunk Futurista' },
            { term: 'Fashion editorial', label: 'Editorial de Moda' },
            { term: 'Organic naturalistic', label: 'Orgânico Naturalista' },
            { term: 'Surreal artistic', label: 'Surreal Artístico' },
            { term: 'Flash paparazzi 2000s', label: 'Flash Paparazzi Anos 2000' },
        ]
    }
];