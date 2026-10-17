// Dedicated static-only GrowUP localhost server. No management API or data write.
import { createServer } from "node:http";
import { existsSync, realpathSync, statSync, createReadStream } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
if(resolve(process.argv[1]||"")!==fileURLToPath(import.meta.url))throw Error("GROWUP_DIRECT_ENTRY_REQUIRED");
const root=realpathSync(process.argv[2]||"");
const port=Number(process.argv[3]);
if(port!==3006||!existsSync(join(root,"index.html")))throw Error("GROWUP_OFFLINE_ARGS_INVALID");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",
  ".ico":"image/x-icon",".woff2":"font/woff2",".mp3":"audio/mpeg",
  ".wav":"audio/wav",".mp4":"video/mp4"};
createServer((req,res)=>{
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405,{allow:"GET, HEAD"});return res.end();}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url||"/","http://127.0.0.1").pathname);}
  catch{res.writeHead(400);return res.end();}
  const segments=pathname.split("/");
  if(pathname.includes("\0")||pathname.includes("\\")||segments.some(x=>x===".."||x.startsWith("."))){
    res.writeHead(403);return res.end();
  }
  const file=resolve(root,"."+pathname,pathname.endsWith("/")?"index.html":"");
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
  try{
    const actual=realpathSync(file),type=MIME[extname(actual).toLowerCase()];
    if((actual!==root&&!actual.startsWith(root+sep))||!type||!statSync(actual).isFile()){res.writeHead(404);return res.end();}
    res.writeHead(200,{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff"});
    if(req.method==="HEAD")return res.end();
    createReadStream(actual).on("error",()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404);res.end();}
}).listen(port,"127.0.0.1",()=>console.log("[GrowUP offline frontend] 127.0.0.1:"+port));
