import './loader.css';

const pre=document.getElementById('preloader');
const enter=document.getElementById('loadEnter');
const retry=document.getElementById('loadRetry');
const status=document.getElementById('loadStatus');
const targets=[...document.body.children].filter(el=>el!==pre&&!['SCRIPT','STYLE'].includes(el.tagName));
const previous=targets.map(el=>el.inert);
targets.forEach(el=>el.inert=true);
let ready=false,returning=false,leaving=false;
try{returning=new URL(document.referrer).origin===location.origin;}catch{}
let count=0;
try{count=['birds','stalagmit','nancy-drew','prizma'].filter(id=>localStorage.getItem(`vol4_${id}_done`)==='true').length;}
catch{}
document.getElementById('loadProgress').textContent=count?`${count} / 4 · дерево помнит прочитанное`:'четыре голоса · одно дерево';
function open(){
 if(!ready||leaving)return;
 leaving=true;pre.classList.add('leaving');
 enter.blur();
 targets.forEach((el,i)=>el.inert=previous[i]);
 document.body.classList.remove('preloading');
 document.body.classList.add('intro-flight');
 setTimeout(()=>{
 document.body.classList.remove('intro-flight');
 pre.remove();
 document.dispatchEvent(new Event('vol4:entered'));
 },matchMedia('(prefers-reduced-motion: reduce)').matches?0:1100);
}
enter.onclick=open;
// Do not let the confirmation key also enter a map node.
pre.addEventListener('keydown',e=>e.stopPropagation());
retry.onclick=()=>location.reload();
const slow=setTimeout(()=>{if(!ready)status.textContent='Карта загружается дольше обычного. Можно подождать или повторить.';if(!ready)retry.hidden=false;},15000);
window.addEventListener('vol4:tree-intro-ready',()=>{
 ready=true;clearTimeout(slow);pre.dataset.state='ready';status.textContent='мир проснулся';
 enter.disabled=false;enter.textContent=count?'вернуться к дереву':'войти в мир';retry.hidden=true;
 if(returning)open();
},{once:true});
import('./main.js').catch(()=>{
 clearTimeout(slow);pre.dataset.state='error';status.textContent='Не удалось открыть 3D-карту. Проверь соединение и поддержку WebGL.';
 enter.hidden=true;retry.hidden=false;
});
