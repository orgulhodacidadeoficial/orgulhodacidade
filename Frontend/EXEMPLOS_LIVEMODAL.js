/**
 * EXEMPLOS DE USO - LiveModal
 * 
 * Este arquivo contém exemplos práticos de como usar o LiveModal
 * em diferentes situações e contextos.
 */

// ============================================================================
// 1. ABRIR MODAL COM VÍDEO DO YOUTUBE
// ============================================================================

// Forma simples - com URL do YouTube
window.LiveModal.open('https://youtu.be/dQw4w9WgXcQ');

// Com título personalizado
window.LiveModal.open(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Boi Orgulho da Cidade - Apresentação 2026'
);

// ============================================================================
// 2. FECHAR O MODAL
// ============================================================================

window.LiveModal.close();

// Ou com botão HTML
document.getElementById('fechar-transmissao').addEventListener('click', () => {
    window.LiveModal.close();
});

// ============================================================================
// 3. GERENCIAR NOME DO USUÁRIO NO CHAT
// ============================================================================

// Definir nome automaticamente
window.LiveModal.setUserName('João Silva');

// Pedir nome ao usuário
const nome = prompt('Qual é seu nome?');
if (nome) {
    window.LiveModal.setUserName(nome);
}

// Recuperar nome salvo
const nomeAtual = window.LiveModal.userName;
console.log('Nome atual:', nomeAtual);

// ============================================================================
// 4. TRABALHAR COM MENSAGENS DE CHAT
// ============================================================================

// Acessar array de mensagens
console.log(window.LiveModal.messages);
// Retorna: [
//   { id: 1234567890, user: "João", text: "Oi!", timestamp: "14:30" },
//   { id: 1234567891, user: "Maria", text: "Olá!", timestamp: "14:31" }
// ]

// Enviar mensagem programaticamente
window.LiveModal.chatInput.value = 'Olá a todos!';
window.LiveModal.sendMessage();

// Limpar chat (remover todas as mensagens)
window.LiveModal.messages = [];
window.LiveModal.renderChat();

// ============================================================================
// 5. INTEGRAÇÃO COM EVENTOS
// ============================================================================

// Exemplo: Botão para abrir transmissão ao vivo
document.getElementById('btn-assistir-vivo').addEventListener('click', () => {
    const url = document.getElementById('youtube-url').value;
    const titulo = document.getElementById('evento-titulo').textContent;
    
    window.LiveModal.open(url, titulo);
});

// Exemplo: Form para adicionar transmissão
document.getElementById('form-transmissao').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const youtubeUrl = document.getElementById('input-youtube-url').value;
    const nomeEvento = document.getElementById('input-nome-evento').value;
    
    // Validar URL
    if (!youtubeUrl.includes('youtube') && !youtubeUrl.includes('youtu.be')) {
        alert('Por favor, insira uma URL válida do YouTube');
        return;
    }
    
    // Abrir modal
    window.LiveModal.open(youtubeUrl, nomeEvento);
});

// ============================================================================
// 6. CUSTOMIZAÇÕES AVANÇADAS
// ============================================================================

// Acessar elementos do DOM do modal
const overlay = window.LiveModal.overlay;
const container = window.LiveModal.container;
const videoContainer = window.LiveModal.videoContainer;
const chatMessages = window.LiveModal.chatMessages;
const chatInput = window.LiveModal.chatInput;

// Exemplo: Adicionar listener customizado quando modal abre
const originalOpen = window.LiveModal.open.bind(window.LiveModal);
window.LiveModal.open = async function(url, title) {
    console.log('Modal abrindo:', title);
    
    // Fazer algo antes de abrir
    document.body.classList.add('modal-ativo');
    
    // Chamar função original
    await originalOpen(url, title);
    
    // Fazer algo depois de abrir
    console.log('Modal aberto com sucesso');
};

// ============================================================================
// 7. SINCRONIZAR COM SERVIDOR (Opcional)
// ============================================================================

// Se implementar endpoints no servidor:

// Antes de abrir, carregar histórico de mensagens
async function abrirTransmissaoComHistorico(url, titulo, videoId) {
    // Abrir modal
    window.LiveModal.open(url, titulo);
    
    // Carregar histórico
    try {
        const response = await fetch(`/api/chat?videoId=${videoId}`);
        const mensagens = await response.json();
        window.LiveModal.messages = mensagens;
        window.LiveModal.renderChat();
    } catch (error) {
        console.log('Histórico não disponível');
    }
}

// Usar:
// abrirTransmissaoComHistorico(
//     'https://youtu.be/VIDEO_ID',
//     'Apresentação Especial',
//     'VIDEO_ID'
// );

// ============================================================================
// 8. VERIFICAR ESTADO DO MODAL
// ============================================================================

// Saber se modal está aberto
const modalAberto = window.LiveModal.overlay.classList.contains('active');
console.log('Modal aberto?', modalAberto);

// Conhecer vídeo atual
console.log('Vídeo atual:', window.LiveModal.currentVideoId);

// Contagem de mensagens
console.log('Total de mensagens:', window.LiveModal.messages.length);

// ============================================================================
// 9. FECHAR MODAL COM ESC (Já implementado)
// ============================================================================

// Já funciona automaticamente quando pressiona ESC
// Mas se quiser adicionar mais validação:

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        console.log('ESC pressionado, fechando modal...');
        window.LiveModal.close();
    }
});

