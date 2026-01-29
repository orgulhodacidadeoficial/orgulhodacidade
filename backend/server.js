const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const session = require('express-session');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const app = express();

// Detectar se usar PostgreSQL ou SQLite
const USE_POSTGRES = !!process.env.DATABASE_URL;
let pool = null;
let db = null;

// PostgreSQL initialization
if (USE_POSTGRES) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  pool.on('error', (err) => {
    console.error('Erro no pool PostgreSQL:', err);
  });
  
  console.log('✅ Usando PostgreSQL para persistência de dados');
  // Initialize tables asynchronously - serão inicializadas em ensureStorageFiles()
} else {
  // SQLite database initialization
  const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Erro abrindo banco de dados SQLite:', err);
    } else {
      console.log('Conectado ao banco de dados SQLite:', DB_PATH);
      initializeTables();
    }
  });
  console.log('ℹ️  Usando SQLite (local) - para produção use PostgreSQL com DATABASE_URL');
}

// PostgreSQL Query wrapper
async function pgQuery(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (err) {
    console.error('Erro PostgreSQL:', err);
    throw err;
  }
}

// SQLite Wrapper para promessas
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Inicializar tabelas
async function initializeTables() {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS inscricoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data JSON,
        receivedAt INTEGER,
        ip TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS contatos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data JSON,
        receivedAt INTEGER,
        ip TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS contratacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data JSON,
        receivedAt INTEGER,
        ip TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        passwordHash TEXT,
        salt TEXT,
        isAdmin INTEGER DEFAULT 0,
        isPresident INTEGER DEFAULT 0,
        createdAt INTEGER
      )
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        videoId TEXT NOT NULL,
        user TEXT NOT NULL,
        email TEXT,
        role TEXT,
        text TEXT NOT NULL,
        timestamp TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Migração: Adicionar colunas email e role se não existirem (para compatibilidade)
    await migrateChatMessagesTable();
    
    console.log('Tabelas SQLite inicializadas com sucesso');
  } catch (err) {
    console.error('Erro inicializando tabelas:', err);
  }
}

// Migração para chat_messages - Adiciona colunas faltando se necessário
async function migrateChatMessagesTable() {
  try {
    // Verificar se as colunas existem
    const tableInfo = await dbAll(`PRAGMA table_info(chat_messages)`);
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('email')) {
      console.log('[MIGRATE] Adicionando coluna email à tabela chat_messages');
      await dbRun(`ALTER TABLE chat_messages ADD COLUMN email TEXT`);
    }
    
    if (!columnNames.includes('role')) {
      console.log('[MIGRATE] Adicionando coluna role à tabela chat_messages');
      await dbRun(`ALTER TABLE chat_messages ADD COLUMN role TEXT DEFAULT 'USUARIO'`);
    }
    
    console.log('[MIGRATE] ✅ chat_messages atualizada com sucesso');
  } catch (err) {
    console.error('[MIGRATE] Erro ao migrar chat_messages:', err);
  }
}

// PostgreSQL Initialize Tables
async function initializePgTables() {
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS inscricoes (
        id SERIAL PRIMARY KEY,
        data JSONB,
        receivedAt BIGINT,
        ip TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS contatos (
        id SERIAL PRIMARY KEY,
        data JSONB,
        receivedAt BIGINT,
        ip TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS contratacoes (
        id SERIAL PRIMARY KEY,
        data JSONB,
        receivedAt BIGINT,
        ip TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        passwordHash TEXT,
        salt TEXT,
        isAdmin INTEGER DEFAULT 0,
        isPresident INTEGER DEFAULT 0,
        createdAt BIGINT
      )
    `);
    
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        data JSONB,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        data JSONB,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        data JSONB,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        videoId TEXT NOT NULL,
        user TEXT NOT NULL,
        email TEXT,
        role TEXT,
        text TEXT NOT NULL,
        timestamp TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Migração: Adicionar colunas email e role se não existirem (para compatibilidade)
    await migrateChatMessagesTablePg();
    
    console.log('✅ Tabelas PostgreSQL inicializadas com sucesso');
  } catch (err) {
    console.error('Erro inicializando tabelas PostgreSQL:', err);
  }
}

// Migração para PostgreSQL - Adiciona colunas faltando se necessário
async function migrateChatMessagesTablePg() {
  try {
    // Verificar se as colunas existem
    const result = await pgQuery(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages'
    `);
    
    const columnNames = result.rows.map(row => row.column_name);
    
    if (!columnNames.includes('email')) {
      console.log('[MIGRATE PG] Adicionando coluna email à tabela chat_messages');
      await pgQuery(`ALTER TABLE chat_messages ADD COLUMN email TEXT`);
    }
    
    if (!columnNames.includes('role')) {
      console.log('[MIGRATE PG] Adicionando coluna role à tabela chat_messages');
      await pgQuery(`ALTER TABLE chat_messages ADD COLUMN role TEXT DEFAULT 'USUARIO'`);
    }
    
    console.log('[MIGRATE PG] ✅ chat_messages atualizada com sucesso');
  } catch (err) {
    console.error('[MIGRATE PG] Erro ao migrar chat_messages:', err);
  }
}

const server = http.createServer(app);
// Server-Sent Events clients (for realtime updates)
const sseClients = new Set();

// WebSocket server para playlist em tempo real
const wss = new WebSocket.Server({ 
  server, 
  path: '/ws/playlist',
  perMessageDeflate: false  // Disable compression to avoid frame issues
});
const playlistClients = new Set();
const chatClients = new Map(); // Map para armazenar clientes de chat por videoId

// Log WebSocket server initialization
console.log('[WebSocket] Inicializando servidor de playlist WebSocket');

