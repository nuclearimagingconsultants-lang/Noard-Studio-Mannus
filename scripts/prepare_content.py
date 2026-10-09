from pathlib import Path
import json,hashlib,subprocess,re
from pypdf import PdfReader

ROOT=Path('/home/ubuntu/ai-business-finance-study')
APP=Path('/home/ubuntu/boardstudio')
OUT=ROOT/'original-lectures'
for name in ['inputs','extracted','scripts','audio','videos','manifests','review']:(OUT/name).mkdir(parents=True,exist_ok=True)
programs={pid:json.loads((ROOT/'research'/f'{pid}.json').read_text()) for pid in ['ai','mba','mfin','cto']}
assets=APP/'data/asset-index.json'
asset_index=json.loads(assets.read_text()) if assets.exists() else {'library/ai/mit6_006_algorithms_lecture1.pdf':'/manus-storage/mit6_006_algorithms_lecture1_5798b7db.pdf'}
documents=[];byhash={};bypath={};references={}
for pid,p in programs.items():
    for c in p['courses']:
        for q in c.get('pdfs',[]):
            rel=q.get('local_path') or ''
            if rel.startswith(str(ROOT)+'/'):rel=rel[len(str(ROOT))+1:]
            if rel:references.setdefault(rel,[]).append((pid,c['id'],q))
    for q in p.get('pdf_library',[]):
        rel=q.get('local_path') or q.get('path') or ''
        if rel.startswith(str(ROOT)+'/'):rel=rel[len(str(ROOT))+1:]
        if rel:references.setdefault(rel,[]).append((pid,None,q))

ordered=[]
for pid in ['ai','mba','mfin','cto']:ordered.extend(sorted((ROOT/'library'/pid).glob('*.pdf')))
for f in ordered:
    rel=str(f.relative_to(ROOT));digest=hashlib.sha256(f.read_bytes()).hexdigest()
    if digest in byhash:
        bypath[rel]=byhash[digest]
        byhash[digest]['aliases'].append(rel)
        for pid,cid,q in references.get(rel,[]):
            if pid not in byhash[digest]['programIds']:byhash[digest]['programIds'].append(pid)
            if cid and cid not in byhash[digest]['courseIds']:byhash[digest]['courseIds'].append(cid)
        continue
    refs=references.get(rel,[]);q=refs[0][2] if refs else {}
    docid='pdf-'+digest[:12]
    reader=PdfReader(str(f))
    text_file=OUT/'extracted'/f'{docid}.json'
    if not text_file.exists():
        pages=[]
        for ix,page in enumerate(reader.pages,1):
            try:text=page.extract_text() or ''
            except Exception as e:text='[EXTRACTION ERROR: '+str(e)+']'
            pages.append({'pdf_page':ix,'text':text})
        text_file.write_text(json.dumps({'source_id':docid,'pdf_path':str(f),'page_count':len(reader.pages),'pages':pages},ensure_ascii=False)+'\n')
    title=q.get('title') or f.stem.replace('_',' ').replace('-',' ')
    doc={'id':docid,'title':title,'author':q.get('author',''),'path':str(f),'relativePath':rel,'aliases':[],'sha256':digest,'pages':len(reader.pages),'sourceUrl':q.get('source_url',q.get('url','')),'licenseNote':q.get('free_basis',q.get('license','Open educational source; see its original access terms.')),'programIds':list(dict.fromkeys([x[0] for x in refs] or [f.parent.name])),'courseIds':list(dict.fromkeys(x[1] for x in refs if x[1])),'storageUrl':asset_index.get(rel),'extractedPath':str(text_file)}
    byhash[digest]=doc;bypath[rel]=doc;documents.append(doc)
    print('Extracted',docid,doc['pages'],'pages',title,flush=True)

