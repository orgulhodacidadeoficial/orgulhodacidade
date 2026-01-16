const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const session = require('express-session');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// SQLite database initialization
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro abrindo banco de dados SQLite:', err);
  } else {
    console.log('Conectado ao banco de dados SQLite:', DB_PATH);
    initializeTables();
  }
});

// Wrapper para promessas no SQLite
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
    
    console.log('Tabelas SQLite inicializadas com sucesso');
  } catch (err) {
    console.error('Erro inicializando tabelas:', err);
  }
}
const server = http.createServer(app);
// Server-Sent Events clients (for realtime updates)
const sseClients = new Set();

// WebSocket server para playlist em tempo real
const wss = new WebSocket.Server({ server, path: '/ws/playlist' });
const playlistClients = new Set();

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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
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
// Funções para SQLite
async function appendToJson(tableName, entry) {
  const dataJson = JSON.stringify(entry);
  const receivedAt = entry.receivedAt || Date.now();
  const ip = entry.ip || 'unknown';
  
  await dbRun(
    `INSERT INTO ${tableName} (data, receivedAt, ip) VALUES (?, ?, ?)`,
    [dataJson, receivedAt, ip]
  );
}

async function readJson(tableName) {
  const rows = await dbAll(`SELECT data FROM ${tableName} ORDER BY id DESC`);
  return rows.map(row => {
    try {
      return JSON.parse(row.data);
    } catch {
      return row.data;
    }
  });
}

async function writeJson(tableName, arr) {
  // Delete all and insert new
  await dbRun(`DELETE FROM ${tableName}`);
  for (const entry of arr) {
    await appendToJson(tableName, entry);
  }
}

// Ensure storage tables exist on startup (chamado em initializeTables)
async function ensureStorageFiles() {
  // Já feito em initializeTables()
  console.log('Storage tables já inicializados via SQLite');
}

// --- User helpers: password hashing + simple users store in Frontend/users.json ---
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

async function findUserByEmail(email) {
  const user = await dbGet(
    'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
    [email]
  );
  return user || null;
}

