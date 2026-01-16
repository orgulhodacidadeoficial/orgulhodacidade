const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const session = require('express-session');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Session
const SESSION_SECRET = process.env.SESSION_SECRET || 'seu-segredo-aqui';
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true }
}));

// Servir arquivos estáticos do Frontend
app.use(express.static(path.join(__dirname, '../Frontend')));

// Data directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Helper para ler/escrever JSON
async function readData(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeData(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Rotas API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor rodando!' });
});

// Inscricoes
app.post('/api/inscricoes', async (req, res) => {
  try {
    const data = await readData('inscricoes.json');
    const novaInscricao = {
      id: Date.now(),
      ...req.body,
      data: new Date().toISOString()
    };
    data[novaInscricao.id] = novaInscricao;
    await writeData('inscricoes.json', data);
    res.json({ success: true, id: novaInscricao.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contatos
app.post('/api/contatos', async (req, res) => {
  try {
    const data = await readData('contatos.json');
    const novoContato = {
      id: Date.now(),
      ...req.body,
      data: new Date().toISOString()
    };
    data[novoContato.id] = novoContato;
    await writeData('contatos.json', data);
    res.json({ success: true, id: novoContato.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir página principal como fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

module.exports = app;
