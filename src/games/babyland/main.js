import './room.css';
import { createScene } from './scene.js';
import { CATEGORIES, ITEMS, BASE_CATS, SECRET_LOOK, itemById } from './items.js';
import { markDone, MAP_URL } from '../../shared/nav.js';
import * as sfx from './sfx.js';
import { createDread, PRESSURE_MS } from './dread.js';
import { createShine } from './shine.js';
import { mountDiary } from './diary.js';

const $=id=>document.getElementById(id);
const state={worn:{},active:'hair',wrong:0,cycles:0,sad:false,ended:false,started:false};
let scene,muted=false,poemVersion=0,poemTimer,flashTimer,faceTimer,pressureTimer,voice;
let dread,shine;
let currentView='full';   // какой план камеры сейчас — от него зависят рамки спутников
const poems=new Map(),played=new Set();
$('game').inert=true;
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
try{scene=createScene($('scene'));}catch(error){console.error('BABYLAND renderer:',error);$('sceneError').hidden=false;$('start').disabled=true;}
$('scene').addEventListener('scene-error',()=>{$('sceneError').hidden=false;document.querySelectorAll('#items button').forEach(b=>b.disabled=true);});
const sound=(name,...args)=>{if(!muted)sfx[name]?.(...args);};
const complete=()=>BASE_CATS.every(cat=>state.worn[cat]);
const allPretty=()=>BASE_CATS.every(cat=>itemById(state.worn[cat])?.kind==='pretty');
function setView(face){currentView=face?'face':'full';scene?.view(face);bindFragments(currentView);$('full').setAttribute('aria-pressed',String(!face));$('face').setAttribute('aria-pressed',String(face));}
function render(){
 if($('game').classList.contains('drawer-closed')) $('drawerToggle').click();
 $('categories').replaceChildren();
 CATEGORIES.forEach((cat,i)=>{const b=document.createElement('button');b.dataset.category=cat.id;b.disabled=cat.id==='makeup'&&!complete();b.setAttribute('aria-pressed',String(state.active===cat.id));b.innerHTML=`<span class="cat-index">0${i+1}</span><span>${cat.label}</span><small>${state.worn[cat.id]?'надето':b.disabled?`${BASE_CATS.filter(c=>state.worn[c]).length}/5`:'выбрать'}</small>`;b.onclick=()=>{state.active=cat.id;sound('clickPlastic');if(cat.id==='makeup')setView(true);render();$('categories').querySelector(`[data-category="${cat.id}"]`).focus();};$('categories').append(b);});
 const cat=CATEGORIES.find(c=>c.id===state.active);$('categoryTitle').textContent=cat.label;$('categoryNumber').textContent=`0${CATEGORIES.indexOf(cat)+1} / 06`;$('categoryHint').textContent=cat.id==='makeup'?'Остался последний штрих.':'Нажми на вещь, чтобы примерить.';
 const focus=document.activeElement?.dataset.item;$('items').replaceChildren();
 ITEMS[state.active].forEach((item,i)=>{const b=document.createElement('button');b.dataset.item=item.id;b.disabled=state.ended||!scene;b.setAttribute('aria-pressed',String(state.worn[state.active]===item.id));const image=document.createElement('img');image.width=192;image.height=192;image.alt='';if(scene)image.src=scene.thumbnail(state.active,item,i);b.dataset.file=`${state.active}_${String(i+1).padStart(2,'0')}.gif`;const label=document.createElement('span');label.textContent=item.label;b.append(image,label);b.onclick=()=>pick(cat.id,item);$('items').append(b);});
 if(focus)$('items').querySelector(`[data-item="${focus}"]`)?.focus();
 $('slots').textContent=`${Object.keys(state.worn).length} / 6`;$('look').textContent=Object.values(state.worn).map(id=>itemById(id).label).join(' · ')||'Твой первый выбор — впереди.';
 shine?.set(Object.values(state.worn).filter(id=>itemById(id)?.kind==='pretty').length);
 $('cycles').textContent=state.wrong?`${state.cycles} / 3 · ${(state.wrong-1)%4+1} / 4`:'♡';
 scene?.face(state.ended?'frozen':state.sad?'sad':'happy',state.worn.makeup);
}

