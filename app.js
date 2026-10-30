const useFB=firebaseConfig.apiKey!=="YOUR_API_KEY";let fs;
if(useFB){firebase.initializeApp(firebaseConfig);fs=firebase.firestore()}
const LS={g:k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return[]}},s:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
/* every staff account only sees its own data: records carry owner = staff id */
const SC=['books','students','loans','trash','audit','settings'];
const mine=c=>SC.includes(c);
const DB={
 async raw(c){if(useFB){const s=await fs.collection(c).get();return s.docs.map(d=>({...d.data(),id:d.id}))}return LS.g(c)},
 async list(c){if(!mine(c))return DB.raw(c);if(!me)return[];if(useFB){const s=await fs.collection(c).where('owner','==',me.id).get();return s.docs.map(d=>({...d.data(),id:d.id}))}return LS.g(c).filter(x=>x.owner===me.id)},
 async add(c,o){if(mine(c)&&me)o={...o,owner:me.id};if(useFB)return (await fs.collection(c).add(o)).id;o.id='x'+Date.now()+Math.random().toString(36).slice(2,6);LS.s(c,[...LS.g(c),o]);return o.id},
 async set(c,id,o){if(mine(c)&&me)o={...o,owner:me.id};if(useFB)return fs.collection(c).doc(id).set(o);LS.s(c,[...LS.g(c).filter(x=>x.id!==id),{...o,id}])},
 async upd(c,id,o){if(useFB)return fs.collection(c).doc(id).update(o);LS.s(c,LS.g(c).map(x=>x.id===id?{...x,...o}:x))},
 async del(c,id){if(useFB)return fs.collection(c).doc(id).delete();LS.s(c,LS.g(c).filter(x=>x.id!==id))}};
/* data saved before accounts were separated has no owner: the first account that logs in after this update takes it over (once) */
async function claimOld(u){try{if((await DB.raw('meta')).some(x=>x.id==='legacy'))return;
 for(const c of SC)for(const x of await DB.raw(c))if(!x.owner)await DB.upd(c,x.id,{owner:u.id});
 await DB.set('meta','legacy',{by:u.id,at:Date.now()})}catch(e){}}
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10),addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const dd=(a,b)=>Math.round((new Date(a)-new Date(b))/864e5);
const toast=(m,bad)=>{const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),2900)};
const log=m=>DB.add('audit',{msg:m,ts:Date.now()});
const getSet=async()=>{const a=await DB.list('settings');return a[0]||{fine:5,days:7}};
const show=(el,m,ok)=>{el.textContent=m;el.className='err'+(ok?' ok':'');el.hidden=false};
let me=null,cur='Dashboard',DASH=null,IR=null,STB=[];

/* ---------- auth (Firestore "staff" collection) ---------- */
async function hp(p){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('librix:'+p));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return 'b:'+btoa(unescape(encodeURIComponent(p)))}}
const fail=(er,x)=>show(er,/permission|insufficient/i.test(x.message)?'Please allow read/write in Firestore rules (Firebase Console > Firestore > Rules).':x.message);
document.addEventListener('click',e=>{const a=e.target.closest('[data-sw]');if(a){$('#fLogin').hidden=a.dataset.sw!=='l';$('#fSign').hidden=a.dataset.sw!=='s';$('#lerr').hidden=$('#serr').hidden=true}});
$('#fSign').onsubmit=async e=>{e.preventDefault();const n=$('#sn').value.trim(),m=$('#se').value.trim().toLowerCase(),id=$('#si').value.trim(),p=$('#sp').value,c=$('#sc').value,er=$('#serr');
 if(!n||!m||!id||!p||!c)return show(er,'Please fill in all fields.');
 if(p.length<4)return show(er,'Password must be at least 4 characters.');
 if(p!==c)return show(er,'Passwords do not match.');
 try{const st=await DB.list('staff');
  const ph=await hp(p),bad=[];
  if(st.some(x=>(x.name||'').toLowerCase()===n.toLowerCase()))bad.push('This name is already taken. Please use a strong, different name.');
  if(st.some(x=>(x.email||'').toLowerCase()===m))bad.push('This email is already registered. Please use a different email.');
  if(st.some(x=>(x.staffId||'').toLowerCase()===id.toLowerCase()))bad.push('This Staff ID is already registered. Please use a different Staff ID.');
  if(st.some(x=>x.pw===ph))bad.push('This password is already in use. Please use a strong, different password.');
  if(bad.length)return show(er,bad.join(' '));
  await DB.add('staff',{name:n,email:m,staffId:id,password:p,pw:ph});
  e.target.reset();$('#fSign').hidden=true;$('#fLogin').hidden=false;show($('#lerr'),'Account created. Please login.',1)}
 catch(x){fail(er,x)}};