function sendSseEvent(eventName, data) {
  const payload = `event: ${eventName}\n` + `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      // ignore broken clients
    }
  }
}

// Broadcast para clientes WebSocket da playlist
function broadcastPlaylist(action, data) {
  const message = JSON.stringify({ action, data, timestamp: new Date().toISOString() });
  for (const client of playlistClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {
        console.warn('Erro ao enviar mensagem de playlist:', e.message);
      }
    }
  }
  console.log(`[Playlist] Broadcast - Action: ${action}, Clientes: ${playlistClients.size}`);
}

// Broadcast de mensagens de chat para um videoId específico
function broadcastChatMessage(videoId, message) {
  try {
    const clients = chatClients.get(videoId);
    if (!clients) {
      console.log(`[Chat] Nenhum cliente conectado para ${videoId}`);
      return;
    }
    
    const payload = JSON.stringify({ type: 'message', data: message, timestamp: new Date().toISOString() });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (e) {
          console.warn('[Chat] Erro ao enviar mensagem:', e.message);
          clients.delete(client);
        }
      }
    }
    console.log(`[Chat] Mensagem enviada para ${videoId} - Clientes: ${clients.size}`);
  } catch (e) {
    console.error('[Chat] Erro crítico em broadcastChatMessage:', e.message);
  }
}

// Gerenciamento de playlist sincronizada
const PLAYLIST_FILE = path.join(__dirname, '..', 'data', 'playlist-sync.json');
let playlistCache = { musics: [], lastUpdated: new Date().toISOString() };

// Carrega playlist do arquivo
async function loadPlaylistFromFile() {
  try {
    const data = await fsPromises.readFile(PLAYLIST_FILE, 'utf8');
    playlistCache = JSON.parse(data);
    console.log(`[Playlist] Carregada do arquivo: ${playlistCache.musics.length} músicas`);
  } catch (e) {
    console.warn('[Playlist] Erro ao carregar arquivo, usando padrão:', e.message);
    playlistCache = { musics: [], lastUpdated: new Date().toISOString() };
  }
}

// Salva playlist no arquivo
async function savePlaylistToFile() {
  try {
    playlistCache.lastUpdated = new Date().toISOString();
    await fsPromises.writeFile(PLAYLIST_FILE, JSON.stringify(playlistCache, null, 2));
    console.log(`[Playlist] Salva no arquivo: ${playlistCache.musics.length} músicas`);
  } catch (e) {
    console.error('[Playlist] Erro ao salvar arquivo:', e.message);
  }
}

// Multer for file uploads
const multer = require('multer');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const IMAGES_DIR = path.join(__dirname, '..', 'Frontend', 'images');
fsPromises.mkdir(UPLOADS_DIR, { recursive: true }).catch(()=>{});
// ensure images dir exists
fsPromises.mkdir(IMAGES_DIR, { recursive: true }).catch(()=>{});
const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = path.basename(file.originalname, ext).replace(/[^a-z0-9\-_.]/gi,'');
    cb(null, `${Date.now()}-${name}${ext}`);
  }
});
const audioUpload = multer({ storage: audioStorage, limits: { fileSize: 50 * 1024 * 1024 } });
// Generic upload middleware for stories and other file uploads
const upload = multer({ storage: audioStorage, limits: { fileSize: 50 * 1024 * 1024 } });
// Endpoint para upload de áudio
app.post('/api/upload-audio', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file', message: 'Nenhum arquivo enviado (campo "audio" esperado)' });
    // Retorna a URL pública do arquivo salvo
    const url = `/uploads/${req.file.filename}`;
    res.json({ ok: true, url, filename: req.file.filename });
  } catch (err) {
    console.error('Erro no upload de áudio:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'server_error', message: String(err && err.message ? err.message : err) });
  }
});
// Servir arquivos de áudio da pasta uploads
app.use('/uploads', express.static(UPLOADS_DIR));

const PORT = process.env.PORT || 3000;
// Admin password: prefer environment variable in production
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'orgulho2026';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('[SECURITY] ADMIN_PASSWORD not set in environment — using default development password. Change in production.');
}

// API: create new story category
app.post('/api/create-story', upload.single('file'), async (req, res) => {
  try {
    // Debug logging to help diagnose failing story creation
    console.log('[create-story] request received');
    console.log('[create-story] req.body:', Object.keys(req.body || {}).length ? req.body : '<empty>');
    console.log('[create-story] req.file:', req.file ? { originalname: req.file.originalname, filename: req.file.filename, path: req.file.path, mimetype: req.file.mimetype } : null);

    if (!req.file) return res.status(400).json({ error: 'no_file', message: 'Nenhum arquivo enviado (campo "file" esperado)' });
    const title = req.body.title || 'Nova Categoria';
    const storiesFile = path.join(__dirname, '..', 'data', 'stories.json');
    let list = [];
    try {
      const raw = await fsPromises.readFile(storiesFile, 'utf8');
      list = JSON.parse(raw);
    } catch (e) {
      list = [];
    }

    // normalize category name to folder name (e.g. "Ensaios 2026" -> "ensaios2026")
    function normalizeFolder(name){
      if(!name) return 'categoria';
      // allow hyphens in folder names (e.g. 'carrossel-brincantes')
      return String(name).toLowerCase().replace(/[^a-z0-9\-]/g,'');
    }
    const folderName = normalizeFolder(title);
    console.log('[create-story] title:', title, '-> folderName:', folderName);
    
    // create category-specific folder and move file there
    const categoryDir = path.join(IMAGES_DIR, folderName);
    try { await fsPromises.mkdir(categoryDir, { recursive: true }); } catch (e) {}
    
    const newPath = path.join(categoryDir, req.file.filename);
    try {
      await fs.rename(req.file.path, newPath);
    } catch (err) {
      console.warn('could not move story file to category folder', err && err.message ? err.message : err);
      // return a helpful error so frontend can show it
      return res.status(500).json({ error: 'move_failed', message: String(err && err.message ? err.message : err) });
    }

    // create story entry with paths relative to Frontend
    const isVideo = req.file.mimetype.startsWith('video');
    const thumbPath = isVideo ? path.join('images', folderName, path.basename(newPath).replace(/\.[^.]+$/, '.jpg')).replace(/\\/g, '/') 
                              : path.join('images', folderName, req.file.filename).replace(/\\/g, '/');
    const srcPath = path.join('images', folderName, req.file.filename).replace(/\\/g, '/');
    
    const storyObj = {
      src: srcPath,
      srcThumb: thumbPath,
      title: title,
      type: isVideo ? 'video' : 'image'
    };

    list.push(storyObj);
    try {
      await fsPromises.writeFile(storiesFile, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('[create-story] could not write stories.json:', e && e.message ? e.message : e);
      return res.status(500).json({ error: 'write_failed', message: String(e && e.message ? e.message : e) });
    }

    console.log('[create-story] story created:', storyObj);
    return res.json({ ok: true, story: storyObj });
  } catch (err) {
    console.error('create-story error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'server_error', message: String(err && err.message ? err.message : err) });
  }
});

app.post('/api/upload', upload.array('photos', 10), async (req, res) => {
  try {
    console.log('[upload] start - IMAGES_DIR=%s', IMAGES_DIR);
    const photosFile = path.join(__dirname, '..', 'data', 'photos.json');
    console.log('[upload] photosFile=%s, filesReceived=%d, categoria=%s', photosFile, (req.files||[]).length, req.body && req.body.categoria);
    (req.files||[]).forEach((f,i) => console.log('[upload] file[%d]= original=%s, path=%s, filename=%s, mimetype=%s, size=%d', i, f.originalname, f.path, f.filename, f.mimetype, f.size));
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'no_files' });
    const categoria = req.body.categoria || '';
    const storyOnly = req.body.storyOnly === '1' || req.body.storyOnly === 'true' || req.body.storyOnly === true;
    let list = [];
    try {
      const raw = await fsPromises.readFile(photosFile, 'utf8');
      list = JSON.parse(raw);
    } catch (e) {
      // ignore, start with empty
      list = [];
    }

    const added = [];
    // normalize category into a folder name (e.g. "Temp. 2026" -> "temp2026")
    function normalizeFolder(name){
      if(!name) return '';
      // allow hyphens in folder names (e.g. 'carrossel-brincantes')
      return String(name).toLowerCase().replace(/[^a-z0-9\-]/g,'');
    }
    const folderName = normalizeFolder(categoria);
    for (const f of req.files) {
      // determine destination: if category folder exists (or folderName), move file into it
      let finalBase = path.basename(f.path);
      let rel = path.join('images', finalBase).replace(/\\/g, '/');
      if(folderName){
        const destDir = path.join(IMAGES_DIR, folderName);
        try{ await fsPromises.mkdir(destDir, { recursive: true }); }catch(e){}
        const newPath = path.join(destDir, finalBase);
        try{
          await fs.rename(f.path, newPath);
          rel = path.join('images', folderName, finalBase).replace(/\\/g, '/');
        }catch(err){
          // if move fails, keep original
          console.warn('could not move uploaded file to category folder', err.message);
        }
      }
      const name = req.body && req.body.name ? String(req.body.name) : '';
      const role = req.body && req.body.role ? String(req.body.role) : '';
      const alt = req.body && req.body.alt ? String(req.body.alt) : 'Banner';
      const obj = { src: rel, categoria: categoria, storyOnly: !!storyOnly, name: name, role: role, alt: alt };
      list.unshift(obj);
      added.push(obj);
    }
    await fsPromises.writeFile(photosFile, JSON.stringify(list, null, 2), 'utf8');
    // ✅ Salvar em PostgreSQL para persistência no Render
    if (USE_POSTGRES) {
      try {
        await pgQuery(`DELETE FROM photos`);
        await pgQuery(`INSERT INTO photos (data) VALUES ($1)`, [JSON.stringify(list)]);
        console.log('[upload] ✅ Fotos salvas em PostgreSQL');
      } catch (e) {
        console.warn('[upload] Aviso ao salvar em PostgreSQL:', e.message);
      }
    }
    // respond with added items
    res.json({ ok: true, added });
    try { sendSseEvent('carousel-update', { type: 'upload', added }); } catch (e) {}
  } catch (err) {
    console.error('upload error', err && err.stack ? err.stack : err);
    // include message to help local debugging
    const payload = { error: 'server_error' };
    try { payload.message = err && err.message ? String(err.message) : String(err); } catch (e) {}
    res.status(500).json(payload);
  }
});

// Chat handlers and state removed per request.
// All chat-related functionality (websocket handlers, state file, message handling)
// has been stripped. A no-op `broadcast` function above keeps any existing
// non-chat code that calls `broadcast(...)` safe.

// CORS middleware - Permite requisições do frontend mesmo em diferentes portas/domínios
app.use((req, res, next) => {
  // Sempre permitir CORS em produção (Render)
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Session middleware
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 } // 1 hour
}));

// Increase body size limits to allow base64 avatar uploads from the chat widget
// (Adjust the limit as needed; large images should ideally be uploaded via multipart endpoint)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const FRONTEND_DIR = path.join(__dirname, '..', 'Frontend');

// Protect direct access to the admin HTML file: if user requests /admin.html
// ensure they have a session; otherwise redirect to login.
app.use((req, res, next) => {
  if (req.path === '/admin.html') {
    if (!req.session || !req.session.admin) return res.redirect('/admin-login.html');
  }
  next();
});

// Rota específica para servir arquivos de áudio da pasta audio/
app.get('/audio/:filename(*)', (req, res) => {
  try {
    const decodedFilename = decodeURIComponent(req.params.filename);
    const audioPath = path.join(FRONTEND_DIR, 'audio', decodedFilename);
    
    // Validação de segurança: garante que o arquivo está dentro da pasta audio/
    const normalizedPath = path.normalize(audioPath);
    const audioDir = path.normalize(path.join(FRONTEND_DIR, 'audio'));
    
    if (!normalizedPath.startsWith(audioDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Verifica se o arquivo existe
    if (fs.existsSync(normalizedPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      return res.sendFile(normalizedPath);
    } else {
      console.warn(`Audio file not found: ${normalizedPath}`);
      return res.status(404).json({ error: 'Audio file not found', file: decodedFilename });
    }
  } catch (err) {
    console.error('Erro ao servir arquivo de áudio:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static frontend files
app.use(express.static(FRONTEND_DIR));

// Compatibility aliases: some frontend builds reference 'main.clean.js'
// Map those requests to the existing `main.js` so the page loads when
// a leftover reference exists in HTML.
app.get('/main.clean.js', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'main.js'));
});
// If a source map is requested, try to serve the map if it exists (optional)
app.get('/main.clean.js.map', (req, res) => {
  const mapPath = path.join(FRONTEND_DIR, 'main.js.map');
  if (fs.existsSync(mapPath)) return res.sendFile(mapPath);
  return res.status(404).end();
});

// SSE endpoint for real-time updates (clients will reconnect automatically)
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');
  // add to clients set
  sseClients.add(res);
  // on client close remove
  req.on('close', () => {
    sseClients.delete(res);
  });
});

function gerarId() {
  return crypto.randomBytes(12).toString('hex');
}

function gerarNomeVisitante() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Orgulho${n}`;
}