// Подъём уровня реакции. Вызывается и кликом по неправильной вещи, и таймером
// давления: по брифу «Уродка» наступает за то, что игрок ДЕРЖИТ её
// некрасивой, а не за число кликов. Возвращает true, если игра закончилась.
function escalate(force=false){
 if(state.ended)return true;
 state.wrong++;
 const level=(state.wrong-1)%4+1;
 if(level===4)state.cycles++;
 if(level>=2)state.sad=true;
 scene.react(level);sound('breakMusic');
 $('status').textContent='Кажется, что-то не так.';
 dread?.set(state.cycles+(level>=3?1:0));
 if(state.cycles>=3){finish('gone');return true;}
 if(level===4){sound('glitch');scene.face('grimace',state.worn.makeup);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){scene.capture($('screamShot'));$('scream').hidden=false;clearTimeout(flashTimer);flashTimer=setTimeout(()=>$('scream').hidden=true,620);}}
 if(force||level===4)dialog('Эта девочка хочет быть красивой!');
 else if(level===3)dialog('Ей это не нравится!!!');
 else if(level===2)dialog('Это не очень красиво.');
 return false;
}
// Что на ней надето неправильного прямо сейчас — состояние, а не история.
const wornWrong=()=>Object.values(state.worn).some(id=>itemById(id)?.kind==='wrong');
function pressureTick(){
 if(!state.started||state.ended||!wornWrong())return;
 if($('reactionDialog').open||$('exitDialog').open)return;   // не бить в открытое окно
 escalate();render();
}
function startPressure(){clearInterval(pressureTimer);pressureTimer=setInterval(pressureTick,PRESSURE_MS);}

function hidePoem(){poemVersion++;clearTimeout(poemTimer);voice?.stop();voice=null;$('subtitles').hidden=true;}
async function poem(key,secret=false){
 hidePoem();const version=poemVersion;
 try{if(!poems.has(key)){const res=await fetch(`${import.meta.env.BASE_URL}poems/babyland/${key}.txt`);if(!res.ok)throw new Error('poem unavailable');poems.set(key,await res.text());}if(version!==poemVersion)return;
 const lines=poems.get(key).split(/\r?\n/).filter(l=>l.trim()),chunks=[];for(let i=0;i<lines.length;i+=2)chunks.push(lines.slice(i,i+2).join('\n'));
 // Если запись чтения уже есть — субтитры идут по её реальному времени.
 // Пока записей нет («пишем звук с Сашей»), работает прежний таймер, и
 // игра от этого не ломается.
 let perChunk=0;
 if(!muted){
  const buf=await sfx.loadVoice(`${import.meta.env.BASE_URL}audio/babyland/${key}.mp3`);
  if(version!==poemVersion)return;
  if(buf&&chunks.length){voice=sfx.playVoice(buf);perChunk=(buf.duration*1000)/chunks.length;}
 }
 let i=0;function next(){if(version!==poemVersion)return;if(i>=chunks.length){$('subtitles').hidden=true;if(secret)location.assign(MAP_URL);return;}$('subtitles').querySelector('p').textContent=chunks[i++];$('subtitles').hidden=false;poemTimer=setTimeout(next,perChunk||Math.max(4500,chunks[i-1].length*60));}next();
 }catch{if(version===poemVersion)$('status').textContent='Стих не загрузился. Можно продолжать примерку.';}
}
function dialog(title,text=''){hidePoem();$('reactionTitle').textContent=title;$('reactionText').textContent=text;sound('uiOpen');$('reactionDialog').showModal();}
function finish(kind){state.ended=true;clearInterval(pressureTimer);$('game').inert=true;hidePoem();scene.end(kind);markDone('babyland');$('machine').textContent='диск прочитан';
 if(kind==='secret'){$('status').textContent='Машина молчит.';sfx.killMusic();poem('secret',true);render();return;}
 if(kind==='perfect'){sound('fanfare');$('endingTitle').textContent='Ура! Теперь она красивая!';$('endingText').textContent='Идеальная девочка.';$('restart').hidden=true;}
 else{$('endingTitle').textContent='Она расстроена и устала.';$('endingText').textContent='Она больше так не может.';$('restart').hidden=false;sfx.killMusic();}
 $('ending').dataset.kind=kind;$('ending').hidden=false;render();$('ending').querySelector(kind==='perfect'?'a':'button').focus();
 if(kind==='perfect')poem('makeup');
}
function pick(cat,item){
 if(!state.started||state.ended||state.worn[cat]===item.id||$('reactionDialog').open)return;
 if(cat==='makeup'&&!complete())return;
 state.worn[cat]=item.id;scene.wear(cat,item.id);sound('clickPlastic');
 if(Object.entries(SECRET_LOOK).every(([c,id])=>state.worn[c]===id)){finish('secret');return;}
 if(allPretty()){state.sad=false;dread?.set(Math.max(0,dread.get()-1));if(state.worn.makeup==='mk_hyper'){finish('perfect');return;}}
 if(item.kind==='pretty'){sound('sparkle');$('status').textContent='Вот так гораздо красивее.';shine.glow($('win-gaze'));shine.flash();{const r=$('win-gaze').getBoundingClientRect();shine.sparkle(r.left+r.width/2,r.top+r.height/2,14);}if(!played.has(cat)){played.add(cat);poem(CATEGORIES.find(c=>c.id===cat).poem);}}
 else{if(escalate(cat==='makeup'))return;}
 render();
 if(item.kind==='wrong'&&(state.wrong%4===0||cat==='makeup')){scene.face('grimace',state.worn.makeup);clearTimeout(faceTimer);faceTimer=setTimeout(()=>scene.face(state.sad?'sad':'happy',state.worn.makeup),1100);}
}
// Кадрирование окон-спутников. Каждое требование Ланы должно смотреть ровно
// на ту часть, которой касается, — иначе окно с надписью «укладывать брови»
// показывает колено, и вся конструкция рассыпается.
// Наборов два: камера в общем плане и в лице кадрирует по-разному, поэтому
// при смене плана рамки пересчитываются.
const FRAGMENTS={
 full:[['frag-1',.38,.05,.24,.16],   // брови — верх головы
       ['frag-2',.30,.42,.40,.32],   // «казаться меньше» — фигура целиком
       ['frag-3',.36,.10,.28,.14],   // линия роста волос
       ['frag-4',.30,.60,.40,.28]],  // свет на ногах
 face:[['frag-1',.34,.26,.32,.12],
       ['frag-2',.28,.18,.44,.46],
       ['frag-3',.32,.14,.36,.12],
       ['frag-4',.30,.44,.26,.18]],
};
function bindFragments(view=currentView){
 const set=FRAGMENTS[view]||FRAGMENTS.full;
 const list=[];
 for(const [id,x,y,w,h] of set){const canvas=$(id)?.querySelector('canvas');if(canvas)list.push({canvas,x,y,w,h});}
 scene?.fragments(list);
}
bindFragments();
dread=createDread(document.getElementById('game'));dread.paint();
shine=createShine(document.getElementById('game'));shine.reset();
mountDiary();
// блёстки на каждый клик по интерфейсу — бриф, стр. 11
document.getElementById('game').addEventListener('pointerdown',e=>{if(state.started&&!state.ended)shine.sparkle(e.clientX,e.clientY,5);});

