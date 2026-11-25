import * as THREE from 'three';
import {GLTFLoader} from './jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from './jsm/utils/SkeletonUtils.js';

const A='./assets/';
const loader=new GLTFLoader();
const gltfCache={};
async function loadG(u){ if(!gltfCache[u]) gltfCache[u]=loader.loadAsync(u); return gltfCache[u]; }
// 로딩 진행 표시: 버튼은 준비 완료까지 비활성, 진행률을 문구로 표시
THREE.DefaultLoadingManager.onProgress=(url,loaded,total)=>{const b=document.getElementById('startBtn');
  if(b&&b.disabled)b.textContent=`로딩 중… ${Math.min(99,Math.round(loaded/total*100))}%`;};

// ---------- renderer / scene ----------
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,200);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();});

// ---------- helpers ----------
function glowTex(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.35,'rgba(255,255,255,.45)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const GLOW=glowTex();
function glow(color,size,op=0.9){const m=new THREE.SpriteMaterial({map:GLOW,color,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false});
  const s=new THREE.Sprite(m);s.scale.set(size,size,1);return s;}
function ring(color,r1,op=0.9){const g=new THREE.RingGeometry(r1*0.72,r1,36);const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false});
  const o=new THREE.Mesh(g,m);o.rotation.x=-Math.PI/2;return o;}
function discShadow(r){const m=new THREE.Mesh(new THREE.CircleGeometry(r,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.y=0.02;return m;}
function norm(n){return (n||'').toLowerCase().replace(/[^a-z]/g,'');}
function findNode(root,pat){let hit=null;root.traverse(o=>{if(!hit&&pat.test(norm(o.name)))hit=o;});return hit;}
function hideWeapons(root){root.traverse(o=>{if(o.isMesh&&/sword|shield|dagger|axe|staff|bow|crossbow|wand|spear|quiver|spellbook|knife|mug/.test(norm(o.name)))o.visible=false;});}
function labelSprite(text,color='#ffffff',w=2.2,ttl=1.4){
  const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
  g.font='700 54px "Noto Sans KR", sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=9;g.strokeStyle='rgba(0,0,0,0.8)';g.strokeText(text,256,64);g.fillStyle=color;g.fillText(text,256,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false}));
  s.scale.set(w,w*0.25,1);return s;}

function makeNumSprite(n){ // 블록 잔여 수치를 큰 숫자로 표시(원작 스타일)
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false}));
  s.scale.set(1.5,1.5,1);
  const o={sprite:s,c,tex:t};
  drawNum(o,n);return o;}
function drawNum(o,n){
  const g=o.c.getContext('2d');g.clearRect(0,0,256,256);
  g.font='800 130px "Noto Sans KR", sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=16;g.strokeStyle='rgba(0,0,0,0.85)';g.strokeText(String(n),128,134);g.fillStyle='#ffffff';g.fillText(String(n),128,134);
  o.tex.needsUpdate=true;}

// transient effects
const fx=[];
function addFx(obj,ttl,fade=true){scene.add(obj);fx.push({obj,t:ttl*FXSLOW,ttl:ttl*FXSLOW,fade});}
function spark(pos,color,size=1.6,ttl=0.35){const g=glow(color,size,1);g.position.copy(pos);addFx(g,ttl);}
function burst(pos,color,n=14,speed=3.2,ttl=0.45,size=0.55){ // 타격 파편
  for(let i=0;i<n;i++){const g=glow(color,size*(0.6+Math.random()*0.8),0.95);g.position.copy(pos);
    const a=Math.random()*Math.PI*2,e=Math.random()*Math.PI-Math.PI/2;
    const v=new THREE.Vector3(Math.cos(a)*Math.cos(e),Math.sin(e)+0.6,Math.sin(a)*Math.cos(e)).normalize().multiplyScalar(speed*(0.5+Math.random()*0.8));
    scene.add(g);fx.push({obj:g,t:ttl,ttl,fade:true,vel:v,grav:-6});}}
function lightningFx(a,b,color=0xffee55){
  const grp=new THREE.Group();const N=9;
  for(let i=0;i<N;i++){const f0=i/N,f1=(i+1)/N;
    const p0=new THREE.Vector3().lerpVectors(a,b,f0);const p1=new THREE.Vector3().lerpVectors(a,b,f1);
    if(i>0&&i<N-1){p0.x+=Math.sin(i*12.9)*0.45;p0.y+=Math.cos(i*7.7)*0.3;p0.z+=Math.sin(i*5.3)*0.2;}
    const len=p0.distanceTo(p1);
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.11,len),new THREE.MeshBasicMaterial({color:0xfff8cc}));
    m.position.copy(p0).lerp(p1,0.5);m.lookAt(p1);grp.add(m);}
  const h=glow(color,3.4,1);h.position.copy(b);grp.add(h);
  addFx(grp,0.28);}

