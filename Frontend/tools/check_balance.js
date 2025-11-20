const fs = require('fs');
const p = process.argv[2] || 'Frontend/script.js';
const s = fs.readFileSync(p, 'utf8');
let stack = [];
let inSingle = false, inDouble = false, inBack = false, inLineComment = false, inBlockComment = false;
function push(t, i){ stack.push({t,i}); }
function pop(expect){ if(stack.length===0) return null; const top = stack[stack.length-1]; if(top.t === expect){ return stack.pop(); } return null; }
for(let i=0;i<s.length;i++){
    const ch = s[i];
    const nxt = s[i+1];
    if(inLineComment){ if(ch==='\n') inLineComment=false; continue; }
    if(inBlockComment){ if(ch==='*' && nxt === '/') { inBlockComment=false; i++; continue; } else continue; }
    if(inSingle){ if(ch==='\\' && nxt){ i++; continue; } if(ch==="'") inSingle=false; continue; }
    if(inDouble){ if(ch==='\\' && nxt){ i++; continue; } if(ch==='"') inDouble=false; continue; }
    if(inBack){ if(ch==='\\' && nxt){ i++; continue; } if(ch==='`') inBack=false; continue; }
    if(ch==='/' && nxt==='/' ){ inLineComment=true; i++; continue; }
    if(ch==='/' && nxt==='*'){ inBlockComment=true; i++; continue; }
    if(ch==="'") { inSingle=true; continue; }
    if(ch==='"'){ inDouble=true; continue; }
    if(ch==='`'){ inBack=true; continue; }
    if(ch==='('||ch==='{'||ch==='[') push(ch,i);
    if(ch===')'){ if(!pop('(')){ console.log('Unmatched ) at index', i); process.exit(0);} }
    if(ch==='}'){ if(!pop('{')){ console.log('Unmatched } at index', i); process.exit(0);} }
    if(ch===']'){ if(!pop('[')){ console.log('Unmatched ] at index', i); process.exit(0);} }
}
if(stack.length){
    console.log('STACK length:', stack.length);
    stack.forEach((it, idx) => {
        const line = s.slice(0,it.i).split(/\r?\n/).length;
        console.log(`#${idx} type=${it.t} index=${it.i} line=${line}`);
    });
    const last = stack[stack.length-1];
    const before = s.slice(Math.max(0,last.i-80), last.i+80);
    const line = s.slice(0,last.i).split(/\r?\n/).length;
    console.log('Unclosed', last.t, 'at index', last.i, 'line', line);
    console.log('context:\n', before);
} else console.log('All balanced');
