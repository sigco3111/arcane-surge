import * as THREE from 'three';
import {GLTFLoader} from './jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from './jsm/utils/SkeletonUtils.js';

const A='./assets/';
const loader=new GLTFLoader();
const gltfCache={};
const gltfDone={};
async function loadG(u){ if(!gltfCache[u]) gltfCache[u]=loader.loadAsync(u).then(g=>{gltfDone[u]=g;return g;}); return gltfCache[u]; }
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
  {const mw=g.measureText(text).width;if(mw>470){g.font='700 '+Math.floor(54*470/mw)+'px Orbitron,Pretendard,"Noto Sans KR",sans-serif';}}
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
  const fam='Orbitron,Pretendard,"Noto Sans KR",sans-serif';
  let px=130;g.font='800 '+px+'px '+fam;
  const w=g.measureText(txt).width;const maxW=222; // 실제 글자 폭을 재서 캔버스(256)에 맞춤 — 자릿수와 무관하게 잘리지 않음
  if(w>maxW){px=Math.max(24,Math.floor(px*maxW/w));g.font='800 '+px+'px '+fam;}
  g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=Math.max(3,Math.round(px/8));g.strokeStyle='rgba(0,0,0,0.85)';g.lineJoin='round';g.strokeText(txt,128,134);g.fillStyle=col||'#ffffff';g.fillText(txt,128,134);
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
  fwdSpeed:2.7, foeSpdMul:1.2, dragClamp:2.1, defLine:2.6, // 전진 2.3->2.7 + 적 속도 1.2배 (사용자 11-27: 아군·적군 모두 더 빠르게). 이전: 1.7->2.3(+35%), 2.6 시험에서 1스테이지 첫 파도 돌파 여유 7.1s->4.5s로 급변해 2.3 조정 후 재상향
  lives:5, killsPerLevel:8, levelMul:1.15,
  stageLen:55,
  bossEvery:5, // 5스테이지마다 보스 / 지역(맵 테마)은 보스 이후 바뀜
  finalStage:40, // 8지역 x 5구간 = 40스테이지: 최종 보스(8번째) 격파가 클리어 조건(사용자 승인 11-27)
};
const FINAL_BOSS_IDX=CFG.finalStage/CFG.bossEvery;
function stageMul(n){return n<=1?1:1.5*Math.pow(1.3,Math.min(n,12)-2)*Math.pow(1.15,Math.max(0,n-12));} // 적 체력 배율: 1스테이지=1, 2스테이지부터 1.5배로 뛰고 이후 1.3배씩(12 이후 1.15배씩)
function blockMul(n){return Math.pow(1.3,Math.min(n,12)-1)*Math.pow(1.15,Math.max(0,n-12));}
const isBossStage=n=>n>0&&n%CFG.bossEvery===0;
const CLASSES={
  Knight:{u:'Knight.glb',s:0.47,dmg:6,cd:0.9,range:9.5,kind:'bolt',color:0xffe27a,hitEfk:'hit',fxScale:0.22,fxSpeed:2.1,anim:'1H_Melee_Attack_Stab',w:{slot:'handslotr',u:'weapons/spear_A.gltf'}},
  Barbarian:{u:'Barbarian.glb',s:0.40,dmg:14,cd:1.25,range:9.5,kind:'wave',color:0xff7a2a,hitEfk:'hit',fxScale:0.1,fxSpeed:2.4,anim:'2H_Melee_Attack_Spin',blockMul:3}, // 상자·방벽 파괴 전담(개편안): 블록 피해 3배. hit로 교체: ember 잔여 화염이 다중 명중 피크에서 누적되는 문제 차단
  Rogue:{u:'Rogue.glb',s:0.47,dmg:4,cd:0.55,range:10.5,kind:'shard',color:0x9fdcff,hitEfk:'cold',fxScale:0.11,fxSpeed:2.6,anim:'2H_Ranged_Shoot',w:{slot:'handslotl',u:'weapons/bow_A_withString.gltf'}},
  Mage:{u:'Mage.glb',s:0.38,dmg:9,cd:1.15,range:10.5,kind:'fire',color:0xff7a2a,hitEfk:'flame',fxScale:0.11,fxSpeed:2.8,anim:'Spellcast_Shoot',w:{slot:'handslotr',u:'weapons/wand.gltf'}},
};
CLASSES.Rogue_Hooded={...CLASSES.Rogue,u:'Rogue_Hooded.glb',color:0xc79fff,hitEfk:'aura',homing:true,fxScale:0.13}; // 특수 유닛만 유도 탄(사용자 결정 20:02)
const START_SQUAD=['Knight']; // 시작 병력 1명(사용자 11-26 19:58 정정)
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
const ENV={Knight:{w:1.2,r:22},Rogue:{w:1.8,r:20},Mage:{w:3.2,r:20},Barbarian:{w:3.6,r:18},Rogue_Hooded:{w:2.0,r:60},
  Ranger:{w:3.0,r:16,l:0.6},Glaive:{w:1.6,r:18,l:0.3},Sorcerer:{w:3.0,r:20,l:0.7},FrostLancer:{w:1.0,r:24,l:0.1},Pyro:{w:2.4,r:16,l:1.2},Prism:{w:0.8,r:40,l:0.4}}; // 병종 개편(사용자 승인 11-27 09:59): 전원 충분한 사거리(16+), 차별화는 공격 방식으로. l=조준 레인 반폭 고정(없으면 w/2−폭발/파동). 연쇄·폭발은 이 레인 밖으로 조준선±1.5/반경 1.0까지만
for(const k in ENV)if(CLASSES[k])CLASSES[k].range=ENV[k].r;
const RANGE_DMG=r=>Math.max(0.15,Math.pow(16/Math.max(16,r),2)); // 사용자 11-27: 사거리가 길수록 데미지를 훨씬 낮춤(16 기준 제곱 감쇠, 하한 0.15) — 가값, 플레이테스트 조정 예정
function growth(cls,n){const g={...GROWTH_DEF};for(const [k,v] of (GROWTH[cls]||[]))if(n>=k)Object.assign(g,v);
  const e=ENV[cls];if(e){g.aoe=Math.min(g.aoe||0,Math.max(0,e.w/2-0.7));g.wave=Math.max(g.wave||0,e.r);g.waveW=Math.min(g.waveW,(e.w/2-0.35)/0.55);} // 개편: 파동 도달 거리도 사거리까지(이전엔 성장치 5~12에 묶여 교전 사거리가 사실상 그대로였음)
  {const k=(CLASSES[cls]||{}).kind;if(k!=='wave'&&k!=='spread'&&!(typeof SPECIAL_KINDS!=='undefined'&&SPECIAL_KINDS.has(k)))g.s=Math.max(g.s,Math.min(n,9));} // 보이는 대원 수 = 발사 줄 수(최대 9), 발당 피해는 줄 수로 나뉘어 총 화력 불변
  g.fan=0; // 가로 나란히 발사로 전환: 각도 부채꼴 없음(Ranger 산탄은 별도 고정)
  return g;}
