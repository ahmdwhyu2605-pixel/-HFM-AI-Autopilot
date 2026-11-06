import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
if(!scripts.length)throw new Error('No inline JavaScript found');
for(let i=0;i<scripts.length;i++)new vm.Script(scripts[i],{filename:'index.html:inline-script-'+(i+1)});
const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]));
const refs=[...html.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(x=>x[1]);
const missing=[...new Set(refs.filter(x=>!ids.has(x)))];
if(missing.length)throw new Error('Missing DOM IDs: '+missing.join(', '));

const requiredIds=['authLogin','authRegister','authLogout','cloudAnalyze','jSave','jRefresh','runBacktest','buy','sell','closeAll','kill','saveSettings','reset','chart'];
const missingFeatures=requiredIds.filter(id=>!ids.has(id));
if(missingFeatures.length)throw new Error('Missing required feature controls: '+missingFeatures.join(', '));
if(html.includes('Math.random'))throw new Error('Synthetic random market data is forbidden');
if(!html.includes("Authorization:'Bearer '+session.access_token"))throw new Error('Market feed must send the signed-in user's JWT');
const config=fs.readFileSync('supabase/config.toml','utf8');
if(!/\[functions\.market-data\]\s*verify_jwt\s*=\s*true/.test(config))throw new Error('market-data must require JWT');
if(!/\[functions\.ai-analysis\]\s*verify_jwt\s*=\s*true/.test(config))throw new Error('ai-analysis must require JWT');
const marketFn=fs.readFileSync('supabase/functions/market-data/index.ts','utf8');
const aiFn=fs.readFileSync('supabase/functions/ai-analysis/index.ts','utf8');
if(!marketFn.includes('TWELVE_DATA_API_KEY')||!aiFn.includes('OPENAI_API_KEY')||!aiFn.includes('TWELVE_DATA_API_KEY'))throw new Error('Backend secret usage is missing');
if(marketFn.includes('Math.random')||aiFn.includes('Math.random'))throw new Error('Synthetic market data found in backend');

console.log('OK: '+scripts.length+' inline script(s), '+ids.size+' DOM IDs, '+refs.length+' direct DOM references.');
