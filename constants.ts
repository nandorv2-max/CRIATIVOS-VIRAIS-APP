import type { Templates } from './types';

export const TEMPLATES: Templates = {
    criativo: {
        name: 'Criativo',
        description: 'Crie anúncios com um editor interativo.',
        icon: '💥',
        isPolaroid: false,
        prompts: []
    },
    criativoViral: {
        name: 'Criativo Viral',
        description: 'Crie designs com fotos, vídeos e áudio.',
        icon: '🚀',
        isPolaroid: false,
        prompts: []
    },
    video: {
        name: 'Vídeo',
        description: 'Crie sequências de vídeos a partir de uma foto.',
        icon: '🎬',
        isPolaroid: false,
        prompts: []
    },
    cenasDoInstagram: {
        name: 'Cenas do Instagram',
        description: 'Descreva uma cena e crie 6 fotos para as suas redes.',
        icon: '✨',
        isPolaroid: false,
        prompts: []
    },
    worldTour: {
        name: 'Viagem pelo Mundo', description: 'Escolha um destino e veja-se lá.', icon: '🌍', isPolaroid: true,
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
        isPolaroid: false,
        prompts: []
    },
    cleanAndSwap: {
        name: 'Limpar e Trocar', description: 'Remova itens de interface e troque a pessoa da foto.', icon: '🧹', isPolaroid: false,
        prompts: [{ id: 'Resultado', base: 'Imagem limpa e com a pessoa trocada' }]
    }
};