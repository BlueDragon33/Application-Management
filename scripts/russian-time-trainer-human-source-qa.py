"""Read-only candidate discovery, no synthesis or runtime admission."""
import sys, pathlib, json, urllib.request, urllib.parse, re, hashlib, subprocess, wave, unicodedata
from html.parser import HTMLParser
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
tmp=pathlib.Path(sys.argv[2]);tmp.mkdir(parents=True,exist_ok=True)
words=["лук","люк","угол","уголь","был","бил","том","дом"]
pairs=[words[i:i+2] for i in range(0,8,2)]
report={"status":"CANDIDATE_ONLY","sourceSha":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"humanAcceptance":"UNVERIFIED","assets":[],"search":[],"rejected":[],"matchedPairs":[]}
def get(url,limit=3000000):
    req=urllib.request.Request(url,headers={"User-Agent":"RussianTimeTrainerAudioQA/1.0 (https://github.com/BlueDragon33/Application-Management/pull/423)"})
    with urllib.request.urlopen(req,timeout=25) as r:
        d=r.read(limit+1)
        if len(d)>limit:raise ValueError("bounded download exceeded")
        return d
def api(**params):
    return json.loads(get("https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode({"action":"query","format":"json","formatversion":2,**params})))
class Plain(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,s):self.parts.append(s)
def plain(s):
    p=Plain();p.feed(s or "");return " ".join(" ".join(p.parts).split())
def norm(s):return unicodedata.normalize("NFC",s).replace("\u0301","").strip().casefold()
def reject(word,title,e):report["rejected"].append({"word":word,"title":title,"reason":str(e)[:400]})
def inspect(word,page,kind):
    title=page["title"]; info=page["imageinfo"][0];md=info["extmetadata"]
    value=lambda k:plain(md.get(k,{}).get("value",""))
    lic=value("LicenseShortName");url=value("LicenseUrl");author=value("Artist")
    assert re.fullmatch(r"CC (?:BY(?:-SA)? [234]\.0)(?: fr| us)?",lic,re.I) and urllib.parse.urlparse(url).hostname=="creativecommons.org","rights unresolved"
    assert urllib.parse.urlparse(info["url"]).hostname=="upload.wikimedia.org"
    data=get(info["url"]);assert hashlib.sha1(data).hexdigest()==info["sha1"],"source digest mismatch"
    local=tmp/(str(page["pageid"])+(".wav" if title.endswith(".wav") else ".ogg"));local.write_bytes(data)
    probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_entries","format_tags:stream_tags","-of","json",str(local)]))
    tags={}
    for section in [probe.get("format",{}),*probe.get("streams",[])]:
        tags.update({k.upper():v for k,v in section.get("tags",{}).items()})
    if kind=="Lingua Libre":
        match=re.fullmatch(r"File:LL-Q7737 \(rus\)-(.+)-"+re.escape(word)+r"\.(?:wav|ogg)",title,re.I)
        assert match,"exact Russian transcription missing"
        speaker=match.group(1)
        assert "speaker" in author.casefold() and norm(speaker) in norm(author),"documented speaker missing"
    else:
        assert "shtooka" in " ".join([value("Credit"),value("ImageDescription"),value("Artist"),str(tags)]).casefold(),"not documented Shtooka"
        speaker=tags.get("SWAC_SPEAK_NAME","")
        assert speaker and not re.search(r"unknown|anonymous|not provided",speaker,re.I),"embedded speaker missing"
        assert norm(tags.get("SWAC_TEXT",""))==norm(word),"embedded transcription missing"
        language=tags.get("SWAC_SPEAK_LANG","").lower()
        assert language.startswith(("ru","rus")),"embedded language missing"
        if not author:author=speaker
    pcm=subprocess.check_output(["ffmpeg","-nostdin","-v","error","-i",str(local),"-f","s16le","-ar","24000","-ac","1","-"])
    assert 4800<=len(pcm)<=240000 and len(pcm)%2==0,"decoded duration outside bounds"
    import array,math
    samples=array.array("h",pcm)
    if sys.byteorder!="little":samples.byteswap()
    peak=max(abs(x) for x in samples)/32768
    rms=math.sqrt(sum(x*x for x in samples)/len(samples))/32768
    assert .02<peak<1 and rms>.004,"silent/clipped"
    dest=out/local.name;dest.write_bytes(data)
    entry={"word":word,"speaker":speaker,"kind":kind,"file":dest.name,"title":title,"page":info["descriptionurl"],"license":lic,"licenseUrl":url,"author":author,"sha256":hashlib.sha256(data).hexdigest(),"seconds":len(pcm)/48000,"peak":peak,"rms":rms,"embeddedSpeaker":tags.get("SWAC_SPEAK_NAME"),"embeddedText":tags.get("SWAC_TEXT"),"embeddedLanguage":tags.get("SWAC_SPEAK_LANG")}
    report["assets"].append(entry)
    return entry
for word in words:
    query='incategory:"Lingua Libre pronunciation-rus" intitle:/-'+word+r'\.wav$/'
    try:
        result=api(generator="search",gsrsearch=query,gsrnamespace=6,gsrlimit=40,prop="imageinfo",iiprop="url|sha1|extmetadata")
        pages=result.get("query",{}).get("pages",[])
        report["search"].append({"word":word,"source":"Lingua Libre","count":len(pages),"truncated":bool(result.get("continue"))})
        for p in pages[:10]:
            try:inspect(word,p,"Lingua Libre")
            except Exception as e:reject(word,p.get("title",""),e)
    except Exception as e:reject(word,"Lingua Libre search",e)
    # Only originals rejected for missing author in the earlier run; do not repeat admitted clips.
    if word in ["лук","угол","уголь"]:
        try:
            p=api(titles="File:Ru-"+word+".ogg",prop="imageinfo",iiprop="url|sha1|extmetadata")["query"]["pages"][0]
            inspect(word,p,"Shtooka")
        except Exception as e:reject(word,"Shtooka embedded tags",e)
for pair in pairs:
    a,b=pair
    for left in [x for x in report["assets"] if x["word"]==a]:
        for right in [x for x in report["assets"] if x["word"]==b]:
            if left["kind"]==right["kind"] and norm(left["speaker"])==norm(right["speaker"]):
                report["matchedPairs"].append({"words":pair,"speaker":left["speaker"],"kind":left["kind"],"files":[left["file"],right["file"]],"note":"Documented same speaker, not acoustic or session-equivalence acceptance"})
report["pairCoverage"]=sum(any(x["words"]==pair for x in report["matchedPairs"]) for pair in pairs)
(out/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("RTT_HUMAN_DISCOVERY "+json.dumps({"assets":report["assets"],"search":report["search"],"rejected":report["rejected"],"matchedPairs":report["matchedPairs"],"pairCoverage":report["pairCoverage"]},ensure_ascii=False),flush=True)
if report["pairCoverage"]!=4:sys.exit(1)