$('#fLogin').onsubmit=async e=>{e.preventDefault();const q=$('#lq').value.trim().toLowerCase(),p=$('#lp').value,er=$('#lerr');if(!q||!p)return show(er,'Enter your Name / Email / ID and password.');
 try{const u=(await DB.list('staff')).find(x=>x.email===q||x.name.toLowerCase()===q||x.staffId.toLowerCase()===q);
  if(!u)return show(er,'No account found with this name, email or ID. Please sign up first.');
  if(u.pw!==await hp(p))return show(er,'Incorrect password.');
  if(u.password!==p){try{await DB.upd('staff',u.id,{password:p});u.password=p}catch(_){}}
  localStorage.setItem('sess',u.id);e.target.reset();er.hidden=true;enter(u)}catch(x){fail(er,x)}};
async function enter(u){me=u;await claimOld(u);$('#auth').hidden=true;$('#app').hidden=false;$('#uini').textContent=u.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();$('#uav').textContent=u.name[0].toUpperCase();log('User logged in: '+u.name);go('Dashboard')}
function out(){localStorage.removeItem('sess');me=null;DASH=IR=null;STB=[];$('#view').innerHTML='';closeM();$('#app').hidden=true;$('#auth').hidden=false}
{const s=localStorage.getItem('sess');if(s)DB.list('staff').then(l=>{const u=l.find(x=>x.id===s);if(u)enter(u)}).catch(()=>{})}

