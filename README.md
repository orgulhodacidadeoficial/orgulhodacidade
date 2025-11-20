# 🎪 Boi Orgulho da Cidade - Website

Website oficial do Boi Orgulho da Cidade com informações sobre apresentações, fotos, músicas e inscrições para seletivas.

## 🚀 Como Rodar

### Pré-requisitos
- Node.js (v14+)
- npm ou yarn

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/orgulhodacidade2/orgulhodacidade.git
cd orgulhodacidade

# Instalar dependências
npm install

# Iniciar o servidor
npm start
```

O servidor estará disponível em `http://localhost:3000`

## 📁 Estrutura do Projeto

```
├── Frontend/          # Arquivos HTML, CSS, JS e imagens
├── backend/           # Servidor Node.js e API
├── data/              # Arquivos JSON (banco de dados)
└── package.json       # Dependências do projeto
```

### Frontend (`/Frontend`)
- **HTML**: Páginas principais (index, fotos, músicas, etc.)
- **CSS**: Estilos responsivos
- **JS**: Lógica do cliente
- **images/**: Imagens e ícones
- **audio/**: Arquivos de áudio

### Backend (`/backend`)
- **server.js**: Servidor Express.js
- **uploads/**: Arquivos enviados pelo usuário

### Data (`/data`)
- **inscricoes.json**: Dados de inscrições
- **contatos.json**: Mensagens de contato
- **contratacoes.json**: Solicitações de contratação
- **events.json**: Eventos e apresentações
- **photos.json**: Metadados de fotos
- **stories.json**: Histórias/notícias
- **users.json**: Usuários registrados
- **playlist-sync.json**: Playlist de músicas

## 🔐 Admin

Para acessar a área de administrador:
1. Vá para `http://localhost:3000/admin-login.html`
2. Defina a senha via variável de ambiente `ADMIN_PASSWORD` (veja `.env.example`).
	- Em desenvolvimento, se `ADMIN_PASSWORD` não for definida o valor padrão de desenvolvimento será usado (não recomendado).

No painel de admin você pode:
- Gerenciar inscrições
- Ver mensagens de contato
- Gerenciar fotos e galerias
- Editar eventos e apresentações
- Gerenciar playlist de músicas

## 📚 Funcionalidades

- ✅ **Galeria de Fotos**: Visualize fotos dos eventos
- ✅ **Reprodutor de Músicas**: Ouça as músicas do boi
- ✅ **Inscrições**: Sistema de inscrição para seletivas 2026
- ✅ **Contato**: Formulário de contato e contratação
- ✅ **Painel Admin**: Gerencie todo o conteúdo

## 📦 Dependências

- **express**: Framework web
- **express-session**: Gerenciamento de sessões
- **multer**: Upload de arquivos
- **body-parser**: Parsing de requisições
- **cors**: Suporte a CORS
- **ws**: WebSocket para sincronização em tempo real
- **sharp**: Processamento de imagens

## 🌐 Deployment

### Heroku
```bash
git push heroku main
```

### Seu servidor pessoal
```bash
npm start
```

Define `PORT` via variável de ambiente se necessário:
```bash
PORT=8000 npm start
```

## 📝 Notas

- Os dados são persistidos em arquivos JSON em `/data`
- Imagens são servidas de `/Frontend/images`
- Arquivos enviados vão para `/backend/uploads`
 - A senha de admin deve ser configurada usando a variável `ADMIN_PASSWORD` (veja `.env.example`).

## 🤝 Contribuições

Para contribuir:
1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona minha feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## 📄 Licença

ISC

## 👥 Autor

Orgulho da Cidade Team

---

**Site**: [Boi Orgulho da Cidade](http://www.orgulhodacidade.com.br)
