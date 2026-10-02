import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

test('authenticated API enforces team isolation, locking, revisions and account revocation', {skip:!process.env.DATABASE_URL}, async()=>{
 const {handleApi}=await import('../src/server/api')
 const {pool}=await import('../src/server/db')
 const {createAccount}=await import('../src/server/accounts')
 const origin=process.env.BETTER_AUTH_URL||'http://localhost:3000'
 const prefix=`test-${randomUUID()}`, password=`${randomUUID()}-secure`, ids:string[]=[]
 let teamId='',examId=''
 const call=(route:string,method='GET',data?:unknown,cookie?:string,requestOrigin=origin)=>handleApi(new Request(`${origin}${route}`,{method,headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{'content-type':'application/json',origin:requestOrigin}:{})},body:data?JSON.stringify(data):undefined}))
 const login=async(email:string)=>{const r=await call('/api/auth/sign-in/email','POST',{email,password});assert.equal(r.status,200,await r.clone().text());const cookies=r.headers.getSetCookie();assert.ok(cookies.length);return cookies.map(c=>c.split(';')[0]).join('; ')}
 try {
  const cookies:Record<string,string>={},users:Record<string,string>={}
  for(const role of ['teacher','outsider','reviewer','committee','office','admin']) {const u=await createAccount(role,`${prefix}-${role}@example.test`,password,['outsider','reviewer'].includes(role)?'teacher':role);ids.push(u.id);users[role]=u.id;cookies[role]=await login(u.email)}
  teamId=prefix;await pool.query('INSERT INTO teams(id,name) VALUES($1,$1)',[teamId]);for(const role of ['teacher','reviewer'])await pool.query('INSERT INTO memberships(team_id,user_id) VALUES($1,$2)',[teamId,users[role]])
  assert.equal((await call('/api/dashboard')).status,401)
  assert.equal((await call('/api/exams','POST',{teamId},cookies.teacher,'https://evil.invalid')).status,403)
  assert.equal((await call('/api/auth/admin/impersonate-user','POST',{userId:users.teacher},cookies.admin)).status,404)
  const created=await call('/api/exams','POST',{teamId,title:'Integration test'},cookies.teacher);assert.equal(created.status,201,await created.clone().text());let exam=(await created.json()).exam;examId=exam.id
  for(const role of ['outsider','committee','office','admin'])assert.equal((await call(`/api/exams/${examId}`,'GET',undefined,cookies[role])).status,403,role)
  const mutate=(action:any,version=exam.version,cookie=cookies.teacher)=>call(`/api/exams/${examId}`,'POST',{version,action},cookie)
  const updated=await mutate({type:'update',title:'Updated'});assert.equal(updated.status,200);const previous=exam.version;exam=(await updated.json()).exam
  assert.equal((await mutate({type:'update',title:'Stale'},previous)).status,409)
  const section={id:'section',title:'Text',text:'<p>Safe<script>alert(1)</script></p>',source:'Original',authorId:users.teacher,reviewerId:users.reviewer,questions:[],findings:[],contributors:[],version:1}
  assert.equal((await mutate({type:'save-section',section})).status,409)
  assert.equal((await call(`/api/exams/${examId}/lock`,'POST',{sectionId:'section'},cookies.teacher)).status,200)
  assert.equal((await call(`/api/exams/${examId}/lock`,'POST',{sectionId:'section'},cookies.reviewer)).status,409)
  const saved=await mutate({type:'save-section',section});assert.equal(saved.status,200,await saved.clone().text());exam=(await saved.json()).exam;assert.equal(exam.sections[0].text,'<p>Safe</p>')
  assert.equal((await mutate({type:'review',sectionId:'section',answers:{}})).status,400)
  assert.equal((await mutate({type:'not-an-action'})).status,400)
  assert.equal((await call(`/api/exams/${examId}/download`,'GET',undefined,cookies.teacher)).status,403)
  assert.equal((await call('/api/admin','POST',{action:'update-user',userId:users.reviewer,role:'committee'},cookies.admin)).status,200)
  assert.equal((await call('/api/dashboard','GET',undefined,cookies.reviewer)).status,401)
  assert.equal((await pool.query('SELECT * FROM memberships WHERE user_id=$1',[users.reviewer])).rowCount,0)
 }finally{
  if(examId){await pool.query('DELETE FROM edit_locks WHERE exam_id=$1',[examId]);await pool.query('DELETE FROM audit WHERE exam_id=$1',[examId]);await pool.query('DELETE FROM revisions WHERE exam_id=$1',[examId]);await pool.query('DELETE FROM exams WHERE id=$1',[examId])}
  await pool.query('DELETE FROM audit WHERE actor_id=ANY($1::text[])',[ids]);if(teamId)await pool.query('DELETE FROM teams WHERE id=$1',[teamId]);await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])',[ids]);await pool.end()
 }
})
