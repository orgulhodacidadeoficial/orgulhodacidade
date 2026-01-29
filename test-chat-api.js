/**
 * Script para testar a API de chat
 * Uso: node test-chat-api.js <url-do-servidor>
 * Exemplo: node test-chat-api.js https://seusite.onrender.com
 */

const baseUrl = process.argv[2] || 'http://localhost:3000';

async function testChatAPI() {
    console.log(`🧪 Testando Chat API em: ${baseUrl}\n`);

    // Teste 1: GET /api/health
    try {
        console.log('1️⃣ Testando /api/health...');
        const res = await fetch(`${baseUrl}/api/health`);
        const data = await res.json();
        console.log('✅ Health check:', data);
    } catch (err) {
        console.error('❌ Erro no health check:', err.message);
    }

    console.log('\n---\n');

    // Teste 2: POST /api/chat (com dados válidos)
    try {
        console.log('2️⃣ Testando POST /api/chat...');
        const message = {
            videoId: 'test_video_123',
            user: 'TestUser',
            email: 'test@example.com',
            role: 'USUARIO',
            text: 'Mensagem de teste',
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        
        console.log('Enviando:', JSON.stringify(message, null, 2));
        
        const res = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
        
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Resposta:', JSON.stringify(data, null, 2));
        
        if (res.ok) {
            console.log('✅ Mensagem salva com sucesso!');
        } else {
            console.error('❌ Erro ao salvar:', data);
        }
    } catch (err) {
        console.error('❌ Erro na requisição:', err.message);
    }

    console.log('\n---\n');

    // Teste 3: GET /api/chat (listar mensagens)
    try {
        console.log('3️⃣ Testando GET /api/chat...');
        const res = await fetch(`${baseUrl}/api/chat?videoId=test_video_123&limit=10`);
        const data = await res.json();
        
        console.log(`Status: ${res.status}`);
        console.log(`Mensagens encontradas: ${Array.isArray(data) ? data.length : 0}`);
        
        if (Array.isArray(data) && data.length > 0) {
            console.log('Primeira mensagem:', JSON.stringify(data[0], null, 2));
            console.log('✅ GET funcionando!');
        } else {
            console.log('⚠️ Nenhuma mensagem encontrada ou erro na resposta');
        }
    } catch (err) {
        console.error('❌ Erro ao listar mensagens:', err.message);
    }
}

testChatAPI().then(() => {
    console.log('\n🎉 Testes concluídos!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
