const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const clean=v=>v==null?'':String(v).trim();
const DEFAULT_ORDER=['social','saa','president','tme','grammarIntro','variety','speeches','guestReport','intermission','topics','evaluation','reports','grammarReport','geComment','summary','adjourn'];
const DEFAULT_TIMES={social:14,saa:1,president:2,tme:8,grammarIntro:4,variety:15,guestReport:8,intermission:15,topics:16,geOpen:2,individualEval:6,reports:3,grammarReport:4,geComment:4,summary:2};
const SESSION_META={
 social:['Equipment checkout & Social time','社交時間'],saa:['SAA calls for opening','SAA 開場'],president:['Chair calls meeting to order','會長致詞'],
 tme:['Toastmaster calls on meeting roles','TME／介紹主題與小幫手'],grammarIntro:['Word of the day','文法介紹'],variety:['Variety session','Variety 時間'],
 speeches:['Manual speech session','所有 Speaker 與演講分鐘'],guestReport:['Officers’ report / Introducing guests','報告及介紹來賓'],
 intermission:['Group photo / Intermission','中場休息'],topics:['Table Topics Session','即席問答時間'],evaluation:['Evaluation session','GE 開場與個別講評'],
 reports:['Timer and Ah Counter’s reports','報告'],grammarReport:['Grammarian’s report','文法報告'],geComment:['General Evaluator’s comment','總講評'],
 summary:['Toastmaster wraps up','總結'],adjourn:['Chair adjourns meeting','散會']
};
const ROLE_FIELDS=[
 ['receptionist','Receptionist'],['saa','SAA'],['president','President'],['tme','Toastmaster'],['timer','Timer'],['ahCounter','Ah Counter'],
 ['varietyMaster','Variety Master'],['topicsmaster','Topicsmaster'],['ge','General Evaluator'],['grammarian','Grammarian'],
 ['evaluatorOfEvaluator','Evaluator of Evaluator'],['evaluatorOfTopicsmaster','Evaluator of Topicsmaster']
];
const ROLE_LABELS={receptionist:'Receptionist',saa:'SAA',president:'President',tme:'Toastmaster',timer:'Timer',ahCounter:'Ah counter',varietyMaster:'Variety Master',topicsmaster:'Topicsmaster',ge:'General Evaluator',grammarian:'Grammarian'};
let project,activeIndex=0,undoStack=[],redoStack=[],continuousSnapshot='',pendingRestore=null,saveTimer=null,resizeObserver=null,dialogResolve=null;

function blankRoles(){return Object.fromEntries(ROLE_FIELDS.map(([k])=>[k,'']))}
function blankMeeting(number=''){
 return {id:uid(),number,date:'',note:'English',theme:'',word:'',roles:blankRoles(),speakers:[],events:['',''],order:[...DEFAULT_ORDER],times:{...DEFAULT_TIMES}};
}
function makeSpeaker(data={}){
 return {id:data.id||uid(),name:clean(data.name),title:clean(data.title),level:clean(data.level),project:clean(data.project),duration:clean(data.duration),minutes:normalMinutes(data.minutes??speechMinutes(data.duration,data.name)),evaluator:clean(data.evaluator)};
}
function speechMinutes(duration,speaker){if(!clean(speaker))return 0;const nums=String(duration||'').match(/\d+/g);return nums?.length?Number(nums.at(-1))+1:8}
function normalMinutes(v){return Math.max(0,Math.floor(Number(v)||0))}
function demoProject(){
 const m=blankMeeting(452);m.date='2026-09-01';m.theme='Keep Going';m.word='agility';
 m.roles={receptionist:'Chin Chi Lai',saa:'Gina Wu',president:'Chin Chi Lai',tme:'Mark Weng',timer:'Alex Ho',ahCounter:'Mandy Lin',varietyMaster:'Darren Lin',topicsmaster:'Darren Lin',ge:'Camila Wu',grammarian:'Steve Huang',evaluatorOfEvaluator:'',evaluatorOfTopicsmaster:''};
 m.speakers=[makeSpeaker({name:'Gina Wu',title:'Do We Really Need Three Meals a Day?',level:'EH L3-2',project:'Inspire your audience',duration:"5'-7'",minutes:8,evaluator:'Steve Huang'}),makeSpeaker({name:'Camila Wu',title:'The Courage to Be Seen',level:'PM Level 5',project:'Prepare to speak professionally',duration:"18'-22'",minutes:23,evaluator:'Kimmy Chang'}),makeSpeaker({name:'Sue Huang',title:'',duration:'',minutes:0,evaluator:''})];
 m.events=['9/29–9/30 SYTC 阿里山民宿 Outing',''];
 const members=['TBA','Alex Ho','Camila Wu','Chin Chi Lai','Darren Lin','Mandy Lin','Gina Wu','Steve Huang','Mark Weng','Susan Su','Sunia Huang','Sue Huang','Watchman Chen','Kimmy Chang'];
 return {id:'demo-project',fileName:'示範資料',members:members.map(name=>({name,active:true})),meetings:[m],baseMeetings:[clone(m)],updatedAt:Date.now()};
}

function activeMeeting(){return project.meetings[activeIndex]||project.meetings[0]}
function snapshot(){return JSON.stringify({project,activeIndex})}
function restoreSnapshot(raw){const x=JSON.parse(raw);project=x.project;activeIndex=Math.min(x.activeIndex,project.meetings.length-1);renderAll();queueSave()}
function applyChange(fn){undoStack.push(snapshot());if(undoStack.length>60)undoStack.shift();redoStack=[];fn();project.updatedAt=Date.now();renderAll();queueSave()}
function beginContinuousEdit(){continuousSnapshot=snapshot()}
function finishContinuousEdit(){if(continuousSnapshot&&continuousSnapshot!==snapshot()){undoStack.push(continuousSnapshot);if(undoStack.length>60)undoStack.shift();redoStack=[]}continuousSnapshot='';renderAll();queueSave()}
function undo(){if(!undoStack.length)return;redoStack.push(snapshot());restoreSnapshot(undoStack.pop())}
function redo(){if(!redoStack.length)return;undoStack.push(snapshot());restoreSnapshot(redoStack.pop())}