/* ---------- ui helpers ---------- */
const NAV=[['Dashboard','▦'],['Books','▮'],['Students','☺'],['Issue & Return','⇄'],['Fines','$']];
$('#nav').innerHTML=NAV.map(([n,i])=>`<button data-p="${n}"><span>${i}</span><b>${n}</b></button>`).join('')+'<button class="lo" data-act="out"><span>⎋</span><b>Logout</b></button>';
const hd=(e,t,s,r='')=>`<div class="hd"><div><div class="eye">${e}</div><h1>${t}</h1><p>${s}</p></div>${r}</div>`;
const stat=(l,v,s,pre='',act='')=>`<div class="stat${act?' click':''}"${act?` data-act="${act}" role="button" tabindex="0"`:''}><small>${l}</small><b data-n="${v}" data-pre="${pre}">${pre}0</b><span>${s}</span></div>`;
const tbl=(h,rows,msg)=>`<div class="tw"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td class="emp" colspan="${h.length}">${msg}</td></tr>`}</tbody></table></div>`;
const catOf=x=>(x.category&&x.category!=='—'?String(x.category).trim():'Uncategorized');
const st=l=>l.returned?'<span class="pill ok">Returned</span>':l.due<today()?'<span class="pill bad">Overdue</span>':'<span class="pill">Issued</span>';
const counts=()=>document.querySelectorAll('[data-n]').forEach(el=>{const n=+el.dataset.n,t0=performance.now();(function f(t){const k=Math.min(1,(t-t0)/800);el.textContent=el.dataset.pre+Math.round(n*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(f)})(t0)});
async function go(p){cur=p;closeM();$('#crumb').textContent=p==='Books'?'Books Management':p==='Students'?'Students Management':p==='Fines'?'Fine Management':p;
 document.querySelectorAll('.nav [data-p]').forEach(b=>b.classList.toggle('on',b.dataset.p===p));const v=$('#view');v.innerHTML=await P[p]();counts();window.scrollTo(0,0)}

/* ---------- pages ---------- */
const P={
async Dashboard(){const[b,s,l]=await Promise.all([DB.list('books'),DB.list('students'),DB.list('loans')]);
 const tot=b.reduce((a,x)=>a+ +x.total,0),av=b.reduce((a,x)=>a+ +x.avail,0),is=l.filter(x=>!x.returned),od=is.filter(x=>x.due<today());
 const m={};b.forEach(x=>{const k=catOf(x).toLowerCase();(m[k]=m[k]||{name:catOf(x),books:[]}).books.push(x)});
 const cats=Object.values(m).sort((x,y)=>x.name.localeCompare(y.name));cats.forEach(c=>c.books.sort((x,y)=>x.title.localeCompare(y.title)));
 DASH={b,s,cats};
 const dep=cats.map((c,i)=>`<button type="button" class="dep" data-act="pickDep" data-id="${i}"><span>${esc(c.name)}</span><small>${c.books.length}</small></button>`).join('')||'<div class="emp">No books yet. Please add Books first.</div>';
 return hd('Library overview','Dashboard','A quick overview of library activity.','<button class="btn" data-p="Issue &amp; Return">＋ Issue a Book</button>')+
 `<div class="stats">${stat('Total Book Copies',tot,av+' available (tap to view)','','showBooks')}${stat('Total Students',s.length,'Tap to view names','','showStu')}${stat('Issued Books',is.length,'Currently with students')}${stat('Overdue Books',od.length,'Need follow-up')}</div>
 <div class="card"><h3>Departments &amp; Books</h3><div class="s">Choose a department to see its subjects and copies.</div>
 <div class="dp"><div class="dcol"><h4>Department</h4><div>${dep}</div></div><div class="dcol"><h4>Subjects (Book Title)</h4><div id="dSub"><div class="emp">Select a department</div></div></div><div class="dcol"><h4>Copies</h4><div id="dCop"><div class="emp">Select a department</div></div></div></div></div>
 <footer class="foot"><div>Project by: Noshad, Ahmed, Faheem</div><div>Copy Right 2026</div></footer>`},
async Books(){const b=[...await DB.list('books')].sort((x,y)=>catOf(x).localeCompare(catOf(y))||x.title.localeCompare(y.title));
 const rows=b.map((x,i)=>`<tr style="--i:${i}" data-q="${esc((x.title+' '+x.author+' '+x.isbn+' '+catOf(x)).toLowerCase())}" data-c="${esc(catOf(x).toLowerCase())}"><td><b>${esc(x.title)}</b></td><td>${esc(x.author)}</td><td class="mono">${esc(x.isbn)}</td><td>${esc(catOf(x))}</td><td><b>${x.total}</b> / <b style="color:var(--ok)">${x.avail}</b></td><td><button class="lk" data-act="delBook" data-id="${x.id}">Delete</button></td></tr>`).join('');
 return hd('Catalog','Books Management','Add and manage the library collection.')+
 `<form class="card" id="fBook"><h3>Add New Book</h3><div class="s">Required fields are marked with *.</div><div class="g3"><div><label>Book Title *</label><input id="bt" placeholder="e.g. Data Structures &amp; Algorithms"></div><div><label>Author *</label><input id="ba" placeholder="Author Name"></div><div><label>ISBN / Code *</label><input id="bi" placeholder="e.g. ISBN-908231"></div><div><label>Category</label><input id="bc" placeholder="Computer Science, Literature..."></div><div><label>Total Copies *</label><input id="bn" type="number" min="1" value="1"></div><button class="btn">Save Book</button></div></form>
 <div class="card"><div class="row"><div><h3>Book Inventory</h3><div class="s">${b.length} total books, sorted by category (A to Z)</div></div><input data-search placeholder="Search title, author, ISBN, category..."></div>${tbl(['Title','Author','ISBN','Category','Total / Available','Action'],rows,'No books added yet.')}</div>`},
async Students(){const[s,b,tr]=await Promise.all([DB.list('students'),DB.list('books'),DB.list('trash')]);STB=b;
 const rows=s.map((x,i)=>`<tr style="--i:${i}" data-q="${esc((x.name+' '+x.roll+' '+x.dept+' '+(x.cnic||'')+' '+(x.btitle||'')).toLowerCase())}"><td class="mono"><b>${esc(x.roll)}</b></td><td>${x.returned?`<span class="done">${esc(x.name)}</span>`:`<b>${esc(x.name)}</b>`}</td><td>${x.btitle?esc(x.btitle)+' <span class="pill'+(x.returned||x.issued?' ok':'')+'">×'+x.copies+(x.returned?' returned':x.issued?' issued':'')+'</span>':'—'}</td><td>${esc(x.dept)}</td><td>${esc(x.phone)}</td><td>${esc(x.cnic||'—')}</td><td>${esc(x.email)}</td><td><input type="checkbox" class="ck" data-act="retStu" data-id="${x.id}" title="Book returned" ${x.returned?'checked disabled':''}></td><td><button class="lk" data-act="delStu" data-id="${x.id}">Delete</button></td></tr>`).join('');
 const trows=[...tr].sort((p,q)=>(q.deletedAt||0)-(p.deletedAt||0)).map((x,i)=>`<tr style="--i:${i}"><td class="mono"><b>${esc(x.roll)}</b></td><td>${esc(x.name)}</td><td>${x.deletedAt?new Date(x.deletedAt).toLocaleDateString():'—'}</td><td><button class="lk g" data-act="restoreStu" data-id="${x.id}">Restore</button> &nbsp; <button class="lk" data-act="purgeStu" data-id="${x.id}">Delete forever</button></td></tr>`).join('');
 return hd('Student directory','Students Management','Add and update student records.')+
 `<form class="card" id="fStu"><h3>Add Student</h3><div class="s">Required fields are marked with *.</div><div class="g2"><div><label>Roll Number *</label><input id="sr" placeholder="e.g. BSCS-001"></div><div><label>Student Name *</label><input id="sm" placeholder="Full name"></div><div class="cb"><label>Book Name *</label><input id="sbq" autocomplete="off" placeholder="Search book by title, author, category..."><input type="hidden" id="sb"><div class="sug" id="sug" hidden></div></div><div><label>Copies *</label><input id="sk" type="number" min="1" value="1"></div><div><label>Email</label><input id="sl" placeholder="student@university.edu"></div><div><label>Department</label><input id="sd" placeholder="e.g. Computer Science"></div><div><label>Phone</label><input id="sh" placeholder="+92 300 0000000"></div><div><label>CNIC / B-Form</label><input id="sx" placeholder="e.g. 42101-1234567-1"></div><div style="align-self:end"><button class="btn">Save Student</button></div></div></form>
 <div class="card"><div class="row"><div><h3>Student Records</h3><div class="s">${s.length} students · tick "Paid" when the book is returned</div></div><input data-search placeholder="Search name, roll no, dept, CNIC..."></div>${tbl(['Roll No','Student Name','Book','Department','Phone','CNIC / B-Form','Email','Paid','Action'],rows,'No students added yet.')}
 <h3 style="margin-top:26px">Trash</h3><div class="s">Deleted students stay here until you delete them forever.</div>${tbl(['Roll No','Student Name','Deleted On','Action'],trows,'Trash is empty.')}</div>`},
async 'Issue & Return'(){const[b,s,l,c]=await Promise.all([DB.list('books'),DB.list('students'),DB.list('loans'),getSet()]);IR={s,b,c};
 const rows=l.filter(x=>!x.returned).map((x,i)=>`<tr style="--i:${i}"><td><b>${esc(x.sname)}</b></td><td>${esc(x.btitle)}</td><td>${x.copies||1}</td><td>${x.issue}</td><td>${x.due}</td><td>${st(x)}</td><td><button class="lk g" data-act="ret" data-id="${x.id}">Return</button></td></tr>`).join('');
 return hd('Circulation desk','Issue &amp; Return Books','Issue books to students and record returns.')+
 `<form class="card" id="fIss"><h3>Issue Book to Student</h3><div class="s">Pick a student. If a book is already recorded for them, it appears in the book box.</div><div class="g4"><div><label>Select Student *</label><select id="is"><option value="">-- Select Student --</option>${s.map(x=>`<option value="${x.id}">${esc(x.name)} (${esc(x.roll)})</option>`).join('')}</select></div><div><label>Select Book *</label><select id="ib"><option value="">-- Select Student first --</option></select></div><div><label>Issue Date *</label><input id="ii" type="date" max="${today()}" value="${today()}"></div><div><label>Return Due Date *</label><input id="id" type="date" value="${addD(today(),+c.days)}"></div></div><button class="btn" style="margin-top:14px">Issue Book</button></form>
 <div class="card"><h3>Currently Issued Books</h3><div class="s">Manage active loans &amp; perform returns</div>${tbl(['Student','Book Title','Copies','Issue Date','Due Date','Status','Action'],rows,'No active book loans.')}</div>`},
async Fines(){const l=(await DB.list('loans')).filter(x=>x.fine>0),sum=f=>l.filter(f).reduce((a,x)=>a+x.fine,0);
 const rows=l.map((x,i)=>`<tr style="--i:${i}"><td><b>${esc(x.sname)}</b></td><td>${esc(x.btitle)}</td><td>Rs. ${x.fine}</td><td><span class="pill ${x.paid?'ok':'bad'}">${x.paid?'Paid':'Pending'}</span></td><td>${x.paid?'—':`<button class="lk g" data-act="pay" data-id="${x.id}">Mark paid</button>`}</td></tr>`).join('');
 return hd('Late return &amp; payments','Fine Management','Track late fees and record payments.')+
 `<div class="stats">${stat('Total Fines',sum(()=>1),'All fine records','Rs. ')}${stat('Pending Fines',sum(x=>!x.paid),'Not marked paid','Rs. ')}${stat('Paid Fines',sum(x=>x.paid),'Marked as paid','Rs. ')}</div>
 <div class="card"><h3>Fine Records</h3><div class="s">Fines are calculated at return time using the current settings.</div>${tbl(['Student','Book','Fine','Status','Action'],rows,'No fine records registered.')}</div>`}};

/* ---------- actions ---------- */
const V=$('#view'),v=id=>$('#'+id).value.trim();
const modal=(t,h)=>{closeM();const m=document.createElement('div');m.className='modal';m.id='modal';m.innerHTML=`<div class="mbox"><div class="mh"><h3>${t}</h3><button type="button" class="x" data-act="closeM" aria-label="Close">✕</button></div><div class="mb">${h}</div></div>`;m.addEventListener('click',e=>{if(e.target===m)closeM()});document.body.append(m)};
const closeM=()=>{const m=$('#modal');if(m)m.remove()};
const pend=x=>x.bid&&+x.copies>0&&!x.issued&&!x.returned;
function sug(q){const g=$('#sug');if(!g)return;q=q.toLowerCase().trim();
 const l=[...STB].filter(x=>(x.title+' '+x.author+' '+x.isbn+' '+catOf(x)).toLowerCase().includes(q)).sort((x,y)=>x.title.localeCompare(y.title)).slice(0,40);
 g.innerHTML=l.map(x=>`<button type="button" class="sg" data-act="pickBk" data-id="${x.id}"${+x.avail<1?' disabled':''}><b>${esc(x.title)}</b><small>${esc(x.author)} · ${esc(catOf(x))} · ${+x.avail<1?'none left':x.avail+' left'}</small></button>`).join('')||'<div class="emp">No book found in inventory.</div>';g.hidden=false}
function fillBooks(sid){const sel=$('#ib');if(!sel||!IR)return;const S=IR.s.find(x=>x.id===sid);
 if(!S){sel.innerHTML='<option value="">-- Select Student first --</option>';return}
 const B=pend(S)?IR.b.find(x=>x.id===S.bid):null;
 if(B){sel.innerHTML=`<option value="${B.id}">${esc(B.title)} (${S.copies} ${+S.copies>1?'copies':'copy'} taken)</option>`;return}
 sel.innerHTML='<option value="">-- Select Book --</option>'+IR.b.filter(x=>x.avail>0).map(x=>`<option value="${x.id}">${esc(x.title)} (${x.avail} left)</option>`).join('')}
const A={
 out,closeM,
 pickBk(id){const B=STB.find(x=>x.id===id);if(!B)return;$('#sb').value=id;$('#sbq').value=B.title;$('#sug').hidden=true},
 showBooks(){const b=[...DASH.b].sort((x,y)=>x.title.localeCompare(y.title));
  const rows=b.map((x,i)=>`<tr style="--i:${i}"><td><b>${esc(x.title)}</b><br><small class="mono">${esc(catOf(x))}</small></td><td>${x.total}</td><td><b style="color:var(--ok)">${x.avail}</b></td></tr>`).join('');
  modal('Total Book Copies',`<div class="s">${b.length} books · ${b.reduce((a,x)=>a+ +x.total,0)} copies · ${b.reduce((a,x)=>a+ +x.avail,0)} left on shelf</div>${tbl(['Book','Total','Copies left'],rows,'No books added yet.')}`)},
 showStu(){const s=[...DASH.s].sort((x,y)=>x.name.localeCompare(y.name));
  const rows=s.map((x,i)=>`<tr style="--i:${i}"><td>${i+1}</td><td><b>${esc(x.name)}</b></td><td class="mono">${esc(x.roll)}</td></tr>`).join('');
  modal('Total Students',`<div class="s">${s.length} registered students</div>${tbl(['#','Student Name','Roll No'],rows,'No students added yet.')}`)},
 pickDep(i){const c=DASH.cats[+i];if(!c)return;document.querySelectorAll('.dep').forEach(b=>b.classList.toggle('on',b.dataset.id===String(i)));
  $('#dSub').innerHTML=c.books.map(x=>`<div class="li"><b>${esc(x.title)}</b><small>${esc(x.author)}</small></div>`).join('');
  $('#dCop').innerHTML=c.books.map(x=>`<div class="li"><b>${x.total} ${+x.total===1?'copy':'copies'}</b><small>${x.avail} available · ${x.total-x.avail} issued</small></div>`).join('')},
 async delBook(id){if(!confirm('Delete this book?'))return;await DB.del('books',id);log('Book deleted');toast('Book deleted');go(cur)},
 async delStu(id){if(!confirm('Move this student to Trash?'))return;const x=(await DB.list('students')).find(y=>y.id===id);if(!x)return;const d={...x};delete d.id;
  if(pend(x)){const b=(await DB.list('books')).find(y=>y.id===x.bid);if(b)await DB.upd('books',b.id,{avail:+b.avail+ +x.copies});d.bid='';d.btitle='';d.copies=0}
  d.deletedAt=Date.now();await DB.set('trash',id,d);await DB.del('students',id);log('Student moved to trash: '+x.name);toast('Moved to Trash');go(cur)},
 async restoreStu(id){const[t,s]=await Promise.all([DB.list('trash'),DB.list('students')]),x=t.find(y=>y.id===id);if(!x)return;
  if(s.some(y=>(y.roll||'').toLowerCase()===(x.roll||'').toLowerCase()))return toast('A student with this roll number already exists.',1);
  const d={...x};delete d.id;delete d.deletedAt;await DB.set('students',id,d);await DB.del('trash',id);log('Student restored: '+x.name);toast('Student restored');go(cur)},
 async purgeStu(id){if(!confirm('Delete forever? This cannot be undone.'))return;await DB.del('trash',id);log('Student deleted forever');toast('Deleted forever');go(cur)},
 async retStu(id,el){if(!confirm('Mark this student\'s book as returned? This cannot be undone.')){el.checked=false;return}
  const[S,L,Bk]=await Promise.all([DB.list('students'),DB.list('loans'),DB.list('books')]),x=S.find(y=>y.id===id);if(!x||!x.bid){el.checked=false;return toast('No book is recorded for this student.',1)}
  if(pend(x)){const b=Bk.find(y=>y.id===x.bid);if(b)await DB.upd('books',b.id,{avail:+b.avail+ +x.copies})}
  else if(x.issued){const ln=L.find(y=>y.sid===id&&y.bid===x.bid&&!y.returned);if(ln){const c=await getSet(),fine=Math.max(0,dd(today(),ln.due))*c.fine;await DB.upd('loans',ln.id,{returned:today(),fine,paid:false});const b=Bk.find(y=>y.id===ln.bid);if(b)await DB.upd('books',b.id,{avail:+b.avail+(+ln.copies||1)})}}
  await DB.upd('students',id,{returned:true});log('Book returned by: '+x.name);toast('Book marked as returned');go(cur)},
 async ret(id){const[l,c]=await Promise.all([DB.list('loans'),getSet()]),x=l.find(y=>y.id===id);if(!x)return;const late=Math.max(0,dd(today(),x.due)),fine=late*c.fine;
  await DB.upd('loans',id,{returned:today(),fine,paid:false});const b=(await DB.list('books')).find(y=>y.id===x.bid);if(b)await DB.upd('books',b.id,{avail:+b.avail+(+x.copies||1)});
  {const S=(await DB.list('students')).find(y=>y.id===x.sid);if(S&&S.issued&&S.bid===x.bid&&!S.returned)await DB.upd('students',S.id,{returned:true})}
  log('Returned: '+x.btitle);toast(fine?`Returned. Late fine Rs. ${fine}`:'Book returned');go(cur)},
 async pay(id){await DB.upd('loans',id,{paid:true});log('Fine paid');toast('Fine marked as paid');go(cur)}};
document.addEventListener('click',e=>{const t=e.target.closest('[data-act],[data-p]');if(!t)return;if(t.dataset.act){if(A[t.dataset.act])A[t.dataset.act](t.dataset.id,t)}else{closeM();go(t.dataset.p)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeM();if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button]')){e.preventDefault();e.target.click()}});
document.addEventListener('input',e=>{if(e.target.dataset.search!==undefined){const q=e.target.value.toLowerCase().trim();V.querySelectorAll('tbody tr[data-q]').forEach(r=>r.hidden=!r.dataset.q.includes(q))}
 if(e.target.id==='sbq'){$('#sb').value='';sug(e.target.value)}});
document.addEventListener('focusin',e=>{if(e.target.id==='sbq')sug(e.target.value)});
document.addEventListener('click',e=>{if(!e.target.closest('.cb')){const g=$('#sug');if(g)g.hidden=true}});
document.addEventListener('change',e=>{if(e.target.id==='is')fillBooks(e.target.value);if(e.target.id==='ii'&&IR&&e.target.value)$('#id').value=addD(e.target.value,+IR.c.days)});
V.addEventListener('submit',async e=>{e.preventDefault();const id=e.target.id;
 if(id==='fBook'){const t=v('bt'),a=v('ba'),i=v('bi'),n=+v('bn');if(!t||!a||!i||n<1)return toast('Fill all required fields.',1);
  if((await DB.list('books')).some(x=>x.isbn.toLowerCase()===i.toLowerCase()))return toast('ISBN already exists.',1);
  await DB.add('books',{title:t,author:a,isbn:i,category:v('bc')||'—',total:n,avail:n});log('Book added: '+t);toast('Book saved')}
 else if(id==='fStu'){const r=v('sr'),n=v('sm'),bid=v('sb'),k=parseInt(v('sk'))||0;if(!r||!n)return toast('Roll number and name are required.',1);
  if(!bid)return toast('Search and pick a book from the list.',1);if(k<1)return toast('Copies must be at least 1.',1);
  if((await DB.list('students')).some(x=>x.roll.toLowerCase()===r.toLowerCase()))return toast('Roll number already exists.',1);
  const B=(await DB.list('books')).find(x=>x.id===bid);if(!B)return toast('Selected book was not found.',1);if(k>+B.avail)return toast(`Only ${B.avail} ${+B.avail===1?'copy is':'copies are'} available.`,1);
  await DB.add('students',{roll:r,name:n,email:v('sl')||'—',dept:v('sd')||'—',phone:v('sh')||'—',cnic:v('sx')||'—',bid:B.id,btitle:B.title,copies:k,issued:false,returned:false});
  await DB.upd('books',B.id,{avail:+B.avail-k});log('Student added: '+n);toast('Student saved')}
 else if(id==='fIss'){const[s,b]=await Promise.all([DB.list('students'),DB.list('books')]),S=s.find(x=>x.id===v('is')),B=b.find(x=>x.id===v('ib')),d=v('id'),i=v('ii');
  if(!S||!B||!d||!i)return toast('Select student, book, issue date and due date.',1);
  if(i>today())return toast('Issue date cannot be in the future.',1);if(d<i)return toast('Due date cannot be before the issue date.',1);
  const own=pend(S)&&S.bid===B.id,k=own?+S.copies:1;if(!own&&+B.avail<1)return toast('No copy of this book is available.',1);
  await DB.add('loans',{sid:S.id,sname:S.name,bid:B.id,btitle:B.title,copies:k,issue:i,due:d,returned:'',fine:0,paid:false});
  if(own)await DB.upd('students',S.id,{issued:true});else await DB.upd('books',B.id,{avail:+B.avail-1});
  log(`Issued: ${B.title} → ${S.name}`);toast('Book issued')}
 go(cur)});
