#!/usr/bin/env node
/**
 * resize-banners.js
 *
 * Small Node script that resizes images to 1920x800 using sharp.
 * Usage:
 *   node scripts/resize-banners.js [file1 file2 ...]
 * If no files are passed, the script will try `Frontend/images/1.png`, `2.png`, `3.png`.
 * Output goes to `Frontend/images/resized/` (created if missing).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'Frontend', 'images');
const outputDir = path.join(imagesDir, 'resized');

const args = process.argv.slice(2);
let files = args.length ? args : ['1.png', '2.png', '3.png'];

if (!fs.existsSync(imagesDir)) {
  console.error('Diretório de imagens não encontrado:', imagesDir);
  process.exit(1);
}

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const WIDTH = 1920;
const HEIGHT = 800;

async function resize(file) {
  const inputPath = path.join(imagesDir, file);
  if (!fs.existsSync(inputPath)) {
    console.warn('Arquivo não encontrado, pulando:', inputPath);
    return;
  }
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const outputName = `${base}-1920x800${ext}`;
  const outputPath = path.join(outputDir, outputName);

  try {
    await sharp(inputPath)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
      .toFile(outputPath);
    console.log('Criado:', outputPath);
  } catch (err) {
    console.error('Erro ao redimensionar', inputPath, err.message);
  }
}

(async () => {
  for (const f of files) {
    await resize(f);
  }
  console.log('Concluído. Arquivos estão em', outputDir);
})();