async function createUser({ name, email, password }) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('UserExists');
  const { salt, hash } = hashPassword(password);
  const userId = crypto.randomBytes(12).toString('hex');
  const user = {
    id: userId,
    name: name || 'Usuário',
    email,
    passwordHash: hash,
    salt,
    createdAt: Date.now(),
  };
  
  await dbRun(
    `INSERT INTO users (id, name, email, passwordHash, salt, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.name, user.email, user.passwordHash, user.salt, user.createdAt]
  );
  
  return user;
}

async function verifyUserCredentials(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const { hash } = hashPassword(password, user.salt);
  if (hash === user.passwordHash) return user;
  return null;
}


// --- Auth endpoints: register / login / logout / me ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const normalizedEmail = String(email).toLowerCase();
    try {
      const user = await createUser({ name, email: normalizedEmail, password });
      // create session
      req.session.userId = user.id;
      return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
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
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const user = await verifyUserCredentials(email, password);
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    req.session.userId = user.id;
    
    // Chat preferences removed with chat feature; return empty preferences
    let chatPreferences = {};
    
    return res.json({ 
      ok: true, 
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
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.session.userId]);
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
    const entry = Object.assign({}, req.body, {
      receivedAt: Date.now(),
      ip: req.ip,
    });
    await appendToJson('inscricoes.json', entry);
    res.json({ ok: true });
  } catch (err) {
    console.error('inscricao error', err);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/api/contato', async (req, res) => {
  try {
    const entry = Object.assign({}, req.body, {
      receivedAt: Date.now(),
      ip: req.ip,
    });
    await appendToJson('contatos.json', entry);
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
    await appendToJson('contratacoes.json', entry);
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
    const data = await readJson('inscricoes.json');
    return res.json(data);
  } catch (err) {
    console.error('GET inscricoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/contatos', requireAdmin, async (req, res) => {
  try {
    const data = await readJson('contatos.json');
    return res.json(data);
  } catch (err) {
    console.error('GET contatos error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/contratacoes', requireAdmin, async (req, res) => {
  try {
    const data = await readJson('contratacoes.json');
    return res.json(data);
  } catch (err) {
    console.error('GET contratacoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Delete a specific inscrição by index (body: { index })
app.post('/api/admin/inscricoes/delete', requireAdmin, async (req, res) => {
  try {
    const idx = Number(req.body && req.body.index);
    const arr = await readJson('inscricoes.json');
    if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) return res.status(400).json({ error: 'Índice inválido' });
    arr.splice(idx, 1);
    await writeJson('inscricoes.json', arr);
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete inscricoes error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Clear all contatos
app.post('/api/admin/contatos/clear', requireAdmin, async (req, res) => {
  try {
    await writeJson('contatos.json', []);
    return res.json({ ok: true });
  } catch (err) {
    console.error('clear contatos error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Delete a specific contratacao by index
app.post('/api/admin/contratacoes/delete', requireAdmin, async (req, res) => {
  try {
    const idx = Number(req.body && req.body.index);
    const arr = await readJson('contratacoes.json');
    if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) return res.status(400).json({ error: 'Índice inválido' });
    arr.splice(idx, 1);
    await writeJson('contratacoes.json', arr);
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete contratacoes error', err);
    return res.status(500).json({ error: 'failed' });
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
    const events = await readJson('events.json');
    return res.json(events || []);
  } catch (err) {
    console.error('Erro carregando events.json:', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Compatibilidade (PT-BR): GET /api/eventos
app.get('/api/eventos', async (req, res) => {
  try {
    const events = await readJson('events.json');
    return res.json(events || []);
  } catch (err) {
    console.error('Erro carregando events.json (alias /api/eventos):', err);
    return res.status(500).json({ error: 'failed' });
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
    const photos = await readJson('photos.json');
    return res.json(photos || []);
  } catch (err) {
    console.error('GET /api/fotos error (alias):', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// GET /api/brincantes - retorna brincantes (categoria='brincantes' em photos.json) - PÚBLICO
app.get('/api/brincantes', async (req, res) => {
  try {
    const photos = await readJson('photos.json');
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
    const stories = await readJson('stories.json');
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
    const photos = await readJson('photos.json');
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

    // write photos.json without the removed entries
    const remaining = photos.filter(p => !toRemove.some(r => r === p || r.src === p.src));
    await writeJson('photos.json', remaining);
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
    await writeJson('photos.json', safe);
    try { broadcast({ type: 'brincantesUpdated', count: safe.filter(p => (p.categoria === 'brincantes' || p.categoria === 'carrossel-brincantes')).length }); } catch (e) {}
    try { broadcast({ type: 'photosUpdated', count: safe.length }); } catch (e) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro salvando photos.json:', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// ===== CAROUSEL-TITULO ENDPOINTS =====
// GET /api/carousel-titulo/list - retorna imagens do carousel de títulos (categoria='titulo')
app.get('/api/carousel-titulo/list', async (req, res) => {
  try {
    const photos = await readJson('photos.json');
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
    const photos = await readJson('photos.json');
    const filtered = photos.filter(p => p.src !== src);
    if (filtered.length === photos.length) return res.status(404).json({ error: 'imagem_nao_encontrada' });
    
    // Tentar remover arquivo fisicamente
    try {
      const filePath = path.join(__dirname, '..', 'Frontend', src.replace(/\//g, path.sep));
      await fs.unlink(filePath);
    } catch (e) {
      console.warn('Could not delete file:', e.message);
    }
    
    await writeJson('photos.json', filtered);
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
    const photos = await readJson('photos.json');
    const filtered = photos.filter(p => p.src !== src);
    if (filtered.length === photos.length) return res.status(404).json({ error: 'imagem_nao_encontrada' });
    
    // Tentar remover arquivo fisicamente
    try {
      const filePath = path.join(__dirname, '..', 'Frontend', src.replace(/\//g, path.sep));
      await fs.unlink(filePath);
    } catch (e) {
      console.warn('Could not delete photo file:', e.message);
    }
    
    await writeJson('photos.json', filtered);
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
    const stories = await readJson('stories.json');
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

    // Remover todas as fotos dessa categoria de photos.json também
    const photos = await readJson('photos.json');
    const photosFiltered = photos.filter(p => p.categoria !== title);
    await writeJson('photos.json', photosFiltered);
    
    await writeJson('stories.json', filtered);
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
    await writeJson('events.json', arr);
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
      ws.send(JSON.stringify({ 
        action: 'connected', 
        data: {
          message: 'Conectado à playlist em tempo real',
          playlist: playlistToSend
        },
        timestamp: new Date().toISOString()
      }));

      // Recebe mensagens do cliente
      ws.on('message', (rawData) => {
        try {
          const message = JSON.parse(rawData);
          console.log(`[Playlist WS] Mensagem recebida: ${message.action}`);

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
        console.warn('[Playlist WS] Erro:', err.message);
      });
    });

    // Start the HTTP server (use the `server` instance so WebSocket Server is attached correctly)
    server.listen(PORT, () => {
      console.log(`Server started on 0.0.0.0:${PORT}`);
      console.log(`WebSocket server para playlist em: ws://<host>:${PORT}/ws/playlist`);
    });
  })
  .catch((err) => {
    console.error('Failed to ensure storage files:', err);
    process.exit(1);
  });