course_items=[];program_items=[]
labels={'ai':'Artificial Intelligence','mba':'Business Administration','mfin':'Quantitative Finance','cto':'Technology Leadership'}
for pid,p in programs.items():
    program_items.append({'id':pid,'name':labels[pid],'fullName':p['name'],'description':p.get('outline_summary',''),'outlineUrl':p.get('outline_url',''),'courseCount':len(p['courses']),'verifiedExternalHours':p.get('verified_video_hours',0),'plannedStudyHours':p.get('study_hours',0),'prerequisites':p.get('prerequisites',''),'schedule':p.get('schedule',''),'capstone':p.get('capstone',''),'accessNotes':p.get('access_notes',''),'limitations':p.get('limitations',[]),'guideUrl':asset_index.get('deliverables/'+pid+'-program.pdf'),'credentialType':'Professional companion' if pid=='cto' else 'Graduate-style independent study'})
    for c in p['courses']:
        pdf_ids=[]
        for q in c.get('pdfs',[]):
            rel=q.get('local_path') or ''
            if rel.startswith(str(ROOT)+'/'):rel=rel[len(str(ROOT))+1:]
            if rel in bypath:pdf_ids.append(bypath[rel]['id'])
        lectures=[]
        m=c.get('video_plan',{})
        for l in m.get('lectures',[]):
            lectures.append({'id':c['id']+':'+str(l['lecture_id']),'localId':str(l['lecture_id']),'title':l.get('title',''),'url':l['url'],'provider':l.get('provider',''),'durationSeconds':l.get('duration_seconds'),'kind':l.get('kind','full_lecture'),'sourceUrl':l.get('source_url',''),'accessVerified':l.get('access_verified',False),'coverageNote':l.get('coverage_note',''),'origin':'external'})
        unit_map=[]
        for u in m.get('unit_map',[]):
            unit_map.append({'number':u['unit_number'],'text':u['unit_text'],'coverage':u['status'],'lectureIds':[c['id']+':'+str(x) for x in u.get('lecture_ids',[])],'viewingSequence':u.get('viewing_sequence',[]),'coveredTopics':u.get('covered_topics',[]),'uncoveredTopics':u.get('uncovered_topics',[]),'practicalWork':u.get('practical_work_note','')})
        item={'id':c['id'],'programId':pid,'title':c['title'],'term':c.get('term',''),'level':c.get('level',''),'prerequisites':c.get('prerequisites',''),'objectives':c.get('objectives',[]),'units':c.get('units',[]),'assignment':c.get('assignment',''),'assessment':c.get('assessment',''),'studyHours':c.get('study_hours',0),'mapping':c.get('mapping',''),'primaryVideo':c.get('video',{}),'primarySeries':m.get('primary_series',[]),'lectures':lectures,'unitMap':unit_map,'coverageStatus':m.get('coverage_status','partial'),'remainingGaps':m.get('remaining_gaps',[]),'pdfIds':list(dict.fromkeys(pdf_ids)),'readings':c.get('textbooks',[]),'syllabusUrl':asset_index.get('deliverables/course-syllabi/'+pid+'/'+c['id']+'.pdf')}
        course_items.append(item)

# Each specialist receives one complete source packet plus the concise curriculum mapping.
slim_courses=[{k:c[k] for k in ['id','programId','title','objectives','units','pdfIds','assignment']} for c in course_items]
for doc in documents:
    packet={'source':doc,'extractedSource':doc['extractedPath'],'courses':[c for c in slim_courses if doc['id'] in c['pdfIds'] or c['id'] in doc['courseIds']],'candidateCourses':slim_courses,'programOrder':['ai','mba','mfin','cto'],'outputRoot':str(OUT)}
    (OUT/'inputs'/f'{doc["id"]}.json').write_text(json.dumps(packet,indent=2,ensure_ascii=False)+'\n')

clean_docs=[{k:v for k,v in doc.items() if k not in ['path','extractedPath','sha256']} for doc in documents]
links=[]
for name,title,kind in [('complete-study-guide.pdf','Complete curriculum guide','PDF guide'),('video-lecture-guide.pdf','Video viewing guide','PDF guide'),('study-board-with-videos.xlsx','Editable study board','Spreadsheet'),('resource-library.csv','Reading resource inventory','CSV'),('video-lectures.csv','Lecture inventory','CSV'),('complete-self-study-library-with-videos.zip','Entire study library','ZIP archive'),('start-here.pdf','Start here','PDF guide')]:
    links.append({'id':name,'title':title,'kind':kind,'url':asset_index.get('deliverables/'+name)})

catalog={'programs':program_items,'courses':course_items,'documents':clean_docs,'downloads':links,'stats':{'programs':4,'courses':51,'units':264,'referencePdfCopies':35,'uniqueReferencePdfs':len(documents),'uniquePdfPages':sum(d['pages'] for d in documents),'lectureEntries':sum(len(c['lectures']) for c in course_items)},'productionOrder':['ai','mba','mfin','cto'],'credentialNotice':'Independent self-study; no university enrollment, academic credit, degree, or credential is awarded.'}
(APP/'data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False)+'\n')
(APP/'data/source-production-index.json').write_text(json.dumps(documents,indent=2,ensure_ascii=False)+'\n')
assets.write_text(json.dumps(asset_index,indent=2)+'\n')
manifest=APP/'data/original-lectures.json'
if not manifest.exists():manifest.write_text(json.dumps({'lessons':[],'sourceCoverage':[],'productionState':'in_progress','notes':['Original PDF-based lecture production is being prepared. No finished hours are claimed before actual video files are verified.']},indent=2)+'\n')
print('Prepared',len(documents),'unique source packets;',catalog['stats'],flush=True)
print('Catalogue:',APP/'data/catalog.json',flush=True)
