# 📦 Passos Rápidos para Deploy no Render

## 1️⃣ Preparar o Repositório Local

```bash
# Entrar no diretório do projeto
cd "c:\Users\Rafael\Downloads\Orgulhodacidade- ultima atualização"

# Ver status atual
git status

# Adicionar todos os arquivos
git add .

# Fazer commit com mensagem descritiva
git commit -m "Setup final para deploy automático no Render"

# Enviar para GitHub
git push origin main
```

## 2️⃣ Configurar no Render

### Passo A: Acessar Render
1. Vá para https://dashboard.render.com
2. Faça login com sua conta (crie se não tiver)
3. Clique em **"New"** → **"Web Service"**

### Passo B: Conectar GitHub
1. Clique em **"Deploy an existing project from a Git repository"**
2. Selecione **GitHub** como provedor
3. Procure por `orgulhodacidade`
4. Selecione e clique em **"Connect"**

### Passo C: Configurar o Serviço

Preencha assim:
```
Name:                     orgulho-da-cidade
Region:                   Brazil (São Paulo)  
Branch:                   main
Runtime:                  Node
Build Command:            (deixar em branco)
Start Command:            (deixar em branco)
Plan:                     Free (ou Paid para produção)
```

⏳ Deixe o render.yaml fazer a configuração automática!

### Passo D: Adicionar Variáveis de Ambiente

Clique em **"Advanced"** → **"Add Environment Variable"**

Adicione estas 3 variáveis:

| Variável | Valor | Como gerar |
|----------|-------|----------|
| **NODE_ENV** | `production` | Literal |
| **ADMIN_PASSWORD** | (gere uma senha forte) | `openssl rand -base64 12` no terminal |
| **SESSION_SECRET** | (gere aleatória) | `openssl rand -hex 32` no terminal |

Exemplos de valores:
```
ADMIN_PASSWORD = Xk9pL2mN5qR8vW
SESSION_SECRET = a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Passo E: Criar o Serviço

Clique em **"Create Web Service"**

⏳ Render começará a fazer build (2-5 minutos)

## 3️⃣ Verificar o Deploy

### Verifique no Dashboard:
1. Vá para a aba **"Logs"** do seu serviço
2. Procure por mensagens de sucesso:
   ```
   ✅ Build started
   ✅ Servidor rodando em porta 3000
   ```

### Acesse seu site:
- URL: `https://orgulho-da-cidade.onrender.com`
- Admin: `https://orgulho-da-cidade.onrender.com/admin.html`
- Senha: (aquela que você setou em ADMIN_PASSWORD)

## 4️⃣ Próximas Atualizações (Automáticas!)

Agora toda vez que você fizer push:

```bash
# Fazer uma mudança no código
# ... editar arquivos ...

# Enviar para GitHub
git add .
git commit -m "Descrição da mudança"
git push origin main
```

✨ **Render detectará e fará deploy automático!**

## 🆘 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| "Service could not be started" | Verifique ADMIN_PASSWORD em Environment |
| "Cannot find module 'express'" | Você enviou package-lock.json? |
| Página não carrega | Aguarde 2-5 min, cheque os Logs |
| Admin não funciona | Senha foi configurada em ADMIN_PASSWORD? |
| Dados sumiram | Está em SQLite? Use PostgreSQL para persistência |

## 📞 Mais Informações

- Guia completo: `SETUP-RENDER.md`
- Documentação Render: https://render.com/docs
- Seu repositório: https://github.com/orgulhodacidade2/orgulhodacidade

---

**Pronto! 🎉 Você agora tem deploy contínuo no Render!**