// ---------- config (수치 전부 초안) ----------
const CFG={
  fwdSpeed:1.7, dragClamp:2.1, defLine:2.6,
  lives:3, gaugePerKill:12, stormDmg:40, killsPerLevel:8, levelMul:1.15,
  stageLen:55,
};
const CLASSES={
  Knight:{u:'Knight.glb',s:0.47,dmg:6,cd:0.9,range:9.5,kind:'bolt',color:0xffe27a,anim:'1H_Melee_Attack_Stab',w:{slot:'handslotr',u:'weapons/spear_A.gltf'}},
  Barbarian:{u:'Barbarian.glb',s:0.40,dmg:14,cd:1.25,range:2.6,kind:'cleave',color:0xff7a2a,anim:'2H_Melee_Attack_Spin'},
  Rogue:{u:'Rogue.glb',s:0.47,dmg:4,cd:0.55,range:10.5,kind:'shard',color:0x9fdcff,anim:'2H_Ranged_Shoot',w:{slot:'handslotl',u:'weapons/bow_A_withString.gltf'}},
  Mage:{u:'Mage.glb',s:0.38,dmg:9,cd:1.15,range:10.5,kind:'fire',color:0xff7a2a,anim:'Spellcast_Shoot',w:{slot:'handslotr',u:'weapons/wand.gltf'}},
};
CLASSES.Rogue_Hooded={...CLASSES.Rogue,u:'Rogue_Hooded.glb'};
const START_SQUAD=['Knight','Barbarian','Rogue','Mage'];
const EXTRA_CYCLE=['Rogue_Hooded','Mage','Knight','Barbarian'];
const CLS_KO={Knight:'나이트',Barbarian:'바바리안',Rogue:'로그',Mage:'메이지',Rogue_Hooded:'후드 로그'};
const FOES={
  Warrior:{u:'Skeleton_Warrior.glb',hp:26,spd:1.05,s:0.56,rr:0.6},
  Minion:{u:'Skeleton_Minion.glb',hp:16,spd:1.5,s:0.56,rr:0.5},
  Rogue:{u:'Skeleton_Rogue.glb',hp:20,spd:1.3,s:0.56,rr:0.55},
  Mage:{u:'Skeleton_Mage.glb',hp:18,spd:0.9,s:0.56,rr:0.55},
  Blob:{u:'blob/GreenBlob.gltf',hp:10,spd:2.0,s:0.35,rr:0.4,gltf:true},
};
const TS=parseFloat(new URLSearchParams(location.search).get('ts'))||1; // 테스트용 시간배율(전체 균일)
const WEAK=new URLSearchParams(location.search).has('weak'); // 패배 경로 테스트용
const BOSSONLY=new URLSearchParams(location.search).has('bossonly'); // 보스 돌파 경로 단독 검증용
const GAUGE0=parseFloat(new URLSearchParams(location.search).get('gauge'))||0; // 합성 마법 테스트용 초기 게이지
const FXSLOW=parseFloat(new URLSearchParams(location.search).get('fxslow'))||1; // 이펙트 수명 배율(캡처 전용, 외형 불변)
const BOSS={u:'bosses/Mushnub_Evolved.gltf',hp:260,spd:1.9,s:0.95,rr:1.3,gltf:true};

// ---------- state ----------
const G={state:'title',stage:1,lives:CFG.lives,kills:0,level:1,dmgMul:1,gauge:0,
  squad:null,allies:[],enemies:[],blocks:[],projs:[],stageZ0:0,spawned:new Set(),extra:0,
  layout:[],boss:null,x:0};
window.__game=G;
Object.defineProperty(G,'fps',{get:()=>Math.round(fpsEMA)});
Object.defineProperty(G,'summary',{get:()=>({state:G.state,stage:G.stage,lives:G.lives,squad:G.allies.length,enemies:G.enemies.length,blocks:G.blocks.length,kills:G.kills,level:G.level,gauge:Math.round(G.gauge),x:+G.x.toFixed(2),fps:Math.round(fpsEMA),bossHp:G.boss?Math.round(G.boss.hp):null})});
Object.defineProperty(G,'hint',{get:()=>{ // 테스트 하니스용: 가장 가까운 위협/보상 위치
  const sq=G.squad?G.squad.position:{x:0,z:0};
  let foe=null,fd=1e9,blk=null,bd=1e9;
  for(const e of G.enemies){if(e.hp<=0)continue;const d=sq.z-e.obj.position.z;if(d>-2&&d<fd){fd=d;foe={x:+e.obj.position.x.toFixed(2),dz:+d.toFixed(1),boss:!!e.isBoss};}}
  for(const b of G.blocks){if(b.hp<=0)continue;const d=sq.z-b.obj.position.z;if(d>-2&&d<bd){bd=d;blk={x:+b.obj.position.x.toFixed(2),dz:+d.toFixed(1),t:b.btype};}}
  return {foe,blk,sqx:+sq.x.toFixed(2)};}});

