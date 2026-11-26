"""Short offline audio audition only. Public models; no secrets or runtime writes."""
import os,sys,pathlib,json,hashlib,time,subprocess,wave
import numpy as np
from huggingface_hub import HfApi,snapshot_download
engine=sys.argv[1]; out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
texts=["общежитие","здравствуйте","Сейчас половина третьего."]
report={"engine":engine,"sourceSha":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"admission":"REVIEW_ONLY","clips":[],"errors":[]}
def digest(path):
    with path.open("rb") as f:return hashlib.file_digest(f,"sha256").hexdigest()
try:
    if engine=="tera":
        repo="TeraSpace/TeraTTSv2"; prefix="4c3bf2e"
        revision=HfApi().model_info(repo,revision=prefix,token=False).sha
        assert revision.startswith(prefix)
        release=pathlib.Path(snapshot_download(repo,revision=revision,token=False,ignore_patterns=["__pycache__/*","models/sampler_teacher*"]))
        assert (release/"LICENSE").is_file() and (release/"LICENSE-OPENRAIL").is_file()
        for name in ["LICENSE","LICENSE-OPENRAIL","RUACCENT_NOTICE.txt"]:
            (out/name).write_bytes((release/name).read_bytes())
        report.update(repo=repo,revision=revision,voice="ru_f1",license="Open RAIL-M with commercial attribution")
        sys.path.insert(0,str(release))
        import teratts
        # Manually verified stress for this bounded corpus; no extra accent model needed.
        model=teratts.load_model(release,threads=4,russian_stress=False)
        marked=["общеж+итие","здр+авствуйте","Сейч+ас полов+ина тр+етьего."]
        def synth(i,text):
            tagged="<ru>"+marked[i]+"</ru>"
            return teratts.generate_speech(model,tagged,"ru_f1",seed=1234),44100,tagged
    elif engine=="chatterbox":
        import torch
        torch.set_num_threads(4)
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        repo="ResembleAI/chatterbox";prefix="5bb1f6e"
        revision=HfApi().model_info(repo,revision=prefix,token=False).sha
        assert revision.startswith(prefix)
        release=pathlib.Path(snapshot_download(repo,revision=revision,token=False,allow_patterns=["ve.pt","t3_mtl23ls_v3.safetensors","s3gen.pt","grapheme_mtl_merged_expanded_v1.json","conds.pt","Cangjie5_TC.json","README.md"]))
        report.update(repo=repo,revision=revision,voice="bundled default voice",license="MIT per upstream model card",codeRevision="ab55923c27757c90cfcc407baa57dc25a7d25217",variant="V3 T3 with upstream standard S3Gen")
        model=ChatterboxMultilingualTTS.from_local(release,"cpu",t3_model="v3")
        def synth(i,text):
            torch.manual_seed(1234)
            with torch.inference_mode(): a=model.generate(text,language_id="ru")
            return a.detach().cpu().numpy().reshape(-1),model.sr,text
    else:raise ValueError("unknown engine")
    report["sourceFiles"]=[{"path":str(p.relative_to(release)),"bytes":p.stat().st_size,"sha256":digest(p)} for p in sorted(release.rglob("*")) if p.is_file()]
    for i,text in enumerate(texts):
        try:
            start=time.perf_counter(); a,sr,inp=synth(i,text); elapsed=time.perf_counter()-start
            a=np.asarray(a).reshape(-1);assert np.isfinite(a).all() and .15<=len(a)/sr<=20
            assert np.max(np.abs(a))>.01
            path=out/f"{i+1:02d}.wav"
            samples=np.rint(np.clip(a,-1,1)*32767).astype("<i2")
            with wave.open(str(path),"wb") as w:
                w.setparams((1,2,int(sr),0,"NONE","not compressed"));w.writeframes(samples.tobytes())
            report["clips"].append({"text":text,"input":inp,"file":path.name,"sha256":digest(path),"seconds":len(a)/sr,"sampleRate":int(sr),"peak":float(np.max(np.abs(a))),"synthesisSeconds":elapsed})
        except Exception as e:
            report["errors"].append({"text":text,"error":repr(e)});print("ITEM_FAIL",repr(e),flush=True)
except Exception as e:
    import traceback
    traceback.print_exc();report["errors"].append({"error":repr(e)})
finally:
    (out/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print("RTT_ADVANCED "+json.dumps({k:v for k,v in report.items() if k!="sourceFiles"},ensure_ascii=False),flush=True)
if len(report["clips"])!=3 or report["errors"]:sys.exit(1)
