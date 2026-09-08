import * as T from 'three';
import { createBody, createItem, disposeGroup } from './doll.js';
import { ITEMS, itemById } from './items.js';
import { buildRoom } from './room.js';

export function createScene(host) {
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.72;
 host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Трёхмерная кукла. Повернуть можно мышью или кнопками под сценой.');renderer.domElement.setAttribute('role','img');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,60);
 scene.add(new T.HemisphereLight('#ffeadd','#2a1a24',.85));
 const light=new T.DirectionalLight('#fff6e9',2.6);light.position.set(-3,6,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-3;light.shadow.camera.right=3;light.shadow.camera.top=5;light.shadow.camera.bottom=-2;light.shadow.normalBias=.025;scene.add(light);
 const fill=new T.DirectionalLight('#eeb6ed',.45);fill.position.set(3,3,-2);scene.add(fill);
 const front=new T.DirectionalLight('#fff1df',.55);front.position.set(0,2.7,6);scene.add(front);
 const model=new T.Group();scene.add(model);const body=createBody();model.add(body.group);const layers=new Map();
 buildRoom(scene);
 // фон не заливаем: рендер прозрачный, под ним чёрная пустота рабочего стола,
 // а розовый тон накладывается смешиванием в CSS
 scene.fog=new T.Fog('#241820',11,24);
 let targetAngle=0,zoom=false,reaction=0,frozen=false,shakeUntil=0,disposed=false;
 // «Девочка испаряется» (бриф, стр. 7) — это растворение, а не пропажа:
 // мгновенное visible=false читается как баг, а не как событие.
 let fade=1,fadeTo=1;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function fit(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const ro=new ResizeObserver(fit);ro.observe(host);fit();
 const aim=new T.Vector3(0,1.69,0),destination=new T.Vector3();camera.position.set(0,1.78,7.3);
 let lastTime=0;
 renderer.setAnimationLoop(t=>{if(disposed||document.hidden)return;const delta=lastTime?(t-lastTime)/1000:1;lastTime=t;const smooth=reduced.matches?1:1-Math.exp(-12*delta);model.rotation.y=T.MathUtils.lerp(model.rotation.y,targetAngle,smooth);model.position.x=!reduced.matches&&t<shakeUntil?Math.sin(t*.12)*.022:0;body.head.rotation.z=!reduced.matches&&!frozen?Math.sin(t*.0009)*.014:0;
  const narrow=Math.max(1,.62/camera.aspect);destination.set(zoom?0:.25,zoom?2.915:2.0,zoom?1.48*narrow:6.8*narrow);camera.position.lerp(destination,smooth);aim.lerp(new T.Vector3(0,zoom?2.9:1.60,0),smooth);camera.lookAt(aim);
  if(fade!==fadeTo){const k=reduced.matches?1:1-Math.exp(-3.2*delta);
   fade+=(fadeTo-fade)*k; if(Math.abs(fadeTo-fade)<0.01)fade=fadeTo;
   model.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){m.transparent=true;m.opacity=fade;m.depthWrite=fade>0.92;}});
   model.visible=fade>0.01;}
  renderer.render(scene,camera);
  copyFragments();
 });
 // окна-спутники показывают тот же кадр кусками. Копировать надо СРАЗУ
 // после render в том же кадре: буфер WebGL живёт только до конца задачи.
 let fragments=[],shots=[];
 // Одноразовый снимок: скримеру нужна её гримаса, а не текстовая плашка.
 // Кадр берём тем же способом, что и окна-спутники — прямо из буфера.
 function grab(canvas,x,y,w,h){shots.push({canvas,x,y,w,h});}
 function copyFragments(){
  if(!fragments.length&&!shots.length)return;
  const w=renderer.domElement.width,h=renderer.domElement.height;
  const jobs=shots.length?fragments.concat(shots):fragments;
  shots=[];
  for(const f of jobs){
   const ctx=f.canvas.getContext('2d');if(!ctx)continue;
   ctx.clearRect(0,0,f.canvas.width,f.canvas.height);
   try{ctx.drawImage(renderer.domElement,f.x*w,f.y*h,f.w*w,f.h*h,0,0,f.canvas.width,f.canvas.height);}catch{}
  }
 }

 let drag=null;
 renderer.domElement.style.touchAction='none';
 renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,angle:targetAngle};renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(drag&&!frozen)targetAngle=drag.angle+(e.clientX-drag.x)*.008;});
 renderer.domElement.addEventListener('pointerup',()=>drag=null);renderer.domElement.addEventListener('pointercancel',()=>drag=null);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();host.dispatchEvent(new CustomEvent('scene-error'));});
 const thumbScene=new T.Scene();thumbScene.add(new T.HemisphereLight('#fff7ef','#b095b7',3));const tl=new T.DirectionalLight('#ffffff',3);tl.position.set(-2,4,5);thumbScene.add(tl);const tc=new T.PerspectiveCamera(34,1,.01,30),thumbCache=new Map();
 function thumbnail(cat,item,index){if(thumbCache.has(item.id))return thumbCache.get(item.id);let group;
  if(cat==='makeup'){const b=createBody();b.expression('happy',item.id);group=new T.Group();group.add(b.head);disposeGroup(b.group);}else group=createItem(cat,item,index);
  thumbScene.add(group);const bounds=new T.Box3().setFromObject(group),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());const d=Math.max(size.x,size.y,size.z)*1.85;tc.position.copy(center).add(new T.Vector3(d*.23,d*.10,d));tc.lookAt(center);
  const oldSize=renderer.getSize(new T.Vector2()),oldRatio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(192,192,false);renderer.render(thumbScene,tc);const url=renderer.domElement.toDataURL('image/png');renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);thumbScene.remove(group);disposeGroup(group);thumbCache.set(item.id,url);return url;
 }
 return {
  thumbnail,
  fragments(list){fragments=list||[];},
  capture(canvas,x=.34,y=.04,w=.32,h=.26){grab(canvas,x,y,w,h);},
  wear(cat,id){if(layers.has(cat)){model.remove(layers.get(cat));disposeGroup(layers.get(cat));layers.delete(cat);}if(id&&cat!=='makeup'){const item=itemById(id),g=createItem(cat,item,ITEMS[cat].findIndex(i=>i.id===id));model.add(g);layers.set(cat,g);}},
  face(kind,makeup){body.expression(kind,makeup);},
  view(face){zoom=face;targetAngle=0;host.dataset.view=face?'face':'full';},
  rotate(delta){if(!frozen)targetAngle+=delta;},
  react(level){reaction=level;shakeUntil=performance.now()+700;host.dataset.reaction=String(level);},
  end(kind){frozen=true;fadeTo=kind==='gone'?0:1;if(kind!=='gone')model.visible=true;if(kind==='perfect')targetAngle=0;},
  reset(){frozen=false;fade=1;fadeTo=1;model.visible=true;model.traverse(o=>{if(o.isMesh){const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){m.opacity=1;m.transparent=false;m.depthWrite=true;}}});targetAngle=0;zoom=false;reaction=0;host.dataset.reaction='0';for(const cat of layers.keys()){model.remove(layers.get(cat));disposeGroup(layers.get(cat));}layers.clear();body.expression();},
  stats(){return {renderer:'Three.js',meshes:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,layers:[...layers.keys()],angle:model.rotation.y,view:zoom?'face':'full',reaction};},
  dispose(){disposed=true;ro.disconnect();renderer.setAnimationLoop(null);disposeGroup(scene);renderer.dispose();renderer.domElement.remove();}
 };
}