const HITR={Knight:0.25,Rogue:0.35,Mage:0.35,Rogue_Hooded:0.35,Ranger:0.35,Glaive:0.5,FrostLancer:0.4,Barbarian:0}; // 탄 명중 반경(없으면 즉시 판정 0)
const XTRA={Sorcerer:0.8}; // 연쇄 추가 반경(조준선 0.7→1.5)
function hitR(cls,gr){return cls==='Barbarian'?0.55*(gr.waveW||1):(HITR[cls]||0);}
function latHalf(cls,gr){const e=ENV[cls];if(!e||e.l)return 0;const room=Math.max(0,e.w/2-hitR(cls,gr)-(gr.aoe||0));return Math.min(Math.max(0,((gr.s||1)-1))*LAT_STEP/2,Math.max(0,room-LANE_MIN));} // 가로 나란히 발사 편대의 반폭(총 폭 상자 안)
const LAT_STEP=0.5;const LANE_MIN=0.15; // 조준 레인 최소 반폭: 총 폭(레인+편대+탄 반경) <= 병종 폭 유지
function envHalf(cls,gr){const e=ENV[cls];if(!e)return 9;if(e.l)return e.l;return Math.max(LANE_MIN,e.w/2-hitR(cls,gr)-(gr.aoe||0)-latHalf(cls,gr));} // 조준 레인 반폭
function reachHalf(cls,gr,dz){const e=ENV[cls];const lane=Math.min(0.6+Math.max(0,dz)*(0.08+Math.tan((gr.fan||0)*Math.PI/360)),envHalf(cls,gr));let r=lane+latHalf(cls,gr)+hitR(cls,gr)+(gr.aoe||0)+(XTRA[cls]||0);if(cls==='Ranger')r=Math.max(r,Math.tan(10.5*Math.PI/180)*Math.min(Math.max(0,dz),6)+0.35);return r;} // 실제 타격이 닿는 최대 반폭(레인+탄 반경+폭발/연쇄)
window.__reach=(cls,n,dz)=>{const gr=growth(cls,n);return reachHalf(cls,gr,dz);};
const CAPTIVE_CYCLE=['Mage','Rogue','Barbarian','Rogue_Hooded','Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism']; // 구출 감옥 순환(현재 병종 제외는 스폰 시 결정). 포격수 제거(사용자 11-27 10:00)
const EXTRA_CYCLE=['Rogue_Hooded','Mage','Knight','Barbarian','Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism'];
// ---- 7개 신규 병종(제안서 12종 중 신규): 모델은 기존 5종 재사용(무기·색만 다름), 공격 방식은 고유 ----
const _B=(b,o)=>({...CLASSES[b],...o});
CLASSES.Ranger=_B('Rogue',{kind:'spread',dmg:7,cd:1.0,range:16,color:0x8fe08a,hitEfk:'hit',fxScale:0.11,fxSpeed:2.6}); // maxD 제거: 개편 사거리 16에 맞춰 탄 도달 거리도 연장
CLASSES.Glaive=_B('Barbarian',{kind:'boomerang',dmg:8,cd:1.4,range:10,color:0xffc84a,hitEfk:'hit',fxScale:0.12,fxSpeed:2.4,anim:'2H_Melee_Attack_Slice'});
CLASSES.Sorcerer=_B('Mage',{kind:'chain',dmg:6,cd:1.1,range:10,color:0xbfe6ff,hitEfk:'hit',fxScale:0.14,fxSpeed:2.6});
CLASSES.FrostLancer=_B('Knight',{kind:'lance',dmg:5,cd:0.8,range:15,color:0x7fd8ff,hitEfk:'cold',fxScale:0.11,fxSpeed:2.6});
CLASSES.Pyro=_B('Mage',{kind:'flame',dmg:6,cd:0.3,range:16,color:0xff8a2a,hitEfk:'hit',fxScale:0.1,fxSpeed:2.6}); // 지속 화염 고화력(개편안): DPS 2배급 상향, 사거리도 16으로
CLASSES.Prism=_B('Rogue_Hooded',{kind:'beam',dmg:2.2,cd:0.25,range:16,color:0xe6c8ff,hitEfk:'hit',fxScale:0.1,fxSpeed:2.6,homing:false});
// 발사 간격 단축(사용자 11-26 19:59 "너무 띄엄띄엄" 정정): 원작 석궁 4발/초, 다른 무기 2.2~3.4발/초 수준으로 맞춤. 1발 피해는 간격 비율만큼 낮춰 초당 화력(DPS)은 유지
const CD_NEW={Knight:0.25,Rogue:0.16,Rogue_Hooded:0.20,Mage:0.40,Barbarian:0.50,Ranger:0.40,Glaive:0.50,Sorcerer:0.40,FrostLancer:0.35}; // 로그 0.20→0.16: 초당 6발+ 연발(개편안), 발당 피해는 비율로 낮춰 DPS 유지
for(const k in CD_NEW){const c=CLASSES[k];if(!c)continue;const r=CD_NEW[k]/c.cd;c.cd=CD_NEW[k];c.dmg*=r;}
for(const k of ['Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism'])GROWTH[k]=[[8,{dmg:1.2}],[12,{dmg:1.4}],[16,{dmg:1.6}]];
for(const k in ENV)if(CLASSES[k]&&CLASSES[k].range!==ENV[k].r&&['Ranger','Glaive','Sorcerer','FrostLancer','Pyro','Prism'].includes(k))CLASSES[k].range=ENV[k].r;
const SPECIAL_KINDS=new Set(['boomerang','chain','lance','flame','beam']);

