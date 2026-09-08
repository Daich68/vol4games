import * as T from 'three';
import {createItem} from './doll.js';
import {ITEMS} from './items.js';

export function buildRoom(scene){
 const group=new T.Group();group.name='dressing-room';scene.add(group);
 // Значения материалов разведены по светлоте намеренно: дуотон (grayscale +
 // multiply розовым) убивает цветовые различия и оставляет только тон.
 // Близкие по яркости поверхности после него сливаются в одно пятно.
 const material=(color,metalness=0)=>new T.MeshStandardMaterial({color,metalness,roughness:metalness?.3:.85});
 const chrome=material('#c6c9dc',.7),wood=material('#8d7a95'),pink=material('#7d3a5f'),lightPink=material('#e4c1d8');
 function add(geo,mat,pos){const mesh=new T.Mesh(geo,mat);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
 const box=(mat,pos,size)=>add(new T.BoxGeometry(...size),mat,pos);
 const rod=(a,b,r=.025)=>{const v=new T.Vector3(...b).sub(new T.Vector3(...a));const mesh=add(new T.CylinderGeometry(r,r,v.length(),12),chrome,[0,0,0]);mesh.position.copy(new T.Vector3(...a).addScaledVector(v,.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return mesh;};
 const tile=document.createElement('canvas');tile.width=128;tile.height=128;const ctx=tile.getContext('2d');ctx.fillStyle='#f4eff7';ctx.fillRect(0,0,128,128);ctx.fillStyle='#6f6478';ctx.fillRect(0,0,64,64);ctx.fillRect(64,64,64,64);const map=new T.CanvasTexture(tile);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(12,12);map.magFilter=T.NearestFilter;
 const floor=add(new T.PlaneGeometry(24,24),new T.MeshStandardMaterial({map,roughness:.55}),[0,-.085,0]);floor.rotation.x=-Math.PI/2;
 box(material('#4a3f52'),[0,2.25,-2.7],[14,4.6,.15]);
 box(wood,[0,.10,-2.58],[14,.15,.10]);
 // Pleated curtains are geometry, with real lighting and depth.
 for(const side of [-1,1]){const geo=new T.PlaneGeometry(2.6,4.4,70,1),p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*15)*.08);geo.computeVertexNormals();const curtain=add(geo,pink,[side*4,2.12,-2.3]);curtain.material.side=T.DoubleSide;rod([side*4-1.4,4.35,-2.3],[side*4+1.4,4.35,-2.3],.035);}
 // Vanity with a rectangular illuminated mirror, offset from the play area.
 box(wood,[-2.5,1.1,-1.6],[1.7,.12,.75]);for(const x of [-3.15,-1.85])for(const z of [-1.86,-1.34])box(chrome,[x,.50,z],[.055,1.10,.055]);
 box(lightPink,[-2.5,2.04,-2.12],[1.52,1.72,.13]);
 box(material('#c5ccdf',.45),[-2.5,2.04,-2.035],[1.30,1.50,.018]);
 const bulb=new T.MeshStandardMaterial({color:'#fff9e6',emissive:'#ffe5d0',emissiveIntensity:.9,roughness:.3});
 for(const x of [-3.19,-1.81])for(let y=1.36;y<2.8;y+=.30)add(new T.SphereGeometry(.054,12,8),bulb,[x,y,-1.99]);
 for(let i=0;i<5;i++){const bottle=box(material(['#813154','#ece3ee','#c866aa','#6f487b','#e4bad4'][i]),[-2.95+i*.23,1.26,-1.50],[.105,.23+(i%2)*.10,.11]);box(chrome,[bottle.position.x,bottle.position.y+.17,-1.50],[.07,.065,.075]);}
 const seat=add(new T.CylinderGeometry(.35,.35,.15,36),lightPink,[-2.5,.55,-.5]);rod([-2.5,.03,-.5],[-2.5,.5,-.5],.055);add(new T.CylinderGeometry(.28,.31,.05,24),chrome,[-2.5,-.02,-.5]);
 // Clothing rail: reuse the actual wardrobe meshes as room props.
 rod([1.85,.04,-1.75],[1.85,2.85,-1.75]);rod([3.5,.04,-1.75],[3.5,2.85,-1.75]);rod([1.85,2.85,-1.75],[3.5,2.85,-1.75]);
 for(const x of [1.85,3.5])rod([x,.02,-2.1],[x,.02,-1.4],.04);
 for(let i=0;i<3;i++){const x=2.16+i*.49;rod([x,2.84,-1.75],[x,2.57,-1.75],.01);rod([x,2.57,-1.75],[x-.21,2.44,-1.75],.012);rod([x-.21,2.44,-1.75],[x+.21,2.44,-1.75],.012);rod([x+.21,2.44,-1.75],[x,2.57,-1.75],.012);const garment=createItem('top',ITEMS.top[i+1],i+1);garment.scale.setScalar(.64);garment.position.set(x,.81,-1.75);group.add(garment);}
 const rug=add(new T.CylinderGeometry(1.1,1.1,.015,64),material('#d99cbe'),[0,-.068,0]);rug.scale.z=.8;
 return group;
}
