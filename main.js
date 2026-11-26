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
function ring(color,r1,op=0.9){const g=new THREE.RingGeometry(r1*0.72,r1,36);const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false});
  const o=new THREE.Mesh(g,m);o.rotation.x=-Math.PI/2;return o;}
function discShadow(r){const m=new THREE.Mesh(new THREE.CircleGeometry(r,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.y=0.02;return m;}
function norm(n){return (n||'').toLowerCase().replace(/[^a-z]/g,'');}
function findNode(root,pat){let hit=null;root.traverse(o=>{if(!hit&&pat.test(norm(o.name)))hit=o;});return hit;}
function hideWeapons(root){root.traverse(o=>{if(o.isMesh&&/sword|shield|dagger|axe|staff|bow|crossbow|wand|spear|quiver|spellbook|knife|mug/.test(norm(o.name)))o.visible=false;});}
function labelSprite(text,color='#ffffff',w=2.2,ttl=1.4){
  const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
  g.font='700 54px Orbitron,Pretendard,"Noto Sans KR",sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=9;g.strokeStyle='rgba(0,0,0,0.8)';g.strokeText(text,256,64);g.fillStyle=color;g.fillText(text,256,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false}));
  s.scale.set(w,w*0.25,1);return s;}

function comboSprite(txt,color,w){ // 콤보 전용: 큰 볼드 + 색 글로우 + 팝 애니(기하·텍스트만, 자체 이펙트 아님)
  const c=document.createElement('canvas');c.width=512;c.height=160;const g=c.getContext('2d');
  g.font='800 92px Orbitron,Pretendard,"Noto Sans KR",sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.shadowColor=color;g.shadowBlur=30;g.fillStyle=color;g.fillText(txt,256,80);g.shadowBlur=0; // 색 글로우 베이스
  g.lineWidth=18;g.strokeStyle='rgba(15,8,0,0.95)';g.strokeText(txt,256,80); // 검정 외곽선
  g.fillStyle='#ffffff';g.fillText(txt,256,80); // 마지막 패스: 불투명 흰 심지 — 색 덧칠 없음(황토 배경 대비)
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false}));
  sp.scale.set(w,w*0.3125,1);return sp;}
function makeNumSprite(n){ // 블록 잔여 수치를 큰 숫자로 표시(원작 스타일)
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false}));
  s.scale.set(1.5,1.5,1);
  const o={sprite:s,c,tex:t};
  drawNum(o,n);return o;}
function fmtNum(n){n=Math.max(0,Math.ceil(+n||0));if(n<10000)return String(n);if(n<1e6)return (n/1000>=100?Math.round(n/1000):(Math.round(n/100)/10))+'k';return (Math.round(n/1e5)/10)+'M';} // 9,999 넘으면 k
function drawNum(o,n,col){
  const g=o.c.getContext('2d');g.clearRect(0,0,256,256);const txt=fmtNum(n);
  const px=txt.length<=3?130:txt.length===4?108:txt.length===5?88:74; // 자릿수에 맞춰 글자 크기 축소 — 잘림 방지
  g.font='800 '+px+'px Orbitron,Pretendard,"Noto Sans KR",sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=Math.round(px/8);g.strokeStyle='rgba(0,0,0,0.85)';g.strokeText(txt,128,134);g.fillStyle=col||'#ffffff';g.fillText(txt,128,134);
  o.tex.needsUpdate=true;}

// transient effects
const fx=[];
function addFx(obj,ttl,fade=true){scene.add(obj);const e={obj,t:ttl*FXSLOW,ttl:ttl*FXSLOW,fade};fx.push(e);return e;}
let __glowTex=null;
function glowSprite(color,w){ // 투사체 존재감용 소형 광원 스프라이트(단순 직접 제작 — 부모 10:42 승인 범위)
  if(!__glowTex){const c2=document.createElement('canvas');c2.width=c2.height=64;const g2=c2.getContext('2d');
    const gr=g2.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'rgba(255,255,255,0.9)');gr.addColorStop(0.4,'rgba(255,255,255,0.35)');gr.addColorStop(1,'rgba(255,255,255,0)');
    g2.fillStyle=gr;g2.fillRect(0,0,64,64);__glowTex=new THREE.CanvasTexture(c2);__glowTex.colorSpace=THREE.SRGBColorSpace;}
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:__glowTex,color,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false}));
  sp.scale.set(w,w,1);return sp;}
function sparkBurst(color,s=1){ // 링 없는 명중 스파크: 방사형 짧은 선조(기하만 — 부모 10:42 승인 범위)
  const g=new THREE.Group();const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.random()*0.3;const len=(0.4+Math.random()*0.25)*s;
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.042,0.042,len),mat);
    m.position.set(Math.sin(a)*0.26*s,0,Math.cos(a)*0.26*s);m.rotation.y=a;g.add(m);}
  const up=new THREE.Mesh(new THREE.BoxGeometry(0.042,0.5*s,0.042),mat);g.add(up);
  g.userData.mat=mat;return g;}
// 자체 제작 전투 이펙트(spark/burst/lightningFx)는 제거 — 전투 효과는 Effekseer 샘플만 사용

// ---------- config (수치 전부 초안) ----------
const CFG={
  fwdSpeed:1.7, dragClamp:2.1, defLine:2.6,
  lives:3, killsPerLevel:8, levelMul:1.15,
  stageLen:55,
};
const CLASSES={
  Knight:{u:'Knight.glb',s:0.47,dmg:6,cd:0.9,range:9.5,kind:'bolt',color:0xffe27a,hitEfk:'hit',fxScale:0.22,fxSpeed:2.1,anim:'1H_Melee_Attack_Stab',w:{slot:'handslotr',u:'weapons/spear_A.gltf'}},
  Barbarian:{u:'Barbarian.glb',s:0.40,dmg:14,cd:1.25,range:9.5,kind:'wave',color:0xff7a2a,hitEfk:'hit',fxScale:0.1,fxSpeed:2.4,anim:'2H_Melee_Attack_Spin'}, // hit로 교체: ember 잔여 화염이 다중 명중 피크에서 누적되는 문제 차단
  Rogue:{u:'Rogue.glb',s:0.47,dmg:4,cd:0.55,range:10.5,kind:'shard',color:0x9fdcff,hitEfk:'cold',fxScale:0.11,fxSpeed:2.6,anim:'2H_Ranged_Shoot',w:{slot:'handslotl',u:'weapons/bow_A_withString.gltf'}},
  Mage:{u:'Mage.glb',s:0.38,dmg:9,cd:1.15,range:10.5,kind:'fire',color:0xff7a2a,hitEfk:'flame',fxScale:0.11,fxSpeed:2.8,anim:'Spellcast_Shoot',w:{slot:'handslotr',u:'weapons/wand.gltf'}},
};
CLASSES.Rogue_Hooded={...CLASSES.Rogue,u:'Rogue_Hooded.glb',color:0xc79fff,hitEfk:'aura',homing:true,fxScale:0.13}; // 특수 유닛만 유도 탄(사용자 결정 20:02)
const START_SQUAD=['Knight','Knight','Knight','Knight']; // 통일 부대(사용자 07:36): 시작 나이트 4명
// 매 인원 성장(시제품 수치 초안): [도달 인원, 변화] 누적 — 전 단계가 눈에 보이는 변화(탄 수/리듬/부채꼴/관통/폭/범위/특성)
const GROWTH_DEF={s:1,burst:1,fan:0,pierce:3,rate:1,dmg:1,big:0,aoe:0,wave:0,waveW:1,knock:1,aux:0};
const GROWTH={ // 탄수 초반 가속(사용자 07:44 "5명까지 탄 수"·매 1명 즉시 체감) — 총화력은 REF_S로 기존 곡선에 정규화
 Knight:[[4,{s:3}],[5,{s:4,burst:2}],[6,{s:5,fan:6}],[7,{s:6,pierce:4}],[8,{fan:9}],[9,{s:7}],[10,{big:1,dmg:1.3}],[11,{s:8}],[12,{pierce:6}],[13,{burst:3}],[14,{pierce:8}],[15,{pierce:99,dmg:1.6}],[16,{burst:4}]], // 탄수 우선(가값)
 Rogue:[[4,{burst:2,s:2}],[5,{rate:0.8}],[6,{s:3}],[7,{burst:3}],[8,{rate:0.68}],[9,{s:4,fan:8}],[10,{burst:4,rate:0.62,dmg:1.2}],[11,{rate:0.50}],[12,{pierce:5,s:5}],[13,{burst:5}],[14,{fan:10}],[15,{rate:0.4,dmg:1.3,s:6}],[16,{fan:12}]], // 연사 우선(가값)
 Mage:[[4,{s:2,aoe:0.5}],[5,{aoe:0.7}],[6,{fan:10}],[7,{s:3,aoe:0.9}],[8,{aoe:1.0}],[9,{aoe:1.2,fan:12}],[10,{pierce:2,dmg:1.3}],[11,{fan:14}],[12,{s:4,aoe:1.3}],[13,{aoe:1.4}],[14,{s:5,fan:16}],[15,{aoe:1.5,dmg:1.4}],[16,{s:6,fan:18}]], // 폭발 우선(가값)
 Barbarian:[[4,{wave:5}],[5,{waveW:1.3,s:2,fan:12}],[6,{wave:6.5}],[7,{knock:2}],[8,{waveW:1.6,s:3,fan:16}],[9,{wave:8,dmg:1.1}],[10,{burst:2,dmg:1.3}],[11,{waveW:1.9,dmg:1.2,s:4,fan:20}],[12,{wave:10,dmg:1.28}],[13,{s:5,knock:3}],[14,{waveW:2.4,s:5,fan:24}],[15,{wave:12,dmg:1.4}],[16,{burst:3}]], // 파동 우선(가값)
 Rogue_Hooded:[[4,{s:2}],[5,{burst:2}],[6,{s:3,rate:0.92}],[7,{fan:8}],[8,{rate:0.85}],[9,{s:4,dmg:1.15}],[10,{aux:1}],[11,{fan:10}],[12,{s:5,aux:2}],[13,{rate:0.72}],[14,{dmg:1.2,burst:3}],[15,{rate:0.62,s:6}],[16,{aux:3}]], // 혼합(가값)
};
const REF_S={Knight:[0,1,1,1,2,2,3,3,3,4,4,5,5,5,6,6,7],Rogue:[0,1,1,1,1,1,2,2,2,3,3,3,3,3,4,4,5],Mage:[0,1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,5],Barbarian:[0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],Rogue_Hooded:[0,1,1,1,2,2,2,3,3,3,3,4,4,4,5,5,5]}; // 정규화 기준: 이전 탄수 곡선(총화력 유지용)
function fxTier(){const p=G.dmgMul*(growth(G.cls,G.allies.length).dmg||1);return p>=3?3:p>=1.6?2:1;} // 성장형 타격FX 단계(가값 임계치 — 단계 비교 검증 후 조정)
// 병종별 고정 총 타격 폭/사거리(제안서): 폭에는 폭발 반경·파동 폭이 포함, 성장해도 이 상자를 넘지 않음
const ENV={Knight:{w:1.2,r:14},Rogue:{w:1.8,r:12},Mage:{w:2.6,r:8},Barbarian:{w:3.6,r:5},Rogue_Hooded:{w:2.0,r:11},
  Ranger:{w:3.0,r:6},Glaive:{w:1.6,r:10},Sorcerer:{w:3.0,r:12,l:0.7},FrostLancer:{w:1.0,r:15},Pyro:{w:2.4,r:4},Prism:{w:0.8,r:16},Artillery:{w:2.8,r:13,l:0.4}}; // l=조준 레인 반폭 고정(없으면 w/2−폭발/파동). 연쇄·폭발은 이 레인 밖으로 조준선±1.5/반경 1.0까지만