const CLS_KO2={Ranger:'레인저',Glaive:'글레이브',Sorcerer:'소서러',FrostLancer:'프로스트 랜서',Pyro:'파이로',Prism:'프리즘 사수'};
const CLS_KO={...CLS_KO2,Knight:'나이트',Barbarian:'바바리안',Rogue:'로그',Mage:'메이지',Rogue_Hooded:'후드 로그'};
const FOES={
  Warrior:{u:'Skeleton_Warrior.glb',hp:38,spd:1.5,s:0.56,rr:0.6},
  Minion:{u:'Skeleton_Minion.glb',hp:23,spd:2.25,s:0.56,rr:0.5},
  Rogue:{u:'Skeleton_Rogue.glb',hp:29,spd:1.85,s:0.56,rr:0.55},
  Mage:{u:'Skeleton_Mage.glb',hp:26,spd:1.4,s:0.56,rr:0.55},
  Blob:{u:'blob/GreenBlob.gltf',hp:15,spd:2.85,s:0.35,rr:0.4,gltf:true}, // 개편 보정(사용자 승인): 사거리 상향으로 쉬워지는 만큼 체력 +45%·속도 +10%
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
const BOSS={u:'bosses/Mushnub_Evolved.gltf',hp:750,spd:1.2,s:0.95,rr:1.3,gltf:true}; // 개편 보정: 보스 체력 +30% // 접근 1.9->1.2: 전진 2.6과 합산 상대속도 3.8로 기존(3.6) 수준 유지 — 보스전 시간 동일
const BOSSES=[{u:'bosses/Mushnub_Evolved.gltf',name:'머쉬넙',m:1},{u:'bosses/Orc.gltf',name:'오크 대장',m:1.15},{u:'bosses/Cyclops.gltf',name:'사이클롭스',m:1.3},
  {u:'bosses/Yeti.gltf',name:'예티',m:1.2},{u:'bosses/YellowDragon.gltf',name:'황금 드래곤',m:1.25},{u:'bosses/Cthulhu.gltf',name:'심연의 군주',m:1.2,hpm:1.1},
  {u:'cute/Demon.gltf',name:'혼돈의 데몬',m:1.35,hpm:1.2},{u:'cute/GreenDemon.gltf',name:'종말의 마왕',m:1.65,hpm:1.55,tint:[0.62,0.4,0.85]}]; // 보스 순환(원 보스 크기 기준으로 자동 정규화), hpm=체력 배율
const REGION_FOES=[ // 지역별 적 구성·보정(11-27 확장): 후반 지역일수록 강한 조합
  {mix:['Warrior','Warrior','Minion','Rogue'],hp:1,spd:1},           // 1 시작의 들판
  {mix:['Warrior','Minion','Rogue','Rogue','Mage'],hp:1.05,spd:1},    // 2 단풍 숲길: 도적 다수
  {mix:['Minion','Blob','Blob','Minion','Warrior'],hp:0.9,spd:1.15},  // 3 설원: 빠른 물량
  {mix:['Warrior','Warrior','Mage','Mage','Blob'],hp:1.2,spd:0.95},   // 4 화산: 단단한 전사·마법사
  {mix:['Rogue','Mage','Blob','Blob','Minion'],hp:1.05,spd:1.1},      // 5 신비의 늪
  {mix:['Warrior','Mage','Rogue','Blob','Warrior'],hp:1.25,spd:1},    // 6 황혼의 황무지
  {mix:['Mage','Mage','Rogue','Warrior','Blob'],hp:1.35,spd:1.05},    // 7 고대 유적: 마법사 중심
  {mix:['Warrior','Blob','Mage','Rogue','Blob','Warrior'],hp:1.5,spd:1.1}, // 8 종말의 심연
];
const regionOf=n=>Math.floor((Math.max(1,n)-1)/CFG.bossEvery);
const regionFoes=n=>REGION_FOES[regionOf(n)%REGION_FOES.length];
const bboxH=o=>{const b=new THREE.Box3().setFromObject(o);return Math.max(0.01,b.max.y-b.min.y);};

// ---------- state ----------
const G={state:'title',stage:1,lives:CFG.lives,kills:0,level:1,dmgMul:1,statV:0,statB:0,statH:0,statX:0,
  squad:null,cls:'Knight',allies:[],enemies:[],blocks:[],projs:[],stageZ0:0,spawned:new Set(),extra:0,waveGrps:{},vcd:0,burstLeft:0,burstT:0,fxT:0,combo:0,comboT:0,
  layout:[],boss:null,x:0};
const BEST_KEY='arcaneSurgeBestDistance_v1';
let BEST=0;try{BEST=parseInt(localStorage.getItem(BEST_KEY))||0;}catch(e){}
function saveBest(d){if(d>BEST){BEST=d;try{localStorage.setItem(BEST_KEY,String(d));}catch(e){}}}
// ---- 다회차(NG+): 해금 병종은 영구 유지, 클리어 시 시작 편성을 골라 다음 회차로(사용자 승인 11-25 15:16) ----
const NG_KEY='arcaneSurgeNG_v1';
let NG={cycle:1,victories:0,unlocked:['Knight'],carry:null};
try{const r=JSON.parse(localStorage.getItem(NG_KEY));if(r&&r.cycle)NG={cycle:r.cycle|0,victories:r.victories|0,unlocked:Array.isArray(r.unlocked)&&r.unlocked.length?r.unlocked.filter(c=>CLASSES[c]):['Knight'],carry:r.carry&&CLASSES[r.carry.cls]?r.carry:null};}catch(e){}
if(!NG.unlocked.length)NG.unlocked=['Knight'];
function saveNG(){try{localStorage.setItem(NG_KEY,JSON.stringify(NG));}catch(e){}}
function unlockCls(cls){if(CLASSES[cls]&&!NG.unlocked.includes(cls)){NG.unlocked.push(cls);saveNG();}}
const cycleHp=()=>1+0.45*(NG.cycle-1);   // 회차당 적 체력 +45%
const cycleSpd=()=>Math.min(1.35,1+0.06*(NG.cycle-1)); // 회차당 적 속도 +6%(상한 1.35)
const cycleDmg=()=>1+0.10*(NG.cycle-1);  // 회차당 시작 공격력 +10%
G.prevBest=BEST; // 이번 판 시작 시점의 최고 기록(신기록 판정 기준)
G.st={kills:{},dmg:{basic:0,skill:0,magic:0},magic:{tornado:0,meteo:0,thunder:0},chests:0,captives:0,crystals:0,maxCombo:0,maxSquad:1,maxLevel:1,breach:0,bossKills:0,series:[],stageT:{},kStage:{},life:[],lastS:-1};
window.__game=G;
Object.defineProperty(G,'fps',{get:()=>Math.round(fpsEMA)});
Object.defineProperty(G,'summary',{get:()=>({state:G.state,stage:G.stage,lives:G.lives,squad:G.allies.length,enemies:G.enemies.length,blocks:G.blocks.length,kills:G.kills,level:G.level,x:+G.x.toFixed(2),fps:Math.round(fpsEMA),bossHp:G.boss?Math.round(G.boss.hp):null})});
Object.defineProperty(G,'hint',{get:()=>{ // 테스트 하니스용: 가장 가까운 위협/보상 위치
  const sq=G.squad?G.squad.position:{x:0,z:0};
  let foe=null,fd=1e9,blk=null,bd=1e9;
  for(const e of G.enemies){if(e.hp<=0)continue;const d=sq.z-e.obj.position.z;if(d>-2&&d<fd){fd=d;foe={x:+e.obj.position.x.toFixed(2),dz:+d.toFixed(1),boss:!!e.isBoss};}}
  for(const b of G.blocks){if(b.hp<=0)continue;const d=sq.z-b.obj.position.z;if(d>-2&&d<bd){bd=d;blk={x:+b.obj.position.x.toFixed(2),dz:+d.toFixed(1),t:b.btype};}}
  return {foe,blk,sqx:+sq.x.toFixed(2)};}});

// ---------- environment: 무한 진행 — 스테이지(55) 단위 타일을 앞에서 생성·뒤에서 제거, 5스테이지(보스 포함)마다 지역 테마 변경 ----------
const C=h=>new THREE.Color(h);
const THEMES=[
 {name:'시작의 들판',sky:C(0x9fc7e8),fog:C(0xb8d6ee),ground:0x4a7c3a,path:0x8a6f4d,hemi:C(0xbcd8ff),hemiG:C(0x3f5a2e),tint:null},
 {name:'단풍 숲길',sky:C(0xe8be8c),fog:C(0xefcfa6),ground:0x8a6531,path:0x6d5438,hemi:C(0xffe0bd),hemiG:C(0x6a4a24),tint:[1.45,0.8,0.45]},
 {name:'설원',sky:C(0xc7d9ee),fog:C(0xdbe7f4),ground:0xe1ebf4,path:0xb2bfcd,hemi:C(0xdbeaff),hemiG:C(0x9fb0c4),tint:[1.35,1.55,1.9]},
 {name:'잿빛 화산지대',sky:C(0x4b2a38),fog:C(0x5e3440),ground:0x3b2a2c,path:0x57362e,hemi:C(0xffb08a),hemiG:C(0x4a2a24),tint:[0.95,0.5,0.42]},
 {name:'신비의 늪',sky:C(0x2d2a5c),fog:C(0x3d3774),ground:0x35305c,path:0x5a4a7a,hemi:C(0xb9aaff),hemiG:C(0x2a2450),tint:[0.65,0.6,1.35]},
 {name:'황혼의 황무지',sky:C(0xe09a5c),fog:C(0xeab084),ground:0x9a6b3d,path:0x7d5230,hemi:C(0xffd0a0),hemiG:C(0x6b4526),tint:[1.5,0.95,0.55]},
 {name:'고대 유적',sky:C(0x8fa8b8),fog:C(0xa9bec9),ground:0x5e6b66,path:0x8a8f85,hemi:C(0xcfe0e8),hemiG:C(0x46524c),tint:[0.8,0.95,0.9]},
 {name:'종말의 심연',sky:C(0x2a1020),fog:C(0x381428),ground:0x2c1a26,path:0x4a2438,hemi:C(0xff7a6a),hemiG:C(0x3a1a2a),tint:[0.9,0.45,0.6]},
];
const themeOf=n=>THEMES[(Math.floor((Math.max(1,n)-1)/CFG.bossEvery)%THEMES.length+THEMES.length)%THEMES.length];
const REGION_Z=CFG.stageLen*CFG.bossEvery;
const TREE_URLS=['forest/Tree_1_A_Color1.gltf','forest/Tree_2_E_Color1.gltf','forest/Tree_3_A_Color1.gltf'].map(u=>A+u);
const DECO_URLS=[[A+'forest/Bush_1_A_Color1.gltf',1.3],[A+'forest/Rock_1_A_Color1.gltf',0.8],[A+'forest/Grass_1_C_Color1.gltf',0.9],[A+'forest/Rock_2_B_Color1.gltf',0.7]];
const tintCache={},tileMats={},tiles=new Map();
let tileGeoG=null,tileGeoP=null,hemi=null;
function tintedScene(url,th){const key=url+'|'+th.name;if(tintCache[key])return tintCache[key];const g=gltfDone[url];if(!g)return null;
  let sc=g.scene;
  if(th.tint){sc=g.scene.clone(true);sc.traverse(o=>{if(o.isMesh&&o.material&&!Array.isArray(o.material)){o.material=o.material.clone();o.material.color.multiply(new THREE.Color(...th.tint));}});}
  tintCache[key]=sc;return sc;}
function buildTile(k){ // k번째 스테이지 구간(z 0→-55 = k0). 구간 소속 지역 테마로 땅·길·나무 색을 칠함(보스 스테이지 다음 타일부터 새 테마)
  const th=themeOf(k+1),grp=new THREE.Group(),L=CFG.stageLen,zc=-L*(k+0.5);
  if(!tileGeoG){tileGeoG=new THREE.PlaneGeometry(80,L+0.2);tileGeoP=new THREE.PlaneGeometry(5.6,L+0.2);}
  if(!tileMats[th.name])tileMats[th.name]={g:new THREE.MeshStandardMaterial({color:th.ground,roughness:1}),p:new THREE.MeshStandardMaterial({color:th.path,roughness:1})};
  const g=new THREE.Mesh(tileGeoG,tileMats[th.name].g);g.rotation.x=-Math.PI/2;g.position.set(0,-0.02,zc);grp.add(g);
  const pa=new THREE.Mesh(tileGeoP,tileMats[th.name].p);pa.rotation.x=-Math.PI/2;pa.position.set(0,0,zc);grp.add(pa);
  for(let i=0;i<12;i++){const z=-L*k-i*(L/12)+((k*7+i*3)%5)*0.2;
    for(const sxn of [-1,1]){const ti=(k+2)*12+i;
      const off=4.7+((ti*37)%13)/13*2.0;
      const ts=tintedScene(TREE_URLS[ti%3],th);if(ts){const t=ts.clone();
        t.position.set(sxn*off,0,z+((ti*53)%17)/17*1.2);t.rotation.y=(ti*61%360)*Math.PI/180;t.scale.setScalar(0.8+((ti*29)%10)/20);grp.add(t);}
      if(ti%2===0){const d=DECO_URLS[ti%4];const ds=tintedScene(d[0],th);if(ds){const dd=ds.clone();
        dd.position.set(sxn*(3.1+((ti*17)%7)/7*0.7),0,z-1.2);dd.scale.setScalar(d[1]);grp.add(dd);}}}}
  scene.add(grp);return grp;}
function ensureTiles(){
  if(!G.squad)return;const kc=Math.floor(Math.max(0,-G.squad.position.z)/CFG.stageLen);
  for(let k=kc-1;k<=kc+3;k++)if(!tiles.has(k))tiles.set(k,buildTile(k));
  for(const [k,gr] of tiles)if(k<kc-1){scene.remove(gr);tiles.delete(k);}}
function updateSky(){ // 지역 끝(보스 구간) 접근 시 하늘·안개·조명을 다음 테마로 서서히 전환
  const p=Math.max(0,-G.squad.position.z),r=Math.floor(p/REGION_Z),f=(p-r*REGION_Z)/REGION_Z;
  const a=themeOf(r*CFG.bossEvery+1),b=themeOf((r+1)*CFG.bossEvery+1);
  let t=Math.min(1,Math.max(0,(f-0.8)/0.2));t=t*t*(3-2*t);
  scene.background.copy(a.sky).lerp(b.sky,t);scene.fog.color.copy(a.fog).lerp(b.fog,t);
  if(hemi){hemi.color.copy(a.hemi).lerp(b.hemi,t);hemi.groundColor.copy(a.hemiG).lerp(b.hemiG,t);}}
async function buildMeadow(){
  const th=THEMES[0];
  scene.background=th.sky.clone(); scene.fog=new THREE.FogExp2(th.fog.clone().getHex(),0.014);
  hemi=new THREE.HemisphereLight(0xbcd8ff,0x3f5a2e,0.9);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff2dd,2.0);sun.position.set(6,13,5);scene.add(sun);
  for(const u of [...TREE_URLS,...DECO_URLS.map(d=>d[0])])await loadG(u);
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
  const stg0=G.stage; // 비동기 로딩 중 스테이지가 바뀌어도 스폰 시점 스테이지 기준 유지
  let f=isBoss?BOSS:FOES[type];let bdef=null;let bossIdx=0;
  if(isBoss){bossIdx=Math.floor(stg0/CFG.bossEvery);bdef=BOSSES[(bossIdx-1+BOSSES.length*100)%BOSSES.length];
    const gm=await loadG(A+BOSS.u),gb=await loadG(A+bdef.u);const refH=bboxH(gm.scene)*BOSS.s;
    f={...BOSS,u:bdef.u,hp:BOSS.hp*(bdef.hpm||1),s:refH*bdef.m/bboxH(gb.scene),hy:refH*bdef.m+0.8};}
  const rf=regionFoes(stg0); // 지역별 적 보정(조합은 stageLayout이 결정)
  const hscale=(stg0===1?0.52:stageMul(stg0))*(isBoss?cycleHp():rf.hp*cycleHp()); // 기본 체력 +30% 반영: 1스테이지 계수 0.75→0.52로 실효 난이도 유지, 2스테이지부터 상승 곡선 그대로
  const sscale=(isBoss?1:Math.min(1.5,1+0.07*(stg0-1))*(stg0===1?0.85:1))*(isBoss?1:rf.spd)*cycleSpd(); // 원작 참고: 단계가 갈수록 적 이동 가속
  const {root,anims}=await makeModel(A+f.u,f.s,isBoss?(bdef.tint||null):[1.05,0.8,0.8]);
  root.position.set(x,0,z);root.rotation.y=0;
  const unit={kind:'foe',type,isBoss,bossIdx,bossName:bdef?bdef.name:null,hp:Math.round(f.hp*hscale),maxHp:Math.round(f.hp*hscale),cfg:f,spd:f.spd*sscale*(CFG.foeSpdMul||1),obj:root,hitT:0,...makeMixer(root,anims)};
  const walk=unit.acts.Walking_A||unit.acts.Walk||unit.acts.Flying;if(walk){walk.play();walk.time=Math.random();}
  const rr=ring(0xff2233,f.rr);rr.position.y=0.035;root.add(rr);
  const fd=new THREE.Mesh(new THREE.CircleGeometry(f.rr*1.15,28),new THREE.MeshBasicMaterial({color:0xff2233,transparent:true,opacity:0.2,depthWrite:false}));
  fd.rotation.x=-Math.PI/2;fd.position.y=0.03;root.add(fd);
  root.add(discShadow(f.rr*0.9));
  // hp bar
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x331111,depthWrite:false}));bg.scale.set(1.1,0.12,1);
  const fg=new THREE.Sprite(new THREE.SpriteMaterial({color:0xff4444,depthWrite:false}));fg.scale.set(1.06,0.09,1);
  const hy=isBoss?(f.hy||2.6):1.55;bg.position.y=hy;fg.position.y=hy;root.add(bg,fg);unit.hpFg=fg;unit.hpBg=bg;
  scene.add(root);G.enemies.push(unit);
  if(wave!=null){ // 적 무리 머리 위에 남은 총체력 숫자 표시(상자 수치와 같은 의미: 소멸까지 필요한 총 대미지)
    const key=G.stage+':'+wave;
    let g=G.waveGrps[key];
    if(!g){g={hp:0,maxHp:0,members:new Set(),num:makeNumSprite(0)};g.num.sprite.position.set(x,2.9,z);scene.add(g.num.sprite);G.waveGrps[key]=g;}
    g.members.add(unit);g.hp+=unit.maxHp;g.maxHp+=unit.maxHp;drawNum(g.num,Math.ceil(g.hp));
    unit.wave=key;unit.wgrp=g;}
  if(isBoss){G.boss=unit;unit.phase=0;G.bossDead=false;
    if(bossIdx===FINAL_BOSS_IDX)showBanner('⚔ 최종 보스 출현','스테이지 '+G.stage+' · '+unit.bossName+' — 쓰러뜨리면 클리어!','boss',2600);
    else showBanner('⚔ 보스 출현','스테이지 '+G.stage+' · '+unit.bossName,'boss',2200);}
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
  const bhp=Math.round(REC_DPS*blockMul(G.stage)*4.2*(1+0.3*(NG.cycle-1))); // 구간 권장 화력 x 약 4.2초(전진 가속으로 사거리 체류 8.2s->5.4s로 줄어 6초는 파괴 불가 — 동일 파괴 여유 유지), 스폰 시점 고정(현재 공격 배율과 무관 — 제안서) // 원작 참고: 진행할수록 상자 수치 증가 · 회차당 +30%
  const unit={kind:'block',btype:kind,hp:bhp,maxHp:bhp,obj:grp,hitT:0};
  const num=makeNumSprite(bhp);num.sprite.position.y=1.55;grp.add(num.sprite);unit.hpNum=num;
  scene.add(grp);G.blocks.push(unit);
}