function clock(mins){const h=Math.floor(mins/60)%24,m=mins%60;return h+':'+String(m).padStart(2,'0')}
function durationFor(m,id){if(id==='speeches')return m.speakers.reduce((n,s)=>n+normalMinutes(s.minutes),0);if(id==='evaluation')return normalMinutes(m.times.geOpen)+normalMinutes(m.times.individualEval);return normalMinutes(m.times[id])}
function calculateTimes(m){
 let current=405;const starts={},speakerStarts={};
 for(const id of m.order){starts[id]=current;if(id==='speeches'){for(const s of m.speakers){speakerStarts[s.id]=current;current+=normalMinutes(s.minutes)}}else current+=durationFor(m,id)}
 return {starts,speakerStarts,finish:current,adjourn:starts.adjourn??current};
}

function memberNames(){return project.members.filter(x=>x.active).map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b,'zh-Hant'))}
function memberOptions(value){const names=memberNames(),has=value&&names.includes(value);return (value&&!has?'<option value="'+esc(value)+'">'+esc(value)+'（自訂）</option>':'')+'<option value="">待安排</option>'+names.map(n=>'<option value="'+esc(n)+'" '+(n===value?'selected':'')+'>'+esc(n)+'</option>').join('')+'<option value="__custom__">＋ 自行輸入名字…</option>'}
function getPerson(m,path){const [type,a,b]=path.split(':');if(type==='role')return m.roles[a]||'';const s=m.speakers.find(x=>x.id===a);return s?.[b]||''}
function setPerson(m,path,value){const [type,a,b]=path.split(':');if(type==='role')m.roles[a]=value;else{const s=m.speakers.find(x=>x.id===a);if(s)s[b]=value}}
function personControl(path,label,value){
 return '<div class="person-drop" data-person-path="'+esc(path)+'"><div class="role-title"><span>'+esc(label)+'</span><span>可拖入</span></div>'+(value?'<div class="person-chip" data-person="'+esc(value)+'" data-source-path="'+esc(path)+'"><span class="grip">⠿</span>'+esc(value)+'</div>':'')+'<div class="person-line"><select onchange="personSelected(this)" data-path="'+esc(path)+'">'+memberOptions(value)+'</select><button type="button" onclick="customPerson(\''+esc(path)+'\')" title="自行輸入">＋</button></div></div>';
}
function personSelected(el){let value=el.value;if(value==='__custom__'){customPerson(el.dataset.path);return}const m=activeMeeting();applyChange(()=>setPerson(m,el.dataset.path,value))}
function customPerson(path){const value=clean(prompt('輸入姓名：',''));if(!value){renderAll();return}applyChange(()=>{setPerson(activeMeeting(),path,value);if(!project.members.some(x=>x.name.toLowerCase()===value.toLowerCase())&&confirm('要把「'+value+'」加入人員下拉清單嗎？'))project.members.push({name:value,active:true})})}

function fieldInput(label,key,value,type='text',wide=false){return '<div class="field '+(wide?'wide':'')+'"><label>'+esc(label)+'</label><input type="'+type+'" value="'+esc(value)+'" onchange="meetingField(\''+key+'\',this.value)"></div>'}
function eventInput(i,value){return '<div class="field"><label>活動 '+(i+1)+'</label><textarea onchange="eventField('+i+',this.value)">'+esc(value)+'</textarea></div>'}
function textField(s,key,label){return '<div class="field"><label>'+label+'</label><input value="'+esc(s[key])+'" onchange="speakerField(\''+s.id+'\',\''+key+'\',this.value)"></div>'}
function numberField(s,key,label){return '<div class="field"><label>'+label+'</label><input type="number" min="0" step="1" value="'+normalMinutes(s[key])+'" onfocus="beginContinuousEdit()" oninput="speakerMinutes(\''+s.id+'\',this.value)" onchange="finishContinuousEdit()"></div>'}
function speakerEditor(s,i){
 return '<article class="speaker-card"><div class="speaker-head"><b>Speaker #'+(i+1)+'</b><button class="btn btn-danger" type="button" onclick="removeSpeaker(\''+s.id+'\')">刪除 Speaker</button></div><div class="speaker-fields">'+
 personControl('speaker:'+s.id+':name','Speaker',s.name)+textField(s,'title','Speech Title')+textField(s,'level','Level')+textField(s,'project','Project')+textField(s,'duration','演講時間範圍')+numberField(s,'minutes','Agenda 分鐘')+personControl('speaker:'+s.id+':evaluator','Evaluator',s.evaluator)+'</div></article>';
}