// Owner endpoints removed: owner-login and verify-owner-code are no longer used
// Funções para PostgreSQL/SQLite e JSON
const DATA_DIR = path.join(__dirname, '..', 'data');

async function appendToJson(tableName, entry) {
  // Para tabelas persistentes (inscricoes, contatos, contratacoes, users)
  if (['inscricoes', 'contatos', 'contratacoes', 'users'].includes(tableName)) {
    const dataJson = JSON.stringify(entry);
    const receivedAt = entry.receivedAt || Date.now();
    const ip = entry.ip || 'unknown';
    
    if (USE_POSTGRES) {
      await pgQuery(
        `INSERT INTO ${tableName} (data, receivedAt, ip) VALUES ($1, $2, $3)`,
        [dataJson, receivedAt, ip]
      );
    } else {
      await dbRun(
        `INSERT INTO ${tableName} (data, receivedAt, ip) VALUES (?, ?, ?)`,
        [dataJson, receivedAt, ip]
      );
    }
  } else {
    // Para tabelas JSON (photos, stories, events)
    const filePath = path.join(DATA_DIR, tableName + '.json');
    let arr = [];
    try {
      const raw = await fsPromises.readFile(filePath, 'utf8');
      arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [];
    } catch (e) {
      arr = [];
    }
    arr.push(entry);
    await fsPromises.writeFile(filePath, JSON.stringify(arr, null, 2), 'utf8');
  }
}

async function readJson(tableName) {
  // Para tabelas persistentes (inscricoes, contatos, contratacoes, users)
  if (['inscricoes', 'contatos', 'contratacoes', 'users'].includes(tableName)) {
    if (USE_POSTGRES) {
      const result = await pgQuery(`SELECT data FROM ${tableName} ORDER BY id DESC`);
      return result.rows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch {
          return row.data;
        }
      });
    } else {
      const rows = await dbAll(`SELECT data FROM ${tableName} ORDER BY id DESC`);
      return rows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch {
          return row.data;
        }
      });
    }
  } else {
    // Para tabelas JSON (photos, stories, events)
    const filePath = path.join(DATA_DIR, tableName + '.json');
    try {
      const raw = await fsPromises.readFile(filePath, 'utf8');
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  }
}

async function writeJson(tableName, arr) {
  // Para tabelas persistentes (inscricoes, contatos, contratacoes, users)
  if (['inscricoes', 'contatos', 'contratacoes', 'users'].includes(tableName)) {
    if (USE_POSTGRES) {
      await pgQuery(`DELETE FROM ${tableName}`);
      for (const entry of arr) {
        await appendToJson(tableName, entry);
      }
    } else {
      // Delete all and insert new
      await dbRun(`DELETE FROM ${tableName}`);
      for (const entry of arr) {
        await appendToJson(tableName, entry);
      }
    }
  } else {
    // Para tabelas JSON (photos, stories, events)
    const filePath = path.join(DATA_DIR, tableName + '.json');
    await fsPromises.writeFile(filePath, JSON.stringify(Array.isArray(arr) ? arr : [], null, 2), 'utf8');
  }
}

// Ensure storage tables exist on startup (chamado em initializeTables)
async function ensureStorageFiles() {
  if (USE_POSTGRES) {
    console.log('Inicializando tabelas PostgreSQL...');
    await initializePgTables();
    console.log('✅ Storage tables inicializados via PostgreSQL');
  } else {
    console.log('✅ Storage tables já inicializados via SQLite');
  }
}

// --- User helpers: password hashing + simple users store in PostgreSQL/SQLite ---
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

