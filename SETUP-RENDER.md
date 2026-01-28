# 🚀 Setup Completo para Deploy no Render

Este guia passo-a-passo irá te levar através do processo de fazer deploy do Boi Orgulho da Cidade no Render.

## ✅ Pré-requisitos

- [ ] Conta GitHub com acesso ao repositório `orgulhodacidade`
- [ ] Conta no Render (https://render.com)
- [ ] Chave SSH ou Token de acesso ao GitHub configurado

## 📋 Etapa 1: Preparar o GitHub

### 1.1 Sincronizar o Repositório Local

```bash
# No diretório do projeto
git status
git add .
git commit -m "Setup final para deploy no Render"
git push origin main
```

**Arquivos que devem estar no GitHub:**
- ✅ `package.json` e `package-lock.json`
- ✅ `render.yaml`
- ✅ `Dockerfile` (opcional, mas incluído)
- ✅ `backend/server.js`
- ✅ `Frontend/` (HTML, CSS, JS)
- ✅ `.env.example` (sem senhas reais)
- ✅ `.gitignore` (correto para Node.js)

### 1.2 Arquivos que NÃO devem estar no GitHub

Verifique se estão no `.gitignore`:
- ❌ `.env` (arquivo local com senhas)
- ❌ `node_modules/`
- ❌ `data/*.db` (banco de dados local)
- ❌ `backend/uploads/` (arquivos enviados)

## 🎯 Etapa 2: Configurar no Render

### 2.1 Criar um Novo Web Service

1. Acesse https://dashboard.render.com
2. Clique em **"New"** → **"Web Service"**
3. Selecione **"Deploy from a Git repository"**
4. Busque por `orgulhodacidade` e clique em **"Connect"**

### 2.2 Preencher as Configurações

| Campo | Valor |
|-------|-------|
| **Name** | `orgulho-da-cidade` |
| **Runtime** | Node |
| **Region** | Brasil (São Paulo) |
| **Branch** | `main` |
| **Build Command** | *(deixar vazio - usa render.yaml)* |
| **Start Command** | *(deixar vazio - usa render.yaml)* |

### 2.3 Definir Variáveis de Ambiente

Clique em **"Advanced"** e configure as variáveis:

```
NODE_ENV          production
PORT              3000
ADMIN_PASSWORD    [gere uma senha forte]
SESSION_SECRET    [gere uma chave aleatória]
NODE_MODULES_CACHE true
```

**Exemplos de valores seguros:**
```bash
# Gerar ADMIN_PASSWORD
openssl rand -base64 12

# Gerar SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 Plano (Plan)

- **Free**: Suficiente para começar (dorme após 15 min de inatividade)
- **Paid**: Recomendado para produção (sempre ativo)

Clique em **"Create Web Service"**

## 📦 Etapa 3: Banco de Dados (Opcional)

### Opção A: Usar SQLite (Mais Simples)

O app já está configurado para usar SQLite por padrão.
- ✅ Sem `DATABASE_URL` configurado
- ✅ Dados salvos em `data/app.db`
- ⚠️ Pode perder dados em redeploy no Free plan

### Opção B: Usar PostgreSQL (Recomendado para Produção)

1. No Render Dashboard, clique em **"New"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `orgulho-db`
   - **Region**: Brasil
   - **PostgreSQL Version**: 15

3. Copie a `Internal Database URL`

4. Volte ao Web Service e adicione a variável:
   ```
   DATABASE_URL    [copie a URL aqui]
   ```

5. Clique em **"Save"** (isso causará um novo deploy)

## 🧪 Etapa 4: Testar o Deploy

### Verificar Status

1. No dashboard do Render, vá para seu Web Service
2. Acesse a aba **"Logs"**
3. Procure por mensagens de sucesso:
   ```
   ✅ Usando PostgreSQL...
   ou
   ℹ️  Usando SQLite...
   
   Servidor rodando em porta 3000
   ```

### Acessar o Site

- URL: `https://orgulho-da-cidade.onrender.com`
- Pode levar 2-5 minutos para estar pronto na primeira vez

### Teste Admin

1. Acesse `https://seu-url.onrender.com/admin.html`
2. Use a senha definida em `ADMIN_PASSWORD`

## 🔄 Deploy Automático

Agora qualquer push para a branch `main` vai triggerar um novo deploy:

```bash
# Para fazer um novo deploy
git add .
git commit -m "Descrição da mudança"
git push origin main
# Render detectará e fará deploy automaticamente
```

## ⚠️ Troubleshooting

### "Cannot find module 'express'"

```bash
# No seu PC, rode
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push origin main
```

### "Application failed to start"

Verifique os logs no Render:
1. Dashboard → seu serviço → Logs
2. Procure por mensagens de erro
3. Se `ADMIN_PASSWORD` não está definido, adicione em Environment

### Dados desapareceram após deploy

Se está usando SQLite (Free plan), isso é esperado. Use PostgreSQL para dados persistentes:
1. Crie um banco PostgreSQL no Render
2. Defina `DATABASE_URL`
3. O app automaticamente migrará os dados

### A URL diz "Service could not be started"

Possíveis causas:
1. Erro em `package.json` ou dependências faltando
2. Variável `ADMIN_PASSWORD` não definida
3. Porta 3000 já em uso (improvável no Render)

Solução:
1. Verifique os logs
2. Se necessário, cancele e crie um novo serviço
3. Certifique-se que `npm start` funciona localmente

## 📊 Monitoramento Contínuo

### Acesso aos Logs

```
Render Dashboard → seu serviço → Logs
```

### Métricas

```
Render Dashboard → seu serviço → Metrics
```

Você pode ver:
- CPU Usage
- Memory Usage
- Bandwidth

## 🎉 Pronto!

Seu site está em produção! 

Próximas etapas opcionais:
- [ ] Configurar domínio personalizado (cname)
- [ ] Adicionar certificado SSL (automático no Render)
- [ ] Configurar alertas de erro
- [ ] Backup automático de banco de dados

---

**Dúvidas?** Verifique os logs no Render Dashboard ou consulte a documentação oficial: https://render.com/docs
