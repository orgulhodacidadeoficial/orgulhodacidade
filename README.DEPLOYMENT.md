# 🚀 Guia de Deploy no Render

Este projeto está configurado para fazer deploy automático no Render.

## Pré-requisitos

1. **Conta no Render**: [https://render.com](https://render.com)
2. **Repositório GitHub**: [https://github.com/orgulhodacidade2/orgulhodacidade](https://github.com/orgulhodacidade2/orgulhodacidade)
3. **Banco de Dados PostgreSQL** (opcional, mas recomendado para produção)

## Passos para Deploy

### 1. Conectar GitHub ao Render

1. Acesse [https://dashboard.render.com](https://dashboard.render.com)
2. Clique em **"Create New"** → **"Web Service"**
3. Selecione **"Deploy an existing project from a Git repository"**
4. Conecte sua conta GitHub e selecione o repositório `orgulhodacidade`

### 2. Configurar o Serviço Web

No formulário de configuração, preencha:

- **Name**: `orgulho-da-cidade` (ou outro nome de sua preferência)
- **Region**: Escolha a região mais próxima (ex: São Paulo)
- **Branch**: `main`
- **Build Command**: (deixe vazio - o render.yaml será usado)
- **Start Command**: (deixe vazio - o render.yaml será usado)
- **Plan**: Escolha Free ou Paid (Free é suficiente para começar)

### 3. Definir Variáveis de Ambiente

Clique em **"Advanced"** e adicione as variáveis:

```
NODE_ENV=production
ADMIN_PASSWORD=sua-senha-forte-aqui
SESSION_SECRET=gere-uma-string-aleatoria-segura
```

**Para PostgreSQL (recomendado):**
- Crie uma instância PostgreSQL no Render
- Copie a `DATABASE_URL` fornecida
- Adicione como variável de ambiente no Web Service

**Sem PostgreSQL (SQLite local):**
- Deixe `DATABASE_URL` sem definir
- O app usará SQLite com persistência em arquivo JSON

### 4. Deploy Automático

Após salvar:

1. O Render automaticamente fará o deploy inicial
2. Qualquer push para `main` no GitHub acionará novo deploy
3. Monitore o progresso em **"Logs"** no dashboard do Render

## Arquivos de Configuração

- **`render.yaml`**: Define como compilar e rodar o app
- **`package.json`**: Dependencies e scripts
- **`.env.example`**: Template de variáveis de ambiente
- **`Dockerfile`**: Alternativa para deployment via Docker (se necessário)

## Troubleshooting

### Erro: "Cannot find module 'express'"

Certifique-se que `package.json` e `package-lock.json` estão no repositório:

```bash
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push origin main
```

### Erro: "ADMIN_PASSWORD not set"

Adicione a variável de ambiente no Render Dashboard:
- Vá para Web Service
- Environment
- Adicione `ADMIN_PASSWORD=orgulho2026` (ou outra senha)
- Clique "Save" (isso causará novo deploy)

### Banco de Dados Persistente

Para dados que não desapareçam após redeploy:

1. Crie PostgreSQL no Render
2. Copie `DATABASE_URL`
3. Adicione como variável de ambiente
4. O app automaticamente criará as tabelas

## Monitoramento

Acesse logs em tempo real:

```
Dashboard Render → Seu Serviço → Logs
```

## URLs Úteis

- **Dashboard**: https://dashboard.render.com
- **Site em Produção**: https://orgulho-da-cidade.onrender.com (ou seu domínio)
- **Painel Admin**: https://seu-dominio.onrender.com/admin-login.html

## Mais Informações

- [Documentação do Render](https://render.com/docs)
- [Guia de render.yaml](https://render.com/docs/infrastructure-as-code)
- [Deploy Node.js](https://render.com/docs/deploy-node-express-app)

---

**Última atualização**: Janeiro 2026
