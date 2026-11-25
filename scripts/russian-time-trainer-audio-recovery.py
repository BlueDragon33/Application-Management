"""Bounded audio recovery evidence only; no app asset writes or assessment admission."""
import hashlib, html, json, pathlib, re, subprocess, sys, urllib.request, urllib.parse, wave, io
from html.parser import HTMLParser

out=pathlib.Path(sys.argv[1]).resolve()
work=pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True,exist_ok=True)
work.mkdir(parents=True,exist_ok=True)
words=[("hard-soft-0","лук"),("hard-soft-1","люк"),("final-soft-0","угол"),("final-soft-1","уголь"),("vowels-0","был"),("vowels-1","бил"),("voicing-0","том"),("voicing-1","дом")]
rev="a31bce3ed50c05399b2a830efd1c607df03cf4b5"
base="https://huggingface.co/rhasspy/piper-voices/resolve/"+rev+"/ru/ru_RU/dmitri/medium/"
manifest={"sourceSha":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"status":"CANDIDATE_ONLY","humanAcceptance":"UNVERIFIED","modelRevision":rev,"sources":[],"failures":[],"matchedHumanPairs":[],"comparisonOrder":["RHVoice","Piper","Human (if available)"],"comparisonTransform":"Decode, mono 24 kHz PCM, 0.65s gap; no gain, pitch or tempo modification."}
class Plain(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]
    def handle_data(self,data): self.parts.append(data)
def plain(value):
    p=Plain(); p.feed(value or ""); return " ".join(" ".join(p.parts).split())
def get(url,limit):
    req=urllib.request.Request(url,headers={"User-Agent":"RussianTimeTrainerAudioQA/1.0 (https://github.com/BlueDragon33/Application-Management/pull/423)"})
    with urllib.request.urlopen(req,timeout=35) as resp:
        data=resp.read(limit+1)
        if len(data)>limit: raise ValueError("source exceeds bounded size")
        return data
def digest(data): return hashlib.sha256(data).hexdigest()
def record(engine,key,word,path,extra):
    pcm=subprocess.check_output(["ffmpeg","-nostdin","-v","error","-i",str(path),"-f","s16le","-ar","24000","-ac","1","-"])
    assert 4800 <= len(pcm) <= 240000 and len(pcm)%2==0, "unexpected decoded duration"
    import array,math
    samples=array.array("h",pcm)
    if sys.byteorder!="little": samples.byteswap()
    peak=max(abs(x) for x in samples)/32768
    rms=math.sqrt(sum(x*x for x in samples)/len(samples))/32768
    assert peak>.02 and rms>.004 and peak<1,"silent/clipped"
    entry={"engine":engine,"id":key,"word":word,"file":path.name,"sha256":digest(path.read_bytes()),"seconds":len(pcm)/48000,"peak":peak,"rms":rms,**extra}
    manifest["sources"].append(entry)
    clips[(engine,key)]=pcm
def fail(scope,e): manifest["failures"].append({"scope":scope,"error":str(e)[:400]}); print(scope,str(e)[:400],flush=True)
clips={}
# First acquire original human recordings, exact titles only, no guessed speaker identity.
for key,word in words:
    try:
        params={"action":"query","format":"json","formatversion":"2","titles":"File:Ru-"+word+".ogg","prop":"imageinfo","iiprop":"url|sha1|extmetadata"}
        query="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode(params)
        page=json.loads(get(query,1000000))["query"]["pages"][0]
        info=page["imageinfo"][0]; md=info["extmetadata"]
        val=lambda k:plain(md.get(k,{}).get("value",""))
        license=val("LicenseShortName"); license_url=val("LicenseUrl")
        author=val("Artist"); credit=val("Credit"); description=val("ImageDescription")
        combined=" ".join([author,credit,description])
        assert re.search(r"shtooka|forvo",combined,re.I), "recording provenance not established"
        assert author and not re.search(r"lacking author|unknown|not provided",author,re.I) and re.fullmatch(r"CC (?:BY(?:-SA)? [234]\.0)(?: fr| us)?",license,re.I), "rights or author unresolved: "+license+" / "+author
        assert license_url.startswith("https://creativecommons.org/") or license_url.startswith("http://creativecommons.org/"),"license URL unresolved"
        url=info["url"]; assert urllib.parse.urlparse(url).hostname=="upload.wikimedia.org"
        data=get(url,2000000); path=out/("human-"+key+".ogg"); path.write_bytes(data)
        assert hashlib.sha1(data).hexdigest()==info["sha1"],"Commons content digest mismatch"
        record("Human",key,word,path,{"page":info["descriptionurl"],"pageid":page["pageid"],"author":author,"credit":credit,"license":license,"licenseUrl":license_url,"sourceMetadata":md,"speakerVerified":False})
    except Exception as e: fail("Human:"+word,e)
