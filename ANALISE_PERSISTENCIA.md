# Análise de Persistência de Dados - Fotos, Apresentações e Carrosseis

## 📋 Resumo Executivo

**PROBLEMA IDENTIFICADO:** Fotos, apresentações e carrosseis **NÃO** estão salvos de forma persistente no banco de dados do Render como inscrições, contatos e contratações.

---

## 🔍 Comparação: Como Funciona a Persistência

### ✅ INSCRIÇÕES, CONTATOS E CONTRATAÇÕES (Persistem Corretamente)

#### Backend (server.js):
```javascript
// POST /api/inscricao - Salva em JSON + PostgreSQL
app.post('/api/inscricao', async (req, res) => {
  const entry = Object.assign({}, req.body, { receivedAt: Date.now(), ip: req.ip });
  await appendToJson('inscricoes', entry);  // ← Salva em JSON
  // PostgreSQL também salva se disponível
});

// POST /api/contato - Salva em JSON
app.post('/api/contato', async (req, res) => {
  const entry = Object.assign({}, req.body, { receivedAt: Date.now(), ip: req.ip });
  await appendToJson('contatos', entry);  // ← Salva em JSON
});

// POST /api/contratacao - Salva em JSON
app.post('/api/contratacao', async (req, res) => {
  const entry = Object.assign({}, req.body, { receivedAt: Date.now(), ip: req.ip });
  await appendToJson('contratacoes', entry);  // ← Salva em JSON
});
```

#### Arquivos Criados em `data/`:
- `inscricoes.json` - Array de inscrições
- `contatos.json` - Array de contatos  
- `contratacoes.json` - Array de contratações

#### Tabelas PostgreSQL (Render):
```javascript
CREATE TABLE inscricoes (
  id SERIAL PRIMARY KEY,
  data JSONB,
  receivedAt BIGINT,
  ip TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE contatos (
  id SERIAL PRIMARY KEY,
  data JSONB,
  receivedAt BIGINT,
  ip TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE contratacoes (
  id SERIAL PRIMARY KEY,
  data JSONB,
  receivedAt BIGINT,
  ip TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

### ❌ FOTOS (NÃO Persistem em BD do Render)

#### Backend (server.js):
```javascript
// POST /api/upload - Upload de fotos
app.post('/api/upload', upload.array('photos', 10), async (req, res) => {
  // Salva APENAS em JSON
  await fsPromises.writeFile(photosFile, JSON.stringify(list, null, 2), 'utf8');
  // ❌ NÃO salva em PostgreSQL
  res.json({ ok: true, added });
});