function renderEditor(){
 const m=activeMeeting(),warnings=collectWarnings(m),roles=ROLE_FIELDS.map(([k,l])=>personControl('role:'+k,l,m.roles[k])).join('');
 const members=project.members.map((x,i)=>x.active?'<span class="member-token" data-person="'+esc(x.name)+'">⠿ '+esc(x.name)+' <button type="button" onclick="editMember('+i+')" title="編輯">✎</button></span>':'').join('');
 const speakers=m.speakers.map((s,i)=>speakerEditor(s,i)).join('')||'<div class="placeholder">目前沒有 Speaker，請按下方按鈕新增。</div>';
 const sessions=m.order.map((id,i)=>'<div class="session-card" data-session-id="'+id+'"><span class="drag-handle">⠿</span><div><b>'+esc(SESSION_META[id]?.[0]||id)+'</b><small>'+esc(SESSION_META[id]?.[1]||'')+'</small></div><small>'+durationFor(m,id)+' 分</small><div class="session-buttons"><button type="button" onclick="moveSession(\''+id+'\',-1)" '+(i===0?'disabled':'')+' aria-label="上移">↑</button><button type="button" onclick="moveSession(\''+id+'\',1)" '+(i===m.order.length-1?'disabled':'')+' aria-label="下移">↓</button></div></div>').join('');
 $('#editorContent').innerHTML='<div class="editor-head"><div><h2>Meeting '+esc(m.number||'未編號')+' 工作安排</h2><p>所有欄位會即時更新下方 Agenda，並自動保存於目前裝置。</p></div><span class="save-state '+(warnings.length?'warn':'')+'">'+(warnings.length?warnings.length+' 項提醒':'資料完整')+'</span></div><div class="editor-grid">'+
 '<section class="card"><h3>場次資料 <small>對應 Excel 基本欄位</small></h3><div class="fields">'+fieldInput('Meeting Number','number',m.number,'number')+fieldInput('日期','date',m.date,'date')+fieldInput('備註／語言','note',m.note)+fieldInput('Meeting Theme','theme',m.theme)+fieldInput('Word of the Day','word',m.word,'text',true)+'</div></section>'+
 '<section class="card"><h3>人員名單 <small>可拖到角色欄位</small></h3><div class="member-tools"><input id="newMemberName" placeholder="輸入新會員或來賓姓名"><button class="btn" type="button" onclick="addMember()">＋新增</button></div><div class="member-pool" id="memberPool">'+members+'</div><p class="member-note">點姓名旁的 ✎ 可改名或停用；停用不會刪除歷史安排。</p></section>'+
 '<section class="card full"><h3>例會角色 <small>下拉選擇、自行輸入或拖曳交換</small></h3><div class="role-grid">'+roles+'</div></section>'+
 '<section class="card full"><h3>Prepared Speeches <small>'+m.speakers.length+' / 5 位</small></h3><div class="speaker-list">'+speakers+'</div><button class="btn btn-primary add-speaker" type="button" onclick="addSpeaker()" '+(m.speakers.length>=5?'disabled':'')+'>＋ 新增 Speaker</button></section>'+
 '<section class="card"><h3>議程順序 <small>整個 Session 拖曳</small></h3><div class="session-list" id="sessionList">'+sessions+'</div></section>'+
 '<section class="card"><h3>Upcoming Events <small>對應 Excel 兩筆活動</small></h3><div class="future-grid">'+eventInput(0,m.events[0])+eventInput(1,m.events[1])+'</div><div class="warning-box '+(warnings.length?'show':'')+'">'+warnings.map(x=>'• '+esc(x)).join('<br>')+'</div></section></div>';
 initSortables();
}

function meetingField(key,value){
 const m=activeMeeting();
 if(key==='number'){
  const n=normalMinutes(value);
  if(project.meetings.some((x,i)=>i!==activeIndex&&Number(x.number)===n)){toast('Meeting Number 不可重複','error');renderAll();return}
  value=n||'';
 }
 applyChange(()=>m[key]=clean(value));
}
function eventField(i,value){applyChange(()=>activeMeeting().events[i]=clean(value))}
function speakerField(id,key,value){applyChange(()=>{const s=activeMeeting().speakers.find(x=>x.id===id);if(!s)return;s[key]=clean(value);if(key==='duration'&&!s.minutes)s.minutes=speechMinutes(value,s.name)})}
function speakerMinutes(id,value){
 const s=activeMeeting().speakers.find(x=>x.id===id),next=normalMinutes(value);if(!s||s.minutes===next)return;
 undoStack.push(snapshot());if(undoStack.length>60)undoStack.shift();redoStack=[];continuousSnapshot='';s.minutes=next;project.updatedAt=Date.now();renderPreview(true);$('#undoBtn').disabled=false;$('#redoBtn').disabled=true;queueSave();
}
function setTime(key,value){
 const m=activeMeeting(),next=normalMinutes(value);if(m.times[key]===next)return;
 undoStack.push(snapshot());if(undoStack.length>60)undoStack.shift();redoStack=[];continuousSnapshot='';m.times[key]=next;project.updatedAt=Date.now();renderPreview(true);$('#undoBtn').disabled=false;$('#redoBtn').disabled=true;queueSave();
}

function addMember(){
 const input=$('#newMemberName'),name=clean(input.value);if(!name)return;
 if(project.members.some(x=>x.name.toLowerCase()===name.toLowerCase())){toast('這個姓名已在人員名單中','error');return}
 applyChange(()=>project.members.push({name,active:true}));
}
function editMember(index){
 const member=project.members[index];if(!member||!member.active)return;
 const next=clean(prompt('修改姓名；留空將停用此人：',member.name));
 if(!next){if(confirm('停用「'+member.name+'」？歷史安排會保留。'))applyChange(()=>member.active=false);return}
 if(next===member.name)return;
 if(project.members.some(x=>x!==member&&x.name.toLowerCase()===next.toLowerCase())){toast('這個姓名已存在','error');return}
 applyChange(()=>{for(const m of project.meetings){for(const k of Object.keys(m.roles))if(m.roles[k]===member.name)m.roles[k]=next;for(const s of m.speakers){if(s.name===member.name)s.name=next;if(s.evaluator===member.name)s.evaluator=next}}member.name=next});
}
function addSpeaker(){const m=activeMeeting();if(m.speakers.length>=5){toast('每場最多 5 位 Speaker','error');return}applyChange(()=>m.speakers.push(makeSpeaker()))}
async function removeSpeaker(id){if(!await confirmAction('刪除 Speaker','將刪除這位 Speaker、演講資料及 Evaluator，後續編號會自動前移。'))return;applyChange(()=>{const m=activeMeeting();m.speakers=m.speakers.filter(x=>x.id!==id)})}
function moveSession(id,delta){applyChange(()=>{const a=activeMeeting().order,i=a.indexOf(id),j=Math.max(0,Math.min(a.length-1,i+delta));a.splice(i,1);a.splice(j,0,id)})}

