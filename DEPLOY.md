# 🚀 Deploy no Vercel

## Pré-requisitos
- Conta no [GitHub](https://github.com)
- Conta no [Vercel](https://vercel.com)

## Passo 1: Preparar repositório Git

```bash
# Se ainda não inicializou Git
git init
git add .
git commit -m "Initial commit"
```

## Passo 2: Fazer push para GitHub

```bash
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git branch -M main
git push -u origin main
```

## Passo 3: Conectar Vercel ao GitHub

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"New Project"**
3. Selecione seu repositório
4. Clique em **"Import"**

## Passo 4: Configurar Variáveis de Ambiente

No dashboard do Vercel, vá para **Settings → Environment Variables** e adicione:

```
ADMIN_PASSWORD=sua_senha_forte_aqui
SESSION_SECRET=seu_valor_secreto_aqui
OWNER_PASSWORD=senha_do_proprietario
```

## Passo 5: Deploy

O Vercel fará o deploy automaticamente a cada push na branch `main`.

---

## ⚠️ Importante: Persistência de Dados

O Vercel **não mantém arquivos JSON entre deploys**. Para usar em produção, você precisa:

### Opção 1: MongoDB Atlas (Recomendado)
```bash
npm install mongodb
```
- Crie conta em [mongodb.com](https://mongodb.com)
- Passe `MONGODB_URI` nas variáveis de ambiente

### Opção 2: Supabase (PostgreSQL)
- Crie conta em [supabase.com](https://supabase.com)
- Configure com SQL

### Opção 3: Firebase
- Use Firestore para dados em tempo real

---

## 🐛 Troubleshooting

### Erro 404 em rotas não-root
Isso é normal. Verifique o `vercel.json` para certeza que as rotas estão corretas.

### WebSocket não conecta
Vercel não suporta WebSocket nativo em funções serverless. Use Socket.IO com fallback HTTP polling.

### Dados desaparecem
Você precisa de um banco de dados externo! Veja seção acima.

---

## 📝 Variáveis recomendadas para Vercel

```env
ADMIN_PASSWORD=valor_secreto_forte
SESSION_SECRET=valor_aleatorio_grande
NODE_ENV=production
```

---

Pronto! Seu site está online! 🎉
