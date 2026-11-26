"""Owner-requested 11-item Russian offline engine audition. QA only."""
import sys, pathlib, subprocess, urllib.request, hashlib, json, wave, time, importlib.metadata, array, math
engine=sys.argv[1]; out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True); work=pathlib.Path(sys.argv[3]);work.mkdir(parents=True,exist_ok=True)
texts=[
("библиотека","библиот+ека"),("аудитория","аудит+ория"),("общежитие","общеж+итие"),("молоко","молок+о"),("хорошо","хорош+о"),("здравствуйте","здр+авствуйте"),("понедельник","понед+ельник"),("воскресенье","воскрес+енье"),("Который час?","Кот+орый ч+ас?"),("Сейчас половина третьего.","Сейч+ас полов+ина тр+етьего."),("Я учусь в университете.","+Я уч+усь в университ+ете.")]
def sha(data):return hashlib.sha256(data).hexdigest()
def get(url, path, limit):
    req=urllib.request.Request(url,headers={"User-Agent":"RTT-offline-audition/1.0"})
    with urllib.request.urlopen(req,timeout=90) as r,path.open("wb") as f:
        n=0
        while True:
            b=r.read(1024*1024)
            if not b:break
            n+=len(b)
            if n>limit:raise ValueError("download limit exceeded")
            f.write(b)
    return {"url":url,"bytes":path.stat().st_size,"sha256":sha(path.read_bytes())}
def cmd(*args,**kwargs):return subprocess.check_output(args,**kwargs)
def pcm(path,slow=False):
    args=["ffmpeg","-nostdin","-v","error","-i",str(path)]
    if slow:args+=["-af","atempo=0.75"]
    return cmd(*args,"-ar","24000","-ac","1","-f","s16le","-")
def wav(path,data):
    with wave.open(str(path),"wb") as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(data)
def stats(data):
    s=array.array("h",data)
    if sys.byteorder!="little":s.byteswap()
    assert .10<=len(s)/24000<=30,"unexpected duration"
    peak=max(abs(x) for x in s)/32768
    rms=math.sqrt(sum(x*x for x in s)/len(s))/32768
    assert peak>.01 and rms>.001,"silent audio"
    return {"seconds":len(s)/24000,"peak":peak,"rms":rms,"fullScaleSamples":sum(abs(x)>=32767 for x in s)}