// ---------- environment (1지역: 시작의 들판) ----------
async function buildMeadow(){
  scene.background=new THREE.Color(0x9fc7e8); scene.fog=new THREE.FogExp2(0xb8d6ee,0.014);
  scene.add(new THREE.HemisphereLight(0xbcd8ff,0x3f5a2e,0.9));
  const sun=new THREE.DirectionalLight(0xfff2dd,2.0);sun.position.set(6,13,5);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,600),new THREE.MeshStandardMaterial({color:0x4a7c3a,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.set(0,-0.02,-140);scene.add(ground);
  const path=new THREE.Mesh(new THREE.PlaneGeometry(5.6,600),new THREE.MeshStandardMaterial({color:0x8a6f4d,roughness:1}));
  path.rotation.x=-Math.PI/2;path.position.set(0,0,-140);scene.add(path);
  const trees=[A+'forest/Tree_1_A_Color1.gltf',A+'forest/Tree_2_E_Color1.gltf',A+'forest/Tree_3_A_Color1.gltf'];
  const deco=[[A+'forest/Bush_1_A_Color1.gltf',1.3],[A+'forest/Rock_1_A_Color1.gltf',0.8],[A+'forest/Grass_1_C_Color1.gltf',0.9],[A+'forest/Rock_2_B_Color1.gltf',0.7]];
  let ti=0;
  for(let z=15;z>=-330;z-=4.5){for(const sxn of [-1,1]){
    const off=4.7+((ti*37)%13)/13*2.0;
    const g=await loadG(trees[ti%3]);const t=g.scene.clone();
    t.position.set(sxn*off,0,z+((ti*53)%17)/17*1.2);t.rotation.y=(ti*61%360)*Math.PI/180;t.scale.setScalar(0.8+((ti*29)%10)/20);scene.add(t);
    if(ti%2===0){const d=deco[ti%4];const g2=await loadG(d[0]);const dd=g2.scene.clone();
      dd.position.set(sxn*(3.1+((ti*17)%7)/7*0.7),0,z-1.2);dd.scale.setScalar(d[1]);scene.add(dd);}
    ti++;}}
  // defense line marker
  const dl=new THREE.Mesh(new THREE.PlaneGeometry(6.4,0.3),new THREE.MeshBasicMaterial({color:0x55ffcc,transparent:true,opacity:0.4,blending:THREE.AdditiveBlending,depthWrite:false}));
  dl.rotation.x=-Math.PI/2;scene.add(dl);G.defLineMesh=dl;
}

// ---------- units ----------
async function makeModel(u,scale,tint){
  const g=await loadG(u);
  const root=SkeletonUtils.clone(g.scene);
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  if(tint)root.traverse(o=>{if(o.isMesh&&o.material){o.material=o.material.clone();o.material.color.multiply(new THREE.Color(...tint));}});
  root.scale.setScalar(scale);
  return {root,anims:g.animations};
}
function makeMixer(root,anims){
  const mixer=new THREE.AnimationMixer(root);const acts={};
  for(const c of anims)acts[c.name]=mixer.clipAction(c);
  return {mixer,acts};
}
function playOnce(unit,name,back){
  const a=unit.acts[name];if(!a)return;
  const b=unit.acts[back];
  if(b)b.stop();
  a.reset();a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=false;a.play();
  const onFin=(e)=>{if(e.action===a){if(b){b.reset();b.play();}unit.mixer.removeEventListener('finished',onFin);}};
  unit.mixer.addEventListener('finished',onFin);
}

async function spawnAlly(clsName,slot){
  const c=CLASSES[clsName];
  const {root,anims}=await makeModel(A+c.u,c.s);
  hideWeapons(root);
  if(c.w){const slot3=findNode(root,new RegExp(c.w.slot));
    if(slot3){const w=await loadG(A+c.w.u);const wr=w.scene.clone();slot3.add(wr);}}
  const unit={kind:'ally',cls:clsName,cfg:c,obj:root,hp:1,cd:Math.random()*0.4,slot,...makeMixer(root,anims)};
  root.rotation.y=Math.PI;
  if(unit.acts.Walking_A){unit.acts.Walking_A.play();unit.acts.Walking_A.timeScale=1.1;}
  const rr=ring(0x22ddff,0.44);rr.position.y=0.035;root.add(rr);
  root.add(discShadow(0.42));
  G.squad.add(root);G.allies.push(unit);
  layoutSquad();
}
function layoutSquad(){ // 뭉친 대형: 황금각 나선 배치, 인원이 늘어도 아래로 길어지지 않음
  G.allies.forEach((u,i)=>{
    if(i===0){u.obj.position.set(0,0,-0.35);return;} // 선두
    const r=Math.min(1.5,0.62+0.42*Math.sqrt(i));
    const a=i*2.399;
    u.obj.position.set(Math.cos(a)*r,0,-0.35+Math.sin(a)*r*0.78);
  });
}

async function spawnFoe(type,x,z,isBoss=false){
  const f=isBoss?BOSS:FOES[type];
  const {root,anims}=await makeModel(A+f.u,f.s,isBoss?null:[1.05,0.8,0.8]);
  root.position.set(x,0,z);root.rotation.y=0;
  const unit={kind:'foe',type,isBoss,hp:f.hp,maxHp:f.hp,cfg:f,obj:root,hitT:0,...makeMixer(root,anims)};
  const walk=unit.acts.Walking_A||unit.acts.Walk;if(walk){walk.play();walk.time=Math.random();}
  const rr=ring(0xff2233,f.rr);rr.position.y=0.035;root.add(rr);
  const fd=new THREE.Mesh(new THREE.CircleGeometry(f.rr*1.15,28),new THREE.MeshBasicMaterial({color:0xff2233,transparent:true,opacity:0.2,depthWrite:false}));
  fd.rotation.x=-Math.PI/2;fd.position.y=0.03;root.add(fd);
  root.add(discShadow(f.rr*0.9));
  // hp bar
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x331111,depthWrite:false}));bg.scale.set(1.1,0.12,1);
  const fg=new THREE.Sprite(new THREE.SpriteMaterial({color:0xff4444,depthWrite:false}));fg.scale.set(1.06,0.09,1);
  const hy=isBoss?2.6:1.55;bg.position.y=hy;fg.position.y=hy;root.add(bg,fg);unit.hpFg=fg;unit.hpBg=bg;
  scene.add(root);G.enemies.push(unit);
  if(isBoss){G.boss=unit;unit.phase=0;}
  return unit;
}

