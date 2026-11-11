#!/usr/bin/env node
// APP-only local review. Never updates BOIECH_AI or an existing working tree.
import {existsSync,readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,lstatSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';

const here=dirname(fileURLToPath(import.meta.url));
const win=process.platform==='win32';
export function validateManifest(value){
 if(!value||value.repository!=='BlueDragon33/Application-Management'||!/^[a-f0-9]{40}$/.test(value.sha))throw new Error('Manifest APP/SHA không hợp lệ. Không tự tải nguồn khác.');
 return value;
}
export function candidatePath(workspace,sha){
 if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('SHA không hợp lệ.');
 return join(resolve(workspace),'_app-owner-review',sha.slice(0,12));
}
export function cleanRuntimeEnvironment(input){
 const env={...input};
 for(const name of Object.keys(env))if(/^(CLOUDFLARE_|CF_API_|VERCEL_|NEON_|GITHUB_|GH_TOKEN$|OPENAI_|ANTHROPIC_|GOOGLE_|AWS_|AZURE_|DATABASE_)/i.test(name)||/(SECRET|PASSWORD|API_KEY|ACCESS_TOKEN|PRIVATE_KEY|_BASE_URL$|_ORIGIN$)/i.test(name))delete env[name];
 return {...env,WRANGLER_SEND_METRICS:'false',LOCAL_DEV_AUTH:'1',LOCAL_DEV_USER_ID:'owner-console-offline',LOCAL_DEV_USER_EMAIL:'owner-review@localhost.invalid',LOCAL_DEV_USER_NAME:'Owner Offline',CONTROL_OWNER_EMAILS:'owner-review@localhost.invalid',APP_RUNTIME:'local',CONTROL_PLANE_NETWORK_MODE:'local',LOCAL_ACTIVE_APPLICATIONS:'boi-ech',NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW:'true'};
}
const localVars=['LOCAL_DEV_AUTH=1','LOCAL_DEV_USER_ID=owner-console-offline','LOCAL_DEV_USER_EMAIL=owner-review@localhost.invalid','LOCAL_DEV_USER_NAME=Owner Offline','CONTROL_OWNER_EMAILS=owner-review@localhost.invalid','APP_RUNTIME=local','CONTROL_PLANE_NETWORK_MODE=local','NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW=true',''].join('\n');
export function ensureLocalRuntimeFiles(review){
 const unexpected=readdirSync(review).filter(name=>/^\.env(?:\.|$)|^\.dev\.vars(?:\.|$)/.test(name)&&name!=='.dev.vars');
 if(unexpected.length)throw new Error('Có file runtime .env/.dev.vars ngoài gói review. Không nạp hoặc ghi đè: '+unexpected.join(', '));
 const vars=join(review,'.dev.vars');
 if(existsSync(vars)){
  if(!lstatSync(vars).isFile()||readFileSync(vars,'utf8').replaceAll('\r\n','\n')!==localVars)throw new Error('.dev.vars không đúng cấu hình runtime review. Giữ nguyên file và dừng; không nạp credential.');
 }else writeFileSync(vars,localVars,{flag:'wx'});
}
export function parseArgs(argv){
 const modes=argv.filter(v=>['--check','--prepare-start','--start','--repair-start'].includes(v));
 if(modes.length!==1)throw new Error('Chọn --check, --prepare-start, --start hoặc --repair-start.');
 let workspace=win?'E:\\BaumanWeb':join(process.cwd(),'BaumanWeb');
 const index=argv.indexOf('--workspace');if(index>=0){workspace=argv[index+1];if(!workspace||workspace.startsWith('--'))throw new Error('Thiếu --workspace.');}
 const allowed=new Set([modes[0],'--workspace','--no-browser',workspace]);
 if(argv.some(a=>!allowed.has(a)))throw new Error('Tham số không được hỗ trợ.');
 return {mode:modes[0],workspace:resolve(workspace),noBrowser:argv.includes('--no-browser')};
}
function git(repo,args){return execFileSync('git',['-C',repo,'-c','core.commitGraph=false',...args],{encoding:'utf8',timeout:120000}).trim();}
function assertRepo(repo){
 const origin=git(repo,['remote','get-url','origin']).toLowerCase();
 if(!['https://github.com/bluedragon33/application-management','https://github.com/bluedragon33/application-management.git','git@github.com:bluedragon33/application-management.git'].includes(origin))throw new Error('Origin không đúng Application-Management.');
}
function freePort(port){return new Promise(resolve=>{const server=createServer();server.once('error',()=>resolve(false));server.listen({host:'127.0.0.1',port,exclusive:true},()=>server.close(()=>resolve(true)));});}
function checked(file,args,cwd,env){const r=spawnSync(file,args,{cwd,env,stdio:'inherit',shell:false});if(r.error||r.status!==0)throw new Error('Lệnh local thất bại; dừng an toàn: '+(r.error?.message||r.status));}
function npmCli(){
 const candidates=[process.env.npm_execpath,join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')];
 if(win){try{for(const value of execFileSync('where.exe',['npm.cmd'],{encoding:'utf8'}).trim().split(/\r?\n/))candidates.push(join(dirname(value),'node_modules/npm/bin/npm-cli.js'));}catch{/* Fail with an actionable message below. */}}
 const found=candidates.find(p=>p&&existsSync(p));if(!found)throw new Error('Không tìm thấy npm CLI của Node. Cài Node.js LTS trước khi mở source thật.');return found;
}
async function main(){
 const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<13))throw new Error('Cần Node >=22.13 để mở source. File HTML không cần Node.');
 const manifest=validateManifest(JSON.parse(readFileSync(join(here,'OWNER_REVIEW_SOURCE.json'),'utf8'))),opt=parseArgs(process.argv.slice(2));
 const original=join(opt.workspace,'Application-Management'),review=candidatePath(opt.workspace,manifest.sha),port=3006;
 assertRepo(original);
 console.log('[APP OWNER] Source đã chốt: '+manifest.sha+'; chỉ Application-Management.');
 if(opt.mode==='--check'){
  console.log('APP hiện tại: '+git(original,['rev-parse','HEAD']));
  console.log('Worktree review: '+(existsSync(review)?git(review,['rev-parse','HEAD']):'Chưa tạo'));
  console.log('Cổng 3006: '+(await freePort(port)?'TRỐNG':'ĐANG DÙNG'));return;
 }
 if(!await freePort(port))throw new Error('Cổng 3006 đang chạy. Không tự kill process; đóng đúng cửa sổ review cũ hoặc dùng HTML.');
 if(opt.mode==='--prepare-start'){
  // Fetch only the frozen APP object. Never switch/pull/reset the user's main.
  git(original,['fetch','--no-tags','origin',manifest.sha]);
  if(git(original,['rev-parse','FETCH_HEAD'])!==manifest.sha)throw new Error('Git trả SHA khác manifest. Dừng trước checkout.');
  if(!existsSync(review)){mkdirSync(dirname(review),{recursive:true});git(original,['worktree','add','--detach',review,manifest.sha]);}
 }
 if(!existsSync(review)||git(review,['rev-parse','HEAD'])!==manifest.sha)throw new Error('Chưa có đúng source review. Chạy 02_CHUAN_BI_VA_MO_APP.cmd.');
 const changed=git(review,['status','--porcelain']).split(/\r?\n/).filter(Boolean).filter(line=>!line.endsWith('tsconfig.tsbuildinfo'));
 if(changed.length)throw new Error('Source review đang có thay đổi; không ghi đè. Hãy giữ lại dữ liệu và kiểm tra.');
 ensureLocalRuntimeFiles(review);
 const env=cleanRuntimeEnvironment(process.env),vite=join(review,'node_modules/vite/bin/vite.js'),wrangler=join(review,'node_modules/wrangler/bin/wrangler.js');
 const toolsReady=()=>existsSync(vite)&&existsSync(wrangler)&&existsSync(join(review,'node_modules/wrangler/wrangler-dist/cli.js'));
 if(!toolsReady()){
  if(!['--prepare-start','--repair-start'].includes(opt.mode))throw new Error('Thiếu dependencies. Chạy 04_CAI_LAI_DEPENDENCY_APP.cmd; không xóa D1.');
  checked(process.execPath,[npmCli(),'ci','--include=dev','--no-audit','--no-fund'],review,env);
  if(!toolsReady())throw new Error('Wrangler/Vite chưa đầy đủ sau npm ci.');
 }
 // Fresh review state only. Never copy the user's account database or secrets.
 const config=readFileSync(join(review,'wrangler.local.jsonc'),'utf8');if(!config.includes('00000000-0000-0000-0000-000000000003'))throw new Error('D1 config không phải placeholder local.');
 const state=join(review,'.wrangler/state');if(existsSync(state)){
  const backup=join(opt.workspace,'_offline-backups','app-owner-'+new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(dirname(backup),{recursive:true});cpSync(state,backup,{recursive:true,errorOnExist:true,force:false});console.log('Đã sao lưu D1 review local.');
 }
 checked(process.execPath,[wrangler,'d1','migrations','apply','learning-management-db','--local','--config','wrangler.local.jsonc'],review,env);
 const child=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:review,env,stdio:'inherit',shell:false});
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;if(child.pid){if(win)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});else child.kill('SIGTERM');}};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);child.once('error',e=>{console.error(e.message);stop();process.exitCode=1;});child.once('exit',code=>{if(!stopping)process.exitCode=code||1;});
 const url='http://127.0.0.1:3006/apps/boi-ech',end=Date.now()+60000;let ready=false;
 while(Date.now()<end&&!stopping){try{const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(1500)});if(response.status<500){ready=true;break;}}catch{/* Startup may still be compiling. */}await new Promise(r=>setTimeout(r,350));}
 if(!ready){stop();throw new Error('APP chưa sẵn sàng trên 3006. Giữ log; không suy diễn thành công.');}
 console.log('APP source review: '+url+' (HTTP sẵn sàng, chưa phải nghiệm thu nghiệp vụ).');
 console.log('Bơi Ếch do Work vận hành riêng. Thiếu bridge sẽ báo chưa xác minh, không giả danh sách trống.');
 if(win&&!opt.noBrowser)spawn('explorer.exe',[url],{detached:true,stdio:'ignore',shell:false}).unref();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error('[APP OWNER] '+e.message);process.exitCode=1;});