async function findUserByEmail(email) {
  if (USE_POSTGRES) {
    const result = await pgQuery(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return result.rows[0] || null;
  } else {
    const user = await dbGet(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      [email]
    );
    return user || null;
  }
}

async function findUserById(id) {
  if (USE_POSTGRES) {
    const result = await pgQuery(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } else {
    const user = await dbGet(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return user || null;
  }
}

async function createUser({ id, password }) {
  const existing = await findUserById(id);
  if (existing) throw new Error('UserExists');
  const { salt, hash } = hashPassword(password);
  const user = {
    id: id,
    name: id,
    email: `${id}@chat.local`,
    passwordHash: hash,
    salt,
    createdAt: Date.now(),
  };
  
  if (USE_POSTGRES) {
    await pgQuery(
      `INSERT INTO users (id, name, email, passwordHash, salt, createdAt) VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.name, user.email, user.passwordHash, user.salt, user.createdAt]
    );
  } else {
    await dbRun(
      `INSERT INTO users (id, name, email, passwordHash, salt, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, user.passwordHash, user.salt, user.createdAt]
    );
  }
  
  return user;
}

async function verifyUserCredentials(userId, password) {
  const user = await findUserById(userId);
  if (!user) return null;
  const { hash } = hashPassword(password, user.salt);
  if (hash === user.passwordHash) return user;
  return null;
}


// --- Auth endpoints: register / login / logout / me ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { id, password } = req.body || {};
    if (!id || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    try {
      const user = await createUser({ id, password });
      // create session
      req.session.userId = user.id;
      return res.json({ ok: true, user: { id: user.id, name: user.id, email: `${user.id}@chat.local` }, userName: user.id });
    } catch (err) {
      if (err && err.message === 'UserExists') return res.status(409).json({ error: 'Usuário já existe' });
      console.error('register error', err);
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  } catch (err) {
    console.error('register endpoint error', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    const user = await verifyUserCredentials(username, password);
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    req.session.userId = user.id;
    
    // Chat preferences removed with chat feature; return empty preferences
    let chatPreferences = {};
    
    return res.json({ 
      ok: true, 
      userName: user.id,
      id: user.id,
      user: { 
        id: user.id, 
        name: user.id, 
        email: `${user.id}@chat.local`,
        avatar: chatPreferences.avatar,
        color: chatPreferences.color,
        font: chatPreferences.font,
        isAdmin: !!user.isAdmin,
        isPresident: !!user.isPresident
      } 
    });
  } catch (err) {
    console.error('login endpoint error', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {});
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.json({ user: null });
    let user;
    if (USE_POSTGRES) {
      const result = await pgQuery('SELECT * FROM users WHERE id = $1', [req.session.userId]);
      user = result.rows[0];
    } else {
      user = await dbGet('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    }
    if (!user) return res.json({ user: null });
    
    // Chat preferences removed with chat feature; return empty preferences
    let chatPreferences = {};
    
    return res.json({ 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        avatar: chatPreferences.avatar,
        color: chatPreferences.color,
        font: chatPreferences.font,
        isAdmin: !!user.isAdmin,
        isPresident: !!user.isPresident
      } 
    });
  } catch (err) {
    console.error('auth/me error', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});


app.post('/api/inscricao', async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ 
        error: 'Erro: identificador do dispositivo não encontrado. Tente limpar o cache do navegador e inscrever novamente.' 
      });
    }
    
    console.log('Nova inscrição - DeviceId detectado:', deviceId);
    
    // Verificar se este deviceId já se inscreveu
    const inscricoes = await readJson('inscricoes');
    console.log('Total de inscrições no banco:', inscricoes.length);
    
    if (inscricoes && inscricoes.length > 0) {
      const jaInscrito = inscricoes.some(insc => {
        return insc.deviceId === deviceId;
      });
      
      if (jaInscrito) {
        console.log(`[INSCRIÇÃO] DeviceId ${deviceId} já inscrito anteriormente`);
        return res.status(400).json({ 
          error: 'Você já realizou uma inscrição neste navegador/dispositivo. Apenas uma inscrição por dispositivo é permitida.' 
        });
      }
    }
    
    const entry = Object.assign({}, req.body, {
      receivedAt: Date.now(),
      ip: req.ip || 'unknown'
    });
    await appendToJson('inscricoes', entry);
    console.log(`[INSCRIÇÃO] ✅ Nova inscrição salva com sucesso para deviceId ${deviceId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('inscricao error', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Endpoint para limpar inscricoes (USE COM CUIDADO)
app.post('/api/inscricao/limpar', async (req, res) => {
  try {
    const { senha } = req.body;
    if (senha !== 'admin123') {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    // Limpar arquivo JSON
    await writeJson('inscricoes', []);
    
    // Limpar banco de dados PostgreSQL se existir
    if (pool) {
      try {
        await pool.query('DELETE FROM inscricoes');
      } catch (e) {
        console.log('Banco PostgreSQL não disponível ou tabela não existe');
      }
    }
    
    res.json({ ok: true, message: 'Inscrições limpas com sucesso' });
  } catch (err) {
    console.error('Erro ao limpar inscrições:', err);
    res.status(500).json({ error: 'Falha ao limpar' });
  }
});

app.post('/api/contato', async (req, res) => {
  try {
    const entry = Object.assign({}, req.body, {
      receivedAt: Date.now(),
      ip: req.ip,
    });
    await appendToJson('contatos', entry);
    res.json({ ok: true });
  } catch (err) {
    console.error('contato error', err);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/api/contratacao', async (req, res) => {
  try {
    const entry = Object.assign({}, req.body, {
      receivedAt: Date.now(),
      ip: req.ip,
    });
    await appendToJson('contratacoes', entry);
    res.json({ ok: true });
  } catch (err) {
    console.error('contratacao error', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Admin route - mainly served by static files in Frontend
app.get('/admin', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'admin.html'));
});

// Simple admin login endpoint used by Frontend/admin-login.html
// This implements a fixed password as requested: always accept "1234"
// Simple admin login endpoint used by Frontend/admin-login.html
app.post('/admin/login', (req, res) => {
  try {
    const password = req.body && req.body.password ? String(req.body.password) : '';
    // Compare with configured admin password (set via `ADMIN_PASSWORD` env var)
    if (password === ADMIN_PASSWORD) {
      // mark session as logged in
      req.session.admin = true;
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Senha inválida' });
  } catch (err) {
    console.error('admin login error', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Endpoint para checar status de admin (sessão)
app.get('/api/admin/status', (req, res) => {
  try {
    const isAdmin = !!(req.session && req.session.admin);
    return res.json({ admin: isAdmin });
  } catch (err) {
    return res.status(500).json({ admin: false });
  }
});

// Middleware to require admin session for protected routes
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  // If API call, return 401; if normal request, redirect to login.
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autorizado' });
  return res.redirect('/admin-login.html');
}

// Admin API: expose JSON data and destructive operations used by the admin UI
app.get('/api/admin/inscricoes', requireAdmin, async (req, res) => {
  try {
    const data = await readJson('inscricoes');
    return res.json(data);
  } catch (err) {
    console.error('GET inscricoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/contatos', requireAdmin, async (req, res) => {
  try {
    const data = await readJson('contatos');
    return res.json(data);
  } catch (err) {
    console.error('GET contatos error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/contratacoes', requireAdmin, async (req, res) => {
  try {
    const data = await readJson('contratacoes');
    return res.json(data);
  } catch (err) {
    console.error('GET contratacoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Clear all inscrições
app.post('/api/admin/inscricoes/clear', requireAdmin, async (req, res) => {
  try {
    await writeJson('inscricoes', []);
    return res.json({ ok: true });
  } catch (err) {
    console.error('clear inscricoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Delete a specific inscrição by index (body: { index })
app.post('/api/admin/inscricoes/delete', requireAdmin, async (req, res) => {
  try {
    const idx = Number(req.body && req.body.index);
    const arr = await readJson('inscricoes');
    if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) return res.status(400).json({ error: 'Índice inválido' });
    arr.splice(idx, 1);
    await writeJson('inscricoes', arr);
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete inscricoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Clear all contatos
app.post('/api/admin/contatos/clear', requireAdmin, async (req, res) => {
  try {
    await writeJson('contatos', []);
    return res.json({ ok: true });
  } catch (err) {
    console.error('clear contatos error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Delete a specific contato by index
app.post('/api/admin/contatos/delete', requireAdmin, async (req, res) => {
  try {
    const idx = Number(req.body && req.body.index);
    const arr = await readJson('contatos');
    
    console.log(`[DELETE CONTATO] Tentando deletar índice ${idx} do array com ${arr.length} itens`);
    
    if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) {
      console.error(`[DELETE CONTATO] Índice inválido: ${idx}, tamanho: ${arr.length}`);
      return res.status(400).json({ error: `Índice inválido: ${idx}` });
    }
    
    arr.splice(idx, 1);
    await writeJson('contatos', arr);
    console.log(`[DELETE CONTATO] ✅ Contato deletado com sucesso`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete contatos error', err);
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

// Delete endpoint for DELETE method (contatos)
app.delete('/api/admin/contatos/delete', requireAdmin, async (req, res) => {
  try {
    const idx = Number(req.body && req.body.index);
    const arr = await readJson('contatos');
    
    console.log(`[DELETE CONTATO] Tentando deletar índice ${idx} do array com ${arr.length} itens`);
    
    if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) {
      console.error(`[DELETE CONTATO] Índice inválido: ${idx}, tamanho: ${arr.length}`);
      return res.status(400).json({ error: `Índice inválido: ${idx}` });
    }
    
    arr.splice(idx, 1);
    await writeJson('contatos', arr);
    console.log(`[DELETE CONTATO] ✅ Contato deletado com sucesso`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete contatos error', err);
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

// Clear all contratações
app.post('/api/admin/contratacoes/clear', requireAdmin, async (req, res) => {
  try {
    await writeJson('contratacoes', []);
    return res.json({ ok: true });
  } catch (err) {
    console.error('clear contratacoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Delete a specific contratacao by index
app.post('/api/admin/contratacoes/delete', requireAdmin, async (req, res) => {
  try {
    const idx = Number(req.body && req.body.index);
    const arr = await readJson('contratacoes');
    
    console.log(`[DELETE CONTRATACAO] Tentando deletar índice ${idx} do array com ${arr.length} itens`);
    
    if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) {
      console.error(`[DELETE CONTRATACAO] Índice inválido: ${idx}, tamanho: ${arr.length}`);
      return res.status(400).json({ error: `Índice inválido: ${idx}` });
    }
    
    arr.splice(idx, 1);
    await writeJson('contratacoes', arr);
    console.log(`[DELETE CONTRATACAO] ✅ Contratação deletada com sucesso`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete contratacoes error', err);
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

// Delete endpoint for DELETE method (contratacoes)
app.delete('/api/admin/contratacoes/delete', requireAdmin, async (req, res) => {
  try {
    const idx = Number(req.body && req.body.index);
    const arr = await readJson('contratacoes');
    
    console.log(`[DELETE CONTRATACAO] Tentando deletar índice ${idx} do array com ${arr.length} itens`);
    
    if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) {
      console.error(`[DELETE CONTRATACAO] Índice inválido: ${idx}, tamanho: ${arr.length}`);
      return res.status(400).json({ error: `Índice inválido: ${idx}` });
    }
    
    arr.splice(idx, 1);
    await writeJson('contratacoes', arr);
    console.log(`[DELETE CONTRATACAO] ✅ Contratação deletada com sucesso`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete contratacoes error', err);
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

// Logout endpoint: destroy session server-side
app.post('/api/admin/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Erro ao destruir sessão', err);
        return res.status(500).json({ error: 'failed' });
      }
      // Clear cookie
      res.clearCookie('connect.sid');
      return res.json({ ok: true });
    });
  } else {
    return res.json({ ok: true });
  }
});

// Serve /admin route only if session is present (prevents simple bypass)
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'admin.html'));
});

// GET /api/events - Carrega os eventos (público)
app.get('/api/events', async (req, res) => {
  try {
    const events = await readJson('events');
    return res.json(events || []);
  } catch (err) {
    console.error('Erro carregando events.json:', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Compatibilidade (PT-BR): GET /api/eventos
app.get('/api/eventos', async (req, res) => {
  try {
    let events = [];
    
    // ✅ Tentar ler do PostgreSQL primeiro (persistente no Render)
    if (USE_POSTGRES) {
      try {
        const result = await pgQuery(`SELECT data FROM events ORDER BY createdAt DESC LIMIT 1`);
        if (result.rows && result.rows.length > 0) {
          const data = result.rows[0].data;
          events = typeof data === 'string' ? JSON.parse(data) : (Array.isArray(data) ? data : []);
          console.log('[GET /api/eventos] ✅ Carregadas ' + events.length + ' apresentações do PostgreSQL');
          return res.json(Array.isArray(events) ? events : []);
        } else {
          // Tabela existe mas está vazia - retornar array vazio, não fallback
          console.log('[GET /api/eventos] ℹ️  PostgreSQL vazio, retornando array vazio');
          return res.json([]);
        }
      } catch (e) {
        console.error('[GET /api/eventos] ❌ Erro ao ler PostgreSQL:', e.message);
        // Em produção, não fallback para JSON - retornar vazio é mais seguro que dados antigos
        return res.json([]);
      }
    }
    
    // Fallback para JSON (dev local)
    events = await readJson('events');
    console.log('[GET /api/eventos] Carregadas ' + (events ? events.length : 0) + ' apresentações do JSON');
    return res.json(events || []);
  } catch (err) {
    console.error('Erro carregando events.json (alias /api/eventos):', err);
    return res.json([]);
  }
});

// ===== WEBSOCKET CHAT =====
// Handler para WebSocket de chat em tempo real
// DESABILITADO PARA EVITAR CONFLITOS - Chat usando apenas HTTP endpoints
/*
chatWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const videoId = url.searchParams.get('videoId');
  
  if (!videoId) {
    console.log('[Chat WS] Conexão sem videoId, fechando...');
    ws.close();
    return;
  }

  // Adicionar cliente ao grupo do vídeo
  if (!chatClients.has(videoId)) {
    chatClients.set(videoId, new Set());
  }
  chatClients.get(videoId).add(ws);
  
  console.log(`[Chat WS] Nova conexão para ${videoId} - Total: ${chatClients.get(videoId).size}`);
  
  // Enviar confirmação de conexão
  ws.send(JSON.stringify({ type: 'connected', videoId }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[Chat WS] Mensagem recebida para ${videoId}:`, message.type);
      
      // Rebroadcast para todos os outros clientes do mesmo videoId
      if (message.type === 'message' && message.data) {
        broadcastChatMessage(videoId, message.data);
      }
    } catch (e) {
      console.warn('[Chat WS] Erro ao processar mensagem:', e.message);
    }
  });

  ws.on('close', () => {
    const clients = chatClients.get(videoId);
    if (clients) {
      clients.delete(ws);
      console.log(`[Chat WS] Desconexão de ${videoId} - Total: ${clients.size}`);
      if (clients.size === 0) {
        chatClients.delete(videoId);
      }
    }
  });

  ws.on('error', (err) => {
    console.warn('[Chat WS] Erro:', err.message);
  });
});
*/