async function spawnBlock(kind,x,z){
  const grp=new THREE.Group();grp.position.set(x,0,z);
  if(kind==='chest'){
    const g=await loadG(A+'env/chest_gold.glb');const r=g.scene.clone();r.scale.setScalar(0.45);grp.add(r);
    const gl=glow(0xffcc44,2.0,0.6);gl.position.y=0.55;grp.add(gl);
    const cls=EXTRA_CYCLE[G.extra%EXTRA_CYCLE.length];G.extra++;
    const tag=labelSprite(`대원 +1 ${CLS_KO[cls]}`,'#ffd966',2.9);tag.position.y=2.1;grp.add(tag);
    grp.userData.rewardCls=cls;grp.userData.tag=tag;
  }else{
    const cry=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.9,0.5),new THREE.MeshStandardMaterial({color:0x66e0ff,emissive:0x2288cc,emissiveIntensity:1.6,roughness:0.2}));
    cry.position.y=0.55;cry.rotation.y=Math.PI/4;grp.add(cry);
    const gl=glow(0x66e0ff,2.1,0.6);gl.position.y=0.85;grp.add(gl);
    const tag=labelSprite('공격력 +20%','#9fe8ff',2.6);tag.position.y=2.1;grp.add(tag);
    grp.userData.tag=tag;
  }
  grp.add(discShadow(0.5));
  const unit={kind:'block',btype:kind,hp:30,maxHp:30,obj:grp,hitT:0};
  const num=makeNumSprite(30);num.sprite.position.y=1.55;grp.add(num.sprite);unit.hpNum=num;
  scene.add(grp);G.blocks.push(unit);
}

// ---------- stage layout ----------
function stageLayout(n){
  const L=[];const z0=-CFG.stageLen*(n-1);
  if(n<5){
    const foeTypes=['Warrior','Minion','Rogue','Mage'];
    [10,22,34,46].forEach((dz,w)=>{
      const cnt=1+n;
      for(let i=0;i<cnt;i++){
        const t=foeTypes[(w+i+n)%4];
        L.push({dz:dz+ (i%2)*1.6, type:'foe',foe:t,x:0.7+ ((i*47)%10)/10*1.5});
      }
    });
    L.push({dz:16,type:'chest',x:-1.5});
    L.push({dz:40,type:'crystal',x:-1.6});
  }else{
    L.push({dz:10,type:'foe',foe:'Warrior',x:0.9});
    L.push({dz:12,type:'foe',foe:'Minion',x:1.8});
    L.push({dz:18,type:'foe',foe:'Rogue',x:1.2});
    L.push({dz:25,type:'boss',x:0});
  }
  L.forEach(e=>e.z=z0-e.dz);
  return L;
}
function setStage(n){
  G.stage=n;G.layout=stageLayout(n);G.spawned=new Set();G.stageZ0=-CFG.stageLen*(n-1);
  document.getElementById('stageName').textContent=`1-${n} · 시작의 들판`;
}