$('start').onclick=()=>{if(!scene)return;state.started=true;startPressure();$('game').inert=false;$('intro').hidden=true;sound('unlockAudio');sound('startMusic');$('machine').textContent='диск читается';$('categories').querySelector('button')?.focus();};
$('sound').onclick=()=>{muted=!muted;sfx.setMuted?.(muted);$('sound').textContent=`Звук: ${muted?'выкл.':'вкл.'}`;$('sound').setAttribute('aria-pressed',String(muted));if(!muted&&state.started)sfx.unlockAudio();};
$('full').onclick=()=>setView(false);$('face').onclick=()=>setView(true);$('rotateLeft').onclick=()=>scene?.rotate(-Math.PI/6);$('rotateRight').onclick=()=>scene?.rotate(Math.PI/6);$('hidePoem').onclick=hidePoem;
$('drawerToggle').onclick=()=>{const collapsed=$('game').classList.toggle('drawer-closed');$('drawerToggle').setAttribute('aria-expanded',String(!collapsed));$('drawerToggle').textContent=collapsed?'Открыть гардероб ↑':'Свернуть ↓';$('items').inert=collapsed;};
$('restart').onclick=()=>{hidePoem();dread?.reset();shine?.reset();startPressure();$('game').inert=false;clearTimeout(flashTimer);clearTimeout(faceTimer);$('scream').hidden=true;Object.assign(state,{worn:{},active:'hair',wrong:0,cycles:0,sad:false,ended:false});played.clear();scene.reset();setView(false);$('ending').hidden=true;$('machine').textContent='диск читается';$('status').textContent='Попробуем ещё раз.';sound('startMusic');render();};
document.querySelectorAll('a[href="/"]').forEach(a=>a.href=MAP_URL);
$('back').addEventListener('click',e=>{if(state.started&&!state.ended){e.preventDefault();$('exitDialog').showModal();}});
$('exitDialog').addEventListener('close',()=>{if($('exitDialog').returnValue==='leave')location.assign(MAP_URL);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.started&&!state.ended&&!$('reactionDialog').open&&!$('exitDialog').open){e.preventDefault();$('exitDialog').showModal();}});
document.addEventListener('visibilitychange',()=>sfx.setMuted?.(muted||document.hidden));
window.addEventListener('pagehide',()=>{hidePoem();clearInterval(pressureTimer);clearTimeout(flashTimer);clearTimeout(faceTimer);scene?.dispose();sfx.killMusic(0);},{once:true});
if(import.meta.env.DEV)window.__babyland={state,stats:()=>scene?.stats()};
render();
