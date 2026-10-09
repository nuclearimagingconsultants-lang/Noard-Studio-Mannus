from pathlib import Path
import concurrent.futures as cf
import subprocess,hashlib,json,re,threading,time
ROOT=Path('/home/ubuntu/ai-business-finance-study')
APP=Path('/home/ubuntu/boardstudio')
INDEX=APP/'data/asset-index.json'
LOCK=threading.Lock()
index=json.loads(INDEX.read_text()) if INDEX.exists() else {}
files=list((ROOT/'library').rglob('*.pdf'))
files += [p for p in (ROOT/'deliverables').rglob('*') if p.is_file() and p.suffix.lower() in {'.pdf','.xlsx','.csv','.md','.zip'} and 'before-' not in p.name and 'original' not in p.name]
unique={};aliases={}
for f in files:
    digest=hashlib.sha256(f.read_bytes()).hexdigest()
    aliases.setdefault(digest,[]).append(str(f.relative_to(ROOT)))
    unique.setdefault(digest,f)

def upload(entry):
    digest,f=entry;rels=aliases[digest]
    with LOCK:existing=next((index[x] for x in rels if index.get(x)),None)
    if existing:
        with LOCK:
            for rel in rels:index[rel]=existing
        return {'path':str(f),'status':'already_uploaded','url':existing}
    started=time.time()
    result=subprocess.run(['manus-upload-file','--webdev',str(f)],cwd=APP,capture_output=True,text=True,timeout=900)
    text=result.stdout+'\n'+result.stderr
    matches=re.findall(r'Storage Path:\s*(/manus-storage/\S+)',text)
    if result.returncode or not matches:
        print('UPLOAD FAILED',str(f.relative_to(ROOT)),text[-700:],flush=True)
        return {'path':str(f),'status':'failed','error':text[-1000:]}
    url=matches[-1]
    with LOCK:
        for rel in rels:index[rel]=url
        tmp=INDEX.with_suffix('.tmp');tmp.write_text(json.dumps(index,indent=2)+'\n');tmp.replace(INDEX)
    print('Uploaded',str(f.relative_to(ROOT)),round(time.time()-started,1),'s',flush=True)
    return {'path':str(f),'status':'uploaded','url':url}

print('Uploading',len(unique),'unique existing study assets',flush=True)
results=[]
with cf.ThreadPoolExecutor(max_workers=3) as pool:
    for result in pool.map(upload,unique.items()):results.append(result)
with LOCK:INDEX.write_text(json.dumps(index,indent=2)+'\n')
(APP/'data/asset-upload-report.json').write_text(json.dumps(results,indent=2)+'\n')
print('Asset uploads complete:',sum(r['status']!='failed' for r in results),'successful,',sum(r['status']=='failed' for r in results),'failed',flush=True)
if any(r['status']=='failed' for r in results):raise SystemExit(1)
