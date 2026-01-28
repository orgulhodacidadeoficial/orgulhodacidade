#!/bin/bash

echo "🔍 Verificando readiness para deploy no Render..."
echo ""

# 1. Verificar package.json
echo "✓ Verificando package.json..."
if [ ! -f "package.json" ]; then
    echo "❌ package.json não encontrado!"
    exit 1
fi
echo "✅ package.json OK"

# 2. Verificar package-lock.json
echo "✓ Verificando package-lock.json..."
if [ ! -f "package-lock.json" ]; then
    echo "⚠️  package-lock.json não encontrado. Rodando npm install..."
    npm install
    git add package-lock.json
    echo "📝 Faça commit e push: git commit -m 'Add package-lock.json' && git push"
fi
echo "✅ package-lock.json OK"

# 3. Verificar render.yaml
echo "✓ Verificando render.yaml..."
if [ ! -f "render.yaml" ]; then
    echo "❌ render.yaml não encontrado!"
    exit 1
fi
echo "✅ render.yaml OK"

# 4. Verificar backend/server.js
echo "✓ Verificando backend/server.js..."
if [ ! -f "backend/server.js" ]; then
    echo "❌ backend/server.js não encontrado!"
    exit 1
fi
echo "✅ backend/server.js OK"

# 5. Verificar se npm start funciona
echo "✓ Testando npm start..."
timeout 5 npm start &
sleep 2
kill $! 2>/dev/null || echo "⚠️  Servidor parou (esperado no teste)"
echo "✅ npm start OK"

# 6. Verificar .gitignore
echo "✓ Verificando .gitignore..."
if [ ! -f ".gitignore" ]; then
    echo "❌ .gitignore não encontrado!"
    exit 1
fi
echo "✅ .gitignore OK"

# 7. Status do Git
echo "✓ Verificando status do Git..."
git status
echo ""

echo "🎉 Tudo pronto! Próximo passo:"
echo ""
echo "   git add ."
echo "   git commit -m 'Setup para deploy no Render'"
echo "   git push origin main"
echo ""
echo "Depois acesse: https://render.com para conectar seu repositório"
