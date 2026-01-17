# 📊 Estrutura de Dados - LiveModal

## 🏗️ Objeto LiveModal

```javascript
window.LiveModal = {
    // Elementos DOM
    overlay: HTMLElement,           // Div com class 'live-modal-overlay'
    container: HTMLElement,         // Div com class 'live-modal-container'
    closeBtn: HTMLElement,          // Botão de fechar (X)
    videoContainer: HTMLElement,    // Container do vídeo YouTube
    chatMessages: HTMLElement,      // Area de mensagens do chat
    chatInput: HTMLInputElement,    // Input de nova mensagem
    chatSendBtn: HTMLButtonElement, // Botão de envio
    
    // Estado
    currentVideoId: String,         // ID do vídeo YouTube atual
    messages: Array,                // Array de mensagens [Mensagem]
    userName: String,               // Nome do usuário (salvo em localStorage)
    
    // Métodos
    init(): void,                   // Inicializa o modal
    open(url, title): Promise,      // Abre modal com vídeo
    close(): void,                  // Fecha o modal
    createModal(): void,            // Cria estrutura HTML
    setupEventListeners(): void,    // Configura listeners
    loadUserName(): void,           // Carrega nome salvo
    loadVideo(videoId): Promise,    // Carrega vídeo via YouTube API
    extractVideoId(url): String,    // Extrai ID da URL
    sendMessage(): void,            // Envia mensagem
    renderChat(): void,             // Renderiza mensagens na tela
    saveChatToServer(msg): Promise, // Salva no servidor (opcional)
    loadChatFromServer(): Promise,  // Carrega do servidor (opcional)
    setUserName(name): void,        // Define nome do usuário
    escapeHtml(text): String        // Escape HTML contra XSS
}
```

---

## 💬 Estrutura de Mensagem

```javascript
{
    id: Number,           // Timestamp Unix em ms (ex: 1705540200000)
    user: String,         // Nome do usuário (ex: "João Silva")
    text: String,         // Texto da mensagem (ex: "Olá a todos!")
    timestamp: String     // Hora formatada (ex: "14:30:45")
}

// Exemplo prático:
{
    id: 1705540200000,
    user: "João Silva",
    text: "Olá a todos!",
    timestamp: "14:30:45"
}
```

---

## 📋 Array de Mensagens

```javascript
window.LiveModal.messages = [
    {
        id: 1705540200000,
        user: "João Silva",
        text: "Olá a todos!",
        timestamp: "14:30:45"
    },
    {
        id: 1705540205000,
        user: "Maria Santos",
        text: "Oi João! Como vai?",
        timestamp: "14:30:50"
    },
    {
        id: 1705540210000,
        user: "João Silva",
        text: "Tudo bem, obrigado!",
        timestamp: "14:30:55"
    }
]
```

---

## 🎥 Estrutura do Modal HTML

```html
<div class="live-modal-overlay active">
    <div class="live-modal-container">
        
        <!-- Header -->
        <div class="live-modal-header">
            <h2 class="live-modal-title">Apresentação 2026</h2>
            <button class="live-modal-close-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <!-- Content: Vídeo + Chat -->
        <div class="live-modal-content">
            
            <!-- Vídeo YouTube -->
            <div class="live-modal-video-container">
                <div id="youtubePlayer"></div>
            </div>
            
            <!-- Chat -->
            <div class="live-modal-chat-container">
                
                <!-- Header do Chat -->
                <div class="live-modal-chat-header">
                    <i class="fas fa-comments"></i> Chat ao vivo
                </div>
                
                <!-- Mensagens -->
                <div class="live-modal-chat-messages">
                    <div class="live-modal-chat-message">
                        <div>
                            <span class="live-modal-chat-user">João Silva</span>
                            <span class="live-modal-chat-timestamp">14:30</span>
                        </div>
                        <div class="live-modal-chat-text">Olá a todos!</div>
                    </div>
                    <!-- Mais mensagens... -->
                </div>
                
                <!-- Input -->
                <div class="live-modal-chat-input-container">
                    <input 
                        type="text" 
                        class="live-modal-chat-input" 
                        placeholder="Enviar mensagem..."
                    />
                    <button class="live-modal-chat-send-btn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
```

---

## 🔄 Fluxo de Dados

### Abrir Modal
```
User.click("Assistir ao vivo")
    ↓
checkLiveStatus() [events.js]
    ↓
LiveModal.open(url, title)
    ↓
extractVideoId(url)
    ↓
YouTubePlayer.initPlayer(videoId)
    ↓
Modal abre + Vídeo toca
    ↓
Chat limpo e pronto
```

### Enviar Mensagem
```
User.type("Olá mundo!")
    ↓
User.press(Enter)
    ↓
sendMessage()
    ↓
Criar objeto Mensagem
    ↓
messages.push(mensagem)
    ↓
renderChat()
    ↓
Mensagem aparece na tela
    ↓
saveChatToServer() [opcional]
```

### Fechar Modal
```
User.press(ESC) ou click(X) ou click(overlay)
    ↓
close()
    ↓
YouTubePlayer.stopVideo()
    ↓
overlay.classList.remove('active')
    ↓
Modal desaparece
```