function collectWarnings(m){
 const out=[],required=['receptionist','saa','president','tme','timer','ahCounter','varietyMaster','topicsmaster','ge','grammarian'];
 const missing=required.filter(k=>!clean(m.roles[k])).map(k=>ROLE_LABELS[k]);if(missing.length)out.push('尚未安排：'+missing.join('、'));
 m.speakers.forEach((s,i)=>{if(!s.name)out.push('Speaker #'+(i+1)+' 尚未安排講者');if(s.name&&!s.evaluator)out.push('Speaker #'+(i+1)+' 尚未安排 Evaluator')});
 const assignments=[];
 for(const [k,v] of Object.entries(m.roles))if(v&&!['evaluatorOfEvaluator','evaluatorOfTopicsmaster'].includes(k))assignments.push(v);
 for(const s of m.speakers){if(s.name)assignments.push(s.name);if(s.evaluator)assignments.push(s.evaluator)}
 const counts={};assignments.filter(x=>x.toUpperCase()!=='TBA').forEach(x=>counts[x]=(counts[x]||0)+1);
 const dup=Object.entries(counts).filter(([,n])=>n>1).map(([n,c])=>n+'（'+c+'項）');if(dup.length)out.push('同一人有多個任務：'+dup.join('、'));
 if(!m.date)out.push('尚未填寫日期');if(!m.number)out.push('尚未填寫 Meeting Number');
 if(m.order.at(-1)!=='adjourn')out.push('Chair adjourns meeting 目前不是最後一個 Session');
 return out;
}

function initSortables(){
 if(typeof Sortable==='undefined')return;
 const session=$('#sessionList');if(session)new Sortable(session,{animation:160,handle:'.drag-handle',delayOnTouchOnly:true,delay:120,onEnd(){const order=$$('#sessionList .session-card').map(x=>x.dataset.sessionId);applyChange(()=>activeMeeting().order=order)}});
 const pool=$('#memberPool');if(pool)new Sortable(pool,{group:{name:'people',pull:'clone',put:false},sort:false,animation:120});
 $$('.person-drop').forEach(el=>new Sortable(el,{group:{name:'people',pull:true,put:true},draggable:'.person-chip,.member-token',sort:false,animation:120,onAdd(evt){
  const name=evt.item.dataset.person||clean(evt.item.textContent.replace(/[⠿✎]/g,'')),source=evt.item.dataset.sourcePath||'',dest=el.dataset.personPath;
  applyChange(()=>{const m=activeMeeting(),old=getPerson(m,dest);setPerson(m,dest,name);if(source&&source!==dest)setPerson(m,source,old)});
 }}));
}

function agendaRow(time,label,role,name,target=''){
 return '<div class="agenda-row"'+(target?' data-session="'+esc(target)+'"':'')+'><span class="agenda-time">'+esc(time)+'</span><span><b>'+esc(label)+'</b></span><span class="agenda-role">'+esc(role)+'</span><span class="agenda-name">'+esc(name||'待安排')+'</span></div>';
}
function speechAgenda(s,i,start){
 const meta=[s.level,s.project].filter(Boolean).join(' · ');
 return '<div class="speech" data-session="speech:'+s.id+'"><div class="speech-time">'+clock(start)+'</div><div class="speech-num">'+(i+1)+'</div><div class="speech-main"><div class="speech-detail"><b>'+esc(s.name||'待安排講者')+'</b><i>'+esc(s.title||'')+'</i></div><div class="speech-meta">'+esc(meta)+'</div></div><div class="speech-duration">'+esc(s.duration||'')+'</div></div>';
}
function renderSession(m,id,t){
 const r=m.roles,start=clock(t.starts[id]??405);
 if(id==='social')return agendaRow(start,'Equipment checkout & Social time','Receptionist',r.receptionist,'social');
 if(id==='saa')return agendaRow(start,'SAA calls for opening','SAA',r.saa,'saa');
 if(id==='president')return agendaRow(start,'Chair calls meeting to order','President',r.president,'president');
 if(id==='tme')return agendaRow(start,'Toastmaster calls on meeting roles','Toastmaster',r.tme,'tme')+agendaRow('','Timer','Timer',r.timer)+agendaRow('','Ah Counter','Ah counter',r.ahCounter);
 if(id==='grammarIntro')return agendaRow(start,'Word of the day'+(m.word?' · '+m.word:''),'Grammarian',r.grammarian,'grammarIntro');
 if(id==='variety')return agendaRow(start,'Variety session','Variety Master',r.varietyMaster,'variety');
 if(id==='speeches')return '<div class="section-row"><span>'+start+'</span><span>Manual speech session</span></div>'+(m.speakers.length?m.speakers.map((s,i)=>speechAgenda(s,i,t.speakerStarts[s.id])).join(''):'<div class="placeholder" data-session="speeches">尚未安排演講</div>');
 if(id==='guestReport')return agendaRow(start,'Officers’ report / Introducing guests','President',r.president,'guestReport');
 if(id==='intermission')return '<div class="merge-row" data-session="intermission"><span>'+start+'</span><span>Group photo / Intermission ('+Math.max(0,normalMinutes(m.times.intermission)-1)+' mins)</span></div>';
 if(id==='topics')return agendaRow(start,'Table Topics Session (Each speech 1’–2’)','Topicsmaster',r.topicsmaster,'topics');
 if(id==='evaluation'){
  let rows=agendaRow(start,'Evaluation session (Each evaluation 2’–3’)','General Evaluator',r.ge,'geOpen');
  rows+=m.speakers.map((s,i)=>agendaRow('',String(i+1),'Evaluator',s.evaluator,i===0?'individualEval':'')).join('')||agendaRow('','Individual evaluations','Evaluator','待安排','individualEval');
  if(r.evaluatorOfEvaluator)rows+=agendaRow('','Evaluator of Evaluator','Evaluator',r.evaluatorOfEvaluator);
  if(r.evaluatorOfTopicsmaster)rows+=agendaRow('','Evaluator of Topicsmaster','Evaluator',r.evaluatorOfTopicsmaster);
  return rows;
 }
 if(id==='reports')return agendaRow(start,'Timer and Ah Counter’s reports','Reports',[r.timer,r.ahCounter].filter(Boolean).join(', '),'reports');
 if(id==='grammarReport')return agendaRow(start,'Grammarian’s report','Grammarian',r.grammarian,'grammarReport');
 if(id==='geComment')return agendaRow(start,'General Evaluator’s comment','General Evaluator',r.ge,'geComment');
 if(id==='summary')return agendaRow(start,'Toastmaster wraps up','Toastmaster',r.tme,'summary');
 if(id==='adjourn')return agendaRow(start,'Chair adjourns meeting','President',r.president,'adjourn');
 return '';
}

