/**
 * Script de teste para validar contagem de presença por aba (presenceId)
 * Este script simula múltiplas abas enviando pings ao servidor
 */

const http = require('http');

// Simular presenceIds de diferentes abas
const presenceIds = [
    'pm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8),
    'pm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8),
    'pm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8),
];

const videoId = '769Zy41hnIs'; // Mesmo videoId para todas as "abas"

function sendPresenceRequest(presenceId, callback) {
    const body = JSON.stringify({
        videoId: videoId,
        id: presenceId,
        email: null
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/chat/presence',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': body.length
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                callback(null, response);
            } catch (e) {
                callback(e);
            }
        });
    });

    req.on('error', (e) => {
        callback(e);
    });

    req.write(body);
    req.end();
}

console.log('\n🧪 Teste de Contagem de Presença por Aba (presenceId)\n');
console.log(`VideoId: ${videoId}`);
console.log(`PresenceIds (3 abas diferentes):\n`);
presenceIds.forEach((id, i) => {
    console.log(`  Aba ${i + 1}: ${id}`);
});

console.log('\n📤 Enviando pings do servidor...\n');

let completedRequests = 0;
const results = [];

presenceIds.forEach((presenceId, index) => {
    sendPresenceRequest(presenceId, (err, response) => {
        if (err) {
            console.log(`❌ Aba ${index + 1}: Erro - ${err.message}`);
            results.push({ tab: index + 1, error: true });
        } else {
            console.log(`✅ Aba ${index + 1}: Resposta - ${JSON.stringify(response)}`);
            results.push({ tab: index + 1, count: response.count });
        }
        completedRequests++;
        
        if (completedRequests === presenceIds.length) {
            console.log('\n📊 Resultado:\n');
            const uniqueCounts = new Set(results.map(r => r.count));
            if (results.every(r => r.count === 3)) {
                console.log(`✅ SUCESSO! Todas as 3 abas foram contadas corretamente.`);
                console.log(`   Contador = ${results[0].count} (esperado: 3)`);
            } else {
                console.log(`❌ FALHA! O contador não está correto.`);
                results.forEach(r => {
                    console.log(`   Aba ${r.tab}: ${r.count}`);
                });
            }
            console.log('\n');
            process.exit(results.every(r => r.count === 3) ? 0 : 1);
        }
    });
});
