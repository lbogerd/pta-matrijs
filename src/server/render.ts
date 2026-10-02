import sanitizeHtml from 'sanitize-html';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { pool } from './db';
import { gradeTable, maximumScore, validNTerm, type Exam } from '../lib/domain';
export type DocumentKind = 'exam' | 'answers';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function renderPreview(exam: Exam, kind: DocumentKind): Promise<string> {
  const files = await pool.query('SELECT id,mime,path FROM files WHERE exam_id=$1', [exam.id]);
  const images = new Map<string,string>();
  for (const file of files.rows) if (['image/png','image/jpeg','image/webp'].includes(file.mime)) {
    try { images.set(`/api/files/${file.id}`,`data:${file.mime};base64,${(await readFile(file.path)).toString('base64')}`); } catch { /* missing files remain visibly unavailable */ }
  }
  const rich = (input: string) => sanitizeHtml(input, {
    allowedTags: ['p','br','strong','b','em','i','u','ul','ol','li','blockquote','h2','h3','img'],
    allowedAttributes: {img:['src','alt']}, allowedSchemes:['data'],
    transformTags: {img: (_tag, attrs) => ({tagName:'img',attribs:{src:images.get(attrs.src) || '',alt:attrs.alt || 'Afbeelding'}})},
  });
  const isReleased = exam.status === 'released';
  const snapshot = [...exam.snapshots].reverse().find(s=>s.releasedAt && !s.withdrawnAt);
  const documentRevision = isReleased && snapshot ? snapshot.revision : exam.revision;
  const maximum = maximumScore(exam);
  const grades = isReleased && snapshot ? snapshot.grades : maximum > 0 && maximum <= 10000 && validNTerm(exam.nTerm) ? gradeTable(maximum,exam.nTerm) : [];
  let qn = 0;
  const sections = exam.sections.map((s,index)=> `<section class="text-section"><h2>Tekst ${index+1} · ${escape(s.title)}</h2><div class="passage">${rich(s.text)}</div><p class="source">Bron: ${escape(s.source)}</p>${s.questions.map(q=>{
    const number=++qn;
    return `<div class="question"><div class="question-heading"><b>${number}.</b> <span>${escape(q.text)}</span><small>${q.points} ${q.points===1?'punt':'punten'}</small></div><ol class="options" type="A">${q.options.map(o=>`<li>${escape(o)}</li>`).join('')}</ol>${kind==='answers'?`<div class="answer"><b>Antwoord: ${escape(String.fromCharCode(65+q.correct))} · ${q.points} punten</b><p>${escape(q.rationale)}</p><p><i>Tekstpassage: ${escape(q.passage)}</i></p></div>`:''}</div>`;
  }).join('')}</section>`).join('');
  const title = kind==='answers'?'Correctiemodel':'Examen';
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(exam.title)} · ${title}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#e9ece9;color:#172e2a;font:11pt/1.55 Arial,sans-serif} @page{size:A4;margin:19mm 18mm 20mm;@bottom-left{content:"${isReleased?'VRIJGEGEVEN':'CONCEPT'} · ${escape(exam.id).replace(/[^a-zA-Z0-9-]/g,'')} · v${documentRevision}";font:8pt Arial;color:#687a75}@bottom-right{content:"Pagina " counter(page) " / " counter(pages);font:8pt Arial;color:#687a75}}
  .pagedjs_pages{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px}.pagedjs_page{background:white;box-shadow:0 2px 12px #0001}.cover{break-after:page}.eyebrow{font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#48756b}.badge{border:1px solid #608c80;display:inline-block;padding:4px 10px;font:9pt Arial;margin:20px 0}h1{font-size:30pt;line-height:1.15;letter-spacing:-1px;margin:30px 0 12px}h2{font-size:17pt;margin:24px 0 12px;break-after:avoid}h3{break-after:avoid}dl{display:grid;grid-template-columns:120px 1fr;gap:10px;margin:35px 0}dt{color:#65756f}dd{margin:0}.candidate{border-top:1px solid #bccbc5;padding-top:15px;margin-top:45px}.candidate p{margin:24px 0}.instructions{background:#f2f5f2;padding:20px}.passage{counter-reset:paragraph}.passage>p{position:relative;padding-left:28px}.passage>p:before{counter-increment:paragraph;content:counter(paragraph);position:absolute;left:0;color:#74827c;font-size:9pt}img{max-width:100%;max-height:170mm;object-fit:contain}p{orphans:3;widows:3}.source{font-size:9pt;color:#687a75}.question{break-inside:avoid;margin:22px 0}.question-heading{display:flex;gap:10px}.question-heading span{flex:1}.question-heading small{white-space:nowrap}.options{padding-left:38px}.options li{padding-left:8px;margin:4px 0}.answer{border-left:3px solid #538172;background:#f1f5f2;padding:12px 16px;margin-top:12px}.answer p{margin:6px 0}.grades{break-before:page}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{text-align:left;border-bottom:1px solid #dce3de;padding:5px 12px}thead{display:table-header-group}tr{break-inside:avoid}.grade-columns{columns:3;column-gap:25px}.grade-row{display:flex;justify-content:space-between;border-bottom:1px solid #dce3de;padding:5px 8px;break-inside:avoid}.grade-header{font-weight:bold;background:#eef3ef}.render-error{padding:30px;color:#9c2828}@media print{body{background:white}.pagedjs_pages{padding:0;gap:0}.pagedjs_page{box-shadow:none;margin:0}}@media screen and (max-width:850px){.pagedjs_pages{align-items:flex-start}}
  </style><script>window.PagedConfig={auto:false};</script></head><body><main id="document"><section class="cover"><div class="eyebrow">PTA Matrijs · ${escape(exam.pta.programme)}</div><div class="badge">${isReleased?'VRIJGEGEVEN':'CONCEPT — NIET VOOR AFNAME'}</div><h1>${escape(exam.title)}</h1><p>${title} · ${escape(exam.pta.subject)} · ${escape(exam.pta.schoolYear)}</p><dl><dt>Onderdeel</dt><dd>${escape(exam.pta.code)}</dd><dt>Duur</dt><dd>${exam.pta.duration} minuten</dd><dt>Maximumscore</dt><dd>${maximum} punten</dd><dt>Hulpmiddelen</dt><dd>${escape(exam.pta.aids)}</dd><dt>Versie</dt><dd>${documentRevision} · ${escape(exam.id)}</dd></dl>${kind==='exam'?`<div class="instructions"><b>Instructies</b><p>Lees de teksten en vragen zorgvuldig. Kies bij iedere vraag één antwoord. Een juist antwoord levert het aangegeven aantal punten op.</p></div><div class="candidate"><p>Naam: ___________________________________________________</p><p>Kandidaatnummer: __________________________________________</p><p>Klas: ____________________________________________________</p></div>`:`<div class="instructions"><b>Correctievoorschrift</b><p>Ken bij het juiste antwoord de volledige vraagscore toe. Ken anders nul punten toe. De verdeling over leerdoelen heeft geen invloed op de beoordeling.</p><p>N-term: ${escape(exam.nTermLock?.value ?? exam.nTerm)} · hoofdrelatie met grensrelaties, één decimaal.</p></div>`}</section>${sections}${kind==='answers'?`<section class="grades"><h2>Score-cijfertabel</h2><p>Maximumscore ${maximum} · N-term ${escape(exam.nTermLock?.value??exam.nTerm)} · ${escape(exam.nTermLock?.method??'Examenblad hoofd- en grensrelaties')}</p><div class="grade-columns"><div class="grade-row grade-header"><span>Score</span><span>Cijfer</span></div>${grades.map(g=>`<div class="grade-row"><span>${g.score}</span><span>${escape(g.grade)}</span></div>`).join('')}</div></section>`:''}</main><script src="/paged.polyfill.js"></script><script>window.PagedPolyfill.preview().then(()=>{window.__PAGED_READY__=true}).catch(()=>{document.body.insertAdjacentHTML('afterbegin','<p class="render-error">Paginaopmaak kon niet worden geladen.</p>')});</script></body></html>`;
}
export async function renderPdf(exam: Exam, kind: DocumentKind): Promise<Buffer> {
  const html = await renderPreview(exam,kind);
  const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage();
    // Only the bundled pagination library may be loaded. Exam content cannot make network requests.
    const library=await readFile(`${process.cwd()}/node_modules/pagedjs/dist/paged.polyfill.js`);
    await page.route('**/*',route=>route.request().url().endsWith('/paged.polyfill.js')?route.fulfill({contentType:'text/javascript',body:library}):route.abort());
    await page.setContent(html.replace('src="/paged.polyfill.js"','src="https://document.invalid/paged.polyfill.js"'),{waitUntil:'networkidle'});
    await page.waitForFunction(()=>Boolean((window as unknown as {__PAGED_READY__:boolean}).__PAGED_READY__),{},{timeout:30000});
    return await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
  } finally {await browser.close();}
}
