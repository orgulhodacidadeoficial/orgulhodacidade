# Script para testar persistência de inscrições no SQLite

$dbPath = "c:\Users\Rafael\Downloads\Orgulhodacidade\data\app.db"
$backupPath = "$dbPath.backup"
$serverUrl = "http://localhost:3000"

Write-Host "🧪 Teste de Persistência de Inscrições" -ForegroundColor Cyan
Write-Host "=" * 50

# 1. Fazer backup do banco
Write-Host "`n1️⃣ Fazendo backup do banco atual..." -ForegroundColor Yellow
if(Test-Path $dbPath) {
  Copy-Item $dbPath $backupPath -Force
  Write-Host "✅ Backup salvo em: $backupPath"
  $backupSize = (Get-Item $backupPath).Length
  Write-Host "   Tamanho: $backupSize bytes"
} else {
  Write-Host "❌ Banco não encontrado!"
  exit 1
}

# 2. Fazer uma inscrição de teste
Write-Host "`n2️⃣ Enviando inscrição de teste..." -ForegroundColor Yellow
$inscricao = @{
  nome = "Teste de Persistência - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  idade = 25
  tipo_participacao = "vaqueiro"
  telefone = "123456789"
  bairro = "Centro"
  email = "teste@persistencia.com"
} | ConvertTo-Json

try {
  $response = Invoke-WebRequest -Uri "$serverUrl/api/inscricao" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $inscricao `
    -ErrorAction Stop
  
  Write-Host "✅ Inscrição enviada com sucesso!"
  Write-Host "   Resposta: $($response.Content)"
} catch {
  Write-Host "❌ Erro ao enviar inscrição: $_"
  exit 1
}

# 3. Verificar inscrições atuais
Write-Host "`n3️⃣ Consultando inscrições no banco..." -ForegroundColor Yellow
try {
  $inscrData = Invoke-WebRequest -Uri "$serverUrl/api/admin/inscricoes" `
    -Method GET `
    -ErrorAction Stop | ConvertFrom-Json
  
  $count = if($inscrData -is [array]) { $inscrData.Count } else { 1 }
  Write-Host "✅ Total de inscrições no banco: $count"
  Write-Host "   Primeira inscrição: $($inscrData[0].nome)"
} catch {
  Write-Host "⚠️  Não foi possível acessar as inscrições (esperado sem autenticação)"
}

# 4. Simular rebuild deletando o banco
Write-Host "`n4️⃣ Simulando rebuild do Render (deletando banco)..." -ForegroundColor Yellow
Remove-Item $dbPath -Force
Write-Host "✅ Banco deletado"
Write-Host "   (Em um rebuild real do Render, isso aconteceria naturalmente)"

# 5. Parar e reiniciar servidor
Write-Host "`n5️⃣ Reiniciando servidor..." -ForegroundColor Yellow
Write-Host "   Você deve parar o npm start manualmente e reiniciar"
Write-Host "   (Pressione Ctrl+C no terminal do npm start)"
Write-Host ""
Read-Host "Pressione Enter quando tiver reiniciado o servidor"

# 6. Verificar se inscrições persistiram
Write-Host "`n6️⃣ Verificando se inscrições persistiram..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
  $response = Invoke-WebRequest -Uri "$serverUrl/api/brincantes" `
    -Method GET `
    -ErrorAction Stop
  
  Write-Host "✅ Servidor está respondendo"
  
  # Se você conseguir acessar um endpoint público, o servidor está online
  # As inscrições não podem ser verificadas sem autenticação, mas o banco deveria ter sido recriado
  
  if(Test-Path $dbPath) {
    $newSize = (Get-Item $dbPath).Length
    Write-Host "✅ Novo banco foi criado com tamanho: $newSize bytes"
    
    if($newSize -gt 20000) {
      Write-Host "⚠️  O banco tem dados! Isso sugere que persistiu."
    } else {
      Write-Host "ℹ️  O banco está pequeno (vazio). Inscrições provavelmente não persistiram."
    }
  } else {
    Write-Host "❌ Banco não foi recriado!"
  }
} catch {
  Write-Host "❌ Servidor não está respondendo: $_"
}

Write-Host "`n" + "=" * 50
Write-Host "📝 Resumo:" -ForegroundColor Cyan
Write-Host "  • Se o banco foi recriado vazio = Render vai fazer igual (precisamos do volume)"
Write-Host "  • Se tinha dados = ✅ Volume persistente está funcionando!"
Write-Host "  • Backup salvo em: $backupPath"
Write-Host ""