// ---------- stage layout ----------
function stageLayout(n){
  const L=[];const z0=-CFG.stageLen*(n-1);
  if(!isBossStage(n)){
    const foeTypes=regionFoes(n).mix; // 지역별 적 조합(11-27 확장)
    [12,17,22,27,32,37,42,47,52,57].forEach((dz,w)=>{ // 파도 8->10개·5 간격(사용자 11-27: 적이 드문드문 — 더 자주 더 많이) — 첫 파도 12부터, 마지막 파도는 다음 구간 초반까지 이어짐
      const cnt=n===1?2+(w%2):Math.min(12,4+n); // 1스테이지는 파도당 2~3마리, 2스테이지부터 늘어남(상한 8->12)
      const cx=[-1.4,1.6,-0.6,1.2,-1.8,0.9,-1.2,1.7,0.2,-0.9][w%10]; // 원작처럼 파도가 통로 이곳저곳에 뭉쳐 나옴 — 가만히 서 있으면 맞지 않는 파도가 생김
      for(let i=0;i<cnt;i++){
        const t=foeTypes[(w+i+n)%foeTypes.length];
        L.push({dz:dz+ (i%2)*1.6, type:'foe',foe:t,x:cx+((i*47)%10)/10*1.4-0.7,wave:w});
      }
    });
    L.push({dz:10,type:'chest',x:-1.5});
    L.push({dz:22,type:'crystal',x:-1.6});
    L.push({dz:32,type:'chest',x:1.6}); // 상자 2개/구간으로 보상 간격 축소
    L.push({dz:44,type:'captive',x:n%2?1.7:-1.7}); // 구간당 감옥 1개, 통로 가장자리(회피 가능)
  }else{
    const rf=regionFoes(n).mix,pick=k=>rf[k%rf.length]; // 보스 구간 잔졸도 지역 조합을 따름
    L.push({dz:8,type:'foe',foe:pick(0),x:0.9,wave:0});
    L.push({dz:11,type:'foe',foe:pick(1),x:1.8,wave:0});
    L.push({dz:15,type:'foe',foe:pick(2),x:1.2,wave:1});
    L.push({dz:19,type:'foe',foe:pick(1),x:0.6,wave:1});
    L.push({dz:21,type:'foe',foe:pick(3),x:1.7,wave:2});
    L.push({dz:23,type:'foe',foe:pick(1),x:0.8,wave:2});
    L.push({dz:25,type:'boss',x:0,wave:'boss'});
    L.push({dz:33,type:'foe',foe:pick(1),x:1.3,wave:3}); // 보스 이후 빈 구간 제거(11-27): 격파 후에도 흐름이 이어지도록 잔여 파도 2줄
    L.push({dz:34,type:'foe',foe:pick(0),x:-1.2,wave:3});
    L.push({dz:38,type:'foe',foe:pick(2),x:0.4,wave:4});
    L.push({dz:39,type:'foe',foe:pick(1),x:-1.6,wave:4});
    L.push({dz:46,type:'foe',foe:pick(0),x:-0.9,wave:5}); // 보스 결전 중에도 잔졸이 계속 도래 — 장기전 중 처치 공백(측정 최대 12초) 방지
    L.push({dz:47,type:'foe',foe:pick(1),x:1.5,wave:5});
    L.push({dz:51,type:'foe',foe:pick(2),x:-1.4,wave:6});
    L.push({dz:52,type:'foe',foe:pick(4),x:0.8,wave:6});
    L.push({dz:42,type:'chest',x:1.6}); // 보스 격파 보상: 이어서 계속 진행
    L.push({dz:51,type:'captive',x:-1.7});
  }
  L.forEach(e=>e.z=z0-e.dz);
  return L;
}
function setStage(n){
  G.stage=n;G.layout=stageLayout(n);G.spawned=new Set();G.stageZ0=-CFG.stageLen*(n-1);
  const th=themeOf(n);G.theme=th;
  const nb=Math.ceil(n/CFG.bossEvery)*CFG.bossEvery;
  document.getElementById('stageName').textContent=(NG.cycle>1?NG.cycle+'회차 · ':'')+`스테이지 ${n} · ${th.name}`;
  document.getElementById('sub').textContent=n===CFG.finalStage?'⚔ 최종 보스':(isBossStage(n)?'⚔ 보스 스테이지':(n<CFG.finalStage?`보스: 스테이지 ${nb}`:'무한 진행'));
  if(G.st){G.st.stageT[n]=G.gtime||0;
    if(n>1&&!isBossStage(n))showBanner('스테이지 '+n,n%CFG.bossEvery===1?'새로운 지역 · '+th.name:'','stage',1400);}
}

