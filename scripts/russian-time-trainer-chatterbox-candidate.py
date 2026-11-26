"""Selected Chatterbox V3: bounded, exact-text preview package, no app writes."""
import os, sys, pathlib, json, hashlib, subprocess, time, wave
import numpy as np
import torch
from huggingface_hub import snapshot_download
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
out=pathlib.Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=True)
prior=pathlib.Path(sys.argv[2])
texts=["библиотека","аудитория","общежитие","молоко","хорошо","здравствуйте","понедельник","воскресенье","Который час?","Сейчас половина третьего.","Я учусь в университете."]
revision="5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18"
expected={"ve.pt":"4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1","t3_mtl23ls_v3.safetensors":"5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953","s3gen.pt":"9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3","conds.pt":"6552d70568833628ba019c6b03459e77fe71ca197d5c560cef9411bee9d87f4e","grapheme_mtl_merged_expanded_v1.json":"69632f47220a788a52ce2661d096453c5655e9bf25289d89a8d832c46ee07dbf"}
def sha(p):
    with p.open("rb") as f:return hashlib.file_digest(f,"sha256").hexdigest()
report={"engine":"Chatterbox Multilingual V3","codeRevision":"ab55923c27757c90cfcc407baa57dc25a7d25217","modelRevision":revision,"sourceSha":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"admission":"CANDIDATE_ONLY","quality":"UNVERIFIED","license":"MIT per upstream model card; deployment rights subject to gate","priorArtifact":15104892325,"assets":[],"failures":[],"modelHashes":expected}
try:
    old=json.loads((prior/"manifest.json").read_text())
    assert old["revision"]==revision and old["codeRevision"]==report["codeRevision"]
    reuse={x["text"]:x for x in old["clips"]}
    assert set(reuse)=={"общежитие","здравствуйте","Сейчас половина третьего."}
    torch.set_num_threads(4)
    release=pathlib.Path(snapshot_download("ResembleAI/chatterbox",revision=revision,token=False,allow_patterns=[*expected,"Cangjie5_TC.json","README.md"]))
    for name,d in expected.items():assert sha(release/name)==d, "model digest "+name
    (out/"MODEL_CARD.md").write_bytes((release/"README.md").read_bytes())
    model=ChatterboxMultilingualTTS.from_local(release,"cpu",t3_model="v3")
    for i,text in enumerate(texts,1):
        try:
            ident=f"chatterbox-preview-{i:02d}"
            raw=out/(ident+".wav")
            if text in reuse:
                x=reuse[text]; src=prior/x["file"]; assert sha(src)==x["sha256"]
                raw.write_bytes(src.read_bytes()); elapsed=0; origin="REUSED_15104892325"
            else:
                start=time.perf_counter();torch.manual_seed(1234)
                with torch.inference_mode(): a=model.generate(text,language_id="ru").detach().cpu().numpy().reshape(-1)
                elapsed=time.perf_counter()-start
                assert np.isfinite(a).all() and .15<=len(a)/model.sr<=20 and np.max(np.abs(a))>.01
                with wave.open(str(raw),"wb") as w:
                    w.setparams((1,2,model.sr,0,"NONE","not compressed"));w.writeframes(np.rint(np.clip(a,-1,1)*32767).astype("<i2").tobytes())
                origin="NEW"
            path=out/(ident+".mp3")
            subprocess.run(["ffmpeg","-nostdin","-v","error","-i",str(raw),"-ac","1","-ar","24000","-c:a","libmp3lame","-b:a","48k",str(path)],check=True)
            pcm=subprocess.check_output(["ffmpeg","-nostdin","-v","error","-i",str(path),"-f","s16le","-ac","1","-ar","24000","-"])
            a=np.frombuffer(pcm,dtype="<i2").astype(np.float64)/32768
            assert .15<=len(a)/24000<=20 and np.max(np.abs(a))>.01
            report["assets"].append({"id":ident,"ru":text,"file":path.name,"sha256":sha(path),"wavSha256":sha(raw),"bytes":path.stat().st_size,"seconds":len(a)/24000,"peak":float(np.max(np.abs(a))),"rms":float(np.sqrt(np.mean(a*a))),"origin":origin,"synthesisSeconds":elapsed})
        except Exception as e:report["failures"].append({"text":text,"error":repr(e)})
except Exception as e:
    import traceback
    traceback.print_exc();report["failures"].append({"error":repr(e)})
finally:
    (out/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print("RTT_CHATTERBOX_PACKAGE "+json.dumps(report,ensure_ascii=False),flush=True)
if len(report["assets"])!=11 or report["failures"]:sys.exit(1)