function headerHtml(){
 return '<header class="club"><div class="club-logo"><img src="assets/xl/media/image1.png" alt="Toastmasters"></div><div class="club-title"><h3>SHIN YING TOASTMASTERS CLUB</h3><p>Since 2006　|　Club No. 974403　|　Area 4　|　Division H</p></div></header>'+
 '<div class="strip"><span>Regular Meeting: 7–9pm, 1st &amp; 3rd Tuesday of every month</span><span>Venue: 新營天居五樓會議室（新營區中山路）</span></div>'+
 '<div class="strip motto"><span>Zoom ID: 8911 1386 086　Password :907992</span><strong>Learn Together; Empower Each Other.</strong></div>';
}
function futureHtml(m){return '<section class="future"><h4>未來活動</h4><div>1. '+esc(m.events[0]||'')+'</div><div>2. '+esc(m.events[1]||'')+'</div></section>'}
function upcomingHtml(){
 const next=project.meetings[activeIndex+1]||activeMeeting(),r=next.roles,s=next.speakers;
 const left=[['Toastmaster',r.tme],['Receptionist',r.receptionist],['Variety Master',r.varietyMaster],['Topicsmaster',r.topicsmaster],['Speaker #1',s[0]?.name],['Speaker #2',s[1]?.name],['Speaker #3',s[2]?.name]];
 const right=[['General Evaluator',r.ge],['Timer',r.timer],['Ah Counter',r.ahCounter],['Grammarian',r.grammarian],['Evaluator #1',s[0]?.evaluator],['Evaluator #2',s[1]?.evaluator],['Evaluator #3',s[2]?.evaluator]];
 return '<table class="next-roles"><thead><tr><th>Meeting Role</th><th>'+esc(next.date)+'</th><th>Meeting Role</th><th>'+esc(next.date)+'</th></tr></thead><tbody>'+left.map((x,i)=>'<tr><td>'+x[0]+'</td><td>'+esc(x[1]||'')+'</td><td>'+right[i][0]+'</td><td>'+esc(right[i][1]||'')+'</td></tr>').join('')+'</tbody></table>';
}

function renderPreview(preservePanel=false){
 const m=activeMeeting(),t=calculateTimes(m);
 $('#previewTitle').textContent='Meeting '+(m.number||'未編號');
 $('#sheet').innerHTML=headerHtml()+'<div class="agenda-body"><aside class="mission"><h4>Club Mission</h4><p>We provide a supportive and positive learning experience in which members are empowered to develop communication and leadership skills.</p></aside><div class="agenda-grid"><div class="meta"><div>Date: <span>'+esc(m.date)+'</span></div><div>Meeting No. <span>'+esc(m.number)+'</span></div><div>Theme: <span>'+esc(m.theme)+'</span></div></div>'+m.order.map(id=>renderSession(m,id,t)).join('')+'</div></div>'+futureHtml(m)+upcomingHtml();
 const overtime=t.finish-540;
 $('#previewStatus').textContent=overtime>0?'⚠ 預計超時 '+overtime+' 分鐘':'● 即時預覽';
 $('#previewStatus').style.background=overtime>0?'#fff0d4':'';
 if(!preservePanel)renderTimePanel(m,t);else{const warning=$('.time-warnings');if(warning)warning.innerHTML=overtime>0?'<div>⚠ 預計超時 '+overtime+' 分鐘（結束 '+clock(t.finish)+'）</div>':'';scheduleAlignment()}
}
function renderMeetingSelector(){
 $('#meetingSelect').innerHTML=project.meetings.map((m,i)=>'<option value="'+i+'" '+(i===activeIndex?'selected':'')+'>Meeting '+esc(m.number||'未編號')+' · '+esc(m.date||'未填日期')+'</option>').join('');
 $('#prevMeeting').disabled=activeIndex===0;$('#nextMeeting').disabled=activeIndex===project.meetings.length-1;$('#deleteMeeting').disabled=project.meetings.length===1;
 $('#fileName').textContent=project.fileName||'工作安排';
}

