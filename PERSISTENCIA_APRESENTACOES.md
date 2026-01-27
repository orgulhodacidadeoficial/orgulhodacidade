# 🔧 Solução: Persistência de Apresentações no Render

## Problema
As apresentações adicionadas como ADMIN desapareciam quando o Render reiniciava/dormia.

## Causa
O arquivo `render.yaml` não estava configurando um banco de dados PostgreSQL. Isso fazia a app usar **SQLite local**, que é perdido no reinício do container.

## Solução Implementada

### 1. Atualizado `render.yaml`
Agora inclui:
- **Banco PostgreSQL** gratuito no Render (`orgulho-db`)
- **Variável `DATABASE_URL`** que conecta a web service ao banco

```yaml
envVars:
  - key: DATABASE_URL
    fromDatabase:
      name: orgulho-db
      property: connectionString

services:
  - type: pserv  # PostgreSQL Service
    name: orgulho-db
    plan: free
    postgresVersion: 15
```

### 2. Como Funciona

O backend (`server.js`) já tinha código pronto para PostgreSQL:

```javascript
if (USE_POSTGRES) {
  // Salva em PostgreSQL (persistente)
  await pgQuery(`DELETE FROM events`);
  await pgQuery(`INSERT INTO events (data) VALUES ($1)`, 
    [JSON.stringify(arr)]);
}
```

### 3. Próximos Passos

1. **Faça um commit** dos mudanças:
   ```bash
   git add render.yaml
   git commit -m "Add PostgreSQL persistence for presentations"
   ```

2. **Push para trigger redeploy** no Render:
   ```bash
   git push origin main
   ```

3. **O Render vai**:
   - Criar novo banco PostgreSQL
   - Atualizar as variáveis de ambiente
   - Redeploy a aplicação

4. **Teste** adicionando uma apresentação como ADMIN

## Detalhes Técnicos

- **SQLite** (antes): Salvo em `/data/app.db` - **perdido no restart**
- **PostgreSQL** (agora): Banco persistente gerenciado pelo Render - **mantém dados**

## Monitoramento

Você pode verificar se está funcionando vendo o log do servidor:
- Se usar PostgreSQL: `✅ Usando PostgreSQL para persistência de dados`
- Se cair em fallback: `ℹ️  Usando SQLite (local)`

## Backup

Recomendado fazer backup regularmente do PostgreSQL via Render Dashboard > Database > Backups.