// POST /api/photos - Salvar array de fotos
app.post('/api/photos', requireAdmin, async (req, res) => {
  const safe = arr.map(item => ({ src, name, role, categoria }));
  await writeJson('photos', safe);  // ← Apenas JSON
  // ❌ NÃO salva em PostgreSQL
});
```

#### Arquivo Criado:
- `photos.json` - Array de fotos (APENAS em JSON, não em PostgreSQL)

#### Tabela PostgreSQL Criada Mas Não Usada:
```javascript
CREATE TABLE photos (
  id SERIAL PRIMARY KEY,
  data JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
// ⚠️ Tabela existe mas NUNCA é populada!
```

---

### ❌ APRESENTAÇÕES (NÃO Persistem em BD do Render)

#### Backend (server.js):
```javascript
// POST /api/events - Salvar apresentações
app.post('/api/events', async (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : req.body.events;
  await writeJson('events', arr);  // ← Apenas JSON
  // ❌ NÃO salva em PostgreSQL
  broadcast({ type: 'eventsUpdated', count: arr.length });
});
```

#### Arquivo Criado:
- `events.json` - Array de apresentações (APENAS em JSON)

#### Tabela PostgreSQL Criada Mas Não Usada:
```javascript
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  data JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
// ⚠️ Tabela existe mas NUNCA é populada!
```

#### Frontend (events.js):
```javascript
async function saveEvents() {
  const response = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apresentacoes, null, 2),
  });
  // Tenta salvar via API
}
```

---

### ⚠️ CARROSSEIS (Mesmo Problema das Fotos)

#### Backend (server.js):
```javascript
// POST /api/carousel-titulo/delete - Remove apenas de JSON
app.post('/api/carousel-titulo/delete', requireAdmin, async (req, res) => {
  const photos = await readJson('photos');
  const filtered = photos.filter(p => p.categoria === 'titulo');
  await writeJson('photos', filtered);  // ← Apenas JSON
  // ❌ NÃO sincroniza com PostgreSQL
});
```

**O Carrossel de Títulos é armazenado em `photos.json` com `categoria === 'titulo'`**

---

## 🚀 Por Que Funciona em Dev Mas Não em Produção (Render)?

### Em Desenvolvimento (Local):
```
Frontend → Backend → JSON (data/*.json) → Disco Local
                  ↘ SQLite (data/app.db)
```
- Arquivos JSON são salvos no disco local
- Rebuild preserva a pasta `data/`
- Dados persistem

### Em Produção (Render):
```
Frontend → Backend → JSON (data/*.json) → Disco Efêmero ❌
                  ↗ PostgreSQL (DATABASE_URL) ✅
```
- Render usa container Docker **sem persistência de disco**
- Cada rebuild cria container novo
- Arquivos JSON são perdidos
- **Apenas dados em PostgreSQL são preservados**

---

## 📊 Tabela Comparativa

| Recurso | POST Endpoint | JSON (data/) | PostgreSQL | Persiste no Render? |
|---------|---------------|-----------|-----------|-------------------|
| **Inscrições** | `/api/inscricao` | ✅ `inscricoes.json` | ✅ `TABLE inscricoes` | ✅ SIM |
| **Contatos** | `/api/contato` | ✅ `contatos.json` | ✅ `TABLE contatos` | ✅ SIM |
| **Contratações** | `/api/contratacao` | ✅ `contratacoes.json` | ✅ `TABLE contratacoes` | ✅ SIM |
| **Fotos** | `/api/upload` + `/api/photos` | ✅ `photos.json` | ❌ Nunca usa | ❌ **NÃO** |
| **Carrosseis** | Upload → photos.json | ✅ `photos.json` | ❌ Nunca usa | ❌ **NÃO** |
| **Apresentações** | `/api/events` | ✅ `events.json` | ❌ Nunca usa | ❌ **NÃO** |
| **Chat** | `/api/chat` | ❌ Nenhum | ✅ `TABLE chat_messages` | ✅ SIM |

---

## 🔧 Solução: Implementar Persistência em PostgreSQL

### Opção 1: Adicionar Salvamento em PostgreSQL (Recomendado)

**Para Fotos e Carrosseis:**
```javascript
// POST /api/upload
app.post('/api/upload', upload.array('photos', 10), async (req, res) => {
  // ... upload de arquivos ...
  
  // Salvar em JSON (para compatibilidade)
  await fsPromises.writeFile(photosFile, JSON.stringify(list, null, 2), 'utf8');
  
  // ✅ ADICIONAR: Salvar em PostgreSQL
  if (USE_POSTGRES) {
    await pgQuery(
      `INSERT INTO photos (data) VALUES ($1)`,
      [JSON.stringify({ list, addedAt: new Date().toISOString() })]
    );
  }
  
  res.json({ ok: true, added });
});

// POST /api/photos
app.post('/api/photos', requireAdmin, async (req, res) => {
  const safe = arr.map(item => ({ src, name, role, categoria }));
  await writeJson('photos', safe);
  
  // ✅ ADICIONAR: Salvar em PostgreSQL
  if (USE_POSTGRES) {
    await pgQuery(
      `TRUNCATE photos; INSERT INTO photos (data) VALUES ($1)`,
      [JSON.stringify(safe)]
    );
  }
  
  try { broadcast({ type: 'photosUpdated', count: safe.length }); } catch (e) {}
  res.json({ ok: true });
});
```

**Para Apresentações:**
```javascript
// POST /api/events
app.post('/api/events', async (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : req.body.events;
  if (!Array.isArray(arr)) return res.status(400).json({ error: 'Esperado um array' });
  
  await writeJson('events', arr);
  
  // ✅ ADICIONAR: Salvar em PostgreSQL
  if (USE_POSTGRES) {
    await pgQuery(
      `TRUNCATE events; INSERT INTO events (data) VALUES ($1)`,
      [JSON.stringify(arr)]
    );
  }
  
  try { broadcast({ type: 'eventsUpdated', count: arr.length }); } catch (e) {} 
  res.json({ ok: true });
});
```

### Opção 2: Carregar de PostgreSQL ao Iniciar

```javascript
// GET /api/eventos - Carregar apresentações
app.get('/api/eventos', async (req, res) => {
  try {
    let data = [];
    
    // Tentar PostgreSQL primeiro
    if (USE_POSTGRES) {
      const result = await pgQuery('SELECT data FROM events ORDER BY createdAt DESC LIMIT 1');
      if (result.rows.length > 0) {
        data = JSON.parse(result.rows[0].data);
      }
    } else {
      // Fallback para JSON
      data = await readJson('events');
    }
    
    res.json(data);
  } catch (err) {
    console.error('GET /api/eventos error', err);
    res.status(500).json({ error: 'failed' });
  }
});
```

---

## 📝 Checklist para Corrigir Persistência

### Para Fotos e Carrosseis:
- [ ] Modificar `POST /api/upload` para salvar em PostgreSQL
- [ ] Modificar `POST /api/photos` para salvar em PostgreSQL
- [ ] Modificar `POST /api/photos/delete` para atualizar PostgreSQL
- [ ] Modificar `POST /api/carousel-titulo/delete` para atualizar PostgreSQL
- [ ] Modificar `GET /api/carousel-titulo/list` para ler de PostgreSQL
- [ ] Modificar `GET /api/photos/list` (ou similar) para ler de PostgreSQL

### Para Apresentações:
- [ ] Modificar `POST /api/events` para salvar em PostgreSQL
- [ ] Modificar `GET /api/eventos` para ler de PostgreSQL
- [ ] Testar sincronização em tempo real com WebSocket

### Testes no Render:
- [ ] Adicionar fotos → Rebuild → Verificar se fotos persistem
- [ ] Adicionar apresentações → Rebuild → Verificar se apresentações persistem
- [ ] Adicionar carrosseis → Rebuild → Verificar se carrosseis persistem

---

## 🎯 Impacto

**Sem Correção:**
- Cada rebuild do Render deleta todas as fotos
- Cada rebuild do Render deleta todas as apresentações
- Cada rebuild do Render deleta todos os carrosseis

**Com Correção:**
- Dados persistem como inscrições, contatos e contratações
- Rebuild não afeta dados
- Sistema funcionará igual em dev e produção

---

## 📞 Suporte

Se precisar de ajuda implementando essas mudanças, os arquivos principais são:
- [backend/server.js](backend/server.js) - Endpoints de API
- [Frontend/events.js](Frontend/events.js) - Carregamento de apresentações
- [Frontend/fotos.js](Frontend/fotos.js) - Carregamento de fotos