function controlInput(key,label,value,target){
 return '<label class="time-control" data-control-target="'+esc(target)+'"><b>'+esc(label)+'</b><input type="number" min="0" step="1" value="'+normalMinutes(value)+'" onfocus="beginContinuousEdit()" oninput="setTime(\''+key+'\',this.value)" onchange="finishContinuousEdit()"></label>';
}
function renderTimePanel(m,t){
 let controls='';
 for(const id of m.order){
  if(id==='speeches'){controls+=m.speakers.map((s,i)=>'<label class="time-control" data-control-target="speech:'+s.id+'"><b>演講者 '+(i+1)+'</b><input type="number" min="0" step="1" value="'+normalMinutes(s.minutes)+'" onfocus="beginContinuousEdit()" oninput="speakerMinutes(\''+s.id+'\',this.value)" onchange="finishContinuousEdit()"></label>').join('');continue}
  if(id==='evaluation'){controls+=controlInput('geOpen','GE 開場',m.times.geOpen,'geOpen')+controlInput('individualEval','個別講評',m.times.individualEval,'individualEval');continue}
  if(id==='adjourn')continue;
  const label=SESSION_META[id]?.[1]||id;controls+=controlInput(id,label,m.times[id],id);
 }
 const overtime=t.finish-540;
 $('#timePanel').style.height=$('#sheet').offsetHeight+'px';
 $('#timePanel').innerHTML='<details open><summary>時間控制器 <small>分鐘</small></summary><div class="start-anchor"><b>固定起點</b><strong>6:45</strong></div><div class="time-help">修改紅字或拖曳 Session，後續時間立即重算</div>'+controls+'<div class="time-warnings">'+(overtime>0?'<div>⚠ 預計超時 '+overtime+' 分鐘（結束 '+clock(t.finish)+'）</div>':'')+'</div></details>';
 observeAlignment();
}
function observeAlignment(){
 resizeObserver?.disconnect();
 if(window.ResizeObserver){resizeObserver=new ResizeObserver(scheduleAlignment);resizeObserver.observe($('#sheet'))}
 scheduleAlignment();
}
function scheduleAlignment(){requestAnimationFrame(syncAlignment)}
function syncAlignment(){
 const sheet=$('#sheet'),panel=$('#timePanel');if(!sheet||!panel)return;panel.style.height=sheet.offsetHeight+'px';
 const sr=sheet.getBoundingClientRect();
 $$('.time-control').forEach(c=>{const target=[...sheet.querySelectorAll('[data-session]')].find(x=>x.dataset.session===c.dataset.controlTarget);if(!target)return;const tr=target.getBoundingClientRect();c.style.top=(tr.top-sr.top-panel.clientTop)+'px';c.style.height=tr.height+'px'});
}
function renderAll(){renderMeetingSelector();renderEditor();renderPreview();$('#undoBtn').disabled=!undoStack.length;$('#redoBtn').disabled=!redoStack.length}

