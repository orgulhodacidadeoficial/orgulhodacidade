# LiveModal - Transmissões ao Vivo com Chat

## 📋 O que foi implementado

O site agora possui um **modal de transmissão ao vivo** que permite:

✅ **Vídeos do YouTube incorporados** - Vídeos tocam dentro do site, não em nova aba
✅ **Chat em tempo real** - Viewers podem conversar enquanto assistem
✅ **Design responsivo** - Funciona perfeitamente em mobile, tablet e desktop
✅ **Controle fácil** - Fechar com botão ou tecla ESC

---

## 🎯 Como Funciona

### Para o Administrador (Configurar Apresentação)

1. Acesse o formulário de **Gerenciar Apresentações**
2. Preencha o campo **"Link da Transmissão (YouTube)"** com a URL do vídeo:
   - `https://youtu.be/VIDEO_ID`
   - `https://www.youtube.com/watch?v=VIDEO_ID`

3. Quando a apresentação estiver **"AGORA"** (dentro do horário), aparecerá o botão **"Assistir ao vivo"**

### Para o Visitante (Assistir à Transmissão)

1. Vá até a página inicial (index.html)
2. Procure pelo evento na seção "Próximas Apresentações"
3. Quando o evento estiver ao vivo, clique no botão **"Assistir ao vivo"**
4. O modal abrirá com:
   - Vídeo do YouTube à esquerda (full HD)
   - Chat ao vivo à direita
5. Digite uma mensagem e pressione **Enter** ou clique no botão de envio
6. Feche o modal com o **X** ou pressionando **ESC**

---

## 🏗️ Estrutura Técnica

### Arquivos Criados

```
Frontend/
├── livemodal.css      (Estilos do modal)
├── livemodal.js       (Lógica do modal e chat)
├── index.html         (MODIFICADO - importa CSS e JS)
└── events.js          (MODIFICADO - abre modal em vez de window.open)
```

### Arquivos Existentes Utilizados

- `youtube-player.js` - Gerencia a API do YouTube
- `events.js` - Gerencia apresentações e eventos

---

## 🎨 Estilo do Modal

### Desktop
```
┌─────────────────────────────────────────────┐
│ 🔴 Transmissão ao vivo               ✕      │
├─────────────────────────────────────────────┤
│                                             │
│   [    VÍDEO YOUTUBE    ]  │  💬 Chat     │
│   [    FULLSCREEN        ]  │  Mensagens   │
│   [    1400px max        ]  │              │
│                            │  [Enviar]    │
│                            │              │
└─────────────────────────────────────────────┘
```

### Mobile
```
┌─────────────────────┐
│ 🔴 Transmissão  ✕  │
├─────────────────────┤
│  [VÍDEO YOUTUBE]    │
│  [FULLSCREEN]       │
│                     │
├─────────────────────┤
│ 💬 Chat             │
│ Mensagens...        │
│ [Enviar]            │
└─────────────────────┘
```

---

## 💬 Chat

### Funcionalidades

- ✅ Armazena mensagens localmente (no navegador)
- ✅ Sincronização com servidor (opcional)
- ✅ Nickname automático ("Visitante" ou personalizado)
- ✅ Timestamps para cada mensagem
- ✅ Limite de 200 caracteres por mensagem
- ✅ Scroll automático para última mensagem

### API de Chat (Opcional)

Se implementado no servidor, o chat pode sincronizar entre múltiplos usuários:

```javascript
POST /api/chat
{
  videoId: "VIDEO_ID",
  user: "Nome do Usuário",
  text: "Mensagem aqui",
  timestamp: "14:30:45"
}

GET /api/chat?videoId=VIDEO_ID
// Retorna array de mensagens
```

---

## 🔧 Como Personalizar

### Mudar Cores

Edite `livemodal.css`:

```css
/* Cor principal (azul) */
background: linear-gradient(135deg, #0b5cff 0%, #0b3a91 100%);

/* Altere para suas cores */
background: linear-gradient(135deg, #FF8A00 0%, #FF6B00 100%);
```

### Personalizar Nickname

Para alterar o nome do usuário no chat:

```javascript
window.LiveModal.setUserName("Meu Nome");
```

Ou criar uma UI para input:

```javascript
const name = prompt("Qual é seu nome?");
if (name) window.LiveModal.setUserName(name);
```

---

## 🚀 Próximas Melhorias (Opcionais)

- [ ] Salvar chat no servidor e recuperar histórico
- [ ] Emojis e formatação de mensagens
- [ ] Moderação de chat (admin pode deletar/bloquear)
- [ ] Notificações de entrada/saída de usuários
- [ ] Reactions e likes em mensagens
- [ ] Filtro de palavras-chave
- [ ] Modo fullscreen do vídeo com overlay do chat

---

## 🐛 Troubleshooting

### Modal não abre
- Verifique se `livemodal.js` e `livemodal.css` foram importados
- Verifique console (F12) para erros

### Vídeo não toca
- Certifique-se de que `youtube-player.js` está carregado
- Verifique a URL do YouTube (deve ser válida)
- Verifique permissões de CORS

### Chat vazio
- Chat local funciona sem servidor
- Para sincronização, implemente o endpoint `/api/chat`

---

## 📞 Suporte

Para dúvidas sobre implementação, consulte:

- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [Documentação do projeto](#)

---

**Criado em:** 17 de Janeiro de 2026
**Versão:** 1.0.0
