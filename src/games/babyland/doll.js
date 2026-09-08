import * as T from 'three';
import { buildHead, faceTexture, MAKEUP } from './face.js';

// One coordinate system for the body and every garment, in scene units.
export const RIG = { sole:.12, ankle:.29, knee:1.05, hip:1.69, waist:2.02, chest:2.28, shoulder:2.52, neck:2.69, head:2.90 };
const profile = [[1.53,.22,.14],[1.69,.29,.18],[1.84,.25,.16],[2.02,.20,.14],[2.18,.25,.17],[2.34,.29,.18],[2.49,.30,.14],[2.57,.15,.10]];
// Дуотон оставляет от цвета только светлоту, поэтому «красивое» и
// «неправильное» разведены по яркости с запасом: это геймплейный сигнал,
// а не оформление. Замер: самое тёмное розовое 0.34, самое светлое
// тёмное 0.13 — зазор втрое шире прежнего.
const pinks = ['#ef8bb4', '#edb6d0', '#e87cb0', '#f5cddc', '#ef8ec0', '#e99db7'];
const darks = ['#4a4857', '#3a3c46', '#575f63', '#565162', '#2e2c35', '#4c555d'];
const mat = (color, glossy=false) => new T.MeshStandardMaterial({color,roughness:glossy?.29:.65,metalness:glossy?.13:0,side:T.DoubleSide});
const skin = '#f4d3b8';
function mesh(g,geo,m,pos=[0,0,0]) { const o=new T.Mesh(geo,m);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;g.add(o);return o; }
function orb(g,m,pos,scale) {const o=mesh(g,new T.SphereGeometry(1,24,18),m,pos);o.scale.set(...scale);return o;}
function box(g,m,pos,size) {return mesh(g,new T.BoxGeometry(...size),m,pos);}
function limb(g,m,a,b,ra,rb=ra) {const v=new T.Vector3(...b).sub(new T.Vector3(...a));const o=mesh(g,new T.CylinderGeometry(rb,ra,v.length(),20),m);o.position.copy(new T.Vector3(...a).addScaledVector(v,.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
function ring(y){for(let i=1;i<profile.length;i++)if(y<=profile[i][0]){const a=profile[i-1],b=profile[i],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);return [T.MathUtils.lerp(a[1],b[1],t),T.MathUtils.lerp(a[2],b[2],t)];}return profile.at(-1).slice(1);}
function shell(g,m,y0,y1,{ease=.02,flare=0,pleat=0}={}) {
 const p=[],uv=[],idx=[],rows=24,n=64;
 for(let i=0;i<=rows;i++){const t=i/rows,y=T.MathUtils.lerp(y0,y1,t),r=ring(y);for(let j=0;j<=n;j++){const a=j/n*Math.PI*2,f=flare*(1-t),wave=1+pleat*Math.cos(a*16)*(1-t);p.push(Math.sin(a)*(r[0]+ease+f)*wave,y,Math.cos(a)*(r[1]+ease+f*.65)*wave);uv.push(j/n,t);}}
 for(let i=0;i<rows;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+n+1;idx.push(a,a+1,b,a+1,b+1,b);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return mesh(g,geo,m);
}
function bow(g,pos,size=.11,color='#ba457e') {const m=mat(color,true);for(const s of [-1,1]){const o=orb(g,m,[pos[0]+s*size*.55,pos[1],pos[2]],[size*.65,size*.43,size*.22]);o.rotation.z=s*.28;}orb(g,m,pos,[size*.22,size*.25,size*.28]);}
function curve(g,m,points,r=.018) {return mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),32,r,8,false),m);}
function torus(g,m,pos,r,tube=.015){return mesh(g,new T.TorusGeometry(r,tube,8,40),m,pos);}
function crown(g){const gold=mat('#dfc794',true);for(let i=-3;i<=3;i++){orb(g,gold,[i*.052,3.24+.10*(1-Math.abs(i)/4),.14],[.025,.04,.025]);if(i<3)limb(g,gold,[i*.052,3.24,.14],[(i+1)*.052,3.24,.14],.012);} }
const arm = s=>[[s*.29,2.46,0],[s*.42,2.03,.015],[s*.48,1.68,.07]];
export function createBody() {
 const group=new T.Group(),m=mat(skin,true);
 shell(group,m,1.56,2.55,{ease:0});limb(group,m,[0,2.5,0],[0,2.72,0],.087);
 for(const s of [-1,1]){const a=arm(s);limb(group,m,a[0],a[1],.09,.066);limb(group,m,a[1],a[2],.066,.044);orb(group,m,a[0],[.093,.105,.09]);orb(group,m,a[1],[.067,.067,.067]);orb(group,m,[s*.49,1.61,.075],[.059,.11,.032]);
 limb(group,m,[s*.15,1.66,0],[s*.14,1.03,.015],.137,.082);orb(group,m,[s*.14,1.03,.015],[.084,.091,.08]);limb(group,m,[s*.14,1.03,.015],[s*.14,.27,0],.082,.047);orb(group,m,[s*.14,.18,.08],[.065,.065,.16]);}
 shell(group,mat('#ecd0db'),1.55,1.8,{ease:.006});shell(group,mat('#ecd0db'),2.13,2.37,{ease:.006});
 const faceMat=mat('#ffffff',true),head=mesh(group,buildHead({rx:.068,ry:.083,rz:.067,seg:48}),faceMat,[0,RIG.head,0]);
 for(const s of [-1,1])orb(group,m,[s*.216,2.90,0],[.035,.068,.027]);
 let previous='';
 function expression(kind='happy',makeup=null){const key=kind+makeup;if(key===previous)return;previous=key;faceMat.map?.dispose();faceMat.map=faceTexture({expression:kind,makeup:MAKEUP[makeup]});faceMat.needsUpdate=true;}
 expression();return {group,head,expression};
}
export function createItem(cat,item,index=0){
 const g=new T.Group();g.name=item.id;const id=item.id,pretty=item.kind==='pretty',color=(pretty?pinks:darks)[index%6],m=mat(color,pretty),trim=mat(pretty?'#fff3e8':'#b3b4bd',pretty);
 if(cat==='hair'){
  const blonde=mat(pretty?'#e6c28a':'#302a35',true),length=[.45,.4,.5,.12,.02,.16,.04,.22][index];
  // Open-front cap: the lower front hemisphere is removed, leaving the face free.
  const geo=new T.SphereGeometry(1,40,26),p=geo.attributes.position,indices=geo.index.array,keep=[];
  for(let i=0;i<indices.length;i+=3){let x=0,y=0,z=0;for(let k=0;k<3;k++){x+=p.getX(indices[i+k]);y+=p.getY(indices[i+k]);z+=p.getZ(indices[i+k]);}if(!(z/3>.28 && y/3<.56 && Math.abs(x/3)<.86))keep.push(indices[i],indices[i+1],indices[i+2]);}geo.setIndex(keep);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x*.255,y*.30-Math.max(0,-y)*length,z*.25);}geo.computeVertexNormals();mesh(g,geo,blonde,[0,3,0]);
  if(index<3||index===7)for(const s of [-1,1]){if(index===7&&s===1)continue;for(let i=0;i<5;i++){const x=s*(.19+i*.019),ys=3.19-i*.035;curve(g,blonde,[[x,ys,.045],[x+s*.04,2.98,.11],[x+s*.035,2.77,.09],[x+s*.06,2.66-length*.32,.03]],.032);}}
  if(index===1||index===2)for(const s of [-1,1]){if(index===2)orb(g,blonde,[s*.31,2.91,-.08],[.105,.31,.115]);bow(g,[s*.25,3.17,.06],.12);}
  if(index===3)crown(g);if(index===6)orb(g,blonde,[.06,3.32,-.12],[.15,.13,.13]);
 }
 if(cat==='top'){
  const sleeved=![0,2,4].includes(index),loose=index>=6&&index!==10;
  shell(g,m,index===4?2.09:1.995,index===2?2.35:2.49,{ease:loose?.075:.018});
  if(sleeved)for(const s of [-1,1]){const a=arm(s),long=index>=6||index===3, end=long?a[1]:[s*.34,2.29,0];limb(g,m,a[0],end,loose?.137:.105,long?.105:.095);orb(g,m,a[0],[loose?.138:.11,.12,.115]);if(long)limb(g,m,a[1],a[2],loose?.108:.08,loose?.08:.055);}
  if(index===0)for(const s of [-1,1]){box(g,m,[s*.18,2.44,.14],[.045,.21,.04]);bow(g,[s*.18,2.50,.17],.08);}
  if(index===1||index===3)for(let i=0;i<14;i++)orb(g,trim,[Math.sin(i/14*Math.PI*2)*.232,2.0,Math.cos(i/14*Math.PI*2)*.175],[.048,.043,.034]);
  if(index===2||index===4)for(let i=0;i<18;i++)orb(g,trim,[(i%6-2.5)*.068,2.19+Math.floor(i/6)*.055,.195],[.012,.012,.009]);
  if(index===5)bow(g,[0,2.22,.21],.15);
  if(index===6){torus(g,m,[0,2.61,-.065],.18,.065).rotation.x=.7;for(const s of [-1,1])curve(g,trim,[[s*.07,2.50,.23],[s*.075,2.34,.25],[s*.09,2.27,.25]],.008);box(g,trim,[0,2.14,.235],[.22,.08,.025]);}
  if([3,8,9,11].includes(index)){box(g,trim,[0,2.24,.23],[.012,.43,.012]);for(let i=0;i<4;i++)orb(g,trim,[.04,2.09+i*.1,.23],[.012,.012,.012]);}
  if(index===10)limb(g,m,[0,2.49,0],[0,2.71,0],.105,.09);
 }
 if(cat==='bottom'){
  if([2,4,5,6].includes(index)){shell(g,m,1.49,2.02,{ease:.032});for(const s of [-1,1]){const y=index===2?1.46:index===6?1.14:.24;limb(g,m,[s*.15,1.67,0],[s*.14,y,.01],index===2?.155:.17,index===2?.16:index===6?.15:.105);if(index===6)box(g,trim,[s*.28,1.42,.01],[.075,.18,.17]);}}
  else {const bottom=index===7?.24:index===3?1.24:1.45;shell(g,m,bottom,2.02,{ease:.029,flare:index===1?.29:index===7?.18:.12,pleat:index===1?.07:.025});if(index<2)for(let j=0;j<(index===1?3:1);j++)shell(g,trim,1.45+j*.12,1.5+j*.12,{ease:.04,flare:.18-j*.03,pleat:.08});}
  if(pretty)bow(g,[.13,1.97,.19],.09);
 }
 if(cat==='shoes')for(const s of [-1,1]){
  orb(g,m,[s*.14,.18,.095],[index>=4?.09:.076,index===0?.095:.06,index>=4?.185:.17]);
  if(index===0||index>=4)box(g,trim,[s*.14,.12,.075],[index>=4?.175:.145,.055,.31]);
  if(index===1)box(g,m,[s*.14,.115,-.03],[.035,.10,.035]);
  if(index===2||index===6)limb(g,m,[s*.14,.2,0],[s*.14,index===2?.80:.49,0],.085,index===2?.09:.1);
  if(index===3)bow(g,[s*.14,.235,.18],.062);
  if(index===4||index===5)for(let i=0;i<3;i++)box(g,trim,[s*.14,.238,.1+i*.035],[.11,.012,.012]);
 }
 if(cat==='acc'){
  if(index===0)for(let i=0;i<26;i++){const a=i/26*Math.PI*2;orb(g,trim,[Math.sin(a)*.16,2.60-Math.max(0,Math.cos(a))*.14,Math.cos(a)*.14],[.025,.025,.025]);}
  if(index===1){orb(g,m,[.55,1.73,.12],[.15,.13,.07]);torus(g,trim,[.55,1.87,.12],.09);bow(g,[.55,1.75,.195],.065);}
  if(index===2)crown(g);
  if(index===3)for(const s of [-1,1])orb(g,trim,[s*.237,2.92,.04],[.034,.048,.034]);
  if(index===4)for(const s of [-1,1]){limb(g,m,[s*.46,1.91,.04],[s*.48,1.64,.07],.065,.05);orb(g,m,[s*.49,1.61,.075],[.066,.117,.039]);}
  if(index===5){const o=torus(g,trim,[.473,1.77,.055],.055,.017);o.rotation.x=Math.PI/2;}
  if(index===6)bow(g,[0,2.66,.112],.12);
  if(index===7)for(const s of [-1,1]){const o=orb(g,mat('#edd9f2',true),[s*.4,2.3,-.20],[.28,.45,.035]);o.rotation.z=-s*.5;orb(g,trim,[s*.32,1.91,-.2],[.23,.22,.03]);}
  if(index===8){orb(g,m,[0,2.20,-.27],[.27,.34,.14]);for(const s of [-1,1])curve(g,m,[[s*.17,2.46,-.2],[s*.24,2.5,.1],[s*.21,2.15,.22],[s*.19,1.95,-.2]],.028);}
  if(index===9){curve(g,m,[[-.25,2.98,0],[-.25,3.28,0],[0,3.37,0],[.25,3.28,0],[.25,2.98,0]],.034);for(const s of [-1,1])orb(g,m,[s*.26,3,0],[.055,.095,.09]);}
  if(index===10){for(const s of [-1,1])torus(g,m,[s*.09,3.015,.229],.065,.012);limb(g,m,[-.025,3.02,.237],[.025,3.02,.237],.009);}
  if(index===11){const o=mesh(g,new T.SphereGeometry(.255,32,16,0,Math.PI*2,0,Math.PI/2),m,[0,3.11,0]);o.scale.y=.65;orb(g,m,[0,3.12,.24],[.21,.025,.16]);}
  if(index===12){const o=box(g,mat('#d5b8a2'),[.123,2.94,.195],[.11,.045,.012]);o.rotation.z=.35;}
  if(index===13){limb(g,trim,[.51,1.65,.1],[.51,1.23,.1],.024);torus(g,trim,[.51,1.2,.1],.06,.023);}
  if(index===14){orb(g,m,[-.09,3.01,.231],[.067,.052,.014]);curve(g,m,[[-.20,3.03,.12],[0,3.04,.24],[.21,3.06,.11]],.009);}
 }
 if(cat==='hair'||cat==='acc'&&[2,3,9,10,11,12,14].includes(index))g.position.y=-.10;
 return g;
}
export function disposeGroup(g){const mats=new Set();g.traverse(o=>{o.geometry?.dispose();if(o.material)mats.add(o.material);});for(const m of mats){m.map?.dispose();m.dispose();}g.clear();}