function dateText(v){
 if(!v)return'';if(v instanceof Date)return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
 if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);return d?d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0'):String(v)}
 const s=clean(v).replace(/\//g,'-'),d=new Date(s);return Number.isNaN(d.valueOf())?s:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function normalizeMeeting(m){
 m.id=m.id||uid();m.roles={...blankRoles(),...(m.roles||{})};m.events=[...(m.events||[]),'',''].slice(0,2);m.order=(m.order||[]).filter(x=>DEFAULT_ORDER.includes(x));
 for(const id of DEFAULT_ORDER)if(!m.order.includes(id))m.order.push(id);
 m.times={...DEFAULT_TIMES,...(m.times||{})};m.speakers=(m.speakers||[]).slice(0,5).map(makeSpeaker);return m;
}
function parseWorkbook(buffer,fileName,id){
 const wb=XLSX.read(buffer,{type:'array',cellDates:true,cellFormula:true}),assignmentName=wb.SheetNames.find(x=>x.toLowerCase().includes('assignment for agenda'));
 if(!assignmentName)throw Error('找不到「Assignment for Agenda」工作表。');
 const a=XLSX.utils.sheet_to_json(wb.Sheets[assignmentName],{header:1,defval:''}),labels=new Map();
 a.forEach((row,i)=>{const label=clean(row[1]).toLowerCase();if(label)labels.set(label,i)});
 const row=(...names)=>{for(const n of names){const r=labels.get(n.toLowerCase());if(r!=null)return r}return null};
 const get=(c,...names)=>{const r=row(...names);return r==null?'':a[r]?.[c]??''};
 const eventRows=a.map((r,i)=>({i,label:clean(r[1]).toLowerCase()})).filter(x=>x.label==='up coming event'||x.label==='upcoming event'||x.label==='up coming event 1'||x.label==='upcoming event 1'||x.label==='up coming event 2'||x.label==='upcoming event 2').map(x=>x.i);
 const meetingRow=row('Meeting number');if(meetingRow==null)throw Error('找不到 Meeting number，檔案格式可能已修改。');
 const meetings=[];
 for(let c=2;c<(a[meetingRow]||[]).length;c++){
  const number=a[meetingRow][c];if(number===''||number==null||Number.isNaN(Number(number)))continue;
  const m=blankMeeting(Math.trunc(Number(number)));m.id='meeting-'+m.number+'-'+c;m.note=clean(a[1]?.[c]||'');m.date=dateText(get(c,'Date'));m.theme=clean(get(c,'Meeting Theme'));m.word=clean(get(c,'Word of the Day'));
  m.roles.receptionist=clean(get(c,'Receptionist'));m.roles.saa=clean(get(c,'SAA'));m.roles.president=clean(get(c,'President'));m.roles.tme=clean(get(c,'TME'));m.roles.timer=clean(get(c,'Timer'));m.roles.ahCounter=clean(get(c,'Ah Counter'));
  m.roles.varietyMaster=clean(get(c,'Variety Master'));m.roles.topicsmaster=clean(get(c,'Topicsmaster'));m.roles.ge=clean(get(c,'GE'));m.roles.grammarian=clean(get(c,'Grammarian'));
  m.roles.evaluatorOfEvaluator=clean(get(c,'Evaluator of Evaluator'));m.roles.evaluatorOfTopicsmaster=clean(get(c,'Evaluator of Topicsmaster'));
  for(let i=1;i<=5;i++){const s=makeSpeaker({name:get(c,'#'+i+' Speaker'),title:get(c,'#'+i+' Title'),level:get(c,'#'+i+' Level'),project:get(c,'#'+i+' Project'),duration:get(c,'#'+i+' Time'),evaluator:get(c,'#'+i+' Evaluator')});if([s.name,s.title,s.level,s.project,s.duration,s.evaluator].some(Boolean))m.speakers.push(s)}
  m.events=[clean(a[eventRows[0]]?.[c]),clean(a[eventRows[1]]?.[c])];
  meetings.push(normalizeMeeting(m));
 }
 if(!meetings.length)throw Error('檔案中沒有可用的 Meeting 資料。');
 const memberSheet=wb.Sheets[wb.SheetNames.find(x=>x.includes('例會人員名單'))],memberRows=memberSheet?XLSX.utils.sheet_to_json(memberSheet,{header:1,defval:''}):[];
 const names=memberRows.slice(1).map(r=>clean(r[1])).filter(Boolean);
 for(const m of meetings)for(const name of assignedNames(m))if(name)names.push(name);
 applyAgendaSettings(wb,meetings);
 const unique=[...new Set(names.map(x=>clean(x)).filter(Boolean))];
 return {id,fileName,members:unique.map(name=>({name,active:true})),meetings,baseMeetings:clone(meetings),updatedAt:Date.now()};
}
function assignedNames(m){return [...Object.values(m.roles),...m.speakers.flatMap(s=>[s.name,s.evaluator])]}
function applyAgendaSettings(wb,meetings){
 const sheet=wb.Sheets['Agenda設定'];if(!sheet)return;const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
 for(const cfg of rows){const m=meetings.find(x=>String(x.number)===String(cfg.MeetingNumber));if(!m)continue;try{if(cfg.SessionOrder)m.order=JSON.parse(cfg.SessionOrder)}catch{}try{if(cfg.TimeSettings)m.times={...m.times,...JSON.parse(cfg.TimeSettings)}}catch{}try{if(cfg.SpeakerMinutes){const mins=JSON.parse(cfg.SpeakerMinutes);m.speakers.forEach((s,i)=>s.minutes=normalMinutes(mins[i]))}}catch{}normalizeMeeting(m)}
}