// ===== USER PROFILE ENDPOINT =====
app.post('/api/user/update-profile', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { userId, newName, avatar } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    if (!newName && !avatar) {
      return res.status(400).json({ error: 'Envie pelo menos um dado para atualizar' });
    }

    console.log(`[User] Atualizando perfil: ${userId}, nome: ${newName ? 'sim' : 'não'}, avatar: ${avatar ? 'sim' : 'não'}`);

    // Para este projeto, armazenaremos o nome e avatar no sessionStorage/localStorage do cliente
    // Se precisar persistir no servidor, você pode adicionar uma tabela de perfis no banco
    
    // Por enquanto, apenas retornamos sucesso
    // O cliente mantém os dados em sessionStorage
    
    return res.json({ 
      ok: true, 
      message: 'Perfil atualizado com sucesso',
      data: {
        userId,
        name: newName,
        avatarSize: avatar ? avatar.length : 0
      }
    });
  } catch (err) {
    console.error('[User] Erro ao atualizar perfil:', err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// ===== CHAT ENDPOINTS =====

// POST /api/chat - Salva uma mensagem de chat
app.post('/api/chat', express.json(), async (req, res) => {
  try {
    console.log('[CHAT POST] Recebido:', req.body);
    const { videoId, user, email, role, text, timestamp } = req.body;
    
    // Validações básicas
    if (!videoId || !user || !text) {
      console.warn('[CHAT POST] Validação falhou - campos obrigatórios faltando');
      return res.status(400).json({ error: 'Missing required fields: videoId, user, text are required' });
    }
    
    // Limpar texto contra XSS
    const cleanText = text.substring(0, 200); // Limite 200 caracteres
    const cleanUser = user.substring(0, 100);
    const cleanEmail = email ? email.substring(0, 100) : null;
    const cleanRole = role ? role.substring(0, 20) : 'USUARIO';
    
    console.log(`[CHAT] Salvando mensagem: ${cleanUser} (${cleanRole}) no vídeo ${videoId}`);
    
    if (USE_POSTGRES) {
      // PostgreSQL - Tentar sem colunas opcionais primeiro
      try {
        // Tentar inserir SEM email e role (mais compatível)
        const result = await pgQuery(
          `INSERT INTO chat_messages (videoId, user, text, timestamp) VALUES ($1, $2, $3, $4) RETURNING id`,
          [videoId, cleanUser, cleanText, timestamp]
        );
        
        if (!result.rows || !result.rows[0]) {
          console.error('[CHAT] Erro: resultado vazio do PostgreSQL');
          return res.status(500).json({ error: 'Database error: no result returned' });
        }
        
        console.log(`[CHAT] ✅ Mensagem salva (sem email/role) com ID: ${result.rows[0].id}`);
        
        // ✨ Broadcast via WebSocket
        const messageToSend = {
          id: result.rows[0].id,
          videoId,
          user: cleanUser,
          text: cleanText,
          timestamp,
          createdAt: new Date().toISOString()
        };
        try {
          broadcastChatMessage(videoId, messageToSend);
        } catch (wsErr) {
          console.warn('[CHAT] Erro ao fazer broadcast (não crítico):', wsErr.message);
        }
        
        return res.json({ success: true, id: result.rows[0].id });
      } catch (err) {
        console.warn('[CHAT] Erro ao salvar sem email/role:', err.message);
        // Se falhar, tentar COM email e role
        try {
          const result = await pgQuery(
            `INSERT INTO chat_messages (videoId, user, email, role, text, timestamp) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [videoId, cleanUser, cleanEmail, cleanRole, cleanText, timestamp]
          );
          
          if (!result.rows || !result.rows[0]) {
            console.error('[CHAT] Erro: resultado vazio do PostgreSQL (com email/role)');
            return res.status(500).json({ error: 'Database error: no result returned' });
          }
          
          console.log(`[CHAT] ✅ Mensagem salva (com email/role) com ID: ${result.rows[0].id}`);
          
          // ✨ Broadcast via WebSocket
          const messageToSend = {
            id: result.rows[0].id,
            videoId,
            user: cleanUser,
            email: cleanEmail,
            role: cleanRole,
            text: cleanText,
            timestamp,
            createdAt: new Date().toISOString()
          };
          try {
            broadcastChatMessage(videoId, messageToSend);
          } catch (wsErr) {
            console.warn('[CHAT] Erro ao fazer broadcast (não crítico):', wsErr.message);
          }
          
          return res.json({ success: true, id: result.rows[0].id });
        } catch (err2) {
          console.error('[CHAT] ❌ Erro ao salvar mensagem (PostgreSQL):', err2);
          return res.status(500).json({ error: 'Failed to save message', details: err2.message });
        }
      }
    } else {
      // SQLite - Tentar sem email/role primeiro
      try {
        const result = await dbRun(
          `INSERT INTO chat_messages (videoId, user, text, timestamp) VALUES (?, ?, ?, ?)`,
          [videoId, cleanUser, cleanText, timestamp]
        );
        console.log(`[CHAT] ✅ Mensagem salva (sem email/role) com ID: ${result.lastID}`);
        
        // ✨ Broadcast via WebSocket
        const messageToSend = {
          id: result.lastID,
          videoId,
          user: cleanUser,
          text: cleanText,
          timestamp,
          createdAt: new Date().toISOString()
        };
        broadcastChatMessage(videoId, messageToSend);
        
        return res.json({ success: true, id: result.lastID });
      } catch (err) {
        console.warn('[CHAT] Erro ao salvar sem email/role:', err.message);
        try {
          const result = await dbRun(
            `INSERT INTO chat_messages (videoId, user, email, role, text, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
            [videoId, cleanUser, cleanEmail, cleanRole, cleanText, timestamp]
          );
          console.log(`[CHAT] ✅ Mensagem salva (com email/role) com ID: ${result.lastID}`);
          
          // ✨ Broadcast via WebSocket
          const messageToSend = {
            id: result.lastID,
            videoId,
            user: cleanUser,
            email: cleanEmail,
            role: cleanRole,
            text: cleanText,
            timestamp,
            createdAt: new Date().toISOString()
          };
          broadcastChatMessage(videoId, messageToSend);
          
          return res.json({ success: true, id: result.lastID });
        } catch (err2) {
          console.error('[CHAT] ❌ Erro ao salvar mensagem (SQLite):', err2);
          return res.status(500).json({ error: 'Failed to save message', details: err2.message });
        }
      }
    }
  } catch (err) {
    console.error('[CHAT] ❌ Erro crítico ao salvar mensagem de chat:', err);
    return res.status(500).json({ error: 'Failed to save message', details: err.message });
  }
});

// GET /api/chat - Carrega mensagens de chat para um vídeo
app.get('/api/chat', async (req, res) => {
  try {
    const { videoId, limit = 100 } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }
    
    const limitNum = Math.min(parseInt(limit) || 100, 500);
    
    if (USE_POSTGRES) {
      try {
        const result = await pgQuery(
          `SELECT id, videoId, user, email, role, text, timestamp, createdAt 
           FROM chat_messages 
           WHERE videoId = $1 
           ORDER BY createdAt ASC 
           LIMIT $2`,
          [videoId, limitNum]
        );
        return res.json(result.rows || []);
      } catch (err) {
        console.warn('[CHAT GET] PostgreSQL error, trying without email/role:', err.message);
        try {
          const result = await pgQuery(
            `SELECT id, videoId, user, text, timestamp, createdAt 
             FROM chat_messages 
             WHERE videoId = $1 
             ORDER BY createdAt ASC 
             LIMIT $2`,
            [videoId, limitNum]
          );
          return res.json(result.rows || []);
        } catch (err2) {
          console.error('[CHAT GET] PostgreSQL fallback also failed:', err2.message);
          return res.json([]);
        }
      }
    } else {
      try {
        const messages = await dbAll(
          `SELECT id, videoId, user, email, role, text, timestamp, createdAt 
           FROM chat_messages 
           WHERE videoId = ? 
           ORDER BY createdAt ASC 
           LIMIT ?`,
          [videoId, limitNum]
        );
        return res.json(messages || []);
      } catch (err) {
        console.warn('[CHAT GET] SQLite error, trying without email/role:', err.message);
        try {
          const messages = await dbAll(
            `SELECT id, videoId, user, text, timestamp, createdAt 
             FROM chat_messages 
             WHERE videoId = ? 
             ORDER BY createdAt ASC 
             LIMIT ?`,
            [videoId, limitNum]
          );
          return res.json(messages || []);
        } catch (err2) {
          console.error('[CHAT GET] SQLite fallback also failed:', err2.message);
          return res.json([]);
        }
      }
    }
  } catch (err) {
    console.error('[CHAT GET] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// DELETE /api/chat/:id - Remove uma mensagem (admin only)
app.delete('/api/chat/:id', async (req, res) => {
  try {
    // Verificar se é admin
    if (!req.session || !req.session.isAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    const { id } = req.params;
    
    if (USE_POSTGRES) {
      // PostgreSQL
      await pgQuery(`DELETE FROM chat_messages WHERE id = $1`, [id]);
    } else {
      // SQLite
      await dbRun(`DELETE FROM chat_messages WHERE id = ?`, [id]);
    }
    
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar mensagem de chat:', err);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

// POST /api/chat/clear - Limpar todas as mensagens de um vídeo (apenas proprietario/adm)
app.post('/api/chat/clear', express.json(), async (req, res) => {
  try {
    const { videoId, userRole, userName } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }
    
    // Verificar se é admin do sistema OU proprietario/adm do chat
    const isSystemAdmin = req.session && req.session.isAdmin;
    const isChatAdmin = userRole === 'ADM' || userRole === 'PROPRIETARIO';
    
    if (!isSystemAdmin && !isChatAdmin) {
      console.warn(`[CHAT/CLEAR] Tentativa de limpar chat por ${userName} (role: ${userRole})`);
      return res.status(403).json({ error: 'Only admin/proprietario can clear chat' });
    }
    
    if (USE_POSTGRES) {
      // PostgreSQL
      await pgQuery(`DELETE FROM chat_messages WHERE videoId = $1`, [videoId]);
    } else {
      // SQLite
      await dbRun(`DELETE FROM chat_messages WHERE videoId = ?`, [videoId]);
    }
    
    console.log(`[CHAT] ✅ Chat do vídeo ${videoId} limpo por ${userName} (${userRole})`);
    return res.json({ success: true, message: 'Chat cleared' });
  } catch (err) {
    console.error('Erro ao limpar chat:', err);
    return res.status(500).json({ error: 'Failed to clear chat', details: err.message });
  }
});

// GET /api/chat/proprietario - Retorna quem é o proprietário do chat
app.get('/api/chat/proprietario', express.json(), async (req, res) => {
  try {
    const { videoId } = req.query;
    // Por enquanto, retorna que não há proprietário definido no servidor
    // Pode ser expandido para salvar proprietário por vídeo no banco
    return res.json({ name: null, videoId: videoId });
  } catch (err) {
    console.error('[CHAT] Erro ao carregar proprietário:', err);
    return res.status(500).json({ error: 'Failed to load proprietario' });
  }
});

// POST /api/chat/proprietario - Define/registra o proprietário
app.post('/api/chat/proprietario', express.json(), async (req, res) => {
  try {
    const { userName, videoId } = req.body;
    
    if (!userName) {
      return res.status(400).json({ error: 'userName is required' });
    }
    
    console.log(`[CHAT] 👑 Proprietário registrado: ${userName} para vídeo ${videoId || 'global'}`);
    return res.json({ success: true, name: userName });
  } catch (err) {
    console.error('[CHAT] Erro ao registrar proprietário:', err);
    return res.status(500).json({ error: 'Failed to register proprietario' });
  }
});

// GET /api/chat/admins-list - Retorna lista de ADMs
app.get('/api/chat/admins-list', express.json(), async (req, res) => {
  try {
    // Por enquanto, retorna lista vazia (pode ser expandido para buscar do banco)
    return res.json({ admins: [] });
  } catch (err) {
    console.error('[CHAT] Erro ao carregar lista de ADMs:', err);
    return res.status(500).json({ error: 'Failed to load admins list' });
  }
});

// POST /api/chat/promote-admin - Promover usuário a ADM
app.post('/api/chat/promote-admin', express.json(), async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    // Verificar se é admin
    if (!req.session || !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only admin can promote users' });
    }
    
    console.log(`[CHAT] ⚡ Usuário promovido a ADM: ${email}`);
    return res.json({ success: true, message: 'User promoted to admin' });
  } catch (err) {
    console.error('[CHAT] Erro ao promover ADM:', err);
    return res.status(500).json({ error: 'Failed to promote admin' });
  }
});

// POST /api/chat/demote-admin - Remover ADM
app.post('/api/chat/demote-admin', express.json(), async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    // Verificar se é admin
    if (!req.session || !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only admin can demote users' });
    }
    
    console.log(`[CHAT] ❌ ADM removido: ${email}`);
    return res.json({ success: true, message: 'User demoted from admin' });
  } catch (err) {
    console.error('[CHAT] Erro ao remover ADM:', err);
    return res.status(500).json({ error: 'Failed to demote admin' });
  }
});

// GET /api/photos - retorna photos.json (público)
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await readJson('photos.json');
    return res.json(photos || []);
  } catch (err) {
    console.error('GET /api/photos error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Compatibilidade (PT-BR): GET /api/fotos
app.get('/api/fotos', async (req, res) => {
  try {
    const photos = await readJson('photos');
    return res.json(photos || []);
  } catch (err) {
    console.error('GET /api/fotos error (alias):', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// GET /api/brincantes - retorna brincantes (categoria='brincantes' em photos.json) - PÚBLICO
app.get('/api/brincantes', async (req, res) => {
  try {
    const photos = await readJson('photos');
    // include both legacy 'brincantes' and the new 'carrossel-brincantes' category
    const brincantes = Array.isArray(photos) ? photos.filter(p => (p.categoria === 'brincantes' || p.categoria === 'carrossel-brincantes')) : [];
    return res.json(brincantes);
  } catch (err) {
    console.error('GET /api/brincantes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// GET /api/historias - retorna stories.json (público) - compatibilidade PT-BR
app.get('/api/historias', async (req, res) => {
  try {
    const stories = await readJson('stories');
    return res.json(stories || []);
  } catch (err) {
    console.error('GET /api/historias error:', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// DELETE /api/brincantes/:id - remove brincante por src (admin only)
app.post('/api/brincantes/delete', requireAdmin, async (req, res) => {
  try {
    const src = req.body && req.body.src ? String(req.body.src) : null;
    if (!src) return res.status(400).json({ error: 'src obrigatório' });
    const photos = await readJson('photos');
    // normalize src param: handle absolute URLs, leading slashes, or relative paths
    function normalizeSrcParam(s){
      if(!s) return s;
      try {
        const u = new URL(s, 'http://localhost');
        let p = u.pathname || '';
        if(p.startsWith('/')) p = p.slice(1);
        return p;
      } catch(e){
        return String(s).replace(/^\/+/, '');
      }
    }
    const normalized = normalizeSrcParam(src);
    // find matching photos by exact match or by filename fallback
    let toRemove = photos.filter(p => p.src === normalized || p.src === src || p.src === ('/' + normalized));
    if(toRemove.length === 0){
      const base = require('path').basename(normalized);
      toRemove = photos.filter(p => p.src && p.src.endsWith(base));
    }
    if(!toRemove || toRemove.length === 0) return res.status(404).json({ error: 'brincante_nao_encontrado' });

    // attempt to unlink files from disk for each matched photo
    for(const p of toRemove){
      try {
        const filePath = path.join(__dirname, '..', 'Frontend', p.src);
        await fs.unlink(filePath);
      } catch (e) {
        console.warn('Could not unlink file for brincante delete:', p.src, e && e.message ? e.message : e);
      }
    }

    // write photos without the removed entries
    const remaining = photos.filter(p => !toRemove.some(r => r === p || r.src === p.src));
    await writeJson('photos', remaining);
    try { broadcast({ type: 'brincantesUpdated', count: remaining.filter(p => (p.categoria === 'brincantes' || p.categoria === 'carrossel-brincantes')).length }); } catch (e) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/brincantes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// POST /api/photos - grava array de fotos (admin only)
app.post('/api/photos', requireAdmin, async (req, res) => {
  try {
    // accept { photos: [...] } or an array in the body
    const arr = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.photos) ? req.body.photos : null);
    if (!Array.isArray(arr)) return res.status(400).json({ error: 'Esperado um array de fotos' });
    // ensure basic shape
    const safe = arr.map(item => ({ src: item.src || '', name: item.name || '', role: item.role || '', categoria: item.categoria || 'brincantes' }));
    await writeJson('photos', safe);
    
    // ✅ Salvar em PostgreSQL para persistência no Render
    if (USE_POSTGRES) {
      try {
        await pgQuery(`DELETE FROM photos`);
        await pgQuery(`INSERT INTO photos (data) VALUES ($1)`, [JSON.stringify(safe)]);
        console.log('[POST /api/photos] ✅ Fotos salvas em PostgreSQL');
      } catch (e) {
        console.warn('[POST /api/photos] Aviso ao salvar em PostgreSQL:', e.message);
      }
    }
    
    try { broadcast({ type: 'brincantesUpdated', count: safe.filter(p => (p.categoria === 'brincantes' || p.categoria === 'carrossel-brincantes')).length }); } catch (e) {}
    try { broadcast({ type: 'photosUpdated', count: safe.length }); } catch (e) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro salvando photos.json:', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// ✅ GET /api/fotos - Carrega fotos do PostgreSQL (persistente no Render) ou fallback JSON
app.get('/api/fotos', async (req, res) => {
  try {
    let photos = [];
    
    // Tentar ler do PostgreSQL primeiro (persistente no Render)
    if (USE_POSTGRES) {
      try {
        const result = await pgQuery(`SELECT data FROM photos ORDER BY createdAt DESC LIMIT 1`);
        if (result.rows && result.rows.length > 0) {
          photos = JSON.parse(result.rows[0].data);
          console.log('[GET /api/fotos] ✅ Carregadas do PostgreSQL');
          return res.json(photos || []);
        }
      } catch (e) {
        console.warn('[GET /api/fotos] Aviso ao ler PostgreSQL:', e.message);
      }
    }
    
    // Fallback para JSON (dev local)
    photos = await readJson('photos');
    return res.json(photos || []);
  } catch (err) {
    console.error('[GET /api/fotos] erro:', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// ===== CAROUSEL-TITULO ENDPOINTS =====
// GET /api/carousel-titulo/list - retorna imagens do carousel de títulos (categoria='titulo')
app.get('/api/carousel-titulo/list', async (req, res) => {
  try {
    const photos = await readJson('photos');
    const carouselImages = Array.isArray(photos) ? photos.filter(p => p.categoria === 'titulo') : [];
    return res.json(carouselImages);
  } catch (err) {
    console.error('GET /api/carousel-titulo/list error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// POST /api/carousel-titulo/delete - remover imagem do carousel (admin only)
app.post('/api/carousel-titulo/delete', requireAdmin, async (req, res) => {
  try {
    const src = req.body && req.body.src ? String(req.body.src) : null;
    if (!src) return res.status(400).json({ error: 'src obrigatório' });
    const photos = await readJson('photos');
    const filtered = photos.filter(p => p.src !== src);
    if (filtered.length === photos.length) return res.status(404).json({ error: 'imagem_nao_encontrada' });
    
    // Tentar remover arquivo fisicamente
    try {
      const filePath = path.join(__dirname, '..', 'Frontend', src.replace(/\//g, path.sep));
      await fs.unlink(filePath);
    } catch (e) {
      console.warn('Could not delete file:', e.message);
    }
    
    await writeJson('photos', filtered);
    // ✅ Atualizar PostgreSQL
    if (USE_POSTGRES) {
      try {
        await pgQuery(`DELETE FROM photos`);
        await pgQuery(`INSERT INTO photos (data) VALUES ($1)`, [JSON.stringify(filtered)]);
        console.log('[POST /api/carousel-titulo/delete] ✅ Atualizado PostgreSQL');
      } catch (e) {
        console.warn('[POST /api/carousel-titulo/delete] Aviso ao atualizar PostgreSQL:', e.message);
      }
    }
    // notify SSE clients
    try { sendSseEvent('carousel-update', { type: 'delete', src }); } catch (e) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/carousel-titulo/delete error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// POST /api/photos/delete - remover imagem da galeria (admin only, realtime para todos)
app.post('/api/photos/delete', requireAdmin, async (req, res) => {
  try {
    const src = req.body && req.body.src ? String(req.body.src) : null;
    if (!src) return res.status(400).json({ error: 'src obrigatório' });
    const photos = await readJson('photos');
    const filtered = photos.filter(p => p.src !== src);
    if (filtered.length === photos.length) return res.status(404).json({ error: 'imagem_nao_encontrada' });
    
    // Tentar remover arquivo fisicamente
    try {
      const filePath = path.join(__dirname, '..', 'Frontend', src.replace(/\//g, path.sep));
      await fs.unlink(filePath);
    } catch (e) {
      console.warn('Could not delete photo file:', e.message);
    }
    
    await writeJson('photos', filtered);
    // ✅ Atualizar PostgreSQL
    if (USE_POSTGRES) {
      try {
        await pgQuery(`DELETE FROM photos`);
        await pgQuery(`INSERT INTO photos (data) VALUES ($1)`, [JSON.stringify(filtered)]);
        console.log('[POST /api/photos/delete] ✅ Atualizado PostgreSQL');
      } catch (e) {
        console.warn('[POST /api/photos/delete] Aviso ao atualizar PostgreSQL:', e.message);
      }
    }
    // notify all SSE clients in realtime
    try { sendSseEvent('photos-update', { type: 'delete', src }); } catch (e) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/photos/delete error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// POST /api/delete-story - remover categoria de fotos (admin only, realtime para todos)
app.post('/api/delete-story', requireAdmin, async (req, res) => {
  try {
    const title = req.body && req.body.title ? String(req.body.title) : null;
    if (!title) return res.status(400).json({ error: 'title obrigatório' });
    const stories = await readJson('stories');
    const filtered = stories.filter(s => (s.categoria || s.title) !== title);
    if (filtered.length === stories.length) return res.status(404).json({ error: 'categoria_nao_encontrada' });
    
    // Tentar remover pasta da categoria
    try {
      function normalizeFolder(name){
        if(!name) return '';
        // allow hyphens in folder names (e.g. 'carrossel-brincantes')
        return String(name).toLowerCase().replace(/[^a-z0-9\-]/g,'');
      }
      const folderName = normalizeFolder(title);
      const categoryDir = path.join(IMAGES_DIR, folderName);
      const files = await fs.readdir(categoryDir);
      for (const file of files) {
        await fs.unlink(path.join(categoryDir, file));
      }
      await fs.rmdir(categoryDir);
    } catch (e) {
      console.warn('Could not delete story folder:', e.message);
    }

    // Remover todas as fotos dessa categoria de photos também
    const photos = await readJson('photos');
    const photosFiltered = photos.filter(p => p.categoria !== title);
    await writeJson('photos', photosFiltered);
    
    await writeJson('stories', filtered);
    // notify all SSE clients in realtime
    try { sendSseEvent('stories-update', { type: 'delete', title }); } catch (e) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/delete-story error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// POST /api/events - replace events.json with the posted array (permite qualquer um em dev)
app.post('/api/events', async (req, res) => {
  try {
    // Accept either an array in the body or { events: [...] }
    const arr = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.events) ? req.body.events : null);
    if (!Array.isArray(arr)) return res.status(400).json({ error: 'Esperado um array de eventos' });
    await writeJson('events', arr);
    
    // ✅ Salvar em PostgreSQL para persistência no Render
    if (USE_POSTGRES) {
      try {
        await pgQuery(`DELETE FROM events`);
        await pgQuery(`INSERT INTO events (data) VALUES ($1)`, [JSON.stringify(arr)]);
        console.log('[POST /api/events] ✅ Apresentações salvas em PostgreSQL');
      } catch (e) {
        console.warn('[POST /api/events] Aviso ao salvar em PostgreSQL:', e.message);
      }
    }
    
    // Notify connected websocket clients that events were updated
    try { broadcast({ type: 'eventsUpdated', count: arr.length }); } catch (e) { /* ignore */ }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro salvando events.json:', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Start server
ensureStorageFiles()
  .then(() => {
    console.log(`[Server] Starting on port ${PORT}`);
    // Chat state removed; continue startup
    return loadPlaylistFromFile();
  })
  .then(() => {
    // Setup WebSocket server para playlist
    wss.on('connection', (ws, req) => {
      console.log(`[Playlist WS] Nova conexão - Total: ${playlistClients.size + 1}`);
      console.log(`[Playlist WS] Client IP: ${req.socket.remoteAddress}`);
      playlistClients.add(ws);

      // Envia confirmação de conexão + playlist atual
      // Garante que todos os campos necessários estão presentes
      const playlistToSend = playlistCache.musics.map(m => ({
        id: m.id,
        title: m.title || 'Sem título',
        artist: m.artist || 'Artista desconhecido',
        fileName: m.fileName || '',
        addedAt: m.addedAt || new Date().toISOString(),
        serverUrl: m.serverUrl || null  // Garante que serverUrl é enviado se existir
      }));

      console.log(`[Playlist WS] Enviando ${playlistToSend.length} músicas para novo cliente`);
      try {
        ws.send(JSON.stringify({ 
          action: 'connected', 
          data: {
            message: 'Conectado à playlist em tempo real',
            playlist: playlistToSend
          },
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('[Playlist WS] Erro ao enviar mensagem de conexão:', err.message);
      }

      // Recebe mensagens do cliente
      ws.on('message', (rawData) => {
        try {
          const message = JSON.parse(rawData);
          console.log(`[Playlist WS] Mensagem recebida: ${message.action}`);

          // Processa ping/pong para manter conexão
          if (message.action === 'ping') {
            ws.send(JSON.stringify({ action: 'pong', timestamp: new Date().toISOString() }));
            return;
          }

          // Processa diferentes ações
          if (message.action === 'music_added' && message.data) {
            // Valida que a música tem os campos necessários
            const musicData = {
              id: message.data.id,
              title: message.data.title || 'Sem título',
              artist: message.data.artist || 'Artista desconhecido',
              fileName: message.data.fileName || '',
              addedAt: message.data.addedAt || new Date().toISOString(),
              serverUrl: message.data.serverUrl || null
            };
            playlistCache.musics.push(musicData);
            console.log(`[Playlist WS] Música adicionada: ${musicData.id} - ${musicData.title} (serverUrl: ${musicData.serverUrl ? 'SIM' : 'NÃO'})`);
            savePlaylistToFile();
            // Re-envia com dados normalizados
            broadcastPlaylist(message.action, musicData);
          } else if (message.action === 'music_removed' && message.data) {
            playlistCache.musics = playlistCache.musics.filter(m => m.id !== message.data.id);
            console.log(`[Playlist WS] Música removida: ${message.data.id}`);
            savePlaylistToFile();
            broadcastPlaylist(message.action, message.data);
          } else if (message.action === 'playlist_cleared') {
            playlistCache.musics = [];
            console.log(`[Playlist WS] Playlist limpa`);
            savePlaylistToFile();
            broadcastPlaylist(message.action, {});
          } else if (message.action && message.data) {
            // Re-broadcast para outros clientes (fallback)
            console.log(`[Playlist WS] Ação desconhecida rebroadcastida: ${message.action}`);
            broadcastPlaylist(message.action, message.data);
          }
        } catch (e) {
          console.warn('[Playlist WS] Erro ao processar mensagem:', e.message);
        }
      });

      // Desconexão
      ws.on('close', () => {
        playlistClients.delete(ws);
        console.log(`[Playlist WS] Desconexão - Total: ${playlistClients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[Playlist WS] Erro na conexão:', err.message);
        console.error('[Playlist WS] Error details:', err);
        playlistClients.delete(ws);
      });
    });

    // Start the HTTP server (use the `server` instance so WebSocket Server is attached correctly)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server started on 0.0.0.0:${PORT}`);
      console.log(`📻 WebSocket server para playlist em: ws://<host>:${PORT}/ws/playlist`);
    });
    
    // Handle server errors
    server.on('error', (err) => {
      console.error('❌ Server error:', err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to ensure storage files:', err);
    process.exit(1);
  });