// ---------- combat ----------
function nearestTarget(unit){
  const wp=unit.obj.getWorldPosition(new THREE.Vector3());
  let best=null,bd=1e9;
  const consider=(o)=>{
    const p=o.obj.position;const dz=wp.z-p.z; // ahead of ally means p.z < wp.z
    if(p.z>wp.z-0.3)return; // 전방의 적만 자동 공격(보스 포함)
    const d=Math.hypot(p.x-wp.x,dz);
    if(d<bd){bd=d;best=o;}
  };
  for(const e of G.enemies)if(e.hp>0)consider(e);
  if(!best||bd>unit.cfg.range)for(const b of G.blocks)if(b.hp>0)consider(b);
  if(bd>unit.cfg.range)return null;
  return best;
}
function fireBolt(unit,target){
  const c=unit.cfg;
  const from=unit.obj.getWorldPosition(new THREE.Vector3());from.y=1.0;
  let mesh;const grp=new THREE.Group();
  if(c.kind==='shard'){mesh=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.55,6),new THREE.MeshBasicMaterial({color:0xd8f4ff}));
    mesh.rotation.x=-Math.PI/2;grp.add(mesh);const gl=glow(0x66ccff,1.0,0.95);grp.add(gl);}
  else if(c.kind==='fire'){mesh=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,10),new THREE.MeshBasicMaterial({color:0xffe0a0}));grp.add(mesh);
    const gl=glow(0xff7a2a,1.5,0.95);grp.add(gl);const gl2=glow(0xffcc44,0.7,0.9);grp.add(gl2);}
  else{mesh=new THREE.Mesh(new THREE.OctahedronGeometry(0.16),new THREE.MeshBasicMaterial({color:0xfff6c0}));mesh.scale.set(0.7,0.7,1.8);grp.add(mesh);
    const gl=glow(0xffe27a,1.25,0.95);grp.add(gl);}
  grp.position.copy(from);scene.add(grp);
  G.projs.push({mesh:grp,target,dmg:c.dmg*G.dmgMul,speed:22,kind:c.kind,color:c.color});
  playOnce(unit,c.anim,'Walking_A');
}
function cleave(unit,target){
  const p=target.obj.position.clone();p.y=0.6;
  spark(p,unit.cfg.color,3.0,0.3);
  burst(p,unit.cfg.color,16,4.0,0.45,0.6);
  efkPlay('hit',p,0.55,1.4);
  damage(target,unit.cfg.dmg*G.dmgMul);
  playOnce(unit,unit.cfg.anim,'Walking_A');
}
function damage(t,d){
  t.hp-=d;t.hitT=0.12;
  if(t.kind==='foe')t.obj.position.z-=t.isBoss?0.06:0.2; // 타격 넉백
  if(t.hpFg){const f=Math.max(0,t.hp/t.maxHp);t.hpFg.scale.x=1.06*f;t.hpFg.position.x=-(1-f)*0.53;}
  if(t.hpNum){drawNum(t.hpNum,Math.max(0,Math.ceil(t.hp))); // 피격 시 잔여 수치 감소가 크게 보이도록
    const pop=1.5*1.25;t.hpNum.sprite.scale.set(pop,pop,1);t.hpNum.popT=0.12;}
  if(t.hp<=0&&t.kind!=='ally')killUnit(t);
}
function killUnit(t){
  if(t.kind==='foe'){
    G.kills++;G.gauge=Math.min(100,G.gauge+CFG.gaugePerKill);
    const dp=t.obj.position.clone();dp.y=0.9;burst(dp,t.isBoss?0xffd9a0:0xfff0dd,t.isBoss?26:16,t.isBoss?5:4,0.6,0.7);
    if(G.kills%CFG.killsPerLevel===0){G.level++;G.dmgMul*=CFG.levelMul;
      const l=labelSprite('레벨 업!','#ffe27a',2.4);l.position.set(G.squad.position.x,2.6,G.squad.position.z-1);addFx(l,1.6);}
    if(t.acts.Death_A||t.acts.Death){const d=t.acts.Death_A||t.acts.Death;
      Object.values(t.acts).forEach(a=>a.stop());d.reset();d.setLoop(THREE.LoopOnce,1);d.clampWhenFinished=true;d.play();}
    if(t.hpFg){t.obj.remove(t.hpFg);t.hpFg=null;}if(t.hpBg){t.obj.remove(t.hpBg);t.hpBg=null;}
    t.deadT=1.1;
    if(t.isBoss){G.bossDead=true;bossPhase(t);}
  }else if(t.kind==='block'){
    const p=t.obj.position.clone();p.y=1;
    if(t.btype==='chest'){
      spark(p,0xffcc44,3,0.5);
      const l=labelSprite('대원 +1','#ffd966',2.2);l.position.copy(p).add(new THREE.Vector3(0,1,0));addFx(l,1.6);
      spawnAlly(t.obj.userData.rewardCls||EXTRA_CYCLE[0]);
    }else{
      spark(p,0x66e0ff,3,0.5);
      G.dmgMul*=1.2;G.gauge=Math.min(100,G.gauge+40);
      const l=labelSprite('공격력 +20%','#9fe8ff',2.4);l.position.copy(p).add(new THREE.Vector3(0,1,0));addFx(l,1.6);
    }
    if(t.hpNum){t.obj.remove(t.hpNum.sprite);t.hpNum=null;}
    if(t.obj.userData.tag){t.obj.remove(t.obj.userData.tag);t.obj.userData.tag=null;} // 파괴된 블록의 보상 라벨 잔존 방지
    scene.remove(t.obj); // G.blocks에서 먼저 빠지면 tick의 제거 분기가 못 잡아 시체가 씬에 남던 버그 수정
    G.blocks.splice(G.blocks.indexOf(t),1);
    t.deadT=0.01;t.remove=true;
  }
}
function bossPhase(boss){
  // 죽을 때 소형 포자체 분열(2회까지): 문서의 머쉬넙 기믹 (초안)
  if(boss.phase<2){
    boss.phase++;
    for(let i=0;i<3;i++){
      const ang=i*2.1;
      spawnFoe('Blob',boss.obj.position.x+Math.sin(ang)*1.4,boss.obj.position.z+Math.cos(ang)*1.4);
    }
    const l=labelSprite('분열!','#ff9aa8',2.0);l.position.set(boss.obj.position.x,2.8,boss.obj.position.z);addFx(l,1.4);
  }
}
function storm(){
  const vis=G.enemies.filter(e=>e.hp>0&&!e.isBoss);
  const targets=vis.slice(0,6);
  if(G.boss&&G.boss.hp>0)targets.push(G.boss);
  for(const t of targets){
    const p=t.obj.position.clone();p.y=0.8;
    const top=p.clone();top.y=9;
    lightningFx(top,p);
    efkPlay('bolt',p,0.7,1.2);
    const p2=p.clone();p2.x+=0.35;const top2=top.clone();top2.x+=0.8;
    lightningFx(top2,p2);
    burst(p,0xffee55,10,3.6,0.4,0.5);
    damage(t,CFG.stormDmg);
  }
  const l=labelSprite('합성 마법!','#b37aff',2.8);l.position.set(G.squad.position.x,3.2,G.squad.position.z-2);addFx(l,1.6);
}