function openDb(){
 return new Promise((resolve,reject)=>{const req=indexedDB.open('sytc-agenda-builder',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
}
async function dbPut(value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(clone(value));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function dbGet(id){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function queueSave(){
 $('#saveState').textContent='儲存中…';$('#saveState').classList.add('warn');clearTimeout(saveTimer);
 saveTimer=setTimeout(async()=>{try{await dbPut(project);localStorage.setItem('sytc-agenda-latest',project.id);$('#saveState').textContent='已自動保存';$('#saveState').classList.remove('warn')}catch{$('#saveState').textContent='無法保存';toast('瀏覽器無法保存資料，請先匯出 Excel。','error')}},350);
}
async function fingerprint(buffer){const hash=await crypto.subtle.digest('SHA-256',buffer.slice(0));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function importFile(file){
 try{
  const buffer=await file.arrayBuffer(),id=await fingerprint(buffer),parsed=parseWorkbook(buffer,file.name,id),saved=await dbGet(id);
  if(saved&&await confirmAction('找到本機進度','這份 Excel 曾經編排過。按「確定」恢復本機進度；按「取消」則以 Excel 內容重新開始。'))project=saved;else project=parsed;
  activeIndex=0;undoStack=[];redoStack=[];project.fileName=file.name;renderAll();queueSave();toast('已載入 '+project.meetings.length+' 個場次');
 }catch(err){toast(err.message||'Excel 讀取失敗','error')}
}
async function loadResume(){
 try{const id=localStorage.getItem('sytc-agenda-latest');if(!id)return;pendingRestore=await dbGet(id);if(pendingRestore)$('#resumeBtn').classList.remove('hidden')}catch{}
}
function resumeLast(){if(!pendingRestore)return;project=pendingRestore;activeIndex=0;undoStack=[];redoStack=[];$('#resumeBtn').classList.add('hidden');renderAll();toast('已恢復上次編排')}

function nextMeetingNumber(){return Math.max(0,...project.meetings.map(x=>Number(x.number)||0))+1}
function addMeeting(){applyChange(()=>{const m=blankMeeting(nextMeetingNumber());project.meetings.push(m);activeIndex=project.meetings.length-1})}
function duplicateMeeting(){
 const source=activeMeeting();
 applyChange(()=>{const m=blankMeeting(nextMeetingNumber());m.note=source.note;m.order=[...source.order];m.times={...source.times};project.meetings.push(m);activeIndex=project.meetings.length-1});
}
async function deleteMeeting(){
 if(project.meetings.length===1)return;
 if(!await confirmAction('刪除目前場次','Meeting '+activeMeeting().number+' 將從目前工作安排中刪除。'))return;
 applyChange(()=>{project.meetings.splice(activeIndex,1);activeIndex=Math.min(activeIndex,project.meetings.length-1)});
}
async function resetMeeting(){
 if(!await confirmAction('重設目前場次','目前場次的所有修改將還原為匯入時內容；新增場次則還原成空白。'))return;
 applyChange(()=>{const current=activeMeeting(),base=project.baseMeetings.find(x=>x.id===current.id);project.meetings[activeIndex]=base?clone(base):blankMeeting(current.number)});
}
function confirmAction(title,message){
 const d=$('#confirmDialog');$('#dialogTitle').textContent=title;$('#dialogMessage').textContent=message;d.showModal();return new Promise(resolve=>dialogResolve=resolve);
}
function closeDialog(result){$('#confirmDialog').close();dialogResolve?.(result);dialogResolve=null}
function toast(message,type=''){
 const el=$('#toast');el.textContent=message;el.className='toast '+type;clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.add('hidden'),2800);
}

function exportWorkbook(){
 if(typeof XLSX==='undefined'){toast('Excel 元件尚未載入，請重新整理後再試。','error');return}
 const wb=XLSX.utils.book_new(),members=[['身份','姓名','狀態'],...project.members.map(x=>['會員',x.name,x.active?'啟用':'停用'])];
 const memberSheet=XLSX.utils.aoa_to_sheet(members);memberSheet['!cols']=[{wch:12},{wch:24},{wch:10}];XLSX.utils.book_append_sheet(wb,memberSheet,'例會人員名單');
 const ms=project.meetings,assignment=[['','欄位編號→',...ms.map((_,i)=>i+1)],['','Note',...ms.map(m=>m.note)],['','Meeting number',...ms.map(m=>Number(m.number)||'')]];
 const add=(label,getter)=>assignment.push([assignment.length-2,label,...ms.map(getter)]);
 add('Date',m=>m.date?new Date(m.date+'T00:00:00'):'');add('Meeting Theme',m=>m.theme);add('Word of the Day',m=>m.word);
 add('Receptionist',m=>m.roles.receptionist);add('SAA',m=>m.roles.saa);add('President',m=>m.roles.president);add('TME',m=>m.roles.tme);add('Timer',m=>m.roles.timer);add('Ah Counter',m=>m.roles.ahCounter);
 add('Variety Master',m=>m.roles.varietyMaster);add('Topicsmaster',m=>m.roles.topicsmaster);add('GE',m=>m.roles.ge);add('Grammarian',m=>m.roles.grammarian);
 for(let i=0;i<5;i++){add('#'+(i+1)+' Speaker',m=>m.speakers[i]?.name||'');add('#'+(i+1)+' Title',m=>m.speakers[i]?.title||'');add('#'+(i+1)+' Level',m=>m.speakers[i]?.level||'');add('#'+(i+1)+' Project',m=>m.speakers[i]?.project||'');add('#'+(i+1)+' Time',m=>m.speakers[i]?.duration||'');add('#'+(i+1)+' Evaluator',m=>m.speakers[i]?.evaluator||'')}
 add('Evaluator of Evaluator',m=>m.roles.evaluatorOfEvaluator);add('Evaluator of Topicsmaster',m=>m.roles.evaluatorOfTopicsmaster);add('Up coming Event 1',m=>m.events[0]);add('Up coming Event 2',m=>m.events[1]);
 const assignmentSheet=XLSX.utils.aoa_to_sheet(assignment,{cellDates:true});assignmentSheet['!cols']=[{wch:5},{wch:28},...ms.map(()=>({wch:22}))];XLSX.utils.book_append_sheet(wb,assignmentSheet,'Assignment for Agenda(工作安排)');
 const settings=ms.map(m=>({MeetingNumber:m.number,SessionOrder:JSON.stringify(m.order),TimeSettings:JSON.stringify(m.times),SpeakerMinutes:JSON.stringify(m.speakers.map(s=>s.minutes))}));
 const settingsSheet=XLSX.utils.json_to_sheet(settings);settingsSheet['!cols']=[{wch:16},{wch:70},{wch:70},{wch:28}];XLSX.utils.book_append_sheet(wb,settingsSheet,'Agenda設定');
 XLSX.writeFile(wb,'SYTC_Work_Assignment_'+new Date().toISOString().slice(0,10)+'.xlsx',{cellDates:true});
 toast('工作安排 Excel 已下載');
}

function switchMeeting(index){activeIndex=Math.max(0,Math.min(project.meetings.length-1,index));undoStack=[];redoStack=[];renderAll()}
function bindUi(){
 $('#uploadBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>{const f=e.target.files[0];if(f)importFile(f);e.target.value=''};
 $('#resumeBtn').onclick=resumeLast;$('#meetingSelect').onchange=e=>switchMeeting(Number(e.target.value));
 $('#prevMeeting').onclick=()=>switchMeeting(activeIndex-1);$('#nextMeeting').onclick=()=>switchMeeting(activeIndex+1);
 $('#addMeeting').onclick=addMeeting;$('#duplicateMeeting').onclick=duplicateMeeting;$('#deleteMeeting').onclick=deleteMeeting;$('#resetMeeting').onclick=resetMeeting;
 $('#exportBtn').onclick=exportWorkbook;$('#printBtn').onclick=()=>window.print();$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
 $('#dialogCancel').onclick=()=>closeDialog(false);$('#dialogConfirm').onclick=()=>closeDialog(true);$('#confirmDialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog(false)});
 $$('.tab').forEach(btn=>btn.onclick=()=>{const target=$('#'+btn.dataset.target);target.scrollIntoView({behavior:'smooth',block:'start'});$$('.tab').forEach(x=>x.classList.toggle('active',x===btn))});
 addEventListener('resize',scheduleAlignment);
}
project=demoProject();bindUi();renderAll();loadResume();