---

## 💾 Armazenamento Local

### LocalStorage
```javascript
localStorage.getItem('liveModalUserName')
// Retorna: "João Silva"

localStorage.setItem('liveModalUserName', 'João Silva')
```

### Mensagens
```javascript
// Armazenadas em memória (RAM)
window.LiveModal.messages = [...]

// Perdidas ao fechar o modal (por design)
// Ideal para chat em tempo real
```

---

## 🌐 Estrutura de Evento (events.json)

```javascript
{
    id: 1,
    nome: "Boi Orgulho da Cidade",
    dia: "2026-01-20",
    dia_fim: "2026-01-21",
    inicio: "18:00",
    termino: "20:00",
    local: "Praça Central, São Luís - MA",
    youtube: "https://youtu.be/dQw4w9WgXcQ",
    descricao: "..."
}
```

---

## 🔌 API de Chat (Servidor - Opcional)

### POST /api/chat
```javascript
Request:
{
    videoId: "dQw4w9WgXcQ",
    user: "João Silva",
    text: "Olá a todos!",
    timestamp: "14:30:45"
}

Response:
{
    success: true,
    message: "Mensagem salva"
}
```

### GET /api/chat
```javascript
Query: ?videoId=dQw4w9WgXcQ

Response:
[
    { id: 1, user: "João", text: "Olá!", timestamp: "14:30" },
    { id: 2, user: "Maria", text: "Oi!", timestamp: "14:31" }
]
```

---

## 🎨 Estrutura de Estilos (CSS)

```css
/* Classes principais */
.live-modal-overlay                    /* Background escuro */
.live-modal-overlay.active             /* Quando modal está aberto */
.live-modal-container                  /* Container principal */
.live-modal-header                     /* Header com título */
.live-modal-title                      /* Título do evento */
.live-modal-close-btn                  /* Botão X */
.live-modal-content                    /* Container vídeo + chat */
.live-modal-video-container            /* Container do vídeo */
.live-modal-chat-container             /* Container do chat */
.live-modal-chat-header                /* Header do chat */
.live-modal-chat-messages              /* Area de mensagens */
.live-modal-chat-message               /* Uma mensagem */
.live-modal-chat-user                  /* Nome do usuário */
.live-modal-chat-text                  /* Texto da mensagem */
.live-modal-chat-timestamp             /* Hora da mensagem */
.live-modal-chat-input-container       /* Input area */
.live-modal-chat-input                 /* Campo de texto */
.live-modal-chat-send-btn              /* Botão enviar */
```

---

## 📱 Responsive Breakpoints

```css
/* Desktop */
@media (min-width: 1024px) {
    .live-modal-content {
        flex-direction: row;    /* Horizontal */
    }
    .live-modal-chat-container {
        width: 320px;           /* Fixo */
    }
}

/* Tablet */
@media (max-width: 1024px) {
    .live-modal-container {
        height: 90vh;           /* Menor altura */
    }
    .live-modal-chat-container {
        width: 280px;           /* Menor largura */
    }
}

/* Mobile */
@media (max-width: 768px) {
    .live-modal-content {
        flex-direction: column; /* Vertical */
    }
    .live-modal-chat-container {
        width: 100%;            /* Full width */
        height: 200px;          /* Altura fixa */
    }
}
```

---

## 🔐 Validações

### URL do YouTube
```javascript
// Válidas:
"https://youtu.be/VIDEO_ID"
"https://www.youtube.com/watch?v=VIDEO_ID"
"https://www.youtube.com/embed/VIDEO_ID"

// Inválidas:
"https://youtube.com/playlist?list=..."  // Playlist
"https://invalid-url.com"                 // Outro site
"VIDEO_ID"                                // Sem protocolo
```

### Nome do Usuário
```javascript
// Válido: String não vazio (máximo sem limite definido)
"João Silva"
"Maria"
"👤 Visitante"

// Inválido: Vazio ou undefined
""
null
undefined
```

### Mensagem
```javascript
// Válido: String com máximo 200 caracteres
"Olá mundo!"

// Inválido: Vazio ou > 200 caracteres
""
"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris..."
```

---

## 📊 Performance

| Métrica | Valor |
|---------|-------|
| Tamanho CSS | 7.2 KB |
| Tamanho JS | 12.1 KB |
| Tempo inicial | < 100ms |
| Memória (chat 100 msgs) | ~50 KB |
| Animações FPS | 60 |

---

## 🔗 Integração com Sistemas Externos

### YouTube IFrame API
```javascript
window.YT.Player()                  // Gerenciador do vídeo
player.playVideo()                  // Tocar
player.pauseVideo()                 // Pausar
player.stopVideo()                  // Parar
player.destroy()                    // Destruir
```

### LocalStorage API
```javascript
localStorage.setItem(key, value)    // Salvar
localStorage.getItem(key)           // Recuperar
localStorage.removeItem(key)        // Deletar
localStorage.clear()                // Limpar tudo
```

### Fetch API (Para servidor)
```javascript
fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
})
```

---

**Documentação de Estrutura Completa** ✅
**Data:** 17 de Janeiro de 2026
