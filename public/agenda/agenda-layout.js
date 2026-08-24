let activeMeeting;
const DEFAULT_TIMES={social:14,saa:1,president:2,tme:8,grammarIntro:4,variety:15,speech1:8,speech2:8,speech3:8,guestReport:8,intermission:15,topics:16,geOpen:2,individualEval:6,reports:3,grammarReport:4,geComment:4,summary:2};
const TIME_FIELDS=[
 ['social','社交時間'],['saa','SAA開場'],['president','會長致詞'],['tme','TME／介紹主題／介紹小幫手',1],
 ['grammarIntro','文法介紹',1],['variety','時間'],['speech1','演講者1',1],['speech2','演講者2',1],['speech3','演講者3',1],
 ['guestReport','報告及介紹來賓'],['intermission','中場休息'],['topics','即席問答時間',1],['geOpen','GE開場',1],
 ['individualEval','個別講評',1],['reports','報告'],['grammarReport','文法報告',1],['geComment','總講評',1],['summary','總結',1]
];
function ensureTimeSettings(m,speeches=[]){
 if(!m.timeSettings){
  m.timeSettings={...DEFAULT_TIMES};
  speeches.forEach(x=>m.timeSettings['speech'+x.i]=speechMinutes(x.d,x.s));
 }
 return m.timeSettings;
}
function speechMinutes(duration,speaker){
 if(!speaker)return 0;
 const nums=String(duration||'').match(/\d+/g);
 return nums?.length?Number(nums.at(-1))+1:8;
}
function clock(mins){
 const h=Math.floor(mins/60)%24,m=mins%60;
 return h+':'+String(m).padStart(2,'0');
}
function calculateTimes(m){
 const t=ensureTimeSettings(m),x={};
 x.social=405;
 x.saa=x.social+t.social;
 x.president=x.saa+t.saa;
 x.tme=x.president+t.president;
 x.word=x.tme+t.tme;
 x.variety=x.word+t.grammarIntro;
 x.manual=x.variety+t.variety;
 x.officers=x.manual+t.speech1+t.speech2+t.speech3;
 x.intermission=x.officers+t.guestReport;
 x.topics=x.intermission+t.intermission;
 x.evaluation=x.topics+t.topics;
 x.reports=x.evaluation+t.geOpen+t.individualEval;
 x.grammar=x.reports+t.reports;x.ge=x.grammar+t.grammarReport;
 x.wrap=x.ge+t.geComment;x.adjourn=x.wrap+t.summary;
 return x;
}
function roleKey(r,l){
 const x=(r||l).toLowerCase();
 return x==='toastmaster'?'tme':x==='general evaluator'?'ge':x;
}
function personInput(n,key,meeting){
 return '<input class="person-picker" list="member-options" value="'+(n||'')+'" placeholder="選擇或輸入" data-key="'+key+'" data-meeting="'+(meeting||activeMeeting.number)+'" onchange="savePerson(this)">';
}
function agendaSessionKey(label){
 const l=String(label);
 if(l.startsWith('Equipment'))return'social';if(l.startsWith('SAA'))return'saa';
 if(l.startsWith('Chair calls'))return'president';if(l.startsWith('Toastmaster calls'))return'tme';
 if(l.startsWith('Word of the day'))return'grammarIntro';if(l.startsWith('Variety'))return'variety';
 if(l.startsWith('Officers'))return'guestReport';if(l.startsWith('Table Topics'))return'topics';
 if(l.startsWith('Evaluation session'))return'geOpen';if(l.startsWith('Timer and'))return'reports';
 if(l.startsWith('Grammarian'))return'grammarReport';if(l.startsWith('General Evaluator'))return'geComment';
 if(l.startsWith('Toastmaster wraps'))return'summary';return'';
}
function agendaRow(t,l,r,n,key,session){
 const sk=session||agendaSessionKey(l);
 return '<div class="row"'+(sk?' data-session="'+sk+'"':'')+'><span class="time">'+t+'</span><span><b>'+l+'</b></span><span class="role">'+(r||'')+'</span><span class="name">'+personInput(n,key||roleKey(r,l))+'</span></div>';
}
function speechHtml(x,time){
 const meta=[x.l,x.p].filter(Boolean).join(' · ');
 return '<div class="speech" data-session="speech'+x.i+'"><div class="speech-time">'+time+'</div><div class="num">'+x.i+'</div><div class="speech-main"><div class="speech-detail">'+personInput(x.s,'#'+x.i+' speaker')+'<i>'+(x.t||'')+'</i></div><div class="speech-meta">'+meta+'</div></div><div class="speech-duration">'+(x.d||'')+'</div></div>';
}
function bodyHtml(m,v,speeches,evals,t){
 const a=[];
 a.push('<div class="agenda-body"><aside class="mission"><h4>Club Mission</h4><p>We provide a supportive and positive learning experience in which members are empowered to develop communication and leadership skills.</p></aside><div class="agenda-grid">');
 a.push('<div class="meta"><div>Date: <span>'+m.date+'</span></div><div>Meeting No. <span>'+m.number+'</span></div><div>Theme: <span>'+(m.theme||'')+'</span></div></div>');
 a.push(agendaRow(clock(t.social),'Equipment checkout & Social time','Receptionist',v('Receptionist')));
 a.push(agendaRow(clock(t.saa),'SAA calls for opening','SAA',v('SAA')||v('GE')));
 a.push(agendaRow(clock(t.president),'Chair calls meeting to order','President',v('President')||v('Receptionist')));
 a.push(agendaRow(clock(t.tme),'Toastmaster calls on meeting roles','Toastmaster',v('TME')));
 a.push(agendaRow('','Timer','Timer',v('Timer')));
 a.push(agendaRow('','Ah Counter','Ah counter',v('Ah Counter')));
 a.push(agendaRow(clock(t.word),'Word of the day'+(v('Word of the day')?' · '+v('Word of the day'):''),'Grammarian',v('Grammarian')));
 a.push(agendaRow(clock(t.variety),'Variety session','Variety Master',v('Variety Master')));
 a.push('<div class="section-row"><span>'+clock(t.manual)+'</span><span>Manual speech session</span></div>');
 a.push(speeches);
 a.push(agendaRow(clock(t.officers),'Officers’ report / Introducing guests','President',v('President')||v('Receptionist')));
 a.push('<div class="merge-row" data-session="intermission"><span>'+clock(t.intermission)+'</span><span>Group photo / Intermission ('+Math.max(0,m.timeSettings.intermission-1)+' mins)</span></div>');
 a.push(agendaRow(clock(t.topics),'Table Topics Session (Each speech 1’-2’)','Topicsmaster',v('Topicsmaster')));
 a.push(agendaRow(clock(t.evaluation),'Evaluation session (Each evaluation 2’-3’)','General Evaluator',v('GE')));
 a.push(evals);
 a.push(agendaRow(clock(t.reports),'Timer and Ah Counter’s reports','', [v('Timer'),v('Ah Counter')].filter(Boolean).join(', ')));
 a.push(agendaRow(clock(t.grammar),'Grammarian’s report','Grammarian',v('Grammarian')));
 a.push(agendaRow(clock(t.ge),'General Evaluator’s comment','General Evaluator',v('GE')));
 a.push(agendaRow(clock(t.wrap),'Toastmaster wraps up','Toastmaster',v('TME')));
 a.push(agendaRow(clock(t.adjourn),'Chair adjourns meeting','President',v('President')||v('Receptionist')));
 a.push('</div></div>');
 a.push(futureHtml(v));
 a.push(upcomingHtml(m));
 return a.join('');
}
function render(m){
  activeMeeting=m;
  const v=l=>m.values[l.toLowerCase()]||'';
  const sp=[1,2,3].map(i=>({i,s:v('#'+i+' Speaker'),t:v('#'+i+' Title'),e:v('#'+i+' Evaluator'),l:v('#'+i+' Level')||v('#'+i+' No.'),p:v('#'+i+' Project'),d:v('#'+i+' Time')}));
  const settings=ensureTimeSettings(m,sp),t=calculateTimes(m);
  const starts=[t.manual,t.manual+settings.speech1,t.manual+settings.speech1+settings.speech2];
  const speeches=sp.map((x,j)=>speechHtml(x,clock(starts[j]))).join('');
  const evals=sp.slice(0,2).map((x,j)=>agendaRow('',String(j+1),'Evaluator',x.e,'#'+(j+1)+' evaluator',j===0?'individualEval':'')).join('');
  $('#previewTitle').textContent='Meeting '+m.number;
  $('#status').textContent='● 預覽完成';
  $('#sheet').innerHTML=headerHtml(m)+bodyHtml(m,v,speeches,evals,t)+memberListHtml();
  renderTimePanel(m,t);
}
function headerHtml(m){
  return '<header class="club"><div class="club-logo"><img src="assets/xl/media/image1.png" alt="Toastmasters"></div><div class="club-title"><h3>SHIN YING TOASTMASTERS CLUB</h3><p>Since 2006　|　Club No. 974403　|　Area 4　|　Division H</p></div></header>'+
  '<div class="strip"><span>Regular Meeting: 7–9pm, 1st &amp; 3rd Tuesday of every month</span><span>Venue: 新營天居五樓會議室（新營區中山路）</span></div>'+
  '<div class="strip motto"><span>Zoom ID: 8911 1386 086　Password :907992</span><strong>Learn Together; Empower Each Other.</strong></div>';
}
function memberListHtml(){
 const keys=/speaker|evaluator|timer|counter|grammarian|master|receptionist|president|saa|tme|ge/i;
 const names=[...new Set(meetings.flatMap(m=>Object.entries(m.values).filter(([k,v])=>v&&keys.test(k)).map(x=>x[1])))].sort();
 return '<datalist id="member-options">'+names.map(n=>'<option value="'+n+'"></option>').join('')+'</datalist>';
}
function savePerson(el){
 const m=meetings.find(x=>String(x.number)===String(el.dataset.meeting));
 if(m)m.values[el.dataset.key.toLowerCase()]=el.value.trim();
}
function timeWarnings(m,t){
 const overtime=t.adjourn-540;
 return overtime>0?['預計超時 '+overtime+' 分鐘（散會 '+clock(t.adjourn)+'）']:[];
}
function renderTimePanel(m,t){
 const panel=document.querySelector('#timePanel');if(!panel)return;
 const rows=TIME_FIELDS.map(([k,l])=>'<label class="time-control" data-control-key="'+k+'"><b>'+l+'</b><input type="number" min="0" step="1" value="'+m.timeSettings[k]+'" data-key="'+k+'" oninput="updateTime(this)"></label>').join('');
 const warnings=timeWarnings(m,t);
 const open=m.timePanelOpen??!matchMedia('(max-width:900px)').matches;
 panel.innerHTML='<details '+(open?'open':'')+' ontoggle="rememberTimePanel(this)"><summary>時間控制器 <small>分鐘</small></summary><div class="start-anchor"><b>固定起點</b><strong>6:45</strong></div><div class="time-help">修改紅字，後面所有時間會立即重算</div>'+rows+'<div class="time-warnings">'+warnings.map(x=>'<div>⚠ '+x+'</div>').join('')+'</div></details>';
 observeAgendaAlignment();
}
function rememberTimePanel(el){activeMeeting.timePanelOpen=el.open;scheduleTimeAlignment()}
let agendaResizeObserver,alignmentResizeBound=false;
function scheduleTimeAlignment(){requestAnimationFrame(syncTimeControlAlignment)}
function observeAgendaAlignment(){
 const sheet=document.querySelector('#sheet');
 agendaResizeObserver?.disconnect();
 if(sheet&&window.ResizeObserver){
  agendaResizeObserver=new ResizeObserver(scheduleTimeAlignment);
  agendaResizeObserver.observe(sheet);
 }
 if(!alignmentResizeBound){addEventListener('resize',scheduleTimeAlignment);alignmentResizeBound=true}
 document.fonts?.ready.then(scheduleTimeAlignment);
 scheduleTimeAlignment();
}
function syncTimeControlAlignment(){
 const sheet=document.querySelector('#sheet'),panel=document.querySelector('#timePanel');
 if(!sheet||!panel)return;
 const mobile=matchMedia('(max-width:900px)').matches;
 panel.classList.toggle('session-aligned',!mobile);
 panel.style.height=mobile?'':sheet.offsetHeight+'px';
 panel.querySelectorAll('.time-control').forEach(control=>{
  control.style.top='';control.style.height='';
  if(mobile)return;
  const target=sheet.querySelector('[data-session="'+control.dataset.controlKey+'"]');
  if(!target)return;
  const sr=sheet.getBoundingClientRect(),tr=target.getBoundingClientRect();
  control.style.top=(tr.top-sr.top-panel.clientTop)+'px';
  control.style.height=tr.height+'px';
 });
}
function updateTime(el){
 const value=Math.max(0,Math.floor(Number(el.value)||0));
 activeMeeting.timeSettings[el.dataset.key]=value;
 render(activeMeeting);
}
function futureHtml(v){
 const f1=v('Future activity 1')||v('Upcoming activity 1')||'';
 const f2=v('Future activity 2')||v('Upcoming activity 2')||'';
 return '<section class="future"><h4>未來活動</h4><div>1. '+f1+'</div><div>2. '+f2+'</div></section>';
}
function upcomingHtml(m){
 const i=meetings.findIndex(x=>x.number===m.number),n=meetings[i+1]||m,v=x=>n.values[x.toLowerCase()]||'';
 const left=[['Toastmaster','TME'],['Receptionist','Receptionist'],['Variety Master','Variety Master'],['Topicsmaster','Topicsmaster'],['Speaker #1','#1 Speaker'],['Speaker #2','#2 Speaker'],['Speaker #3','#3 Speaker']];
 const right=[['General Evaluator','GE'],['Timer','Timer'],['Ah Counter','Ah Counter'],['Grammarian','Grammarian'],['Evaluator #1','#1 Evaluator'],['Evaluator #2','#2 Evaluator'],['Evaluator #3','#3 Evaluator']];
 return '<table class="next-roles"><thead><tr><th>Meeting Role</th><th>'+n.date+'</th><th>Meeting Role</th><th>'+n.date+'</th></tr></thead><tbody>'+left.map((r,j)=>'<tr><td>'+r[0]+'</td><td>'+personInput(v(r[1]),r[1],n.number)+'</td><td>'+right[j][0]+'</td><td>'+personInput(v(right[j][1]),right[j][1],n.number)+'</td></tr>').join('')+'</tbody></table>';
}