// ---------- combat ----------
function corridorK(){const gr=growth(G.cls,G.allies.length);return 0.08+Math.tan((gr.fan||0)*Math.PI/360);} // 사선대 기울기: 기본 0.08 + 성장 부채꼴 반각
const AIM_PAD=1.4; // 11-27 피드백: 조준 레인이 너무 좁아 적이 있어도 발사/명중이 안 됨 -> 자동조준 여유폭
function corridorW(dz){return Math.min(0.6+Math.max(0,dz)*corridorK(),envHalf(G.cls,growth(G.cls,G.allies.length)))+AIM_PAD;} // 사선대 반폭 — 조준·발사·충돌·가이드 표시가 같은 기하에서 파생
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
const EARLY_BONUS=7.0; // 사용자 11-26 22:06 "투사체 공격력이 더 높아야": 초반 보정을 더하는 방식(1명 +3.9, 보이는 대원 9명 상한까지 선형으로 0). 더하기라 대원이 늘 때 총 화력은 줄지 않음(연사/줄 수/피해 분배 구조 불변)
const FORCE=n=>2.6*(0.7+0.3*Math.min(16,Math.max(1,n)))+EARLY_BONUS*Math.min(1,Math.max(0,(9-n)/8)); // 가값
function fireVolley(c,n,gr){ // 일제사격 1회: gr.s갈래 부채꼴, 인원은 발당 피해로 환산
  const sq=G.squad.position;
  let t=squadTarget(c);
  if(!t){if(SPECIAL_KINDS.has(c.kind))return;G.statN=(G.statN||0)+1;t={kind:'none',obj:{position:new THREE.Vector3(sq.x,0.8,sq.z-12)}};} // 대상이 없어도 일정 간격으로 전방 발사
  G.statV++;
  const from=new THREE.Vector3(sq.x,1.0,sq.z-0.6);
  const tp=t.obj.position.clone();tp.y=0.8;
  if(t.kind==='foe'){const dl=Math.hypot(tp.x-from.x,tp.z-from.z);tp.z+=(t.spd||t.cfg.spd)*dl/PSPD;} // 적 전진 선행조준
  const base=Math.atan2(tp.x-from.x,-(tp.z-from.z)); // 전방 0 기준 좌우 각
  const fan=(gr.fan||0)*Math.PI/180;
  const perDmg=c.dmg*G.dmgMul*gr.dmg*FORCE(n)*RANGE_DMG(c.range)/(c.kind==='wave'?1:gr.s); // 총 화력 = 병종 기본 x 병력 곡선 1회 적용(REF_S 이중 적용 제거) x 사거리 감쇠 — 계수는 가값
  if(SPECIAL_KINDS.has(c.kind)){fireSpecial(c,gr,t,from,tp,perDmg,n);for(const u of G.allies)playOnce(u,c.anim,'Walking_A');return;}
  if(c.kind==='spread'){const half=10.5*Math.PI/180;G.statV+=0;for(let i=0;i<7;i++){const ang=0+(i/6-0.5)*2*half;spawnVolleyBolt(c,{...gr,s:7},from,ang,perDmg*0.45,n,true);}efkPlay('hit',from,0.15,2.2);for(const u of G.allies)playOnce(u,c.anim,'Walking_A');return;}
  const dzT=Math.max(0.5,from.z-tp.z),angMax=Math.atan2(corridorW(dzT),dzT); // 탄 궤적이 사선대를 벗어나지 않게 발사각 제한
  const lat=latHalf(G.cls,gr),stp=gr.s>1?2*lat/(gr.s-1):0;
  let ang=base;if(ang>angMax)ang=angMax;if(ang<-angMax)ang=-angMax;
  for(let i=0;i<gr.s;i++){ // 가로로 나란히(평행) 발사 — 병력/탄 수가 늘면 옆으로 늘어남, 총 폭은 병종 상자 안
    const f=from.clone();f.x+=gr.s>1?(i*stp-lat):0;
    spawnVolleyBolt(c,gr,f,ang,perDmg,n);
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
  if(wide)p.k=Math.tan(10.5*Math.PI/180)+0.08;
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
  const aimX=z=>(k==='chain'||k==='flame'||k==='beam')?from.x:from.x+Math.tan(base)*(from.z-z); // 연쇄·화염·광선은 부대 정면 직선 — 조준 레인 + 자체 폭이 총 폭 상자 안에 들도록
  if(k==='boomerang'||k==='lance'){
    const spd=k==='lance'?PSPD*1.7:PSPD*0.8;
    const grp=new THREE.Group();let mesh;
    if(k==='boomerang'){mesh=new THREE.Mesh(new THREE.TorusGeometry(0.6,0.14,6,16),new THREE.MeshBasicMaterial({color:c.color}));mesh.rotation.x=Math.PI/2;}
    else{mesh=new THREE.Mesh(new THREE.ConeGeometry(0.1,1.6,6),new THREE.MeshBasicMaterial({color:c.color}));mesh.rotation.x=-Math.PI/2;grp.add(glowSprite(c.color,0.7));}
    grp.add(mesh);grp.position.copy(from);grp.rotation.y=base;scene.add(grp);
    const vel=new THREE.Vector3(Math.sin(base),0,-Math.cos(base)).multiplyScalar(spd);
    const p={mesh:grp,target:null,owner:{cfg:c,fxT:0},dmg,speed:spd,kind:k,color:c.color,hitEfk:c.hitEfk,fx0:from.x,fz0:from.z,vel,maxDist:k==='boomerang'?c.range:c.range+1,traveled:0,pierce:99,hitSet:new Set(),aoe:0,knock:1,
      waveRad:k==='boomerang'?0.5:0.4,boom:k==='boomerang',slow:k==='lance'?1.6:0};
    if(k==='lance')p.k=0.2;
    {const trId=k==='lance'?'cold':'suzsword';p.efkH=efkPlay(trId,from,k==='lance'?0.16:0.18,2.0);if(p.efkH&&k==='lance'){try{p.efkH.setRotation(0,Math.atan2(vel.x,vel.z)+Math.PI/2,0);}catch(e){p.efkH=null;}}}
    G.projs.push(p);G.statB++;return;}
  if(k==='chain'){
    const pts=[from.clone()];const first=t;const hit=[first];
    const hp=first.obj.position.clone();hp.y=0.9;pts.push(hp);damage(first,dmg,'skill');efkPlay('thunder',new THREE.Vector3(hp.x,0,hp.z),0.12,2.2);
    let last=first;
    for(let h=0;h<4;h++){let best=null,bd=1e9; // 5연쇄(개편안): 첫 대상 + 4회 연쇄
      for(const e of foesAlive()){if(hit.includes(e))continue;const p=e.obj.position;if(p.z>from.z-0.3)continue;
        if(Math.abs(p.x-aimX(p.z))>1.5)continue; // 연쇄는 조준선 ±1.5 안에서만 — 총 폭 3.0
        const d=Math.hypot(p.x-last.obj.position.x,p.z-last.obj.position.z);if(d<=1.5&&d<bd){bd=d;best=e;}}
      if(!best)break;hit.push(best);const q=best.obj.position.clone();q.y=0.9;pts.push(q);damage(best,dmg*0.6,'skill');efkPlay('thunder',new THREE.Vector3(q.x,0,q.z),0.1,2.2);last=best;}
    lineFx(pts,0xbfe6ff,0.22);return;}
  if(k==='flame'){
    const len=c.range;
    for(const o of [...foesAlive(),...G.blocks.filter(b=>b.hp>0)]){const p=o.obj.position;const dz=from.z-p.z;if(dz<=0||dz>len)continue;if(Math.abs(p.x-aimX(p.z))>1.2)continue;damage(o,dmg,'skill');}
    for(let i=1;i<=3;i++){const q=new THREE.Vector3(aimX(from.z-i*1.2),0.6,from.z-i*1.2);efkPlay('fireball',q,0.12+0.03*i,2.2);}efkPlay('flame',new THREE.Vector3(aimX(from.z-2.4),0.4,from.z-2.4),0.12,2.0);return;}
  if(k==='beam'){
    const len=c.range;for(let i=0;i<5;i++){const zz=from.z-1.5-i*3.2;efkPlay('aura',new THREE.Vector3(aimX(zz),0.9,zz),0.16,2.4);}
    for(const o of [...foesAlive(),...G.blocks.filter(b=>b.hp>0)]){const p=o.obj.position;const dz=from.z-p.z;if(dz<=0||dz>len)continue;if(Math.abs(p.x-aimX(p.z))>0.4)continue;damage(o,dmg,'skill');if(o.kind==='foe'&&!(G.sparkT>0)){efkPlay('thunder',new THREE.Vector3(p.x,0,p.z),0.1,2.2);G.sparkT=0.12;}}return;}
}
let BIGI=0;
const BIG_ORDER=['tornado','meteo','thunder'];
const BIG_KO={tornado:'토네이도',meteo:'메테오',thunder:'낙뢰'};
const BIG_DESC={tornado:'전방 끝까지 휩쓸며 적을 갈아냅니다',meteo:'전방으로 운석이 연속 낙하합니다',thunder:'전방 적들에게 연쇄로 번개가 내리칩니다'};
const BIG_LEN=26; // 마법이 훑는 전방 거리(화면 끝까지)
// 대마법: 처치 BIG_EVERY마리마다 자동 발동(순서 고정: 토네이도 → 메테오 → 낙뢰). 모두 부대 앞에서 전방 끝까지 훑으며 피해를 준다.
function castBig(which){
  const kind=which||BIG_ORDER[BIGI++%3];
  const sq=G.squad.position;const dm=G.dmgMul*(1+0.04*G.level)*stageMul(G.stage);G.q=G.q||[];
  const sz0=sq.z,sx0=sq.x;
  G.st.magic[kind]++;
  showBanner('✦ 대마법 · '+BIG_KO[kind],BIG_DESC[kind],'magic',1500);
  const foes=()=>foesAlive().filter(e=>e.obj.position.z<sz0-0.5&&e.obj.position.z>sz0-BIG_LEN-6);
  const mark=(x,z,r,color,ttl)=>{const m=ring(color,r,0.55);m.position.set(x,0.13,z);addFx(m,ttl);return m;};
  if(kind==='tornado'){ // 부대 앞에서 출발해 전방 끝까지 이동하며 닿는 적에게 지속 피해 + 밀어냄
    const pos={x:sx0,z:sz0-2};const SP=13,R=1.9;let tk=0,fxT=0;
    const mk=ring(0x9fe8ff,R,0.5);mk.position.set(pos.x,0.14,pos.z);scene.add(mk);
    G.q.push({t:BIG_LEN/SP,step:(dt)=>{pos.z-=SP*dt;tk+=dt;fxT-=dt;mk.position.set(pos.x,0.14,pos.z);mk.rotation.z+=dt*8;
        if(fxT<=0){fxT=0.14;efkPlay('tornade',new THREE.Vector3(pos.x,0,pos.z),0.38,1.6);}
        if(tk>=0.08){tk=0;for(const o of foesAlive())if(Math.hypot(o.obj.position.x-pos.x,o.obj.position.z-pos.z)<=R){damage(o,6*dm,'magic');o.obj.position.z-=0.08;}}},
      fn:()=>{scene.remove(mk);}});
  }else if(kind==='meteo'){ // 전방 구간을 앞에서 뒤로 8발 연속 낙하: 적이 몰린 곳을 우선 조준(예고 원 → 낙하)
    const N=8;
    for(let i=0;i<N;i++){
      G.q.push({t:0.1+i*0.2,fn:()=>{
        const zc=sz0-4-i*(BIG_LEN-4)/(N-1);let best=null,bd=1e9;
        for(const e of foes()){const dz=Math.abs(e.obj.position.z-zc);if(dz<3.2&&dz<bd){bd=dz;best=e;}}
        const tx=best?best.obj.position.x:sx0+((i*37)%7-3)*0.55;
        const tz=best?best.obj.position.z-(best.spd||best.cfg.spd||1)*0.45*-1:zc; // 낙하 시간만큼 앞질러 조준
        const q=new THREE.Vector3(tx,0,tz);
        mark(q.x,q.z,1.7,0xff5a2a,0.45);
        G.q.push({t:0.45,fn:()=>{efkPlay('meteo',q,0.5,1.4);mark(q.x,q.z,1.7,0xff9a4a,0.4);
          for(const o of foesAlive())if(Math.hypot(o.obj.position.x-q.x,o.obj.position.z-q.z)<=1.7)damage(o,15*dm,'magic');}});
      }});
    }
  }else{ // 낙뢰: 가까운 적부터 전방 끝까지 순서대로(적이 적으면 전방 레인을 따라 빈 곳에도 낙뢰)
    const tg=foes().sort((a,b)=>b.obj.position.z-a.obj.position.z).slice(0,12);
    const M=Math.max(tg.length,7);
    for(let i=0;i<M;i++){
      G.q.push({t:0.08+i*0.11,fn:()=>{
        const e=tg[i];let x,z;
        if(e&&e.hp>0){x=e.obj.position.x;z=e.obj.position.z;}else{z=sz0-3-i*(BIG_LEN-3)/(M-1);x=sx0+((i*53)%7-3)*0.5;}
        const q=new THREE.Vector3(x,0,z);mark(x,z,1.0,0xbfe6ff,0.25);efkPlay('thunder',q,0.22,1.6);
        for(const o of foesAlive())if(Math.hypot(o.obj.position.x-x,o.obj.position.z-z)<=1.0)damage(o,11*dm,'magic');}});
    }
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
  unlockCls(cls); // 한 번 전환한 병종은 영구 해금(다회차 시작 편성 후보)
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
function damage(t,d,src){
  if(t.kind==='block'){const bm=(CLASSES[G.cls]||{}).blockMul||1;d*=bm;} // 바바리안 상자·방벽 3배(개편안)
  const hpB=t.hp;t.hp-=d;t.hitT=0.12;
  if(t.kind==='foe'&&G.st)G.st.dmg[src||'basic']+=Math.min(d,Math.max(0,hpB));
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
    G.kills++;{const key=t.isBoss?'boss':t.type;G.st.kills[key]=(G.st.kills[key]||0)+1;G.st.kStage[G.stage]=(G.st.kStage[G.stage]||0)+1;}
    if(G.kills%BIG_EVERY===0)castBig();G.combo++;G.st.maxCombo=Math.max(G.st.maxCombo,G.combo);G.comboT=4.0; // 콤보 창(시제품 4.0초, 계측 후 조정)
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
    if(t.isBoss){G.bossDead=true;G.st.bossKills++;bossPhase(t);
      if(t.bossIdx===FINAL_BOSS_IDX){showBanner('🏆 최종 보스 격파!',(t.bossName||'보스')+' 처치','boss',2600);
        G.q.push({t:1.8,fn:()=>victory()});}
      else{if(G.lives<CFG.lives)G.lives++; // 보스 격파 보상: 생명 +1(최대치까지) — 끊김 없이 계속 진행
        showBanner('🏆 보스 격파!',(t.bossName||'보스')+' 처치 · 계속 전진','boss',2600);}}
  }else if(t.kind==='block'){
    const p=t.obj.position.clone();p.y=1;
    if(t.btype==='chest'){G.st.chests++;
      {const rp=ring(0xffd966,1.0,0.8);rp.position.set(p.x,0.12,p.z);addFx(rp,0.6);} // 밝은 중심면 없는 얇은 고리 표시(비교빌드)
      const l=labelSprite('대원 +1','#ffd966',2.2);l.position.copy(p).add(new THREE.Vector3(0,1,0));addFx(l,1.6);
      if(G.allies.length<16)spawnAlly(G.cls);
      else{G.dmgMul*=1.1;const l2=labelSprite('단련: 공격력 +10%','#ffd966',2.2);l2.position.copy(p).add(new THREE.Vector3(0,2,0));addFx(l2,1.6);} // 인원 상한(시제품 16) 이후 보상 대체(제안값)
    }else if(t.btype==='captive'){G.st.captives++;
      convertSquad(t.obj.userData.rewardCls||'Knight'); // 전환: 비행탄 제거+전원 교체+1명은 convertSquad 내부
    }else{
      {const rp=ring(0x9fe8ff,1.0,0.8);rp.position.set(p.x,0.12,p.z);addFx(rp,0.6);} // 밝은 중심면 없는 얇은 고리 표시(비교빌드)
      G.dmgMul*=1.2;G.st.crystals++;
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
const KEYS=new Set();
function dragScale(){return 9/Math.min(innerWidth,innerHeight*0.62);} // PC 가로 화면에서도 모바일과 같은 이동감(세로 화면 기준 폭)
function onDown(x){dragging=true;lastPX=x;}
function onMove(x){if(!dragging)return;const dx=(x-lastPX)*dragScale();lastPX=x;
  G.x=THREE.MathUtils.clamp(G.x+dx,-CFG.dragClamp,CFG.dragClamp);}
function onUp(){dragging=false;}
renderer.domElement.addEventListener('pointerdown',e=>onDown(e.clientX));
addEventListener('pointermove',e=>onMove(e.clientX));
addEventListener('pointerup',onUp);
addEventListener('pointercancel',onUp);
const KMAP={ArrowLeft:'L',KeyA:'L',ArrowRight:'R',KeyD:'R'};
function togglePause(){if(G.state!=='play')return;G.paused=!G.paused;const o=document.getElementById('pauseOv');if(o)o.classList.toggle('hidden',!G.paused);} // 일시정지(사용자 11-27)
addEventListener('keydown',e=>{if(e.code==='KeyP'||e.code==='Escape'){togglePause();e.preventDefault();return;}const k=KMAP[e.code];if(!k)return;KEYS.add(k);e.preventDefault();});
addEventListener('keyup',e=>{const k=KMAP[e.code];if(k)KEYS.delete(k);});
addEventListener('blur',()=>KEYS.clear());
function keyMove(dt){const d=(KEYS.has('R')?1:0)-(KEYS.has('L')?1:0);if(d)G.x=THREE.MathUtils.clamp(G.x+d*5.5*dt,-CFG.dragClamp,CFG.dragClamp);}

// ---------- flow ----------
const $=id=>document.getElementById(id);
function preloadAssets(){ // 게임 플레이 중 로딩 지연이 없도록 전 에셋 예비 로드
  const urls=[...Object.values(CLASSES).map(c=>c.u),...Object.values(CLASSES).filter(c=>c.w).map(c=>c.w.u),
    ...Object.values(FOES).map(f=>f.u),...BOSSES.map(b=>b.u),'env/chest_gold.glb',
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
  G.cycle=NG.cycle;
  const form=NG.carry||{cls:START_SQUAD[0],n:START_SQUAD.length}; // 다회차: 선택한 시작 편성(클리어 시 선택)
  G.cls=form.cls;unlockCls(form.cls);
  for(let i=0;i<Math.min(16,form.n);i++)await spawnAlly(form.cls);
  G.dmgMul=cycleDmg();
  const stg=parseInt(new URLSearchParams(location.search).get('stage'))||1; // 테스트용 구간 건너뛰기
  if(stg>1){
    for(let i=0;i<3;i++)await spawnAlly(G.cls);G.extra=3;
    G.dmgMul=2.0;G.level=6;G.kills=40;
    G.squad.position.z=-CFG.stageLen*(stg-1);
  }
  const squadN=parseInt(new URLSearchParams(location.search).get('squad'))||0; // 테스트용 대원 수 고정(12명 동일조건 검증)
  while(squadN>0&&G.allies.length<squadN){await spawnAlly(G.cls);G.extra++;}
  if(WEAK)G.dmgMul=0.05;
  setStage(stg);ensureTiles();updateSky();
  try{await efkInit();}catch(e){console.warn('effekseer off:',e.message);efk=null;}
  window.G=G;window.__efk=()=>efk?Object.keys(efk.eff):null;window.__efkPlay=(id,x,y,z,s,sp)=>efkPlay(id,{x,y,z},s||0.8,sp||1);window.__efkStop=()=>{if(efk)efk.ctx.stopAll();}; // 테스트 훅
  await pre; // 전 에셋 예비 로드 완료 대기
  const sb=$('startBtn');sb.disabled=false;sb.textContent='게임 시작';
  if(NG.cycle>1||NG.victories>0){const ti=$('titleInfo');if(ti)ti.textContent=NG.cycle+'회차 진행 중 · 클리어 '+NG.victories+'회 · 해금 병종 '+NG.unlocked.length+'/'+Object.keys(CLASSES).length;}
  sb.addEventListener('click',()=>{$('title').classList.add('hidden');G.state='play';});
  $('retryBtn').addEventListener('click',()=>location.reload());
  $('pauseBtn').addEventListener('click',()=>togglePause());
  requestAnimationFrame(tick);
}
function fmtT(t){t=Math.round(t);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
function sample(force){
  const st=G.st,t=G.gtime||0;if(!force&&t-st.lastS<1)return;st.lastS=t;
  const d=Math.max(0,Math.floor(-G.squad.position.z));
  st.series.push({t,d,k:G.kills,n:G.allies.length,lv:G.level});
  st.maxSquad=Math.max(st.maxSquad,G.allies.length);st.maxLevel=Math.max(st.maxLevel,G.level);
  if(d>G.prevBest)saveBest(d);}
function chartLines(series,keys,T,marks){ // keys: [{k,color,label}] 각 계열은 자기 최대값 기준 정규화
  const W=320,H=120,pl=6,pr=6,pt=8,pb=16;let out=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart">`;
  const X=t=>pl+(W-pl-pr)*(T>0?t/T:0);
  out+=`<line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" stroke="#44507a" stroke-width="1"/>`;
  for(const m of marks||[])out+=`<line x1="${X(m.t).toFixed(1)}" y1="${pt}" x2="${X(m.t).toFixed(1)}" y2="${H-pb}" stroke="${m.boss?'#ffcc55':'#2c3558'}" stroke-width="${m.boss?1.4:0.8}" ${m.boss?'':'stroke-dasharray="2 3"'}/>`;
  for(const kk of keys){const mx=Math.max(1,...series.map(r=>r[kk.k]));
    const pts=series.map(r=>`${X(r.t).toFixed(1)},${(H-pb-(H-pb-pt)*r[kk.k]/mx).toFixed(1)}`);
    if(kk.fill)out+=`<polygon points="${X(0).toFixed(1)},${H-pb} ${pts.join(' ')} ${X(series[series.length-1].t).toFixed(1)},${H-pb}" fill="${kk.color}" opacity="0.18"/>`;
    out+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${kk.color}" stroke-width="2" stroke-linejoin="round"/>`;}
  for(const m of marks||[])if(m.dot)out+=`<circle cx="${X(m.t).toFixed(1)}" cy="${(H-pb-(H-pb-pt)*m.y).toFixed(1)}" r="3.4" fill="#ff4d5e" stroke="#fff" stroke-width="1"/>`;
  out+=`<text x="${pl}" y="${H-3}" fill="#8c98c4" font-size="9">0:00</text><text x="${W-pr}" y="${H-3}" fill="#8c98c4" font-size="9" text-anchor="end">${fmtT(T)}</text></svg>`;
  return out;}
function bars(items,fmt){const mx=Math.max(1,...items.map(i=>i.v));
  return '<div class="bars">'+items.map(i=>`<div class="br"><span class="bl">${i.l}</span><span class="bt"><i style="width:${(100*i.v/mx).toFixed(1)}%;background:${i.c||'#7a5cff'}"></i></span><span class="bv">${fmt?fmt(i.v):i.v}</span></div>`).join('')+'</div>';}
function dashHTML(dist,rec,cause){
  const st=G.st,T=G.gtime||0,ser=st.series.length>1?st.series:[{t:0,d:0,k:0,n:1,lv:1},{t:Math.max(1,T),d:dist,k:G.kills,n:G.allies.length,lv:G.level}];
  const marks=[];for(const n in st.stageT){if(+n>1&&st.stageT[n]<=T)marks.push({t:st.stageT[n],boss:isBossStage(+n-1)});}
  const lifeDots=st.life.map(l=>({t:l.t,dot:1,y:Math.min(1,l.d/Math.max(1,dist))}));
  const FN={Warrior:'해골 전사',Minion:'해골 미니언',Rogue:'해골 도적',Mage:'해골 마법사',Blob:'슬라임',boss:'보스'};
  const killItems=Object.keys(st.kills).map(k=>({l:FN[k]||k,v:st.kills[k],c:k==='boss'?'#ffcc55':'#ff8a4a'})).sort((a,b)=>b.v-a.v);
  const stg=[];for(let n=1;n<=G.stage;n++)stg.push({l:''+n,v:st.kStage[n]||0,c:isBossStage(n)?'#ffcc55':'#7a5cff'});
  const dmgT=st.dmg.basic+st.dmg.skill+st.dmg.magic||1;
  const pct=v=>Math.round(100*v/dmgT);
  const cards=[['도달 스테이지',G.stage],['처치',G.kills],['최고 레벨',st.maxLevel],['최대 대원',st.maxSquad+'명'],['최대 콤보','×'+st.maxCombo],['플레이 시간',fmtT(T)],
    ['보스 격파',st.bossKills],['적 돌파',st.breach+'회'],['대마법',(st.magic.tornado+st.magic.meteo+st.magic.thunder)+'회'],['상자/구출/수정',st.chests+'/'+st.captives+'/'+st.crystals]];
  return `<div class="hero"><div class="lab">${cause}</div><div class="big">${dist}<small> m</small></div>
    <div class="recline ${rec?'rec':''}">${rec?'🏆 신기록! (이전 최고 '+G.prevBest+' m)':'🏆 최고 기록 '+BEST+' m'+(BEST>dist?' · 신기록까지 '+(BEST-dist+1)+' m':'')}</div></div>
   <div class="cards">${cards.map(c=>`<div class="card"><b>${c[1]}</b><span>${c[0]}</span></div>`).join('')}</div>
   <h3>진행 거리 · 처치 추이</h3>${chartLines(ser,[{k:'d',color:'#6fd3ff',fill:1},{k:'k',color:'#ff9a3c'}],Math.max(1,ser[ser.length-1].t),marks.concat(lifeDots))}
   <div class="legend"><i style="background:#6fd3ff"></i>거리 <i style="background:#ff9a3c"></i>누적 처치 <i style="background:#ffcc55"></i>보스 지점 <i style="background:#ff4d5e;border-radius:50%"></i>생명 손실</div>
   <h3>스테이지별 처치 수</h3>${(()=>{const mx=Math.max(1,...stg.map(i=>i.v));return '<div class="cols">'+stg.map(i=>`<div class="col"><i style="height:${(100*i.v/mx).toFixed(0)}%;background:${i.c}"></i><em>${i.v}</em><span>${i.l}</span></div>`).join('')+'</div>';})()}
   <h3>피해 구성</h3><div class="stack"><i style="width:${pct(st.dmg.basic)}%;background:#6fd3ff"></i><i style="width:${pct(st.dmg.skill)}%;background:#7a5cff"></i><i style="width:${pct(st.dmg.magic)}%;background:#ff9a3c"></i></div>
   <div class="legend"><i style="background:#6fd3ff"></i>일반 사격 ${pct(st.dmg.basic)}% <i style="background:#7a5cff"></i>병종 스킬 ${pct(st.dmg.skill)}% <i style="background:#ff9a3c"></i>대마법 ${pct(st.dmg.magic)}%</div>
   <h3>대마법 발동</h3>${bars(BIG_ORDER.map(k=>({l:BIG_KO[k],v:st.magic[k],c:'#ff9a3c'})))}
   <h3>처치한 적</h3>${bars(killItems)}
   <h3>부대 성장</h3>${chartLines(ser,[{k:'n',color:'#7dff9a'},{k:'lv',color:'#ffd966'}],Math.max(1,ser[ser.length-1].t),marks)}
   <div class="legend"><i style="background:#7dff9a"></i>대원 수(최대 ${st.maxSquad}) <i style="background:#ffd966"></i>레벨(최대 ${st.maxLevel})</div>`;}
function endGame(cause){
  G.state='lose';const dist=Math.max(0,Math.floor(-G.squad.position.z));
  sample(true);const rec=dist>G.prevBest&&dist>0;saveBest(dist);
  $('endTitle').textContent='게임 오버';
  $('endBody').innerHTML=dashHTML(dist,rec,cause==='boss'?'보스가 방어선을 돌파했습니다':'적의 돌파로 생명이 모두 소진되었습니다');
  $('retryBtn').classList.remove('hidden');
  $('end').classList.remove('hidden');$('end').scrollTop=0;
}
function carryCount(){return Math.min(8,Math.max(2,Math.ceil(G.st.maxSquad/2)));} // 이월 편성 규모: 이번 판 최대 대원의 절반(2~8명) — 수치는 플레이 테스트로 조정 예정(사용자 승인 11-25)
function victory(){ // 40스테이지 최종 보스 격파: 클리어 대시보드 + 다음 회차(NG+) 시작 편성 선택
  if(G.state==='win')return;
  G.state='win';
  NG.victories++;saveNG();
  const dist=Math.max(0,Math.floor(-G.squad.position.z));
  sample(true);saveBest(dist);
  $('endTitle').textContent='🏆 아케인 서지 클리어!';
  $('endBody').innerHTML=dashHTML(dist,false,'8개 지역 · 40스테이지를 모두 정복했습니다');
  const n=carryCount(),nc=NG.cycle+1;
  const p=document.createElement('div');p.id='ngPanel';
  p.innerHTML='<h3>다음 회차(NG+) — 시작 병종 선택</h3><div class="nginfo">해금된 병종과 최고 기록은 영구 유지됩니다. 고른 병종 '+n+'명으로 '+nc+'회차를 시작합니다.<br>'+nc+'회차: 적 체력 +'+Math.round(0.45*NG.cycle*100)+'% · 상자 수치 +'+Math.round(0.3*NG.cycle*100)+'% · 시작 공격력 +'+Math.round(0.10*NG.cycle*100)+'%</div><div class="ngbtns"></div>';
  const btns=p.querySelector('.ngbtns');
  NG.unlocked.forEach(cls=>{const b=document.createElement('button');b.className='go ngbtn';b.textContent=CLS_KO[cls]+' 부대 ('+n+'명)';
    b.addEventListener('click',()=>{NG.cycle=nc;NG.carry={cls,n};saveNG();location.reload();});btns.appendChild(b);});
  $('endBody').appendChild(p);
  $('retryBtn').classList.add('hidden');
  $('end').classList.remove('hidden');$('end').scrollTop=0;
}
let __bn=null;
function showBanner(t,sub,cls,ms){const b=document.getElementById('banner');if(!b)return;
  b.className='banner '+(cls||'');b.innerHTML='<b>'+t+'</b>'+(sub?'<span>'+sub+'</span>':'');void b.offsetWidth;b.classList.add('show');
  clearTimeout(__bn);__bn=setTimeout(()=>b.classList.remove('show'),ms||1500);}

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
  if(G.state==='play'&&!G.paused)update(dt);
  // camera follows squad
  cam.position.set(G.squad?G.squad.position.x*0.4:0,17,(G.squad?G.squad.position.z:0)+13.5);
  cam.lookAt(G.squad?G.squad.position.x*0.3:0,0,(G.squad?G.squad.position.z:0)-11);
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
  keyMove(dt);
  G.squad.position.x+=(G.x-G.squad.position.x)*Math.min(1,dt*10);
  const sq=G.squad.position;
  { // 가이드: 사선대 경계 2줄 — corridorW(실제 조준·충돌 판정 함수)를 그대로 샘플링해 그림: 보이는 모양 = 실제 타격 범위(성장·고정 총 폭 상자 반영)
    const N=14;if(!G.guideStrips){G.guideL.visible=false;G.guideR.visible=false;
      const mk=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((N+1)*2*3),3));
        const idx=[];for(let i=0;i<N;i++){const a0=i*2;idx.push(a0,a0+1,a0+2,a0+1,a0+3,a0+2);}g.setIndex(idx);
        const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.12,depthWrite:false,side:THREE.DoubleSide}));m.frustumCulled=false;scene.add(m);return m;};
      G.guideStrips=[mk(),mk()];G.reachStrips=[mk(),mk()];for(const m of G.reachStrips)m.material.color.set(0xffb060);}
    const len=CLASSES[G.cls].range;
    if(G.guideStrips){for(const m of G.guideStrips.concat(G.reachStrips))m.visible=false;}
    else{}
    if(false)[-1,1].forEach((sgn,si)=>{const pos=G.guideStrips[si].geometry.attributes.position;
      for(let i=0;i<=N;i++){const dz=len*i/N;const hw=corridorW(dz);const z=sq.z-0.6-dz;
        pos.setXYZ(i*2,sq.x+sgn*hw,0.06,z);pos.setXYZ(i*2+1,sq.x+sgn*(hw+0.07),0.06,z);}
      pos.needsUpdate=true;
      const rp=G.reachStrips[si].geometry.attributes.position,grr=growth(G.cls,G.allies.length);
      for(let i=0;i<=N;i++){const dz=len*i/N;const hw=reachHalf(G.cls,grr,dz);const z=sq.z-0.6-dz;rp.setXYZ(i*2,sq.x+sgn*hw,0.05,z);rp.setXYZ(i*2+1,sq.x+sgn*(hw+0.07),0.05,z);}
      rp.needsUpdate=true;});
  }
  // stage spawning
  G.layout.forEach((e,i)=>{
    if(G.spawned.has(i))return;
    if(e.z<sq.z-34)return; // 예지 24->34: 다음 구간 파도가 전환 전에 미리 접근을 시작해 스테이지 경계의 전투 공백 제거(사용자 11-27)
    G.spawned.add(i);
    if(e.type==='foe'){if(!BOSSONLY)spawnFoe(e.foe,e.x,e.z,false,e.wave);}
    else if(e.type==='boss')spawnFoe(null,e.x,e.z,true,e.wave);
    else if(!BOSSONLY)spawnBlock(e.type,e.x,e.z);
  });
  // stage clear
  if(sq.z<G.stageZ0-CFG.stageLen+18)setStage(G.stage+1); // 보스를 잡든 아니든 끊김 없이 다음 스테이지로 이어짐(무한 진행)
  ensureTiles();updateSky(); // 경계 전에 다음 구역 생성 — 잔적 정리와 다음 파도가 겹쳐 공백 제거
  // allies: 통일 부대 일제사격 — 탄 수/패턴은 성장 단계, 인원은 탄 1발 피해로 환산(설계 v2, 수치 초안)
  for(const u of G.allies)u.mixer.update(dt);
  G.fxT=Math.max(0,G.fxT-dt);G.sparkT=Math.max(0,(G.sparkT||0)-dt);G.fx3T=Math.max(0,(G.fx3T||0)-dt);
  const c=CLASSES[G.cls],n=G.allies.length,gr=growth(G.cls,n);
  if(G.burstLeft>0){G.burstT-=dt;if(G.burstT<=0){fireVolley(c,n,gr);G.burstLeft--;G.burstT=0.09;}}
  else{G.vcd-=dt;
    if(G.vcd<=0&&(squadTarget(c)||!SPECIAL_KINDS.has(c.kind))){fireVolley(c,n,gr);if(gr.burst>1){G.burstLeft=gr.burst-1;G.burstT=0.09;}
      G.vcd=Math.max(0.08,c.cd*gr.rate);}}
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
      if(e.isBoss){endGame('boss');return;} // 보스 돌파는 즉시 패배
      scene.remove(e.obj);G.enemies.splice(G.enemies.indexOf(e),1);
      if(e.wgrp){e.wgrp.members.delete(e);if(e.wgrp.members.size===0){scene.remove(e.wgrp.num.sprite);delete G.waveGrps[e.wave];}}
      G.lives--;G.st.breach++;G.st.life.push({t:G.gtime,d:Math.max(0,Math.floor(-sq.z))});
      const l=labelSprite('돌파!','#ff6666',1.8);l.position.set(e.obj.position.x,1.5,sq.z+1);addFx(l,1.2);
      if(G.lives<=0){endGame('life');return;}
    }
  }
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
    if(b.remove)scene.remove(b.obj);
    else if(b.obj.position.z>sq.z+8){scene.remove(b.obj);const bi=G.blocks.indexOf(b);if(bi>=0)G.blocks.splice(bi,1);}} // 지나친 상자 정리(무한 진행 대비)
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
      for(const e of G.enemies)if(e.hp>0&&e.deadT==null&&!p.hitSet.has(e))seg(e,(p.waveRad||0.35)+(e.cfg&&e.cfg.rr?e.cfg.rr*0.45:0.2));
      if(!hit)for(const b of G.blocks)if(b.hp>0)seg(b,(p.waveRad||0.35)+0.1);
      if(hit){G.statH++;const hp2=hit.obj.position.clone();hp2.y=0.8;
        if(G.fxT<=0){efkPlay(p.hitEfk||'hit',hp2,(p.owner.cfg.fxScale||0.4)*(fxTier()>=2?1.3:1),p.owner.cfg.fxSpeed||1.4);G.fxT=0.07;} // 2단계~ 명중 섬광 확대(가값)
        if(p.slow&&hit.kind==='foe'){hit.slowT=p.slow;efkPlay('toonwater',hp2,0.12,1.8);}
        if(p.knock>1&&hit.kind==='foe')hit.obj.position.z-=0.2*(p.knock-1); // 충격파 넉백(보임이 성장 체감)
        damage(hit,p.dmg,SPECIAL_KINDS.has(p.kind)?'skill':'basic');
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
  // 대형 마법 예약 이벤트
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
  $('clsName').textContent=CLS_KO[G.cls]||G.cls; // 현재 부대 병종 이름 상시 표시(사용자 11-27)
  if(G.combo<2)$('combo').classList.remove('on');
  $('lv').textContent=G.level;
  $('kills').textContent=G.kills;
  { const dist=Math.max(0,Math.floor(-sq.z));sample(false);
    $('dist').textContent=dist;const bestShown=Math.max(G.prevBest,dist);$('best').textContent=bestShown;
    $('scoreBox').classList.toggle('rec',dist>G.prevBest&&G.prevBest>0);
    const mk=G.kills%BIG_EVERY;$('magicBar').style.width=(100*mk/BIG_EVERY)+'%';
    $('magicTxt').textContent='대마법 '+mk+'/'+BIG_EVERY+' · 다음 '+BIG_KO[BIG_ORDER[BIGI%3]]; }
  $('fps').textContent=Math.round(fpsEMA)+' fps · 초안';
}
init().catch(e=>{console.error(e);window.__err=String(e.stack||e);});
window.__spawn=async(type,x,dz)=>{await spawnFoe(type,x,G.squad.position.z-dz,false,null);return 1;}; // 테스트 훅
window.__step=(n,dt)=>{window.__fn=(window.__fn||performance.now());for(let i=0;i<n;i++){window.__skipDraw=i<n-1;window.__fn+=dt*1000;tick(window.__fn);}last=performance.now();return 1;}; // 검증 훅: 수동 프레임 진행(실제 렌더는 마지막 프레임만) — 종료 시 내부 시계를 실시간에 재동기화(rAF 보간 프레임의 음수 dt 되감기 방지)
window.__numTest=(n,x,z)=>{const o=makeNumSprite(n);o.sprite.position.set(x,2,G.squad.position.z-z);scene.add(o.sprite);return 1;}; // 검증 훅: 숫자 스프라이트 표시
window.__bossTest=async(stage,x,dz)=>{const o=G.stage;G.stage=stage;await spawnFoe(null,x,G.squad.position.z-dz,true,'boss');G.stage=o;return 1;}; // 검증 훅
window.__end=c=>endGame(c);
window.__fwd=v=>{CFG.fwdSpeed=v;return 1;}; // 검증 훅
window.__ng=()=>NG; // 검증 훅: 다회차 상태
window.__layout=n=>stageLayout(n); // 검증 훅: 구간 배치(지역별 적 조합 확인)
window.__theme=n=>themeOf(n).name; // 검증 훅: 지역 테마 이름
window.__victory=()=>victory(); // 검증 훅