for(const k in ENV)if(CLASSES[k])CLASSES[k].range=ENV[k].r;
function growth(cls,n){const g={...GROWTH_DEF};for(const [k,v] of (GROWTH[cls]||[]))if(n>=k)Object.assign(g,v);
  const e=ENV[cls];if(e){g.aoe=Math.min(g.aoe||0,e.w/2-0.4);g.wave=Math.min(g.wave||0,e.r);g.waveW=Math.min(g.waveW,(e.w/2-0.35)/0.55);}
  return g;}
function envHalf(cls,gr){const e=ENV[cls];if(!e)return 9;if(e.l)return e.l;return Math.max(0.35,e.w/2-(gr.aoe||0)-(cls==='Barbarian'?0.55*gr.waveW:0));}
const CAPTIVE_CYCLE=['Mage','Rogue','Barbarian','Rogue_Hooded','Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism','Artillery']; // 구출 감옥 순환(현재 병종 제외는 스폰 시 결정)
const EXTRA_CYCLE=['Rogue_Hooded','Mage','Knight','Barbarian','Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism','Artillery'];
// ---- 7개 신규 병종(제안서 12종 중 신규): 모델은 기존 5종 재사용(무기·색만 다름), 공격 방식은 고유 ----
const _B=(b,o)=>({...CLASSES[b],...o});
CLASSES.Ranger=_B('Rogue',{kind:'spread',dmg:7,cd:1.0,range:6.5,color:0x8fe08a,hitEfk:'hit',fxScale:0.11,fxSpeed:2.6,maxD:6.5});
CLASSES.Glaive=_B('Barbarian',{kind:'boomerang',dmg:8,cd:1.4,range:10,color:0xffc84a,hitEfk:'hit',fxScale:0.12,fxSpeed:2.4,anim:'2H_Melee_Attack_Slice'});
CLASSES.Sorcerer=_B('Mage',{kind:'chain',dmg:6,cd:1.1,range:10,color:0xbfe6ff,hitEfk:'hit',fxScale:0.14,fxSpeed:2.6});
CLASSES.FrostLancer=_B('Knight',{kind:'lance',dmg:5,cd:0.8,range:15,color:0x7fd8ff,hitEfk:'cold',fxScale:0.11,fxSpeed:2.6});
CLASSES.Pyro=_B('Mage',{kind:'flame',dmg:3,cd:0.3,range:4,color:0xff8a2a,hitEfk:'hit',fxScale:0.1,fxSpeed:2.6});
CLASSES.Prism=_B('Rogue_Hooded',{kind:'beam',dmg:2.2,cd:0.25,range:16,color:0xe6c8ff,hitEfk:'hit',fxScale:0.1,fxSpeed:2.6,homing:false});
CLASSES.Artillery=_B('Barbarian',{kind:'lob',dmg:9,cd:1.8,range:13,color:0xffd27a,hitEfk:'hit',fxScale:0.14,fxSpeed:2.4,anim:'2H_Melee_Attack_Chop'});
for(const k of ['Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism','Artillery'])GROWTH[k]=[[8,{dmg:1.2}],[12,{dmg:1.4}],[16,{dmg:1.6}]];
for(const k in ENV)if(CLASSES[k]&&CLASSES[k].range!==ENV[k].r&&['Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism','Artillery'].includes(k))CLASSES[k].range=ENV[k].r;
const SPECIAL_KINDS=new Set(['boomerang','chain','lance','flame','beam','lob']);

const CLS_KO2={Ranger:'레인저',Glaive:'글레이브',Sorcerer:'소서러',FrostLancer:'프로스트 랜서',Pyro:'파이로',Prism:'프리즘 사수',Artillery:'포격수'};
const CLS_KO={...CLS_KO2,Knight:'나이트',Barbarian:'바바리안',Rogue:'로그',Mage:'메이지',Rogue_Hooded:'후드 로그'};
const FOES={
  Warrior:{u:'Skeleton_Warrior.glb',hp:26,spd:1.35,s:0.56,rr:0.6},
  Minion:{u:'Skeleton_Minion.glb',hp:16,spd:2.05,s:0.56,rr:0.5},
  Rogue:{u:'Skeleton_Rogue.glb',hp:20,spd:1.7,s:0.56,rr:0.55},
  Mage:{u:'Skeleton_Mage.glb',hp:18,spd:1.25,s:0.56,rr:0.55},
  Blob:{u:'blob/GreenBlob.gltf',hp:10,spd:2.6,s:0.35,rr:0.4,gltf:true},
};
let TS=parseFloat(new URLSearchParams(location.search).get('ts'))||1; // 테스트용 시간배율(전체 균일)
window.__setTS=v=>{TS=v;}; // 시연: 실행 중 배율 변경 훅
window.__convert=c=>convertSquad(c); // 시연: 전환 훅
window.__setN=async n=>{n=Math.max(1,Math.min(16,n|0));while(G.allies.length>n){const u=G.allies.pop();G.squad.remove(u.obj);}while(G.allies.length<n)await spawnAlly(G.cls);}; // 테스트: 인원 수 직접 설정
window.__resetMul=()=>{G.dmgMul=1;}; // 테스트: 공격력 배율 초기화
window.__boltDemo=(spd=6)=>{ // 시연: 실제 탄체 메시의 저속 비행 확인용(모양·궤적 전용)
  const mk=(kind,color,x,z)=>{const grp=new THREE.Group();let mesh;
    if(kind==='shard'){mesh=new THREE.Mesh(new THREE.ConeGeometry(0.09,1.8,6),new THREE.MeshBasicMaterial({color}));mesh.rotation.x=-Math.PI/2;}
    else{mesh=new THREE.Mesh(new THREE.OctahedronGeometry(0.16),new THREE.MeshBasicMaterial({color}));mesh.scale.set(0.8,0.8,12.0);}
    grp.add(mesh);grp.position.set(x,1.0,z);scene.add(grp);
    G.projs.push({mesh:grp,target:null,owner:{cfg:{},fxT:9},dmg:0,speed:spd,kind,color,hitEfk:'hit',vel:new THREE.Vector3(0,0,-spd),maxDist:40,traveled:0,pierce:99,hitSet:new Set()});};
  const sz=G.squad?G.squad.position.z:0;mk('bolt',0xffe27a,-0.8,sz-3);mk('shard',0x9fdcff,0,sz-1.5);mk('bolt',0xffe27a,0.8,sz);};
const WEAK=new URLSearchParams(location.search).has('weak'); // 패배 경로 테스트용
const BOSSONLY=new URLSearchParams(location.search).has('bossonly'); // 보스 돌파 경로 단독 검증용
const FXSLOW=parseFloat(new URLSearchParams(location.search).get('fxslow'))||1; // 이펙트 수명 배율(캡처 전용, 외형 불변)
const NOFX=new URLSearchParams(location.search).has('nofx'); // 로직 회귀 전용: 효과 재생/그리기 생략
const NODRAW=new URLSearchParams(location.search).has('nodraw'); // 검증 전용: WebGL 그리기 생략(로직·DOM HUD는 실시간 동작) — 헤드리스 CSS 애니메이션 계측용
const FXLIST=new URLSearchParams(location.search).get('fxlist');
const NUMFX=parseInt(new URLSearchParams(location.search).get('numfx')||'1',10); // 시연: 숫자 차감 강조
const DART=!!new URLSearchParams(location.search).get('dart'); // 시연: 원작식 빠른 직사 연사감
const PSPD=DART?58:30; // 효과 청취 전용: id=경로,id=경로
const BOSS={u:'bosses/Mushnub_Evolved.gltf',hp:520,spd:1.9,s:0.95,rr:1.3,gltf:true};