// ============================================================================
// 10. EXEMPLO COMPLETO - Integração em Página de Evento
// ============================================================================

/*
HTML:
<div class="evento">
    <h2 id="evento-titulo">Apresentação 2026</h2>
    <p id="evento-descricao">...</p>
    <button id="btn-assistir" class="btn-primario">Assistir ao Vivo</button>
    <button id="btn-definir-nome" class="btn-secundario">Meu Nome</button>
</div>

JavaScript:
*/

class EventoAoVivo {
    constructor(eventoId) {
        this.eventoId = eventoId;
        this.evento = null;
        this.init();
    }
    
    async init() {
        // Carregar dados do evento
        this.evento = await this.carregarEvento();
        this.setupEventListeners();
    }
    
    async carregarEvento() {
        // Simular carregamento do servidor
        return {
            id: this.eventoId,
            nome: 'Boi Orgulho da Cidade',
            youtubeUrl: 'https://youtu.be/VIDEO_ID',
            horarioInicio: '18:00',
            horarioFim: '20:00'
        };
    }
    
    setupEventListeners() {
        document.getElementById('btn-assistir').addEventListener('click', () => {
            this.abrirTransmissao();
        });
        
        document.getElementById('btn-definir-nome').addEventListener('click', () => {
            this.pedirNome();
        });
    }
    
    abrirTransmissao() {
        if (!this.evento.youtubeUrl) {
            alert('Transmissão não disponível no momento');
            return;
        }
        
        window.LiveModal.open(this.evento.youtubeUrl, this.evento.nome);
    }
    
    pedirNome() {
        const nome = prompt('Qual é seu nome?', window.LiveModal.userName);
        if (nome) {
            window.LiveModal.setUserName(nome);
            alert('Nome atualizado para: ' + nome);
        }
    }
}

// Usar:
// const evento = new EventoAoVivo(1);

// ============================================================================
// 11. TRATAMENTO DE ERROS
// ============================================================================

// Wrapping seguro
function abrirModalSeguro(url, titulo) {
    try {
        // Validar URL
        if (!url || typeof url !== 'string') {
            throw new Error('URL inválida');
        }
        
        // Validar se é YouTube
        if (!url.includes('youtu')) {
            throw new Error('Deve ser uma URL do YouTube');
        }
        
        // Validar título
        titulo = titulo || 'Transmissão ao vivo';
        
        // Abrir
        window.LiveModal.open(url, titulo);
        console.log('Modal aberto com sucesso');
        
    } catch (error) {
        console.error('Erro ao abrir modal:', error.message);
        alert('Não foi possível abrir a transmissão: ' + error.message);
    }
}

// ============================================================================
// 12. MONITORAR ATIVIDADE DO CHAT
// ============================================================================

// Saber quando usuário envia mensagem
const originalSendMessage = window.LiveModal.sendMessage.bind(window.LiveModal);
window.LiveModal.sendMessage = function() {
    const mensagem = this.chatInput.value;
    console.log('Mensagem enviada:', mensagem);
    
    // Chamar original
    originalSendMessage();
    
    // Fazer algo depois (ex: analytics)
    this.rastrearMensagem(mensagem);
};

window.LiveModal.rastrearMensagem = function(mensagem) {
    // Enviar para analytics, servidor, etc
    console.log('Analytics: mensagem enviada no chat');
};

// ============================================================================
// 13. RESPONDER AO FECHAR MODAL
// ============================================================================

const originalClose = window.LiveModal.close.bind(window.LiveModal);
window.LiveModal.close = function() {
    console.log('Modal fechando...');
    
    // Fazer algo antes de fechar
    const totalMensagens = this.messages.length;
    console.log('Total de mensagens nesta sessão:', totalMensagens);
    
    // Chamar original
    originalClose();
    
    // Fazer algo depois de fechar
    console.log('Modal fechado');
};

// ============================================================================
// 14. FORMATO DE MENSAGENS
// ============================================================================

// Estrutura de uma mensagem no chat:
/*
{
    id: 1705537800000,           // Timestamp Unix em ms
    user: "João Silva",          // Nome do usuário
    text: "Olá a todos!",        // Texto da mensagem
    timestamp: "14:30:45"        // Hora formatada (pt-BR)
}
*/

// ============================================================================
// 15. DOCUMENTAÇÃO INLINE
// ============================================================================

/**
 * Abre o modal de transmissão ao vivo
 * @param {string} youtubeUrl - URL do vídeo do YouTube
 * @param {string} title - Título da transmissão (opcional, padrão: "Transmissão ao vivo")
 * @returns {Promise<void>}
 * 
 * @example
 * window.LiveModal.open('https://youtu.be/dQw4w9WgXcQ', 'Meu Evento');
 */

/**
 * Fecha o modal
 * @returns {void}
 * 
 * @example
 * window.LiveModal.close();
 */

/**
 * Define o nome do usuário para o chat
 * @param {string} name - Nome do usuário
 * @returns {void}
 * 
 * @example
 * window.LiveModal.setUserName('João Silva');
 */

/**
 * Envia uma mensagem no chat
 * @returns {void}
 * 
 * @example
 * window.LiveModal.chatInput.value = 'Olá!';
 * window.LiveModal.sendMessage();
 */

// ============================================================================
// FIM DOS EXEMPLOS
// ============================================================================

console.log('%c LiveModal - Exemplos carregados', 'background: #0b5cff; color: white; padding: 5px 10px; border-radius: 3px;');