# Existing exact RHVoice files, never regenerated.
old=pathlib.Path("public/russian-time-trainer/sound-candidate")
original=json.loads((old/"manifest.json").read_text())
for key,word in words:
    name="adaptive-sound-"+key
    entry=next(a for a in original["assets"] if a["id"]==name)
    data=(old/(name+".mp3")).read_bytes()
    assert digest(data)==entry["sha256"]
    path=out/("rhvoice-"+key+".mp3");path.write_bytes(data)
    record("RHVoice",key,word,path,{"source":original["source"],"license":original["license"],"voice":original["voice"],"originalArtifact":original["artifactId"]})
# Separate alternate offline synthesis. No model, tool, or dependency deployed.
try:
    from piper import PiperVoice
    model=work/"ru_RU-dmitri-medium.onnx"
    for name,limit in [("ru_RU-dmitri-medium.onnx",70000000),("ru_RU-dmitri-medium.onnx.json",1000000),("MODEL_CARD",10000)]:
        (work/name).write_bytes(get(base+name,limit))
    actual_model_hash=digest(model.read_bytes())
    manifest["observedModelSha256"]=actual_model_hash
    assert actual_model_hash=="f073356ebc4bd0f80c5af58df2953a5988bd5bdab1eb38635ce960b071fbefcb", "pinned model SHA mismatch: "+actual_model_hash+" bytes="+str(model.stat().st_size)
    card=(work/"MODEL_CARD").read_text()
    assert "CC0" in card and "Speakers: 1" in card, "pinned card lacks expected CC0 and single-speaker metadata"
    (out/"PIPER_MODEL_CARD.txt").write_text(card)
    voice=PiperVoice.load(str(model))
    for key,word in words:
        try:
            path=out/("piper-"+key+".wav")
            with wave.open(str(path),"wb") as w: voice.synthesize_wav(word,w)
            record("Piper",key,word,path,{"modelRevision":rev,"modelSha256":digest(model.read_bytes()),"modelCard":base+"MODEL_CARD","datasetLicense":"CC0","speaker":"Dmitri (single-speaker model)","licenseAdmission":"pending review of base model/output terms"})
        except Exception as e: fail("Piper:"+word,e)
except Exception as e:
    import traceback
    traceback.print_exc()
    fail("Piper acquisition/synthesis",repr(e))
# Human speaker provenance is not inferred from upload authors. Metadata stays in report for qualified review.
# Provide natural-rate independent clips and labeled ordering; do not mix as an assessment.
for key,word in words:
    tracks=[clips[(engine,key)] for engine in ["RHVoice","Piper","Human"] if (engine,key) in clips]
    if len(tracks)<2:continue
    with wave.open(str(out/("compare-"+key+".wav")),"wb") as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
        w.writeframes((b"\x00\x00"*15600).join(tracks))
for engine in ["RHVoice","Piper","Human"]:
    manifest[engine+"Count"]=sum(x["engine"]==engine for x in manifest["sources"])
(out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print("RTT_AUDIO_RECOVERY "+json.dumps({k:manifest[k] for k in ["RHVoiceCount","PiperCount","HumanCount","failures","matchedHumanPairs"]},ensure_ascii=False),flush=True)
# Partial acquisition is not a completed recovery.
if manifest["PiperCount"]!=8 or manifest["HumanCount"]!=8: sys.exit(1)