// ---------- input ----------
let dragging=false,lastPX=0;
function onDown(x){dragging=true;lastPX=x;}
function onMove(x){if(!dragging)return;const dx=(x-lastPX)/innerWidth*9;lastPX=x;
  G.x=THREE.MathUtils.clamp(G.x+dx,-CFG.dragClamp,CFG.dragClamp);}
function onUp(){dragging=false;}
renderer.domElement.addEventListener('pointerdown',e=>onDown(e.clientX));
addEventListener('pointermove',e=>onMove(e.clientX));
addEventListener('pointerup',onUp);
addEventListener('pointercancel',onUp);

// ---------- flow ----------
const $=id=>document.getElementById(id);
function preloadAssets(){ // 게임 플레이 중 로딩 지연이 없도록 전 에셋 예비 로드
  const urls=[...Object.values(CLASSES).map(c=>c.u),...Object.values(CLASSES).filter(c=>c.w).map(c=>c.w.u),
    ...Object.values(FOES).map(f=>f.u),BOSS.u,'env/chest_gold.glb',
    'forest/Tree_1_A_Color1.gltf','forest/Tree_2_E_Color1.gltf','forest/Tree_3_A_Color1.gltf',
    'forest/Bush_1_A_Color1.gltf','forest/Rock_1_A_Color1.gltf','forest/Grass_1_C_Color1.gltf','forest/Rock_2_B_Color1.gltf'];
  return Promise.all([...new Set(urls)].map(u=>loadG(A+u)));
}
async function init(){
  const pre=preloadAssets();
  await buildMeadow();
  G.squad=new THREE.Group();scene.add(G.squad);
  G.squad.position.set(0,0,0);
  for(const c of START_SQUAD)await spawnAlly(c);
  const stg=parseInt(new URLSearchParams(location.search).get('stage'))||1; // 테스트용 구간 건너뛰기
  if(stg>1){
    for(let i=0;i<3;i++)await spawnAlly(EXTRA_CYCLE[i%EXTRA_CYCLE.length]);G.extra=3;
    G.dmgMul=2.0;G.level=6;G.kills=40;
    G.squad.position.z=-CFG.stageLen*(stg-1);
  }
  if(WEAK)G.dmgMul=0.05;
  if(GAUGE0)G.gauge=GAUGE0;
  setStage(stg);
  try{await efkInit();}catch(e){console.warn('effekseer off:',e.message);efk=null;}
  await pre; // 전 에셋 예비 로드 완료 대기
  const sb=$('startBtn');sb.disabled=false;sb.textContent='게임 시작';
  sb.addEventListener('click',()=>{$('title').classList.add('hidden');G.state='play';});
  $('retryBtn').addEventListener('click',()=>location.reload());
  requestAnimationFrame(tick);
}
function endGame(win){
  G.state=win?'win':'lose';
  $('endTitle').textContent=win?'1지역 클리어!':'방어선 돌파';
  $('endBody').innerHTML=win
    ?`시작의 들판 5구간을 돌파했습니다.<br>처치 ${G.kills} · 레벨 ${G.level} · 대원 ${G.allies.length}명<br>(수직 슬라이스 · 수치는 초안입니다)`
    :`적이 방어선을 넘었습니다.<br>처치 ${G.kills} · 스테이지 1-${G.stage}`;
  $('end').classList.remove('hidden');
  if(win)G.allies.forEach(u=>{if(u.acts.Cheer){Object.values(u.acts).forEach(a=>a.stop());u.acts.Cheer.play();}});
}

