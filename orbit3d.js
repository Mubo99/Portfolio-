/* Real 3D glass app tiles around the portrait (Three.js).
   - on load the tiles swing in on a wide loop around the portrait (passing behind it), slow down and stop
   - when the theme switches (dark <-> light) every tile makes one full lap around the portrait
     (behind it, then in front again), changing look on the way
   - tiles behind the portrait are drawn on a canvas under it and dimmed a little for depth
   If WebGL or the CDN is unavailable, the page falls back to the CSS tiles. */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const hero=document.getElementById('hero');
const html=document.documentElement;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

try{init()}catch(e){console.warn('3D tiles unavailable, using CSS tiles',e)}

function init(){
  const probe=document.createElement('canvas');
  if(!(probe.getContext('webgl2')||probe.getContext('webgl')))throw new Error('no WebGL');

  /* ---- canvases: "front" is the WebGL canvas, "back" gets a (dimmed) copy of the back pass ---- */
  const front=document.createElement('canvas');front.id='gl-front';
  const back=document.createElement('canvas');back.id='gl-back';
  hero.appendChild(back);hero.appendChild(front);
  const bctx=back.getContext('2d');
  hero.classList.add('gl3d');

  const renderer=new THREE.WebGLRenderer({canvas:front,alpha:true,antialias:true});
  renderer.setClearColor(0x000000,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  const scene=new THREE.Scene();
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;
  const key=new THREE.DirectionalLight(0xffffff,2.3);key.position.set(-400,500,800);scene.add(key);
  const rim=new THREE.DirectionalLight(0xaecbff,1.3);rim.position.set(500,-200,-300);scene.add(rim);
  const camera=new THREE.PerspectiveCamera(30,1,10,6000);

  /* ---- tile definitions ---- */
  const SPEC=[
    {n:'Ps',dark:{bg:'#07304f',fg:'#4cb8ff'},light:{bg:'#a9d8ff',fg:'#032a47'}},
    {n:'Ai',dark:{bg:'#3a0b00',fg:'#ffa11a'},light:{bg:'#ffd29a',fg:'#4a1500'}},
    {n:'Lr',dark:{bg:'#07304f',fg:'#4cb8ff'},light:{bg:'#a9d8ff',fg:'#032a47'}},
    {n:'Pr',dark:{bg:'#10105f',fg:'#c7a8ff'},light:{bg:'#cfc2ff',fg:'#1b0f5c'}},
    {n:'Ae',dark:{bg:'#10105f',fg:'#a3a3ff'},light:{bg:'#c4c4ff',fg:'#14145c'}},
    {n:'DV',dark:{bg:'#18181c',fg:'#ffffff'},light:{bg:'#ececf1',fg:'#18181c'}}
  ];
  const frameGeo=new RoundedBoxGeometry(100,100,26,6,22);
  const rimGeo=new RoundedBoxGeometry(89,89,20,6,17);
  const glassGeo=new RoundedBoxGeometry(84,84,22,6,15);
  const faceGeo=new THREE.PlaneGeometry(68,68);
  const shadowGeo=new THREE.PlaneGeometry(190,190);
  const chrome=new THREE.MeshStandardMaterial({color:0xe6e6ee,metalness:1,roughness:.12,envMapIntensity:1.5});
  const rimMat=new THREE.MeshStandardMaterial({color:0x151519,metalness:.85,roughness:.38,envMapIntensity:.9});

  /* soft contact shadow under each tile */
  const shadowTex=(()=>{
    const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
    const g=x.createRadialGradient(64,64,4,64,64,62);g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(.6,'rgba(0,0,0,.22)');g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
  })();
  const shadowMat=new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.55});

  function hex(h){h=h.replace('#','');return[0,2,4].map(i=>parseInt(h.substr(i,2),16))}
  function toHex(a){return'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}
  function shade(h,p){return toHex(hex(h).map(v=>v*(1+p)))}
  function lighten(h,p){return toHex(hex(h).map(v=>v+(255-v)*p))}
  function faceTexture(spec,variant){
    const v=spec[variant],c=document.createElement('canvas');c.width=c.height=256;
    const x=c.getContext('2d');x.clearRect(0,0,256,256);
    if(spec.n==='DV'){
      const balls=[[128,86,'#ff5a5a','#a50e0e'],[88,160,'#37d985','#0b7a3c'],[168,160,'#4a8cff','#1239a8']];
      balls.forEach(([bx,by,c1,c2])=>{
        const g=x.createRadialGradient(bx-14,by-16,6,bx,by,56);g.addColorStop(0,'#ffffff');g.addColorStop(.25,c1);g.addColorStop(1,c2);
        x.fillStyle=g;x.beginPath();x.arc(bx,by,56,0,7);x.fill();
      });
    }else{
      x.font='800 156px Inter, "Helvetica Neue", Arial, sans-serif';x.textAlign='center';x.textBaseline='middle';
      for(let k=9;k>=1;k--){x.fillStyle=shade(v.fg,-.18-k*.045);x.fillText(spec.n,128+k*1.1,136+k*1.5)}
      const g=x.createLinearGradient(0,60,0,200);g.addColorStop(0,lighten(v.fg,.45));g.addColorStop(.5,v.fg);g.addColorStop(1,shade(v.fg,-.25));
      x.fillStyle=g;x.fillText(spec.n,128,136);
      x.lineWidth=2;x.strokeStyle='rgba(255,255,255,.35)';x.strokeText(spec.n,128,136);
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
  }

  const tiles=SPEC.map(spec=>{
    const group=new THREE.Group();
    const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.position.set(6,-14,-18);
    const frame=new THREE.Mesh(frameGeo,chrome);
    const rimM=new THREE.Mesh(rimGeo,rimMat);rimM.position.z=2.5;
    const glassMat=new THREE.MeshPhysicalMaterial({color:spec.dark.bg,roughness:.08,metalness:.05,clearcoat:1,clearcoatRoughness:.03,
      iridescence:.55,iridescenceIOR:1.35,iridescenceThicknessRange:[120,420],sheen:.4,sheenColor:new THREE.Color(0x8fb4ff),envMapIntensity:1.7});
    const glass=new THREE.Mesh(glassGeo,glassMat);glass.position.z=4;
    const tex={dark:faceTexture(spec,'dark'),light:faceTexture(spec,'light')};
    const faceMat=new THREE.MeshBasicMaterial({map:tex.dark,transparent:true,toneMapped:false});
    const face=new THREE.Mesh(faceGeo,faceMat);face.position.z=15.8;
    group.add(shadow,frame,rimM,glass,face);group.visible=false;scene.add(group);
    return{spec,group,glassMat,faceMat,tex,variant:'dark',front:true,a0:0,anim:null,spin:null};
  });

  /* ---- layout: the tiles sit on an ellipse around the portrait ---- */
  const ANG=[-70,-22,26,74,118,-120].map(d=>d*Math.PI/180);   /* 4 in front, 2 behind at the sides */
  let W=1,H=1,S=86,dpr=1,R=300,RY=50,CX=0,CY=0;
  function layout(){
    W=hero.clientWidth;H=hero.clientHeight;dpr=Math.min(devicePixelRatio||1,2);
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);
    back.width=Math.round(W*dpr);back.height=Math.round(H*dpr);
    camera.aspect=W/H;camera.position.set(0,0,(H/2)/Math.tan(15*Math.PI/180));camera.updateProjectionMatrix();
    const small=W<700;
    S=small?58:Math.min(124,Math.max(84,W*.082));
    R=Math.min(W*(small?.38:.35),620);RY=R*.17;CX=W/2;CY=H*(small?.62:.64);
    tiles.forEach((t,i)=>{t.a0=ANG[i]});
    dirty=true;
  }

  /* ---- animation ---- */
  const easeOut=u=>1-Math.pow(1-u,3),easeInOut=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
  let clock=0,dirty=true,visible=true,started=false,lastMX=0,lastMY=0;
  const themeNow=()=>html.dataset.theme==='light'?'light':'dark';

  function setVariant(t,v){
    if(t.variant===v)return;t.variant=v;
    t.glassMat.color.set(t.spec[v].bg);t.faceMat.map=t.tex[v];t.faceMat.needsUpdate=true;
  }
  function startIntro(){
    started=true;
    tiles.forEach((t,i)=>{
      setVariant(t,themeNow());
      t.group.visible=true;
      t.anim=reduce?null:{t0:clock+.05+i*.09,dur:2.1};
    });
    dirty=true;
  }
  function startLap(){
    if(!started)return;
    const v=themeNow();
    tiles.forEach((t,i)=>{
      if(reduce){setVariant(t,v);return}
      t.spin={t0:clock+i*.08,dur:1.8,to:v,swapped:false};
    });
    dirty=true;
  }
  new MutationObserver(()=>{if(themeNow()!==tiles[0].variant&&!tiles[0].spin)startLap()}).observe(html,{attributes:true,attributeFilter:['data-theme']});

  function update(now){
    clock=now/1000;
    const mx=parseFloat(hero.style.getPropertyValue('--mx'))||0,my=parseFloat(hero.style.getPropertyValue('--my'))||0;
    key.position.set(-400+mx*600,500-my*350,800);            /* highlights glide across the glass as you move the mouse */
    let busy=false;
    tiles.forEach(t=>{
      let a=t.a0,rf=1,sc=1;
      if(t.anim){
        const u=(clock-t.anim.t0)/t.anim.dur;
        if(u<0){t.group.visible=false;busy=true;return}
        t.group.visible=true;
        if(u>=1){t.anim=null;busy=true}
        else{busy=true;const e=easeOut(u);a=t.a0-(1-e)*Math.PI*2.6;rf=1+(1-e)*.5;sc=.55+.45*e}
      }
      if(t.spin){
        const u=(clock-t.spin.t0)/t.spin.dur;
        busy=true;
        if(u>=1){setVariant(t,t.spin.to);t.spin=null}
        else if(u>=0){
          const e=easeInOut(u);a=t.a0+e*Math.PI*2;sc*=1+Math.sin(Math.PI*u)*.1;
          if(u>.5&&!t.spin.swapped){setVariant(t,t.spin.to);t.spin.swapped=true}
        }
      }
      const s=Math.sin(a),c=Math.cos(a);
      t.front=c>0;
      const x=CX+R*rf*s,y=CY+RY*rf*c,z=c*R*.45,depth=.9+.1*c;
      t.group.position.set(x-W/2+mx*16,-(y-H/2)-my*8,z);
      t.group.rotation.set(-my*.22+c*.1,-s*.62+mx*.3,0);
      t.group.scale.setScalar(S/100*sc*depth);
    });
    if(Math.abs(mx-lastMX)>.0005||Math.abs(my-lastMY)>.0005){busy=true;lastMX=mx;lastMY=my}
    return busy;
  }

  function render(){
    tiles.forEach(t=>{t.vis=t.group.visible;t.group.visible=t.vis&&!t.front});
    renderer.render(scene,camera);
    bctx.clearRect(0,0,back.width,back.height);
    bctx.filter='brightness(.74) saturate(.92)';             /* tiles behind you are a little darker: depth */
    bctx.drawImage(front,0,0,back.width,back.height);
    bctx.filter='none';
    tiles.forEach(t=>{t.group.visible=t.vis&&t.front});
    renderer.render(scene,camera);
    tiles.forEach(t=>{t.group.visible=t.vis});
  }

  function frame(now){
    requestAnimationFrame(frame);
    if(!visible&&!dirty)return;
    const busy=update(now);
    if(busy||dirty){render();dirty=false}
  }

  new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)dirty=true}).observe(hero);
  addEventListener('resize',()=>{layout()});
  layout();
  requestAnimationFrame(frame);
  /* wait for fonts so the letters on the tiles use Inter, then start right after the name and portrait appear */
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(()=>{
    tiles.forEach(t=>{t.tex={dark:faceTexture(t.spec,'dark'),light:faceTexture(t.spec,'light')};t.faceMat.map=t.tex[t.variant];t.faceMat.needsUpdate=true});
    setTimeout(startIntro,reduce?0:850);
  });
}
