import {build} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]||path.join(root,'outputs','boi-owner-offline'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'boi-owner-review-'));
try{
await build({configFile:false,root,plugins:[react()],resolve:{alias:{'next/link':path.join(root,'qa/owner-offline-link.tsx')}},define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW':'"true"'},build:{target:'es2022',outDir:temp,emptyOutDir:true,cssCodeSplit:false,sourcemap:false,lib:{entry:path.join(root,'qa/boi-owner-offline.tsx'),name:'BoiOwnerOfflineReview',formats:['iife'],fileName:'owner-review'},rollupOptions:{output:{inlineDynamicImports:true}}}});
const files=fs.readdirSync(temp),js=files.filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(temp,f),'utf8')).join('\n'),css=files.filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(path.join(temp,f),'utf8')).join('\n');
if(!js||!css)throw new Error('Offline build missing script or stylesheet.');
if(/@import\s|url\(\s*["']?https?:/i.test(css))throw new Error('Offline stylesheet must not load external resources.');
const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Bơi Ếch · Owner Console · Offline Review</title><style>${css.replaceAll('</style','<\\/style')}</style></head><body><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
fs.mkdirSync(output,{recursive:true});const destination=path.join(output,'MO_GIAO_DIEN_OWNER.html');fs.writeFileSync(destination,html);console.log('Standalone offline Owner review:',destination,Buffer.byteLength(html),'bytes');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