manifest={"engine":engine,"sourceSha":cmd("git","rev-parse","HEAD",text=True).strip(),"admission":"REVIEW_ONLY","linguisticAcceptance":"UNVERIFIED","rateMethod":"natural engine default; slow FFmpeg atempo=0.75, pitch-preserving time stretch; no gain processing except engine default","sampleRate":24000,"sources":[],"clips":[],"failures":[]}
try:
    start=time.perf_counter()
    if engine=="piper":
        from piper import PiperVoice
        rev="a31bce3ed50c05399b2a830efd1c607df03cf4b5"
        base="https://huggingface.co/rhasspy/piper-voices/resolve/"+rev+"/ru/ru_RU/dmitri/medium/"
        for name,limit in [("ru_RU-dmitri-medium.onnx",70000000),("ru_RU-dmitri-medium.onnx.json",1000000),("MODEL_CARD",20000)]:
            manifest["sources"].append(get(base+name,work/name,limit))
        assert manifest["sources"][0]["sha256"]=="f073356ebc4bd0f80c5af58df2953a5988bd5bdab1eb38635ce960b071fbefcb"
        card=(work/"MODEL_CARD").read_text();assert "CC0" in card
        (out/"PIPER_MODEL_CARD.txt").write_text(card)
        model=PiperVoice.load(str(work/"ru_RU-dmitri-medium.onnx"))
        manifest.update(voice="Dmitri",version=importlib.metadata.version("piper-tts"),license="GPL-3.0 runtime; CC0 dataset per model card; base model/output rights pending deployment admission",modelBytes=manifest["sources"][0]["bytes"])
        def synth(text,marked,path):
            with wave.open(str(path),"wb") as w:model.synthesize_wav(text,w)
    elif engine=="rhvoice":
        manifest.update(voice="Aleksandr-HQ",version=cmd("dpkg-query","-W","-f=${Version}","rhvoice",text=True),license="voice CC BY-SA 4.0; RHVoice upstream https://github.com/RHVoice/aleksandr-hq-rus")
        manifest["sources"].append({"url":"https://github.com/RHVoice/aleksandr-hq-rus","voice":"Aleksandr-HQ","package":cmd("dpkg-query","-W","-f=${Version}","rhvoice-russian",text=True)})
        def synth(text,marked,path):
            subprocess.run(["RHVoice-test","-p","Aleksandr-HQ","-o",str(path)],input=text+"\n",text=True,check=True,timeout=25)
    elif engine=="silero":
        import torch
        torch.set_num_threads(2)
        rev="e382298387332f2bf461fe6eadfde99104611b0c"
        prefix="https://raw.githubusercontent.com/snakers4/silero-models/"+rev+"/"
        for name in ["LICENSE_CIS","models.yml","README.md"]:
            manifest["sources"].append(get(prefix+name,work/name,1000000))
        assert "MIT License" in (work/"LICENSE_CIS").read_text()
        assert "v5_cis_base.pt" in (work/"models.yml").read_text()
        (out/"SILERO_LICENSE_CIS.txt").write_bytes((work/"LICENSE_CIS").read_bytes())
        model_path=work/"v5_cis_base.pt"
        manifest["sources"].append(get("https://models.silero.ai/models/tts/ru/v5_cis_base.pt",model_path,1000000000))
        assert manifest["sources"][-1]["sha256"]=="ba41b18f6a707ad93605a162998865e7c087153d2e010a26dd02229dab0e672a", "Silero package changed since verified first acquisition"
        model=torch.package.PackageImporter(str(model_path)).load_pickle("tts_models","model")
        model.to(torch.device("cpu"))
        speaker="ru_ekaterina"
        speakers=list(model.speakers)
        assert speaker in speakers, "documented speaker unavailable: "+str(speakers)
        manifest.update(voice=speaker,version=torch.__version__,license="MIT (CIS base model, upstream LICENSE_CIS)",modelBytes=model_path.stat().st_size,speakerList=speakers,stressInput="explicit manual stress marks, not auto-stress")
        def synth(text,marked,path):
            audio=model.apply_tts(text=marked,speaker=speaker,sample_rate=24000)
            # Same linear PCM conversion for raw Silero output, no volume normalization.
            a=audio.detach().cpu().flatten().numpy()
            import numpy as np
            wav(path,np.clip(a*32768,-32768,32767).astype("<i2").tobytes())
    else:raise ValueError("unknown engine")
    manifest["setupSeconds"]=time.perf_counter()-start
    tracks={"normal":[],"slow":[]}
    for i,(text,marked) in enumerate(texts,1):
        try:
            raw=work/f"{i:02d}.wav"
            t=time.perf_counter();synth(text,marked,raw);elapsed=time.perf_counter()-t
            for rate in ["normal","slow"]:
                data=pcm(raw,rate=="slow"); info=stats(data); file=out/f"{i:02d}-{rate}.wav";wav(file,data)
                manifest["clips"].append({"id":i,"text":text,"engineInput":marked if engine=="silero" else text,"rate":rate,"file":file.name,"sha256":sha(file.read_bytes()),"bytes":file.stat().st_size,"synthesisSeconds":elapsed,**info})
                tracks[rate].append(data)
        except Exception as e:
            manifest["failures"].append({"id":i,"error":repr(e)});print("ITEM_FAIL",i,repr(e),flush=True)
    for rate,items in tracks.items():
        if len(items)==len(texts):
            wav(out/f"{engine}-{rate}.wav",(b"\x00\x00"*24000).join(items))
except Exception as e:
    import traceback
    traceback.print_exc();manifest["failures"].append({"error":repr(e)})
finally:
    (out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    print("RTT_ENGINE_AUDITION "+json.dumps({"engine":engine,"voice":manifest.get("voice"),"modelBytes":manifest.get("modelBytes"),"clipCount":len(manifest["clips"]),"sources":manifest["sources"],"failures":manifest["failures"]},ensure_ascii=False),flush=True)
if len(manifest["clips"])!=22 or manifest["failures"]:sys.exit(1)