// ---------- state ----------
const G={state:'title',stage:1,lives:CFG.lives,kills:0,level:1,dmgMul:1,statV:0,statB:0,statH:0,statX:0,
  squad:null,cls:'Knight',allies:[],enemies:[],blocks:[],projs:[],stageZ0:0,spawned:new Set(),extra:0,waveGrps:{},vcd:0,burstLeft:0,burstT:0,fxT:0,combo:0,comboT:0,
  layout:[],boss:null,x:0};
window.__game=G;
Object.defineProperty(G,'fps',{get:()=>Math.round(fpsEMA)});
Object.defineProperty(G,'summary',{get:()=>({state:G.state,stage:G.stage,lives:G.lives,squad:G.allies.length,enemies:G.enemies.length,blocks:G.blocks.length,kills:G.kills,level:G.level,x:+G.x.toFixed(2),fps:Math.round(fpsEMA),bossHp:G.boss?Math.round(G.boss.hp):null})});
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
  G.allies.forEach((u,i)=>{u.obj.visible=i<9; // 표시 모델 최대 9 — 병력 수는 숫자(대원 N)로, 화력은 병력 곡선

    if(i===0){u.obj.position.set(0,0,-0.35);return;} // 선두
    const r=Math.min(1.5,0.62+0.42*Math.sqrt(i));
    const a=i*2.399;
    u.obj.position.set(Math.cos(a)*r,0,-0.35+Math.sin(a)*r*0.78);
  });
}

async function spawnFoe(type,x,z,isBoss=false,wave){
  const f=isBoss?BOSS:FOES[type];
  const hscale=1.28**(G.stage-1); // 원작 tide hs=1.3^(단계-1) 참고: 진행할수록 적 체력 증가
  const sscale=isBoss?1:Math.min(1.5,1+0.07*(G.stage-1)); // 원작 참고: 단계가 갈수록 적 이동 가속
  const {root,anims}=await makeModel(A+f.u,f.s,isBoss?null:[1.05,0.8,0.8]);
  root.position.set(x,0,z);root.rotation.y=0;
  const unit={kind:'foe',type,isBoss,hp:Math.round(f.hp*hscale),maxHp:Math.round(f.hp*hscale),cfg:f,spd:f.spd*sscale,obj:root,hitT:0,...makeMixer(root,anims)};
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
  if(wave!=null){ // 적 무리 머리 위에 남은 총체력 숫자 표시(상자 수치와 같은 의미: 소멸까지 필요한 총 대미지)
    const key=G.stage+':'+wave;
    let g=G.waveGrps[key];
    if(!g){g={hp:0,maxHp:0,members:new Set(),num:makeNumSprite(0)};g.num.sprite.position.set(x,2.9,z);scene.add(g.num.sprite);G.waveGrps[key]=g;}
    g.members.add(unit);g.hp+=unit.maxHp;g.maxHp+=unit.maxHp;drawNum(g.num,Math.ceil(g.hp));
    unit.wave=key;unit.wgrp=g;}
  if(isBoss){G.boss=unit;unit.phase=0;}
  return unit;
}

async function spawnBlock(kind,x,z){
  const grp=new THREE.Group();grp.position.set(x,0,z);
  if(kind==='chest'){
    const g=await loadG(A+'env/chest_gold.glb');const r=g.scene.clone();r.scale.setScalar(0.45);grp.add(r);
    const cls=G.cls; // 통일 부대: 상자는 현재 병종 대원 보충
    const tag=labelSprite(`대원 +1 ${CLS_KO[cls]}`,'#ffd966',2.9);tag.position.y=2.1;grp.add(tag);
    grp.userData.rewardCls=cls;grp.userData.tag=tag;
  }else if(kind==='captive'){
    const cls=CAPTIVE_CYCLE[(G.stage+G.extra)%CAPTIVE_CYCLE.length];G.extra++;
    const {root}=await makeModel(A+CLASSES[cls].u,CLASSES[cls].s);root.position.y=0.05;root.rotation.y=Math.PI;grp.add(root);
    const cage=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,1.5,10,1,true),new THREE.MeshBasicMaterial({color:CLASSES[cls].color,transparent:true,opacity:0.28,side:THREE.DoubleSide,depthWrite:false}));
    cage.position.y=0.75;grp.add(cage);
    const tag=labelSprite(`구출: ${CLS_KO[cls]}`,'#c9a2ff',2.9);tag.position.y=2.3;grp.add(tag);
    grp.userData.rewardCls=cls;grp.userData.tag=tag;
  }else{
    const cry=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.9,0.5),new THREE.MeshStandardMaterial({color:0x66e0ff,emissive:0x2288cc,emissiveIntensity:1.6,roughness:0.2}));
    cry.position.y=0.55;cry.rotation.y=Math.PI/4;grp.add(cry);
    const tag=labelSprite('공격력 +20%','#9fe8ff',2.6);tag.position.y=2.1;grp.add(tag);
    grp.userData.tag=tag;
  }
  grp.add(discShadow(0.5));
  const bhp=Math.round(REC_DPS*(1.3**(G.stage-1))*6); // 구간 권장 화력 x 약 6초, 스폰 시점 고정(현재 공격 배율과 무관 — 제안서) // 원작 참고: 진행할수록 상자 수치 증가
  const unit={kind:'block',btype:kind,hp:bhp,maxHp:bhp,obj:grp,hitT:0};
  const num=makeNumSprite(bhp);num.sprite.position.y=1.55;grp.add(num.sprite);unit.hpNum=num;
  scene.add(grp);G.blocks.push(unit);
}

// ---------- stage layout ----------
function stageLayout(n){
  const L=[];const z0=-CFG.stageLen*(n-1);
  if(n<5){
    const foeTypes=['Warrior','Minion','Rogue','Mage'];
    [19,25,31,37,43,49,55,61].forEach((dz,w)=>{ // 원작 참고: 파도 수·밀도 상향(더 빨리 더 많이), 첫 파도는 접촉 여유 확보
      const cnt=3+n;
      const cx=[-1.4,1.6,-0.6,1.2,-1.8,0.9,-1.2,1.7][w%8]; // 원작처럼 파도가 통로 이곳저곳에 뭉쳐 나옴 — 가만히 서 있으면 맞지 않는 파도가 생김
      for(let i=0;i<cnt;i++){
        const t=foeTypes[(w+i+n)%4];
        L.push({dz:dz+ (i%2)*1.6, type:'foe',foe:t,x:cx+((i*47)%10)/10*1.4-0.7,wave:w});
      }
    });
    L.push({dz:12,type:'chest',x:-1.5});
    L.push({dz:26,type:'crystal',x:-1.6});
    L.push({dz:38,type:'chest',x:1.6}); // 상자 2개/구간으로 보상 간격 축소
    L.push({dz:50,type:'captive',x:n%2?1.7:-1.7}); // 구간당 감옥 1개, 통로 가장자리(회피 가능)
  }else{
    L.push({dz:8,type:'foe',foe:'Warrior',x:0.9,wave:0});
    L.push({dz:11,type:'foe',foe:'Minion',x:1.8,wave:0});
    L.push({dz:15,type:'foe',foe:'Rogue',x:1.2,wave:1});
    L.push({dz:19,type:'foe',foe:'Minion',x:0.6,wave:1});
    L.push({dz:21,type:'foe',foe:'Mage',x:1.7,wave:2});
    L.push({dz:23,type:'foe',foe:'Minion',x:0.8,wave:2});
    L.push({dz:25,type:'boss',x:0,wave:'boss'});
  }
  L.forEach(e=>e.z=z0-e.dz);
  return L;
}
function setStage(n){
  G.stage=n;G.layout=stageLayout(n);G.spawned=new Set();G.stageZ0=-CFG.stageLen*(n-1);
  document.getElementById('stageName').textContent=`1-${n} · 시작의 들판`;
}

