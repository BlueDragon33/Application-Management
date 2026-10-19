// Math_Bauman PR #72 isolated Windows QA static server.
// No D1, download, shell API, package install, production endpoint or LAN binding.
// Only serves existing, tracked files from the fixed detached QA worktree.
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync, createReadStream } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SHA="2d96583f034ff3c61456d52a0ef550d2c371d248";
const PORT=3022;
const PATH_SEGMENTS=["_qa","Math_Bauman_PR72"];
const MIME={
 ".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",
 ".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json",
 ".wasm":"application/wasm",".svg":"image/svg+xml",".png":"image/png",
 ".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".webp":"image/webp",
 ".ico":"image/x-icon",".woff":"font/woff",".woff2":"font/woff2",
 ".ttf":"font/ttf",".otf":"font/otf",".mp3":"audio/mpeg",
 ".mp4":"video/mp4",".webm":"video/webm",".wav":"audio/wav",
 ".pdf":"application/pdf",".txt":"text/plain; charset=utf-8"
};
function git(root,args){
 return execFileSync("git",["-C",root,...args],{
  encoding:"utf8",timeout:8000,windowsHide:true,
  env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0",GCM_INTERACTIVE:"never"},
  stdio:["ignore","pipe","ignore"]
 }).trim();
}
export function validateQaSource(root,managerRoot,sha){
 const expected=realpathSync(resolve(managerRoot,"..",...PATH_SEGMENTS));
 const actual=realpathSync(root);
 if(actual!==expected||sha!==SHA)throw Error("MATH_QA_ROOT_OR_SHA_INVALID");
 if(!existsSync(join(actual,"index.html"))||!existsSync(join(actual,"service-worker.js")))
   throw Error("MATH_QA_MISSING_ENTRY");
 if(git(actual,["rev-parse","--show-prefix"])!=="")throw Error("MATH_QA_NOT_WORKTREE_ROOT");
 if(git(actual,["rev-parse","--abbrev-ref","HEAD"])!=="HEAD")
   throw Error("MATH_QA_NOT_DETACHED");
 if(git(actual,["rev-parse","HEAD"]).toLowerCase()!==SHA)
   throw Error("MATH_QA_COMMIT_DRIFT");
 if(git(actual,["status","--porcelain","--untracked-files=no"]))
   throw Error("MATH_QA_TRACKED_DIRTY");
 return actual;
}
export function serveMathQA({root,port,sha,managerRoot}){
 if(port!==PORT)throw Error("MATH_QA_PORT_MISMATCH");
 const staticRoot=validateQaSource(root,managerRoot,sha);
 const expectedHost="127.0.0.1:"+PORT;
 const localhostHost="localhost:"+PORT;
 const server=createServer((req,res)=>{
   const fail=(status)=>{res.writeHead(status,{"cache-control":"no-store","x-content-type-options":"nosniff"});res.end();};
   if(req.headers.host!==expectedHost && req.headers.host!==localhostHost)return fail(403);
   if(req.method!=="GET"&&req.method!=="HEAD")return fail(405);
   let pathname;
   try{pathname=decodeURIComponent(new URL(req.url||"/","http://127.0.0.1").pathname);}
   catch{return fail(400);}
   if(pathname.includes("\\")||pathname.includes("\0")||pathname.split("/").some(x=>x===".."||x.startsWith(".")))return fail(403);
   const candidate=resolve(staticRoot,"."+pathname,pathname.endsWith("/")?"index.html":"");
   if(candidate!==staticRoot&&!candidate.startsWith(staticRoot+sep))return fail(403);
   try{
     const filename=realpathSync(candidate);
     if(!filename.startsWith(staticRoot+sep)||!statSync(filename).isFile())return fail(404);
     const type=MIME[extname(filename).toLowerCase()];
     if(!type)return fail(404);
     res.writeHead(200,{
       "content-type":type,"cache-control":"no-store",
       "x-content-type-options":"nosniff","x-math-qa-sha":SHA,
       "cross-origin-resource-policy":"same-origin"
     });
     if(req.method==="HEAD")return res.end();
     createReadStream(filename).on("error",()=>res.destroy()).pipe(res);
   }catch{return fail(404);}
 });
 return server.listen(PORT,"127.0.0.1");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const managerRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
 const server=serveMathQA({root:process.argv[2],port:Number(process.argv[3]),sha:process.argv[4],managerRoot});
 server.on("listening",()=>console.log("[Math PR72 QA only] http://127.0.0.1:"+PORT+"/index.html, source="+SHA));
}