// ---------- update ----------
let last=performance.now(),fpsEMA=60;
// ---------- Effekseer 연동 (sigco3111/effekseer-ko; 런타임 MIT, 샘플 효과 CC0) ----------
// src/player.js(MIT, Patch)의 three.js 래퍼를 이 게임 구조에 맞게 옮김. 실패 시 자체 효과만 사용.
let efk=null;
async function efkInit(){
  if(!window.effekseer)return;
  const gl=renderer.getContext();
  await new Promise((res,rej)=>window.effekseer.initRuntime('./assets/effekseer/effekseer.wasm',res,()=>rej(new Error('wasm load failed'))));
  const ctx=window.effekseer.createContext();
  ctx.init(gl,{instanceMaxCount:16000,squareMaxCount:48000});
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  const eff={};
  const loads=[['hit','./assets/effekseer/effects/andrewfm/hit_eff.efk'],
               ['fire','./assets/effekseer/effects/andrewfm/fire.efk'],
               ['bolt','./assets/effekseer/effects/pierre-1/LightningStrike.efk']];
  await Promise.all(loads.map(([id,url])=>new Promise((res,rej)=>{
    ctx.loadEffect(url,1,e=>{eff[id]=e;res();},(w,p)=>rej(new Error(url+' '+w+' '+(p||''))));})));
  efk={ctx,eff};
}
function efkPlay(id,pos,scale=1,speed=1){
  if(!efk||!efk.eff[id])return null;
  const h=efk.ctx.play(efk.eff[id],pos.x,pos.y,pos.z);
  if(scale!==1)h.setScale(scale,scale,scale);
  if(speed!==1)h.setSpeed(speed);
  return h;
}