// ---------- combat ----------
function corridorK(){const gr=growth(G.cls,G.allies.length);return 0.08+Math.tan((gr.fan||0)*Math.PI/360);} // 사선대 기울기: 기본 0.08 + 성장 부채꼴 반각
function corridorW(dz){return Math.min(0.6+Math.max(0,dz)*corridorK(),envHalf(G.cls,growth(G.cls,G.allies.length)));} // 사선대 반폭 — 조준·발사·충돌·가이드 표시가 같은 기하에서 파생
function squadTarget(c){ // 부대 중심 기준, 사선대 안 가장 가까운 대상(적·블록·감옥 동일 규칙)
  const sx=G.squad.position.x,sz=G.squad.position.z;
  let best=null,bd=1e9;
  const consider=(o,bias=0)=>{
    const p=o.obj.position;const dz=sz-p.z;
    if(p.z>sz-0.3)return;
    const tol=corridorW(dz);
    if(Math.abs(p.x-sx)>tol)return;
    const d=Math.hypot(p.x-sx,dz)-bias;
    if(d<bd){bd=d;best=o;}
  };
  for(const e of G.enemies)if(e.hp>0&&e.deadT==null)consider(e);
  for(const b of G.blocks)if(b.hp>0)consider(b,1.5);
  if(bd>c.range)return null;
  return best;
}
const REC_DPS=5; // 구간1 권장 초당 화력(가값): 30 = 5 x 6초
const FORCE=n=>1.6*(0.7+0.3*Math.min(16,Math.max(1,n))); // 가값: 이중 적용 제거분 보정
function fireVolley(c,n,gr){ // 일제사격 1회: gr.s갈래 부채꼴, 인원은 발당 피해로 환산
  const t=squadTarget(c);if(!t)return;
  G.statV++;
  const sq=G.squad.position;
  const from=new THREE.Vector3(sq.x,1.0,sq.z-0.6);
  const tp=t.obj.position.clone();tp.y=0.8;
  const base=Math.atan2(tp.x-from.x,-(tp.z-from.z)); // 전방 0 기준 좌우 각
  const fan=(gr.fan||0)*Math.PI/180;
  const perDmg=c.dmg*G.dmgMul*gr.dmg*FORCE(n)/(c.kind==='wave'?1:gr.s); // 총 화력 = 병종 기본 x 병력 곡선 1회 적용(REF_S 이중 적용 제거) — 계수는 가값
  if(SPECIAL_KINDS.has(c.kind)){fireSpecial(c,gr,t,from,tp,perDmg,n);for(const u of G.allies)playOnce(u,c.anim,'Walking_A');return;}
  if(c.kind==='spread'){const half=14*Math.PI/180;G.statV+=0;for(let i=0;i<7;i++){const ang=base+(i/6-0.5)*2*half;spawnVolleyBolt(c,{...gr,s:7},from,ang,perDmg*0.45,n,true);}efkPlay('hit',from,0.15,2.2);for(const u of G.allies)playOnce(u,c.anim,'Walking_A');return;}
  const dzT=Math.max(0.5,from.z-tp.z),angMax=Math.atan2(corridorW(dzT),dzT); // 탄 궤적이 사선대를 벗어나지 않게 발사각 제한
  for(let i=0;i<gr.s;i++){
    let off=gr.s>1?(i/(gr.s-1)-0.5)*fan:0;
    if(gr.s%2===0&&i===(gr.s>>1)-1)off=0; // 짝수 갈래: 한 발은 정확히 조준각 — 원거리 정조준 스트래들(전탄 빗나감) 방지

    let ang=base+off;if(ang>angMax)ang=angMax;if(ang<-angMax)ang=-angMax;
    spawnVolleyBolt(c,gr,from,ang,perDmg,n);
  }
  if(gr.aux>0)for(let i=0;i<gr.aux;i++)spawnAuxBolt(c,from,perDmg*0.6);
  efkPlay('hit',from,0.15,2.2); // 발사구 섬광: 잔여 없는 짧은 플래시로 통일(ember류 잔여 화염 방지)
  for(const u of G.allies)playOnce(u,c.anim,'Walking_A');
}
function spawnVolleyBolt(c,gr,from,ang,dmg,n,wide){
  const grp=new THREE.Group();let mesh;
  if(c.kind==='fire'){mesh=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,10),new THREE.MeshBasicMaterial({color:0xffe0a0}));grp.add(mesh);}
  else if(c.kind==='wave'){mesh=new THREE.Mesh(new THREE.BoxGeometry(0.5*gr.waveW,0.55,0.35),new THREE.MeshBasicMaterial({color:c.color,transparent:true,opacity:0.55}));grp.add(mesh);}
  else if(c.kind==='shard'||c.kind==='spread'){mesh=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.8,6),new THREE.MeshBasicMaterial({color:c.color}));mesh.rotation.x=-Math.PI/2;grp.add(mesh);grp.add(glowSprite(c.color,0.55));}
  else{mesh=new THREE.Mesh(new THREE.OctahedronGeometry(0.16),new THREE.MeshBasicMaterial({color:c.color}));mesh.scale.set(0.7*(gr.big?1.7:1),0.7*(gr.big?1.7:1),1.8*(gr.big?1.4:1));grp.add(mesh);}
  grp.position.copy(from);grp.rotation.y=ang;scene.add(grp);
  const spd=c.kind==='wave'?26:PSPD;
  const vel=new THREE.Vector3(Math.sin(ang),0,-Math.cos(ang)).multiplyScalar(spd);
  const maxDist=c.kind==='wave'?(gr.wave||4):(c.maxD||c.range+3.5);
  const p={mesh:grp,target:null,owner:{cfg:c,fxT:0},dmg,speed:spd,kind:c.kind,color:c.color,hitEfk:c.hitEfk||'hit',
    fx0:from.x,fz0:from.z,vel,maxDist,traveled:0,pierce:c.kind==='wave'?99:gr.pierce,hitSet:new Set(),aoe:gr.aoe||0,knock:c.kind==='wave'?gr.knock:1,waveRad:c.kind==='wave'?0.55*gr.waveW:0};
  const TRAIL={bolt:'suzsword',shard:'cold',fire:'fireball'}; // 병종별 궤적(기존 effekseer 에셋). wave는 파동 메시가 곧 형태 — ember 잔여 화염으로 제외
  const TSC={bolt:0.11,wave:0.07,shard:0.09,fire:0.18}; // 궤적은 작게·빠르게 — 입자 덩어리가 공격 형태를 가리지 않도록
  const tId=TRAIL[c.kind];if(tId){p.efkH=efkPlay(tId,from,TSC[c.kind]*[1,1.25,1.4][fxTier()-1],2.0); /* 티어별 궤적 밀도(가값) */ if(p.efkH){try{p.efkH.setRotation(0,Math.atan2(vel.x,vel.z)+Math.PI/2,0);}catch(e){p.efkH=null;}}} // 궤적을 진행 방향으로 정렬(검 날 열이 진행축에 놓이도록 +90°)
  if(wide)p.k=Math.tan(14*Math.PI/180)+0.08;
  G.projs.push(p);G.statB++;
}
function spawnAuxBolt(c,from,dmg){ // 후드 특성: 유도 보조탄 — 적만 추적(블록·감옥 무시)
  let best=null,bd=1e9;const sz=G.squad.position.z,sx=G.squad.position.x;
  for(const e of G.enemies){if(e.hp<=0||e.deadT!=null)continue;const p=e.obj.position;if(p.z>sz-0.3)continue;
    const tol=corridorW(sz-p.z);if(Math.abs(p.x-sx)>tol)continue;
    const d=Math.hypot(p.x-sx,sz-p.z);if(d<bd){bd=d;best=e;}}
  if(!best)return;
  const mesh=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.5,5),new THREE.MeshBasicMaterial({color:0xc79fff})); // 가는 보라탄
  mesh.rotation.x=-Math.PI/2;const grp=new THREE.Group();grp.add(mesh);grp.position.copy(from);scene.add(grp);
  const pa={mesh:grp,target:best,owner:{cfg:c,fxT:0},dmg,speed:PSPD*0.8,kind:'aux',color:0xc79fff,hitEfk:'aura',fx0:from.x,fz0:from.z};
  pa.efkH=efkPlay('aura',from,0.11,1.4);G.projs.push(pa);
}

