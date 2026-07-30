"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "menu" | "countdown" | "playing" | "over";
type Car = { x:number;y:number;vx:number;vy:number;a:number;hp:number;color:string;name:string;player?:boolean;dead?:boolean;hit?:number;boostTime?:number;boostCooldown?:number;place?:number;mineUsed?:boolean };
type Pickup = { x:number;y:number;type:"repair"|"boost";active:boolean };
type Particle = { x:number;y:number;vx:number;vy:number;life:number;color:string };
type Mine = { x:number;y:number;owner:number;arm:number;active:boolean };
type VoiceRecognition = { lang:string;continuous:boolean;interimResults:boolean;onresult:((e:{resultIndex:number;results:ArrayLike<{0:{transcript:string}}>} )=>void)|null;onend:(()=>void)|null;onerror:(()=>void)|null;start:()=>void;stop:()=>void };

const TAU = Math.PI * 2;
const COLORS = ["#ff4f64", "#4ad9ff", "#c8ff49", "#ffbe3d", "#a86bff", "#ff67c8"];
const NAMES = ["나", "번개", "독사", "탱크", "유령", "로켓"];

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("menu");
  const input = useRef({ left:false,right:false,gas:false,brake:false,boost:false });
  const joystick = useRef({ steer:0, pointerId:-1 });
  const voiceRecognition = useRef<VoiceRecognition|null>(null);
  const voiceEnabled = useRef(false);
  const game = useRef({ cars:[] as Car[], particles:[] as Particle[], pickups:[] as Pickup[], mines:[] as Mine[], time:75, boost:100, boostTime:0, boostCooldown:0, score:0, shake:0 });
  const [phase,setPhaseState] = useState<Phase>("menu");
  const [stickX,setStickX] = useState(0);
  const [voiceStatus,setVoiceStatus] = useState<"off"|"listening"|"unsupported">("off");
  const [hud,setHud] = useState({hp:100,time:75,boost:100,score:0,alive:6,rank:1,mine:true});

  const setPhase = (p:Phase) => { phaseRef.current=p;if(p==="over"){voiceEnabled.current=false;voiceRecognition.current?.stop();setVoiceStatus("off");}setPhaseState(p); };
  const init = useCallback(() => {
    game.current = {
      cars: [
        {x:0,y:210,vx:0,vy:0,a:-Math.PI/2,hp:100,color:COLORS[0],name:NAMES[0],player:true},
        {x:0,y:-210,vx:0,vy:0,a:Math.PI/2,hp:100,color:COLORS[1],name:NAMES[1]},
        {x:-310,y:0,vx:0,vy:0,a:0,hp:100,color:COLORS[2],name:NAMES[2]},
        {x:310,y:0,vx:0,vy:0,a:Math.PI,hp:100,color:COLORS[3],name:NAMES[3]},
        {x:-245,y:175,vx:0,vy:0,a:-.45,hp:100,color:COLORS[4],name:NAMES[4]},
        {x:245,y:-175,vx:0,vy:0,a:2.7,hp:100,color:COLORS[5],name:NAMES[5]},
      ],
      particles:[], pickups:[{x:-150,y:-80,type:"boost",active:true},{x:170,y:95,type:"repair",active:true}], mines:[],
      time:75,boost:100,boostTime:0,boostCooldown:0,score:0,shake:0
    };
    setHud({hp:100,time:75,boost:100,score:0,alive:6,rank:1,mine:true});
  },[]);
  const triggerBoost = () => {
    const g=game.current;
    if(phaseRef.current==="playing"&&g.boostCooldown<=0){g.boostTime=.85;g.boostCooldown=3;}
  };
  const dropMine = () => {
    const g=game.current,car=g.cars[0];
    if(phaseRef.current==="playing"&&car&&!car.dead&&!car.mineUsed){
      car.mineUsed=true;
      g.mines.push({x:car.x-Math.cos(car.a)*48,y:car.y-Math.sin(car.a)*48,owner:0,arm:.8,active:true});
    }
  };
  const startVoiceMine = () => {
    const speechWindow=window as typeof window & {SpeechRecognition?:new()=>VoiceRecognition;webkitSpeechRecognition?:new()=>VoiceRecognition};
    const Recognition=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    if(!Recognition){setVoiceStatus("unsupported");return;}
    if(!voiceRecognition.current){
      const recognition=new Recognition();
      recognition.lang="ko-KR";recognition.continuous=true;recognition.interimResults=false;
      recognition.onresult=(event)=>{
        for(let i=event.resultIndex;i<event.results.length;i++){
          const command=event.results[i][0].transcript.replace(/\s/g,"");
          if(command.includes("지뢰"))dropMine();
        }
      };
      recognition.onend=()=>{if(voiceEnabled.current)window.setTimeout(()=>{try{recognition.start();setVoiceStatus("listening");}catch{}},250);};
      recognition.onerror=()=>setVoiceStatus("off");
      voiceRecognition.current=recognition;
    }
    voiceEnabled.current=true;
    try{voiceRecognition.current.start();setVoiceStatus("listening");}catch{}
  };
  const start = () => { init();setPhase("countdown");setTimeout(()=>setPhase("playing"),2200); };
  const moveJoystick = (e:React.PointerEvent<HTMLElement>) => {
    if(joystick.current.pointerId!==e.pointerId)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=Math.max(-1,Math.min(1,(e.clientX-(rect.left+rect.width/2))/(rect.width*.34)));
    joystick.current.steer=x;setStickX(x);
  };
  const releaseJoystick = (e:React.PointerEvent<HTMLElement>) => {
    if(joystick.current.pointerId!==e.pointerId)return;
    joystick.current.pointerId=-1;joystick.current.steer=0;setStickX(0);
  };
  const bind = (key:keyof typeof input.current) => ({
    onPointerDown:(e:React.PointerEvent)=>{ e.preventDefault(); input.current[key]=true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); },
    onPointerUp:()=>input.current[key]=false,
    onPointerCancel:()=>input.current[key]=false,
    onPointerLeave:(e:React.PointerEvent)=>{ if(!e.buttons) input.current[key]=false; }
  });

  useEffect(()=>{
    const c=canvas.current!; const ctx=c.getContext("2d")!;
    let raf=0,last=performance.now(),hudTick=0;
    const resize=()=>{ const d=Math.min(devicePixelRatio,2); c.width=innerWidth*d;c.height=innerHeight*d;c.style.width=innerWidth+"px";c.style.height=innerHeight+"px";ctx.setTransform(d,0,0,d,0,0); };
    resize(); addEventListener("resize",resize);
    const key=(e:KeyboardEvent,v:boolean)=>{if(["ArrowDown","s","S"].includes(e.key))input.current.brake=v;if(e.code==="Space"&&v)triggerBoost(); };
    const kd=(e:KeyboardEvent)=>key(e,true), ku=(e:KeyboardEvent)=>key(e,false);addEventListener("keydown",kd);addEventListener("keyup",ku);
    function spark(x:number,y:number,color:string,n=8){ for(let i=0;i<n;i++){const a=Math.random()*TAU,s=90+Math.random()*260;game.current.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.35,color});}}
    function update(dt:number){
      const g=game.current;if(phaseRef.current!=="playing")return;
      g.time-=dt;if(g.time<=0){g.time=0;g.cars.filter(car=>!car.dead).sort((a,b)=>b.hp-a.hp).forEach((car,index)=>car.place=index+1);setPhase("over");}
      g.boostTime=Math.max(0,g.boostTime-dt);g.boostCooldown=Math.max(0,g.boostCooldown-dt);
      const p=g.cars[0]; if(p.dead)return;
      const inp=input.current; const speed=Math.hypot(p.vx,p.vy);
      const steer=joystick.current.steer;
      p.a+=Math.max(-1,Math.min(1,steer))*3.05*dt*(.45+Math.min(speed/210,1));
      let thrust=420;if(inp.brake)thrust=-230;
      if(g.boostTime>0){thrust=760;if(Math.random()<.75)spark(p.x-Math.cos(p.a)*38,p.y-Math.sin(p.a)*38,Math.random()>.45?"#42e8ff":"#d8ff45",2);}
      p.vx+=Math.cos(p.a)*thrust*dt;p.vy+=Math.sin(p.a)*thrust*dt;
      g.cars.forEach((car,i)=>{
        if(car.dead)return;
        car.boostTime=Math.max(0,(car.boostTime||0)-dt);car.boostCooldown=Math.max(0,(car.boostCooldown||0)-dt);
        if(i>0){
          const targets=g.cars.filter(q=>!q.dead&&q!==car);
          const target=targets.reduce((nearest,q)=>Math.hypot(q.x-car.x,q.y-car.y)<Math.hypot(nearest.x-car.x,nearest.y-car.y)?q:nearest,targets[0]||p);
          const distance=Math.hypot(target.x-car.x,target.y-car.y);
          const desired=Math.atan2(target.y-car.y,target.x-car.x);
          const diff=Math.atan2(Math.sin(desired-car.a),Math.cos(desired-car.a));
          car.a+=Math.max(-1,Math.min(1,diff))*2.25*dt;
          if((car.boostCooldown||0)<=0&&Math.abs(diff)<.42&&distance<430&&Math.random()<dt*2.1){car.boostTime=.85;car.boostCooldown=3;}
          if(!car.mineUsed&&g.time<72-i*2){car.mineUsed=true;g.mines.push({x:car.x-Math.cos(car.a)*48,y:car.y-Math.sin(car.a)*48,owner:i,arm:.8,active:true});}
          const aiThrust=(car.boostTime||0)>0?700:(car.hp<35?300:360);
          car.vx+=Math.cos(car.a)*aiThrust*dt;car.vy+=Math.sin(car.a)*aiThrust*dt;
          if((car.boostTime||0)>0&&Math.random()<.5)spark(car.x-Math.cos(car.a)*38,car.y-Math.sin(car.a)*38,"#42e8ff",1);
        }
        const drag=Math.pow(.99,dt*60);car.vx*=drag;car.vy*=drag;const boosting=i===0?g.boostTime>0:(car.boostTime||0)>0;const max=i===0?(boosting?560:380):(boosting?520:350);const s=Math.hypot(car.vx,car.vy);if(s>max){car.vx*=max/s;car.vy*=max/s;}car.x+=car.vx*dt;car.y+=car.vy*dt;
        const rx=580,ry=330,edge=(car.x*car.x)/(rx*rx)+(car.y*car.y)/(ry*ry);if(edge>1){const nx=car.x/(rx*rx),ny=car.y/(ry*ry),nl=Math.hypot(nx,ny);const ux=nx/nl,uy=ny/nl;const dot=car.vx*ux+car.vy*uy;if(dot>0){car.vx-=2.55*dot*ux;car.vy-=2.55*dot*uy;car.hp-=Math.min(4,dot*.015);g.shake=Math.min(13,g.shake+4);spark(car.x,car.y,"#d8f8ff",10);}car.x*=.988;car.y*=.988;}
        car.hit=Math.max(0,(car.hit||0)-dt);
      });
      for(let i=0;i<g.cars.length;i++)for(let j=i+1;j<g.cars.length;j++){
        const a=g.cars[i],b=g.cars[j];if(a.dead||b.dead)continue;
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d<68&&d>0){
          const nx=dx/d,ny=dy/d,over=68-d;
          a.x-=nx*over/2;a.y-=ny*over/2;b.x+=nx*over/2;b.y+=ny*over/2;
          const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
          if(rel>0){
            const attackA=Math.max(0,a.vx*nx+a.vy*ny);
            const attackB=Math.max(0,-b.vx*nx-b.vy*ny);
            const attacker=attackA>=attackB?a:b;
            const victim=attacker===a?b:a;
            const impulse=rel*.95;
            a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;
            const dmg=Math.max(2,rel*.075);
            victim.hp-=dmg;
            victim.hit=.2;
            spark((a.x+b.x)/2,(a.y+b.y)/2,"#ffce57",14);
            g.shake=Math.min(14,g.shake+rel*.025);
            if(attacker.player)g.score+=Math.floor(dmg*10);
          }
        }
      }
      g.mines.forEach(mine=>{
        mine.arm=Math.max(0,mine.arm-dt);
        if(!mine.active||mine.arm>0)return;
        const victim=g.cars.find(car=>!car.dead&&Math.hypot(car.x-mine.x,car.y-mine.y)<34);
        if(victim){
          mine.active=false;victim.hp=0;victim.hit=.35;g.shake=18;
          spark(mine.x,mine.y,"#ff4d28",42);spark(mine.x,mine.y,"#ffd84a",28);
        }
      });
      g.mines=g.mines.filter(mine=>mine.active);
      g.cars.forEach(car=>{if(car.hp<=0&&!car.dead){car.hp=0;car.place=g.cars.filter(x=>!x.dead).length;car.dead=true;spark(car.x,car.y,car.color,35);if(!car.player)g.score+=500;}});
      g.pickups.forEach(pk=>{if(!pk.active)return;g.cars.forEach(car=>{if(!car.dead&&Math.hypot(car.x-pk.x,car.y-pk.y)<52){pk.active=false;if(pk.type==="repair")car.hp=Math.min(100,car.hp+28);else{if(car.player){g.boostCooldown=0;g.boostTime=.85;}else{car.boostCooldown=3;car.boostTime=.85;}car.vx+=Math.cos(car.a)*190;car.vy+=Math.sin(car.a)*190;spark(car.x,car.y,"#42e8ff",24);}setTimeout(()=>pk.active=true,8000);}})});
      g.particles.forEach(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;});g.particles=g.particles.filter(q=>q.life>0);g.shake*=.87;
      const alive=g.cars.filter(x=>!x.dead).length;if(alive===1){const survivor=g.cars.find(x=>!x.dead);if(survivor)survivor.place=1;}if((p.dead||alive===1)&&phaseRef.current==="playing")setTimeout(()=>setPhase("over"),600);
      if((hudTick+=dt)>.08){hudTick=0;const rank=p.place||1+g.cars.filter(x=>!x.dead&&x!==p&&x.hp>p.hp).length;setHud({hp:Math.round(p.hp),time:Math.ceil(g.time),boost:g.boostCooldown<=0?100:Math.round((1-g.boostCooldown/3)*100),score:g.score,alive,rank,mine:!p.mineUsed});}
    }
    function roundRect(x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
    function drawCar(car:Car){
      if(car.dead){ctx.globalAlpha=.18;ctx.fillStyle=car.color;ctx.beginPath();ctx.arc(car.x,car.y,38,0,TAU);ctx.fill();ctx.globalAlpha=1;return;}
      ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);if(car.hit){ctx.shadowBlur=25;ctx.shadowColor="#fff";}
      if((car.player?game.current.boostTime:(car.boostTime||0))>0){ctx.fillStyle="#dfff48";ctx.shadowBlur=18;ctx.shadowColor="#39ddff";ctx.beginPath();ctx.moveTo(-35,-15);ctx.lineTo(-72,-5);ctx.lineTo(-35,3);ctx.fill();ctx.beginPath();ctx.moveTo(-35,8);ctx.lineTo(-64,17);ctx.lineTo(-35,22);ctx.fill();ctx.shadowBlur=0;}
      ctx.fillStyle="#050a15";roundRect(-42,-31,84,62,24);ctx.fill();ctx.fillStyle=car.color;roundRect(-36,-26,72,52,20);ctx.fill();
      ctx.fillStyle="rgba(5,12,25,.72)";roundRect(-6,-19,28,38,10);ctx.fill();ctx.fillStyle="#eafcff";roundRect(24,-13,9,26,5);ctx.fill();
      ctx.strokeStyle="#07111e";ctx.lineWidth=5;ctx.beginPath();ctx.arc(4,0,12,0,TAU);ctx.stroke();ctx.restore();
      ctx.fillStyle="rgba(3,8,18,.72)";roundRect(car.x-30,car.y-51,60,7,4);ctx.fill();ctx.fillStyle=car.hp>45?"#79f77b":"#ff5068";roundRect(car.x-30,car.y-51,60*Math.max(0,car.hp)/100,7,4);ctx.fill();
    }
    function draw(){
      const w=innerWidth,h=innerHeight,g=game.current,p=g.cars[0];
      const cam=p||{x:0,y:0,a:-Math.PI/2};
      const shakeX=(Math.random()-.5)*g.shake,shakeY=(Math.random()-.5)*g.shake;
      const horizon=h*.35+shakeY,focal=Math.min(w*.7,680),cameraHeight=86;
      const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#020510");sky.addColorStop(.55,"#101d40");sky.addColorStop(1,"#7b2858");ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);
      ctx.fillStyle="#d6f8ff";for(let i=0;i<26;i++){const sx=(i*193)%w,sy=28+(i*71)%(Math.max(40,horizon-60));ctx.globalAlpha=.25+(i%4)*.15;ctx.fillRect(sx,sy,2,2)}ctx.globalAlpha=1;
      const ground=ctx.createLinearGradient(0,horizon,0,h);ground.addColorStop(0,"#1a2342");ground.addColorStop(1,"#070b16");ctx.fillStyle=ground;ctx.fillRect(0,horizon,w,h-horizon);
      const project=(x:number,y:number,height=0)=>{
        const dx=x-cam.x,dy=y-cam.y,ca=Math.cos(cam.a),sa=Math.sin(cam.a);
        const z=dx*ca+dy*sa+58,lateral=-dx*sa+dy*ca;
        if(z<24)return null;
        const scale=focal/z;
        return{x:w/2+lateral*scale+shakeX,y:horizon+cameraHeight*scale-height*scale,z,scale};
      };
      ctx.lineWidth=1;
      for(let z=90;z<1100;z+=75){const y=horizon+cameraHeight*focal/z;ctx.strokeStyle=`rgba(72,217,255,${Math.min(.24,80/z)})`;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      for(let lane=-600;lane<=600;lane+=120){ctx.strokeStyle="rgba(66,190,255,.14)";ctx.beginPath();ctx.moveTo(w/2+lane*focal/70,h);ctx.lineTo(w/2+lane*focal/1100,horizon+cameraHeight*focal/1100);ctx.stroke();}
      for(let i=0;i<72;i++){
        const a=i/72*TAU,b=(i+1)/72*TAU;
        const p1=project(Math.cos(a)*580,Math.sin(a)*330),p2=project(Math.cos(b)*580,Math.sin(b)*330);
        const t1=project(Math.cos(a)*580,Math.sin(a)*330,76),t2=project(Math.cos(b)*580,Math.sin(b)*330,76);
        if(!p1||!p2||!t1||!t2)continue;
        if(Math.max(Math.abs(p1.x-w/2),Math.abs(p2.x-w/2))>w*2.2)continue;
        ctx.fillStyle=i%2?"rgba(12,27,48,.88)":"rgba(28,44,69,.88)";
        ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(t2.x,t2.y);ctx.lineTo(t1.x,t1.y);ctx.closePath();ctx.fill();
        ctx.strokeStyle=i%2?"#2bdbff":"#ff405d";ctx.lineWidth=Math.max(1,Math.min(7,p1.scale*4));ctx.shadowBlur=10;ctx.shadowColor=ctx.strokeStyle;
        ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();ctx.beginPath();ctx.moveTo(t1.x,t1.y);ctx.lineTo(t2.x,t2.y);ctx.stroke();
        if(i%3===0){ctx.strokeStyle="#b9f6ff";ctx.lineWidth=Math.max(1,Math.min(5,p1.scale*3));ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(t1.x,t1.y);ctx.stroke();}
      }
      ctx.shadowBlur=0;
      const objects:Array<{kind:"car"|"mine"|"pickup"|"particle";z:number;data:Car|Mine|Pickup|Particle;pr:{x:number;y:number;z:number;scale:number}}>= [];
      g.cars.slice(1).forEach(car=>{const pr=project(car.x,car.y);if(pr)objects.push({kind:"car",z:pr.z,data:car,pr});});
      g.mines.forEach(mine=>{const pr=project(mine.x,mine.y);if(pr)objects.push({kind:"mine",z:pr.z,data:mine,pr});});
      g.pickups.filter(pk=>pk.active).forEach(pk=>{const pr=project(pk.x,pk.y,24);if(pr)objects.push({kind:"pickup",z:pr.z,data:pk,pr});});
      g.particles.forEach(q=>{const pr=project(q.x,q.y,18);if(pr)objects.push({kind:"particle",z:pr.z,data:q,pr});});
      objects.sort((a,b)=>b.z-a.z).forEach(obj=>{
        const {x,y,scale}=obj.pr;
        if(x<-180||x>w+180)return;
        if(obj.kind==="car"){
          const car=obj.data as Car;if(car.dead)return;const cw=Math.max(16,84*scale),ch=Math.max(11,55*scale);
          ctx.save();ctx.translate(x,y);if(car.hit){ctx.shadowBlur=28;ctx.shadowColor="#fff";}else{ctx.shadowBlur=15;ctx.shadowColor=car.color;}
          ctx.fillStyle="#050711";roundRect(-cw*.58,-ch*.22,cw*1.16,ch*.42,ch*.18);ctx.fill();
          ctx.fillStyle=car.color;roundRect(-cw/2,-ch,cw,ch,ch*.22);ctx.fill();ctx.shadowBlur=0;
          ctx.fillStyle="#101a2c";ctx.beginPath();ctx.moveTo(-cw*.26,-ch*.76);ctx.lineTo(cw*.26,-ch*.76);ctx.lineTo(cw*.35,-ch*.35);ctx.lineTo(-cw*.35,-ch*.35);ctx.closePath();ctx.fill();
          ctx.fillStyle="#f3ffff";ctx.fillRect(-cw*.38,-ch*.28,cw*.18,Math.max(2,ch*.08));ctx.fillRect(cw*.2,-ch*.28,cw*.18,Math.max(2,ch*.08));
          ctx.fillStyle="#07101b";ctx.fillRect(-cw*.42,-ch*.07,cw*.22,ch*.18);ctx.fillRect(cw*.2,-ch*.07,cw*.22,ch*.18);
          ctx.fillStyle="#0b1220";roundRect(-cw*.35,-ch*1.22,cw*.7,Math.max(4,7*scale),4);ctx.fill();ctx.fillStyle=car.hp>45?"#65f286":"#ff405d";roundRect(-cw*.35,-ch*1.22,cw*.7*car.hp/100,Math.max(4,7*scale),4);ctx.fill();ctx.restore();
        }else if(obj.kind==="mine"){
          const mine=obj.data as Mine,r=Math.max(5,18*scale);ctx.fillStyle="#101522";ctx.strokeStyle=mine.arm>0?"#ffc83d":"#ff3f55";ctx.lineWidth=Math.max(2,3*scale);ctx.shadowBlur=16;ctx.shadowColor=ctx.strokeStyle;ctx.beginPath();ctx.ellipse(x,y,r,r*.35,0,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
        }else if(obj.kind==="pickup"){
          const pk=obj.data as Pickup,s=Math.max(9,30*scale);ctx.fillStyle=pk.type==="repair"?"#51f293":"#35dcff";ctx.shadowBlur=22;ctx.shadowColor=ctx.fillStyle;roundRect(x-s/2,y-s,s,s,5);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#06101c";ctx.font=`bold ${Math.max(10,s*.65)}px Arial`;ctx.textAlign="center";ctx.fillText(pk.type==="repair"?"+":"⚡",x,y-s*.25);
        }else{const q=obj.data as Particle;ctx.globalAlpha=Math.min(1,q.life*4);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(x,y,Math.max(2,4*scale),0,TAU);ctx.fill();ctx.globalAlpha=1;}
      });
      if(p&&!p.dead){
        const hood=ctx.createLinearGradient(0,h*.78,0,h);hood.addColorStop(0,p.color);hood.addColorStop(1,"#4b0c1a");ctx.fillStyle=hood;ctx.shadowBlur=g.boostTime>0?30:0;ctx.shadowColor="#39ddff";ctx.beginPath();ctx.moveTo(w*.3,h);ctx.lineTo(w*.4,h*.82);ctx.quadraticCurveTo(w*.5,h*.76,w*.6,h*.82);ctx.lineTo(w*.7,h);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
        ctx.fillStyle="#07101d";ctx.beginPath();ctx.ellipse(w*.5,h*.93,w*.11,h*.13,0,0,TAU);ctx.fill();ctx.strokeStyle="#7f96ad";ctx.lineWidth=8;ctx.stroke();
        if(g.boostTime>0){ctx.fillStyle="rgba(55,225,255,.18)";for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(w/2+(i-4)*w*.08,horizon);ctx.lineTo(w/2+(i-4)*w*.19,h);ctx.lineTo(w/2+(i-3.7)*w*.19,h);ctx.fill();}}
      }
      const vignette=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.72);vignette.addColorStop(.55,"transparent");vignette.addColorStop(1,"rgba(0,0,0,.65)");ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    }
    function loop(now:number){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();raf=requestAnimationFrame(loop)}raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("keydown",kd);removeEventListener("keyup",ku)};
  },[init]);

  const playerPlace=game.current.cars[0]?.place||hud.rank;
  const won=playerPlace===1&&(hud.alive===1||phase==="over");
  return <main className="game">
    <canvas ref={canvas} aria-label="범퍼 러시 게임 경기장"/>
    {(phase==="countdown")&&<div className="countdown">준비<span>곧 시작합니다</span></div>}
    {(phase==="playing"||phase==="countdown")&&<header className="hud">
      <div className="brand">BUMPER <b>RUSH</b></div>
      <div className="stat"><small>남은 시간</small><strong>{hud.time}</strong></div>
      <div className="stat"><small>생존</small><strong>{hud.alive}<i>/6</i></strong></div>
      <div className="stat rank"><small>현재 순위</small><strong>{hud.rank}<i>위</i></strong></div>
      <div className="score"><small>SCORE</small>{hud.score.toLocaleString()}</div>
    </header>}
    {(phase==="playing"||phase==="countdown")&&<div className="meters">
      <label>내구도 <b>{hud.hp}</b><span><i style={{width:`${hud.hp}%`}}/></span></label>
      <label>부스터 <b>{hud.boost===100?"READY":`${Math.ceil((100-hud.boost)*.03)}초`}</b><span className="blue"><i style={{width:`${hud.boost}%`}}/></span></label>
      <div className="sensor-off">센서 OFF · 조이스틱 조작</div>
    </div>}
    {(phase==="playing"||phase==="countdown")&&<div className="controls">
      <div className="joystick" aria-label="방향 조이스틱" onPointerDown={(e)=>{e.preventDefault();joystick.current.pointerId=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);moveJoystick(e)}} onPointerMove={moveJoystick} onPointerUp={releaseJoystick} onPointerCancel={releaseJoystick}>
        <div className="joystick-knob" style={{transform:`translate(${stickX*34}px,-50%)`}} />
      </div>
      <div className="pedals"><button className="mine" aria-label="지뢰 설치" disabled={!hud.mine} onPointerDown={(e)=>{e.preventDefault();dropMine()}}><span>✹</span>{hud.mine?"MINE":"USED"}</button><button className="brake" aria-label="브레이크" {...bind("brake")}>BRAKE</button><button className="nitro" aria-label="부스터" disabled={hud.boost<100} onPointerDown={(e)=>{e.preventDefault();triggerBoost()}}><span>{hud.boost===100?"⚡":Math.ceil((100-hud.boost)*.03)}</span>{hud.boost===100?"BOOST":"COOL"}</button></div>
    </div>}
    {phase==="menu"&&<section className="panel intro"><div className="eyebrow">6인 배틀 아레나</div><h1>BUMPER<br/><em>RUSH</em></h1><p>박고, 버티고, 끝까지 살아남아라!</p><button onClick={start}>경기 시작 <span>→</span></button><div className="tips"><span>◒ 기울기 조향</span><span>자동 전진</span><span>⚡ 부스터</span></div></section>}
    {phase==="over"&&<section className="panel result"><div className="eyebrow">{won?"ARENA CHAMPION":"GAME OVER"}</div><h2>{won?"최후의 생존자!":"차량 파손!"}</h2><div className="final"><span><small>최종 점수</small>{hud.score.toLocaleString()}</span><span><small>최종 순위</small>{playerPlace}위</span></div><button onClick={start}>다시 도전 <span>↻</span></button></section>}
  </main>
}