function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min(0.25,(now-last)/1000);last=now;
  fpsEMA=fpsEMA*0.95+(1/Math.max(dt,1e-4))*0.05;
  if(G.state==='play')update(dt);
  // camera follows squad
  cam.position.set(G.squad?G.squad.position.x*0.4:0,17,(G.squad?G.squad.position.z:0)+13.5);
  cam.lookAt(G.squad?G.squad.position.x*0.3:0,0,(G.squad?G.squad.position.z:0)-6);
  if(G.defLineMesh)G.defLineMesh.position.set(0,0.035,(G.squad?G.squad.position.z:0)+CFG.defLine);
  renderer.render(scene,cam);
  if(efk){ // Effekseer 효과를 three 위에 같은 카메라로 그림
    efk.ctx.update(dt*60);
    const gl=renderer.getContext();
    efk.ctx.setProjectionMatrix(cam.projectionMatrix.elements);
    efk.ctx.setCameraMatrix(cam.matrixWorldInverse.elements);
    gl.useProgram(null);
    efk.ctx.draw();
    renderer.resetState();
  }
}
function update(dt){
  dt*=TS;
  // advance (통로 진행은 보스전에도 멈추지 않음)
  G.squad.position.z-=CFG.fwdSpeed*dt;
  G.squad.position.x+=(G.x-G.squad.position.x)*Math.min(1,dt*10);
  const sq=G.squad.position;
  // stage spawning
  G.layout.forEach((e,i)=>{
    if(G.spawned.has(i))return;
    if(e.z<sq.z-28)return;
    G.spawned.add(i);
    if(e.type==='foe'){if(!BOSSONLY)spawnFoe(e.foe,e.x,e.z);}
    else if(e.type==='boss')spawnFoe(null,e.x,e.z,true);
    else if(!BOSSONLY)spawnBlock(e.type,e.x,e.z);
  });
  // stage clear
  const ahead=G.stage<5 && sq.z<G.stageZ0-CFG.stageLen+6;
  const clearOfFoes=G.enemies.length===0;
  if(ahead&&clearOfFoes)setStage(G.stage+1);
  // allies
  for(const u of G.allies){
    u.mixer.update(dt);
    u.cd-=dt;
    if(u.cd<=0){const t=nearestTarget(u);
      if(t){u.cfg.kind==='cleave'?cleave(u,t):fireBolt(u,t);u.cd=u.cfg.cd;}}
  }
  // foes
  for(const e of [...G.enemies]){
    e.mixer.update(dt);
    if(e.deadT!=null){e.deadT-=dt;
      if(e.deadT<=0){scene.remove(e.obj);G.enemies.splice(G.enemies.indexOf(e),1);
        if(e.isBoss)G.boss=null;}
      continue;}
    e.obj.position.z+=e.cfg.spd*dt;
    if(e.hitT>0)e.hitT-=dt;
    if(e.obj.position.z>sq.z+CFG.defLine){ // 방어선 돌파
      if(e.isBoss){endGame(false);return;} // 보스 돌파는 즉시 패배
      scene.remove(e.obj);G.enemies.splice(G.enemies.indexOf(e),1);
      G.lives--;
      const l=labelSprite('돌파!','#ff6666',1.8);l.position.set(e.obj.position.x,1.5,sq.z+1);addFx(l,1.2);
      if(G.lives<=0){endGame(false);return;}
    }
  }
  if(G.stage===5&&G.bossDead&&G.enemies.length===0){endGame(true);return;}
  // blocks hitT
  for(const b of [...G.blocks]){if(b.hitT>0)b.hitT-=dt;
    if(b.hpNum){const s=b.hpNum.sprite.scale.x+(1.5-b.hpNum.sprite.scale.x)*Math.min(1,dt*10);b.hpNum.sprite.scale.set(s,s,1);}
    const tag=b.obj.userData.tag;
    if(tag&&tag.visible){const dz=b.obj.position.z-sq.z; // 부대가 지나친(공격/선택 구간 밖) 보상 라벨은 숨김
      if(dz>-1.0)tag.visible=false;}
    if(b.remove)scene.remove(b.obj);}
  // projectiles
  for(const p of [...G.projs]){
    if(!p.target||p.target.hp<=0){scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);continue;}
    const tp=p.target.obj.position.clone();tp.y=0.8;
    const d=tp.clone().sub(p.mesh.position);const dist=d.length();
    const step=p.speed*dt;
    if(dist<=step+0.15){
      const col=p.kind==='fire'?0xff7a2a:p.kind==='shard'?0x66ccff:0xffe27a;
      spark(tp,col,p.kind==='fire'?2.8:1.9,0.32);
      burst(tp,col,p.kind==='fire'?22:16,p.kind==='fire'?5.0:4.2,0.5,p.kind==='fire'?0.75:0.6);
      if(p.kind==='fire')efkPlay('fire',tp,0.5,1.4);else efkPlay('hit',tp,0.5,1.4);
      damage(p.target,p.dmg);
      scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);
    }else{p.mesh.position.addScaledVector(d.normalize(),step);
      p.trailT=(p.trailT||0)-dt;
      if(p.trailT<=0){p.trailT=0.03;const t=glow(p.color||0xffffff,0.5,0.5);t.position.copy(p.mesh.position);addFx(t,0.18);}}
  }
  // gauge storm
  if(G.gauge>=100){G.gauge=0;storm();}
  // fx
  for(const f of [...fx]){f.t-=dt;
    if(f.vel){f.vel.y+=(f.grav||0)*dt;f.obj.position.addScaledVector(f.vel,dt);}
    if(f.fade&&f.obj.material)f.obj.material.opacity=Math.max(0,f.t/f.ttl);
    if(f.t<=0){scene.remove(f.obj);fx.splice(fx.indexOf(f),1);}}
  // HUD
  $('hearts').textContent='♥'.repeat(Math.max(0,G.lives))+'♡'.repeat(Math.max(0,CFG.lives-G.lives));
  $('squadN').textContent=G.allies.length;
  $('lv').textContent=G.level;
  $('kills').textContent=G.kills;
  $('gaugeFill').style.width=G.gauge+'%';
  $('gaugePct').textContent=Math.round(G.gauge)+'%';
  $('fps').textContent=Math.round(fpsEMA)+' fps · 초안';
}
init().catch(e=>{console.error(e);window.__err=String(e.stack||e);});