// ---------- 신규 병종 공격 + 자동 대형 마법 (제안서 12종, 총 폭 ≤ 3.6 규칙: 폭/반경/연쇄 범위 모두 포함) ----------
const BIG_EVERY=20; // 처치 20마다 자동 대형 마법(직접 시전 없음) — 가값
function foesAlive(){return G.enemies.filter(e=>e.hp>0&&e.deadT==null);}
function lineFx(pts,color,ttl,w){const g=new THREE.BufferGeometry().setFromPoints(pts);const m=new THREE.LineBasicMaterial({color,transparent:true,opacity:1});const l=new THREE.Line(g,m);addFx(l,ttl);return l;}
function slabFx(from,ang,len,wid,color,ttl,op=0.4){const m=new THREE.Mesh(new THREE.PlaneGeometry(wid,len),new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.rotation.z=ang;const c=new THREE.Group();c.add(m);m.position.set(0,0,-len/2);c.position.set(from.x,0.25,from.z);c.rotation.y=-ang;const e=addFx(c,ttl,false);e.slab=m;return e;}
function fireSpecial(c,gr,t,from,tp,dmg,n){
  const k=c.kind;G.statV++;
  const base=Math.atan2(tp.x-from.x,-(tp.z-from.z));
  const aimX=z=>from.x+Math.tan(base)*(from.z-z);
  if(k==='boomerang'||k==='lance'){
    const spd=k==='lance'?PSPD*1.7:PSPD*0.8;
    const grp=new THREE.Group();let mesh;
    if(k==='boomerang'){mesh=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.1,6,14),new THREE.MeshBasicMaterial({color:c.color}));mesh.rotation.x=Math.PI/2;}
    else{mesh=new THREE.Mesh(new THREE.ConeGeometry(0.1,1.6,6),new THREE.MeshBasicMaterial({color:c.color}));mesh.rotation.x=-Math.PI/2;grp.add(glowSprite(c.color,0.7));}
    grp.add(mesh);grp.position.copy(from);grp.rotation.y=base;scene.add(grp);
    const vel=new THREE.Vector3(Math.sin(base),0,-Math.cos(base)).multiplyScalar(spd);
    const p={mesh:grp,target:null,owner:{cfg:c,fxT:0},dmg,speed:spd,kind:k,color:c.color,hitEfk:c.hitEfk,fx0:from.x,fz0:from.z,vel,maxDist:k==='boomerang'?c.range:c.range+1,traveled:0,pierce:99,hitSet:new Set(),aoe:0,knock:1,
      waveRad:k==='boomerang'?0.8:0.5,boom:k==='boomerang',slow:k==='lance'?1.6:0};
    if(k==='lance')p.k=0.2;
    {const trId=k==='lance'?'cold':'suzsword';p.efkH=efkPlay(trId,from,k==='lance'?0.12:0.13,2.0);if(p.efkH&&k==='lance'){try{p.efkH.setRotation(0,Math.atan2(vel.x,vel.z)+Math.PI/2,0);}catch(e){p.efkH=null;}}}
    G.projs.push(p);G.statB++;return;}
  if(k==='chain'){
    const pts=[from.clone()];const first=t;const hit=[first];
    const hp=first.obj.position.clone();hp.y=0.9;pts.push(hp);damage(first,dmg);efkPlay('thunder',new THREE.Vector3(hp.x,0,hp.z),0.12,2.2);
    let last=first;
    for(let h=0;h<3;h++){let best=null,bd=1e9;
      for(const e of foesAlive()){if(hit.includes(e))continue;const p=e.obj.position;if(p.z>from.z-0.3)continue;
        if(Math.abs(p.x-aimX(p.z))>1.5)continue; // 연쇄는 조준선 ±1.5 안에서만 — 총 폭 3.0
        const d=Math.hypot(p.x-last.obj.position.x,p.z-last.obj.position.z);if(d<=1.5&&d<bd){bd=d;best=e;}}
      if(!best)break;hit.push(best);const q=best.obj.position.clone();q.y=0.9;pts.push(q);damage(best,dmg*0.6);efkPlay('thunder',new THREE.Vector3(q.x,0,q.z),0.1,2.2);last=best;}
    lineFx(pts,0xbfe6ff,0.22);return;}
  if(k==='flame'){
    const len=c.range;
    for(const o of [...foesAlive(),...G.blocks.filter(b=>b.hp>0)]){const p=o.obj.position;const dz=from.z-p.z;if(dz<=0||dz>len)continue;if(Math.abs(p.x-aimX(p.z))>1.2)continue;damage(o,dmg);}
    for(let i=1;i<=3;i++){const q=new THREE.Vector3(aimX(from.z-i*1.2),0.6,from.z-i*1.2);efkPlay('fireball',q,0.12+0.03*i,2.2);}efkPlay('flame',new THREE.Vector3(aimX(from.z-2.4),0.4,from.z-2.4),0.12,2.0);return;}
  if(k==='beam'){
    const len=c.range;for(let i=0;i<5;i++){const zz=from.z-1.5-i*3.2;efkPlay('aura',new THREE.Vector3(aimX(zz),0.9,zz),0.16,2.4);}
    for(const o of [...foesAlive(),...G.blocks.filter(b=>b.hp>0)]){const p=o.obj.position;const dz=from.z-p.z;if(dz<=0||dz>len)continue;if(Math.abs(p.x-aimX(p.z))>0.4)continue;damage(o,dmg);if(o.kind==='foe'&&!(G.sparkT>0)){efkPlay('thunder',new THREE.Vector3(p.x,0,p.z),0.1,2.2);G.sparkT=0.12;}}return;}
  if(k==='lob'){
    const lead=t.kind==='foe'?(t.spd||t.cfg.spd||1)*0.75:0;
    const to=new THREE.Vector3(tp.x,0.1,tp.z+lead);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10),new THREE.MeshBasicMaterial({color:c.color}));ball.position.copy(from);scene.add(ball);
    const mk=ring(0xffd27a,1.0,0.35);mk.position.set(to.x,0.1,to.z);scene.add(mk);
    const dur=0.75;let el=0;G.q=G.q||[];const th=efkPlay('fireball',from,0.1,1.6);
    G.q.push({t:dur,step:(dt)=>{el+=dt;const u=Math.min(1,el/dur);ball.position.set(from.x+(to.x-from.x)*u,1.0+(to.y-1.0)*u+3.2*Math.sin(Math.PI*u),from.z+(to.z-from.z)*u);if(th){try{th.setLocation(ball.position.x,ball.position.y,ball.position.z);}catch(e){}}},
      fn:()=>{scene.remove(ball);scene.remove(mk);const rm=ring(0xff9a4a,1.0,0.6);rm.position.set(to.x,0.12,to.z);addFx(rm,0.35);
        if(th){try{th.stop();}catch(e){}}efkPlay('meteo',new THREE.Vector3(to.x,0,to.z),0.3,2.0);
        for(const o of [...foesAlive(),...G.blocks.filter(b=>b.hp>0)])if(Math.hypot(o.obj.position.x-to.x,o.obj.position.z-to.z)<=1.0)damage(o,dmg);}});return;}
}
let BIGI=0;
function castBig(which){
  const kinds=['tornado','meteo','thunder'];const kind=which||kinds[BIGI++%3];
  const sq=G.squad.position;const dm=G.dmgMul*(1+0.04*G.level);G.q=G.q||[];
  const KO={tornado:'토네이도',meteo:'메테오',thunder:'번개'};
  const l=labelSprite('대형 마법: '+KO[kind],'#ffe9a8',3.0);l.position.set(sq.x,3.2,sq.z-2);addFx(l,1.4);
  const alive=foesAlive().filter(e=>e.obj.position.z<sq.z-0.5&&e.obj.position.z>sq.z-16).sort((a,b)=>b.obj.position.z-a.obj.position.z);
  if(kind==='tornado'){
    const pos={x:sq.x,z:sq.z-3};const h=efkPlay('tornade',new THREE.Vector3(pos.x,0,pos.z),0.5,1.2);let tk=0;
    G.q.push({t:3.0,step:(dt)=>{pos.z-=3.0*dt;tk+=dt;if(h){try{h.setLocation(pos.x,0,pos.z);}catch(e){}}
      if(tk>=0.25){tk=0;for(const o of [...foesAlive()])if(Math.hypot(o.obj.position.x-pos.x,o.obj.position.z-pos.z)<=1.3)damage(o,5*dm);}},fn:()=>{if(h){try{h.stop();}catch(e){}}}});
  }else if(kind==='meteo'){
    const tg=alive.slice(0,3);if(!tg.length)tg.push({obj:{position:new THREE.Vector3(sq.x,0,sq.z-6)}});
    tg.forEach((e,i)=>G.q.push({t:0.25+i*0.4,fn:()=>{const p=e.obj.position;const q=new THREE.Vector3(p.x,0,p.z);efkPlay('meteo',q,0.5,1.3);
      G.q.push({t:0.5,fn:()=>{const rm=ring(0xff7a2a,1.4,0.6);rm.position.set(q.x,0.12,q.z);addFx(rm,0.4);for(const o of foesAlive())if(Math.hypot(o.obj.position.x-q.x,o.obj.position.z-q.z)<=1.4)damage(o,14*dm);}});}}));
  }else{
    const tg=alive.slice(0,5);
    tg.forEach((e,i)=>G.q.push({t:0.12+i*0.14,fn:()=>{if(e.hp<=0)return;const p=e.obj.position;efkPlay('thunder',new THREE.Vector3(p.x,0,p.z),0.2,1.6);damage(e,9*dm);}}));
  }
}
window.__big=k=>castBig(k);window.__cls=()=>Object.keys(CLASSES);
function nearestTarget(unit){
  const wp=unit.obj.getWorldPosition(new THREE.Vector3());
  let best=null,bd=1e9;
  const consider=(o,bias=0)=>{
    const p=o.obj.position;const dz=wp.z-p.z; // ahead of ally means p.z < wp.z
    if(p.z>wp.z-0.3)return; // 전방의 적만 자동 공격(보스 포함)
    const cleave=unit.cfg.kind==='cleave';
    const tol=cleave?1.1:0.6+dz*0.08; // 직사화기: 전방 좁은 사선대 안의 대상만 교전(사용자 결정 11-26 06:03)
    const laneX=cleave?wp.x:G.squad.position.x; // 원거리는 부대 중심 기준 사선대 — 인원이 늘어도 대형 너비가 아니라 부대 위치가 사격 레인을 결정
    if(Math.abs(p.x-laneX)>tol)return;
    const d=Math.hypot(p.x-wp.x,dz)-bias;
    if(d<bd){bd=d;best=o;}
  };
  for(const e of G.enemies)if(e.hp>0)consider(e);
  for(const b of G.blocks)if(b.hp>0)consider(b,1.5); // 상자·수정도 적과 거리로 경쟁(약간 우대) — 파도가 촘촘해져도 부숨
  if(bd>unit.cfg.range)return null;
  return best;
}
async function convertSquad(cls){ // 통일 부대 전환: 진화 단계(인원 파생)·레벨·공격력 배율·생명 유지, 병종만 교체
  if(G.cls===cls){if(G.allies.length<16)await spawnAlly(cls);return;}
  G.cls=cls;
  for(const p of [...G.projs]){if(p.efkH){try{p.efkH.stop();}catch(e){}}scene.remove(p.mesh);}G.projs.length=0; // 전환 시 기존 비행탄 제거
  const n=Math.min(16,G.allies.length+1); // 구출: 전환 + 대원 1명
  for(const u of G.allies){G.squad.remove(u.obj);}
  G.allies.length=0;
  for(let i=0;i<n;i++)await spawnAlly(cls);
  {const rp=ring(CLASSES[cls].color,1.6,0.8);rp.position.set(G.squad.position.x,0.12,G.squad.position.z);addFx(rp,0.8);}
  const l=labelSprite(CLS_KO[cls]+' 부대!','#ffffff',2.8);l.position.set(G.squad.position.x,2.8,G.squad.position.z);addFx(l,1.6);
}
function fireBolt(unit,target){
  const c=unit.cfg;
  const from=unit.obj.getWorldPosition(new THREE.Vector3());from.y=1.0;
  let mesh;const grp=new THREE.Group();
  if(c.kind==='shard'){mesh=new THREE.Mesh(new THREE.ConeGeometry(DART?0.09:0.1,DART?1.8:0.55,6),new THREE.MeshBasicMaterial({color:c.color}));
    mesh.rotation.x=-Math.PI/2;grp.add(mesh);}
  else if(c.kind==='fire'){mesh=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,10),new THREE.MeshBasicMaterial({color:0xffe0a0}));grp.add(mesh);}
  else{mesh=new THREE.Mesh(new THREE.OctahedronGeometry(0.16),new THREE.MeshBasicMaterial({color:c.color}));mesh.scale.set(0.7,0.7,1.8);if(DART)mesh.scale.set(0.8,0.8,12.0); grp.add(mesh);} // DART: 원작식 긴 탄체(약 0.13x1.9)
  grp.position.copy(from);scene.add(grp);
  const p={mesh:grp,target:c.homing?target:null,owner:unit,dmg:c.dmg*G.dmgMul,speed:PSPD,kind:c.kind,color:c.color,hitEfk:c.hitEfk||'hit'};
  if(!c.homing){const tp0=target.obj.position.clone();tp0.y=0.8;
    if(target.kind==='foe')tp0.z+=(target.spd||target.cfg.spd)*(tp0.distanceTo(from)/PSPD); // 적의 전진을 앞질러 조준(추적은 아님)
    const d0=tp0.clone().sub(from);const dist0=Math.max(0.1,d0.length());
    p.vel=d0.normalize().multiplyScalar(PSPD);p.maxDist=dist0+3.5;p.traveled=0;p.pierce=3;p.hitSet=new Set();} // 일반 유닛은 직사탄: 빗나갈 수 있지만 경로상 적을 최대 3회 관통(원작 참고)
  if(c.kind==='fire')p.efkH=efkPlay('fireball',from,0.30,1.0); // 메이지는 FireBall 샘플이 날아가는 탄체
  G.projs.push(p);
  playOnce(unit,c.anim,'Walking_A');
}
function cleave(unit,target){
  const p=target.obj.position.clone();p.y=0.8;
  if((unit.fxT||0)<=0){efkPlay(unit.cfg.hitEfk||'ember',p,unit.cfg.fxScale||0.4,unit.cfg.fxSpeed||1.4);unit.fxT=0.7;}
  damage(target,unit.cfg.dmg*G.dmgMul);
  playOnce(unit,unit.cfg.anim,'Walking_A');
}
function damage(t,d){
  const hpB=t.hp;t.hp-=d;t.hitT=0.12;
  if(t.wgrp){const d2=Math.min(d,Math.max(0,hpB),t.wgrp.hp);t.wgrp.hp=Math.max(0,t.wgrp.hp-d2); // 오버킬 초과분이 무리 수치를 먼저 0으로 만들던 버그 수정
    const big=d2>=t.wgrp.maxHp*0.15; // 대형 피해(무리 총체력 15%+): 빨간 플래시
    drawNum(t.wgrp.num,Math.ceil(t.wgrp.hp),big?'#ff5a4a':'#ffb02e');
    t.wgrp.num.sprite.scale.set(1.35*1.5,1.35*1.5,1);t.wgrp.num.flash=0.28;}
  if(t.kind==='foe')t.obj.position.z-=t.isBoss?0.06:0.2; // 타격 넉백
  if(t.hpFg){const f=Math.max(0,t.hp/t.maxHp);t.hpFg.scale.x=1.06*f;t.hpFg.position.x=-(1-f)*0.53;}
  if(t.hpNum){drawNum(t.hpNum,Math.max(0,Math.ceil(t.hp))); // 피격 시 잔여 수치 감소가 크게 보이도록
    const pop=1.5*1.25;t.hpNum.sprite.scale.set(pop,pop,1);t.hpNum.popT=0.12;}
  if(t.hp<=0&&t.kind!=='ally')killUnit(t);
}
function killUnit(t){
  if(t.kind==='foe'){
    G.kills++;if(G.kills%BIG_EVERY===0)castBig();G.combo++;G.comboT=4.0; // 콤보 창(시제품 4.0초, 계측 후 조정)
    if(G.combo>=2){const tier=G.combo>=25?'#ff5a4a':G.combo>=10?'#ff9a3c':G.combo>=5?'#ffd966':'#ffffff'; // 콤보는 우측 상단 카운터에 통합(사용자 10:29) — 평소 작게, 누적 순간만 짧고 날카롭게
      const cb=$('combo');cb.style.setProperty('--cc',tier);cb.querySelector('.cbn').textContent='\u00d7'+G.combo;
      cb.classList.add('on');cb.classList.remove('hit','hit5');void cb.offsetWidth;cb.classList.add(G.combo%5===0?'hit5':'hit');}
    const TITLES={25:'연전연승',50:'파죽지세',100:'천하무적'};
    if(TITLES[G.combo]){const l=labelSprite(TITLES[G.combo]+' ×'+G.combo,'#ffd966',3.6);l.position.set(G.squad.position.x,3.6,G.squad.position.z-6);addFx(l,1.6);}
    const dp=t.obj.position.clone();dp.y=0.9;
    if(t.isBoss)efkPlay('featherbomb',dp,0.40,1.8);
    else{const tier=fxTier();if((G.sparkT||0)<=0){const sp=sparkBurst((CLASSES[G.cls]||{}).color||0xffe9a8,tier>=2?1.35:1.15);sp.position.copy(dp);const fe=addFx(sp,0.24,false);fe.grow=1;fe.spark=sp.userData.mat;G.sparkT=0.12;}if(tier>=3&&(G.fx3T||0)<=0){efkPlay('toonhit',dp,0.5,2.0);G.fx3T=0.15;}} // 다중 동시 처치 피크 제한 + 성장 티어(강타 소형 폭발은 비화염), T3 폭발 교체(featherbomb→toonhit 0.5): 가림 없이 타격지점 식별(동일조건 실속 영상 비교)
    if(G.kills%CFG.killsPerLevel===0){G.level++;G.dmgMul*=CFG.levelMul;
      {const rp=ring(0xffd966,1.2,0.8);rp.position.set(G.squad.position.x,0.12,G.squad.position.z);addFx(rp,0.6);} // 밝은 중심면 없는 얇은 고리 표시(비교빌드)
      const l=labelSprite('레벨 업!','#ffe27a',2.4);l.position.set(G.squad.position.x,2.6,G.squad.position.z-1);addFx(l,1.6);}
    if(t.acts.Death_A||t.acts.Death){const d=t.acts.Death_A||t.acts.Death;
      Object.values(t.acts).forEach(a=>a.stop());d.reset();d.setLoop(THREE.LoopOnce,1);d.clampWhenFinished=true;d.play();}
    if(t.hpFg){t.obj.remove(t.hpFg);t.hpFg=null;}if(t.hpBg){t.obj.remove(t.hpBg);t.hpBg=null;}
    if(t.wgrp){t.wgrp.members.delete(t);if(t.wgrp.members.size===0){scene.remove(t.wgrp.num.sprite);delete G.waveGrps[t.wave];}}
    t.deadT=1.1;
    if(t.isBoss){G.bossDead=true;bossPhase(t);}
  }else if(t.kind==='block'){
    const p=t.obj.position.clone();p.y=1;
    if(t.btype==='chest'){
      {const rp=ring(0xffd966,1.0,0.8);rp.position.set(p.x,0.12,p.z);addFx(rp,0.6);} // 밝은 중심면 없는 얇은 고리 표시(비교빌드)
      const l=labelSprite('대원 +1','#ffd966',2.2);l.position.copy(p).add(new THREE.Vector3(0,1,0));addFx(l,1.6);
      if(G.allies.length<16)spawnAlly(G.cls);
      else{G.dmgMul*=1.1;const l2=labelSprite('단련: 공격력 +10%','#ffd966',2.2);l2.position.copy(p).add(new THREE.Vector3(0,2,0));addFx(l2,1.6);} // 인원 상한(시제품 16) 이후 보상 대체(제안값)
    }else if(t.btype==='captive'){
      convertSquad(t.obj.userData.rewardCls||'Knight'); // 전환: 비행탄 제거+전원 교체+1명은 convertSquad 내부
    }else{
      {const rp=ring(0x9fe8ff,1.0,0.8);rp.position.set(p.x,0.12,p.z);addFx(rp,0.6);} // 밝은 중심면 없는 얇은 고리 표시(비교빌드)
      G.dmgMul*=1.2;
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
// 합성 마법/게이지는 사용자 결정으로 제거(18:37) — 캐릭터별 자동공격·스킬에 집중

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
  try{await Promise.race([Promise.all([document.fonts.load('800 64px Orbitron'),document.fonts.load('700 16px Pretendard')]),new Promise(r=>setTimeout(r,3000))]);}catch(e){} // 게임용 서체 선로드(실패해도 진행)
  await buildMeadow();
  G.squad=new THREE.Group();scene.add(G.squad);
  G.squad.position.set(0,0,0);
  { // 타격 범위 가이드: 바깥 경계 2줄(옅게) — 보이는 경계=실제 타격 범위
    const mkG=()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(0.07,11),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.10,depthWrite:false}));
      m.rotation.x=-Math.PI/2;scene.add(m);return m;};
    G.guideL=mkG();G.guideR=mkG();}
  for(const c of START_SQUAD)await spawnAlly(c);
  const stg=parseInt(new URLSearchParams(location.search).get('stage'))||1; // 테스트용 구간 건너뛰기
  if(stg>1){
    for(let i=0;i<3;i++)await spawnAlly(G.cls);G.extra=3;
    G.dmgMul=2.0;G.level=6;G.kills=40;
    G.squad.position.z=-CFG.stageLen*(stg-1);
  }
  const squadN=parseInt(new URLSearchParams(location.search).get('squad'))||0; // 테스트용 대원 수 고정(12명 동일조건 검증)
  while(squadN>0&&G.allies.length<squadN){await spawnAlly(G.cls);G.extra++;}
  if(WEAK)G.dmgMul=0.05;
  setStage(stg);
  try{await efkInit();}catch(e){console.warn('effekseer off:',e.message);efk=null;}
  window.G=G;window.__efk=()=>efk?Object.keys(efk.eff):null;window.__efkPlay=(id,x,y,z,s,sp)=>efkPlay(id,{x,y,z},s||0.8,sp||1);window.__efkStop=()=>{if(efk)efk.ctx.stopAll();}; // 테스트 훅
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
  const loads=FXLIST?FXLIST.split(',').map(s=>s.split('=')).map(([id,u])=>[id,'./assets/effekseer/effects/'+u]) : [['hit','./assets/effekseer/effects/andrewfm/hit_eff.efk'],
               ['suzsword','./assets/effekseer/effects/suzuki/002_sword_effect/sword.efk'],
               ['ember','./assets/effekseer/effects/pierre-2/Sword_Ember.efk'],
               ['cold','./assets/effekseer/effects/nextsoft/MagicCold.efk'],
               ['flame','./assets/effekseer/effects/pierre-1/Flame.efk'],
               ['aura','./assets/effekseer/effects/effekseer-1.6/Aura01.efk'],
               ['fireball','./assets/effekseer/effects/pierre-2/FireBall.efk'],
               ['toonhit','./assets/effekseer/effects/tktk/ToonHit.efk'],
               ['featherbomb','./assets/effekseer/effects/pierre-2/FeatherBomb.efk'],
               ['bene','./assets/effekseer/effects/pierre-2/Benediction.efk'],
               ['powerup','./assets/effekseer/effects/nextsoft/PowerUp.efk'],
               ['tornade','./assets/effekseer/effects/nextsoft/MagicTornade.efk'],
               ['meteo','./assets/effekseer/effects/nextsoft/MagicMeteo.efk'],
               ['thunder','./assets/effekseer/effects/nextsoft/MagicThunder.efk'],
               ['toonwater','./assets/effekseer/effects/tktk/ToonWater.efk']];
  const XL=new URLSearchParams(location.search).get('xfx'); // 검증용: 후보 효과 추가 로드(id=경로,…)
  if(XL)for(const q of XL.split(',')){const [i2,u2]=q.split('=');loads.push([i2,'./assets/effekseer/effects/'+u2]);}
  await Promise.all(loads.map(([id,url])=>new Promise((res,rej)=>{
    const e=ctx.loadEffect(url,1,()=>res(),(w,p)=>rej(new Error(url+' '+w+' '+(p||'')))); // onload는 인자 없음 → 반환값 사용
    eff[id]=e;})));
  efk={ctx,eff};
}
function efkPlay(id,pos,scale=1,speed=1){
  if(NOFX||!efk||!efk.eff[id])return null;
  const h=efk.ctx.play(efk.eff[id],pos.x,pos.y,pos.z);
  if(scale!==1)h.setScale(scale,scale,scale);
  const sp=speed/FXSLOW; // FXSLOW는 캡처용 수명 배율(외형 불변)
  if(sp!==1)h.setSpeed(sp);
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
  if(!NODRAW&&!window.__skipDraw){renderer.render(scene,cam);
  if(efk&&!NOFX){ // Effekseer 효과를 three 위에 같은 카메라로 그림
    efk.ctx.update(dt*60);
    const gl=renderer.getContext();
    efk.ctx.setProjectionMatrix(cam.projectionMatrix.elements);
    efk.ctx.setCameraMatrix(cam.matrixWorldInverse.elements);
    gl.useProgram(null);
    efk.ctx.draw();
    renderer.resetState();
  }}
}
function update(dt){
  dt*=TS;
  G.gtime=(G.gtime||0)+dt; // 계측용 게임 시간(TS 적용 후)
  // advance (통로 진행은 보스전에도 멈추지 않음)
  G.squad.position.z-=CFG.fwdSpeed*dt;
  G.squad.position.x+=(G.x-G.squad.position.x)*Math.min(1,dt*10);
  const sq=G.squad.position;
  { // 가이드: 사선대 경계 2줄 — corridorW(실제 조준·충돌 판정 함수)를 그대로 샘플링해 그림: 보이는 모양 = 실제 타격 범위(성장·고정 총 폭 상자 반영)
    const N=14;if(!G.guideStrips){G.guideL.visible=false;G.guideR.visible=false;
      const mk=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((N+1)*2*3),3));
        const idx=[];for(let i=0;i<N;i++){const a0=i*2;idx.push(a0,a0+1,a0+2,a0+1,a0+3,a0+2);}g.setIndex(idx);
        const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.12,depthWrite:false,side:THREE.DoubleSide}));m.frustumCulled=false;scene.add(m);return m;};
      G.guideStrips=[mk(),mk()];}
    const len=CLASSES[G.cls].range;
    [-1,1].forEach((sgn,si)=>{const pos=G.guideStrips[si].geometry.attributes.position;
      for(let i=0;i<=N;i++){const dz=len*i/N;const hw=corridorW(dz);const z=sq.z-0.6-dz;
        pos.setXYZ(i*2,sq.x+sgn*hw,0.06,z);pos.setXYZ(i*2+1,sq.x+sgn*(hw+0.07),0.06,z);}
      pos.needsUpdate=true;});
  }
  // stage spawning
  G.layout.forEach((e,i)=>{
    if(G.spawned.has(i))return;
    if(e.z<sq.z-24)return; // 파도가 시간차를 두고 도래하도록 스폰 예지 거리 조정(한꺼번에 몰려와 순삭되는 것 방지)
    G.spawned.add(i);
    if(e.type==='foe'){if(!BOSSONLY)spawnFoe(e.foe,e.x,e.z,false,e.wave);}
    else if(e.type==='boss')spawnFoe(null,e.x,e.z,true,e.wave);
    else if(!BOSSONLY)spawnBlock(e.type,e.x,e.z);
  });
  // stage clear
  const ahead2=G.stage<5 && sq.z<G.stageZ0-CFG.stageLen+18;
  if(ahead2)setStage(G.stage+1); // 경계 전에 다음 구역 생성 — 잔적 정리와 다음 파도가 겹쳐 공백 제거
  // allies: 통일 부대 일제사격 — 탄 수/패턴은 성장 단계, 인원은 탄 1발 피해로 환산(설계 v2, 수치 초안)
  for(const u of G.allies)u.mixer.update(dt);
  G.fxT=Math.max(0,G.fxT-dt);G.sparkT=Math.max(0,(G.sparkT||0)-dt);G.fx3T=Math.max(0,(G.fx3T||0)-dt);
  const c=CLASSES[G.cls],n=G.allies.length,gr=growth(G.cls,n);
  if(G.burstLeft>0){G.burstT-=dt;if(G.burstT<=0){fireVolley(c,n,gr);G.burstLeft--;G.burstT=0.09;}}
  else{G.vcd-=dt;
    if(G.vcd<=0&&squadTarget(c)){fireVolley(c,n,gr);if(gr.burst>1){G.burstLeft=gr.burst-1;G.burstT=0.09;}
      G.vcd=Math.max(0.15,c.cd*gr.rate);}}
  // 콤보 창
  if(G.comboT>0){G.comboT-=dt;
    if(G.comboT<=0){if(G.combo>=10){const l=labelSprite('연속 처치 ×'+G.combo+' 종료','#aab2bd',2.4);l.position.set(G.squad.position.x,3.1,G.squad.position.z-6);addFx(l,1.2);}G.combo=0;}}
  // foes
  for(const e of [...G.enemies]){
    e.mixer.update(dt);
    if(e.deadT!=null){e.deadT-=dt;
      if(e.deadT<=0){scene.remove(e.obj);G.enemies.splice(G.enemies.indexOf(e),1);
        if(e.isBoss)G.boss=null;}
      continue;}
    e.obj.position.z+=(e.spd||e.cfg.spd)*dt*(e.slowT>0?0.5:1);if(e.slowT>0)e.slowT-=dt;
    if(e.hitT>0)e.hitT-=dt;
    if(e.obj.position.z>sq.z+CFG.defLine){ // 방어선 돌파
      if(e.isBoss){endGame(false);return;} // 보스 돌파는 즉시 패배
      scene.remove(e.obj);G.enemies.splice(G.enemies.indexOf(e),1);
      if(e.wgrp){e.wgrp.members.delete(e);if(e.wgrp.members.size===0){scene.remove(e.wgrp.num.sprite);delete G.waveGrps[e.wave];}}
      G.lives--;
      const l=labelSprite('돌파!','#ff6666',1.8);l.position.set(e.obj.position.x,1.5,sq.z+1);addFx(l,1.2);
      if(G.lives<=0){endGame(false);return;}
    }
  }
  if(G.stage===5&&G.bossDead&&G.enemies.length===0){endGame(true);return;}
  // wave group numbers: 무리 중심을 따라 이동 + 팝 애니메이션
  for(const key in G.waveGrps){const g=G.waveGrps[key];
    let sx=0,sz=0,n=0;g.members.forEach(m=>{if(m.hp>0){sx+=m.obj.position.x;sz+=m.obj.position.z;n++;}});
    if(n)g.num.sprite.position.set(sx/n,2.9,sz/n-0.6);
    if(g.num.flash){g.num.flash-=dt;if(g.num.flash<=0){g.num.flash=0;drawNum(g.num,Math.ceil(g.hp));}}
    const ws=g.num.sprite.scale.x+(1.5-g.num.sprite.scale.x)*Math.min(1,dt*10);g.num.sprite.scale.set(ws,ws,1);}
  // blocks hitT
  for(const b of [...G.blocks]){if(b.hitT>0)b.hitT-=dt;
    if(b.hpNum){const s=b.hpNum.sprite.scale.x+(1.5-b.hpNum.sprite.scale.x)*Math.min(1,dt*10);b.hpNum.sprite.scale.set(s,s,1);}
    const tag=b.obj.userData.tag;
    if(tag&&tag.visible){const dz=b.obj.position.z-sq.z; // 부대가 지나친(공격/선택 구간 밖) 보상 라벨은 숨김
      if(dz>-1.0)tag.visible=false;}
    if(b.remove)scene.remove(b.obj);}
  // projectiles
  for(const p of [...G.projs]){
    if(p.vel&&p.boom){p.mesh.rotation.y+=dt*18;
      if(!p.back&&p.traveled+p.speed*dt>=p.maxDist){p.back=true;p.hitSet.clear();p.maxDist=1e9;}
      if(p.back){const dx=sq.x-p.mesh.position.x,dz2=(sq.z-0.6)-p.mesh.position.z,dl=Math.hypot(dx,dz2);
        if(dl<0.6){scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);continue;}
        p.vel.set(dx/dl*p.speed,0,dz2/dl*p.speed);}}
    if(p.vel){ // 직사탄: 직진하며 경로상의 첫 대상에 명중, 사거리 끝에서 소멸
      const step=p.speed*dt;const px0=p.mesh.position.x,pz0=p.mesh.position.z;
      p.mesh.position.addScaledVector(p.vel,dt);p.traveled+=step;
      if(p.efkH){try{p.efkH.setLocation(p.mesh.position.x,p.mesh.position.y,p.mesh.position.z);}catch(e){p.efkH=null;}}
      const dzB=p.fz0-p.mesh.position.z; // 사선대 이탈 탄은 경계에서 소멸 — 발사 시점 원점 기준(부대 이동 중 돌발 소멸 방지)
      if(!p.boom&&dzB>0&&Math.abs(p.mesh.position.x-p.fx0)>(p.k!=null?0.6+dzB*p.k:corridorW(dzB))+0.05){G.statX++;if(p.efkH){try{p.efkH.stop();}catch(e){}p.efkH=null;}
        scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);continue;}
      const ux=p.vel.x/p.speed,uz=p.vel.z/p.speed; // 이동 선분 기준 최근접 판정(고속 관통 방지)
      let hit=null,bhd=1e9;
      const seg=(o,rad)=>{const ox=o.obj.position.x-px0,oz=o.obj.position.z-pz0;
        const t=Math.max(0,Math.min(step,ox*ux+oz*uz));const dd=Math.hypot(ox-ux*t,oz-uz*t);
        if(dd<rad&&dd<bhd){bhd=dd;hit=o;}};
      for(const e of G.enemies)if(e.hp>0&&e.deadT==null&&!p.hitSet.has(e))seg(e,p.waveRad||0.6);
      if(!hit)for(const b of G.blocks)if(b.hp>0)seg(b,p.waveRad?p.waveRad+0.1:0.7);
      if(hit){G.statH++;const hp2=hit.obj.position.clone();hp2.y=0.8;
        if(G.fxT<=0){efkPlay(p.hitEfk||'hit',hp2,(p.owner.cfg.fxScale||0.4)*(fxTier()>=2?1.3:1),p.owner.cfg.fxSpeed||1.4);G.fxT=0.25;} // 2단계~ 명중 섬광 확대(가값)
        if(p.slow&&hit.kind==='foe'){hit.slowT=p.slow;efkPlay('toonwater',hp2,0.12,1.8);}
        if(p.knock>1&&hit.kind==='foe')hit.obj.position.z-=0.2*(p.knock-1); // 충격파 넉백(보임이 성장 체감)
        damage(hit,p.dmg);
        if(p.aoe>0){ // 메이지 폭발: 링=실제 피해 영역
          const ar=p.aoe;const rm=ring(0xff9a4a,ar,0.55);rm.position.set(hp2.x,0.1,hp2.z);addFx(rm,0.3);
          for(const e2 of G.enemies){if(e2===hit||e2.hp<=0||e2.deadT!=null)continue;
            if(Math.hypot(e2.obj.position.x-hp2.x,e2.obj.position.z-hp2.z)<=ar)damage(e2,p.dmg*0.5);}}
        if(hit.kind==='block'){if(p.efkH){try{p.efkH.stop();}catch(e){}p.efkH=null;}scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);continue;} // 블록은 탄을 막음
        p.hitSet.add(hit);p.pierce--;
        if(p.pierce<=0){if(p.efkH){try{p.efkH.stop();}catch(e){}p.efkH=null;}scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);continue;}}
      if(p.traveled>=p.maxDist){G.statX++;if(p.efkH){try{p.efkH.stop();}catch(e){}p.efkH=null;}
        scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);}
      continue;
    }
    if(!p.target||p.target.hp<=0){scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);continue;}
    const tp=p.target.obj.position.clone();tp.y=0.8;
    const d=tp.clone().sub(p.mesh.position);const dist=d.length();
    const step=p.speed*dt;
    if(dist<=step+0.15){
      const dzA=p.fz0!=null?(p.fz0-p.mesh.position.z):(sq.z-0.6)-p.mesh.position.z; // 유도탄도 같은 사선대 판정(발사 원점 기준)
      const ax0=p.fx0!=null?p.fx0:sq.x;
      if(dzA>0&&Math.abs(p.mesh.position.x-ax0)>corridorW(dzA)+0.35){scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);continue;}
      if((p.owner.fxT||0)<=0){efkPlay(p.hitEfk||'hit',tp,(p.owner.cfg.fxScale||0.4)*(fxTier()>=2?1.3:1),p.owner.cfg.fxSpeed||1.4);p.owner.fxT=0.7;}
      if(p.efkH){try{p.efkH.stop();}catch(e){}p.efkH=null;}
      damage(p.target,p.dmg);
      scene.remove(p.mesh);G.projs.splice(G.projs.indexOf(p),1);
    }else{p.mesh.position.addScaledVector(d.normalize(),step);
      if(p.efkH){try{p.efkH.setLocation(p.mesh.position.x,p.mesh.position.y,p.mesh.position.z);}catch(e){p.efkH=null;}}}
  }
  // 포격·대형 마법 예약 이벤트
  if(G.q&&G.q.length)for(const ev of [...G.q]){ev.t-=dt;if(ev.step)ev.step(dt,ev);if(ev.t<=0){G.q.splice(G.q.indexOf(ev),1);if(ev.fn)ev.fn();}}
  // fx
  for(const f of [...fx]){f.t-=dt;
    if(f.vel){f.vel.y+=(f.grav||0)*dt;f.obj.position.addScaledVector(f.vel,dt);}
    if(f.popW){const e=Math.min(1,1-f.t/f.ttl);const k=e<0.3?0.5+(e/0.3)*0.6:1.1-0.12*Math.min(1,(e-0.3)/0.7);f.obj.scale.set(f.popW*k,f.popW*0.3125*k,1);}
    if(f.grow){const e2=1-f.t/f.ttl;f.obj.scale.setScalar(0.3+1.0*e2);}
    if(f.spark)f.spark.opacity=Math.max(0,f.t/f.ttl);
    if(f.fade&&f.obj.material)f.obj.material.opacity=f.hold?Math.max(0,Math.min(1,f.t/(f.ttl*(1-f.hold)))):Math.max(0,f.t/f.ttl);
    if(f.t<=0){scene.remove(f.obj);fx.splice(fx.indexOf(f),1);}}
  // HUD
  $('hearts').textContent='♥'.repeat(Math.max(0,G.lives))+'♡'.repeat(Math.max(0,CFG.lives-G.lives));
  $('squadN').textContent=G.allies.length;
  if(G.combo<2)$('combo').classList.remove('on');
  $('lv').textContent=G.level;
  $('kills').textContent=G.kills;
  $('fps').textContent=Math.round(fpsEMA)+' fps · 초안';
}
init().catch(e=>{console.error(e);window.__err=String(e.stack||e);});
window.__spawn=async(type,x,dz)=>{await spawnFoe(type,x,G.squad.position.z-dz,false,null);return 1;}; // 테스트 훅
window.__step=(n,dt)=>{window.__fn=(window.__fn||performance.now());for(let i=0;i<n;i++){window.__skipDraw=i<n-1;window.__fn+=dt*1000;tick(window.__fn);}return 1;}; // 검증 훅: 수동 프레임 진행(실제 렌더는 마지막 프레임만)
