import { useState, useRef, useEffect, useCallback } from "react";
import { analyzeFramesLocally } from "./analyzer.js";

const FONT_LINK = document.createElement("link");
FONT_LINK.rel = "stylesheet";
FONT_LINK.href = "https://fonts.googleapis.com/css2?family=Boogaloo&family=DM+Mono:wght@400;500&family=Fredoka+One&display=swap";
document.head.appendChild(FONT_LINK);

const MAX_RECORD_SECS = 10;
const FRAME_INTERVAL_MS = 900;

const TRICKS = [
  { id:"ghost",  label:"Ghost",         emoji:"👻", desc:"Exhale a cloud, suck it back in",       color:"#b96eff", glow:"#b96eff55", dark:"#7c3aed" },
  { id:"orings", label:"O-Rings",        emoji:"⭕", desc:"Blow as many perfect rings as you can", color:"#ff7c2a", glow:"#ff7c2a55", dark:"#c2440e" },
  { id:"french", label:"French Inhale",  emoji:"👃", desc:"Vapor flows mouth → nose like a pro",  color:"#2affb2", glow:"#2affb255", dark:"#059669" },
];

const ROASTS = {
  ghost: {
    "1":  { title:"ABSOLUTELY NOT",        sub:"Did you even try? That was just breathing." },
    "2":  { title:"TRAGIC",                sub:"A ghost? More like a fart in the wind." },
    "3":  { title:"SIR PLEASE STOP",       sub:"The cloud evaporated from embarrassment." },
    "4":  { title:"ROOM FOR IMPROVEMENT",  sub:"Weak. Your vape is ashamed of you." },
    "5":  { title:"MEH",                   sub:"Mid at best. The ghost barely showed up." },
    "6":  { title:"NOT BAD ACTUALLY",      sub:"The cloud was felt. The re-inhale was present." },
    "7":  { title:"RESPECT",               sub:"A solid ghost. Your ancestors are mildly proud." },
    "8":  { title:"CERTIFIED CLOUDY",      sub:"Dense, clean, and re-inhaled. We bow slightly." },
    "9":  { title:"LORD DARTH VAPER",      sub:"The ghost was so thick it had opinions." },
    "10": { title:"TRANSCENDENT BEING",    sub:"You have ascended. The cloud chose you." },
  },
  orings: {
    "1":  { title:"WHAT WAS THAT",         sub:"Those weren't rings. Those were crimes." },
    "2":  { title:"OVAL FAIL",             sub:"Blobs. You blew blobs. Not rings." },
    "3":  { title:"WEAK LINKS",            sub:"The rings collapsed before they even tried." },
    "4":  { title:"ALMOST ROUND",          sub:"Egg-shaped at best. Keep stretching." },
    "5":  { title:"PASSABLE",              sub:"A ring-ish shape was detected. Barely." },
    "6":  { title:"RING ENTHUSIAST",       sub:"Round enough. We accept your offering." },
    "7":  { title:"O MY GOD",              sub:"Clean, consistent, and actually round. Legend behavior." },
    "8":  { title:"RING MASTER",           sub:"Those rings had structure. They had FORM." },
    "9":  { title:"SMOKE GEOMETRY GOD",    sub:"Your rings were so perfect they gave us anxiety." },
    "10": { title:"THE CHOSEN ONER",       sub:"Physics wept. Those rings defied reality." },
  },
  french: {
    "1":  { title:"ABSOLUTELY BOTCHED",    sub:"Nothing went nose-ward. Nothing." },
    "2":  { title:"A DISASTER",            sub:"The vapor had no direction. Just like your life." },
    "3":  { title:"SIDEWAYS AT BEST",      sub:"The French would like you to stop." },
    "4":  { title:"BARELY A WATERFALL",    sub:"More of a drizzle. A sad, sad drizzle." },
    "5":  { title:"WE SAW SOMETHING",      sub:"A faint upward wisp. Points for showing up." },
    "6":  { title:"DECENT INHALE",         sub:"The flow was real. The nose received the message." },
    "7":  { title:"TRÈS BON",              sub:"Smooth, visible, directional. C'est magnifique-ish." },
    "8":  { title:"WATERFALL CERTIFIED",   sub:"The vapor cascaded like a beautiful smoky river." },
    "9":  { title:"PARISIAN CLOUD LORD",   sub:"Flowing, dense, effortless. The French approve." },
    "10": { title:"VAPOR DEITY",           sub:"That was not a trick. That was performance art." },
  },
};

function getRoast(trickId, score) {
  const bracket = Math.max(1, Math.min(10, Math.round(score)));
  return ROASTS[trickId]?.[String(bracket)] || { title:"SCORED", sub:"Analysis complete." };
}

function getSystemPrompt(trickId) {
  const brutal = `SCORING PHILOSOPHY: Be a harsh, unforgiving judge. Most attempts should score 3–6. Scores of 8+ require genuinely impressive, dense, well-executed tricks. A score of 9 should feel rare. A 10 should feel nearly impossible — only for textbook-perfect execution with a massive, dense cloud. If the vapor is thin, wispy, or barely visible, score low (1–4). Do NOT give out easy high scores.`;
  const map = {
    ghost:`You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: Ghost Inhale.\nScoring (1.0–10.0, one decimal):\n- cloud 0–3: size and density. Thin wispy exhale = 0–1. Dense ball = 2–3.\n- retention 0–3: how little vapor was lost. Major dissipation before re-inhale = 0–1.\n- execution 0–4: spherical shape of cloud + completeness of re-inhale. Sloppy = 0–1. Clean spherical re-inhale = 3–4.\nIf you see mostly empty air or a barely visible puff, score 1–3.\nRespond ONLY with JSON: {"score":<1.0-10.0>,"summary":"<one brutal honest sentence>","cloud":<0-3>,"retention":<0-3>,"execution":<0-4>}`,
    orings:`You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: O-Rings.\nCount only DISTINCT, clearly circular rings. Blobs, ovals, and shapeless puffs do NOT count.\nScoring (1.0–10.0, one decimal):\n- roundness 0–4: perfectly circular rings = 3–4. Deformed = 0–1.\n- consistency 0–3: uniform size and shape across rings.\n- distance 0–3: how far rings travel before dissolving.\nIf no clear rings are visible, ring_count = 0 and score = 1–3.\nRespond ONLY with JSON: {"score":<1.0-10.0>,"ring_count":<int>,"summary":"<one brutal honest sentence>","roundness":<0-4>,"consistency":<0-3>,"distance":<0-3>}`,
    french:`You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: French Inhale (Irish Waterfall). Vapor must visibly flow UPWARD from open mouth into nostrils continuously.\nScoring (1.0–10.0, one decimal):\n- flow 0–4: continuous unbroken vapor stream. Any gaps = major deduction.\n- direction 0–3: clearly travelling upward toward nose. Sideways or downward = 0.\n- volume 0–3: thick, dense, visible vapor stream. Wispy = 0–1.\nIf there is no visible upward vapor movement, score 1–3.\nRespond ONLY with JSON: {"score":<1.0-10.0>,"summary":"<one brutal honest sentence>","flow":<0-4>,"direction":<0-3>,"volume":<0-3>}`,
  };
  return map[trickId];
}

async function analyzeFrames(frames, trickId) {
  return analyzeFramesLocally(frames, trickId);
}

function captureFrameB64(video, canvas) {
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -canvas.width, 0); ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{width:100%;height:100%;overflow:hidden;background:#5bbfff;}
@keyframes floatCloud{0%,100%{transform:translateX(0) translateY(0)}50%{transform:translateX(12px) translateY(-8px)}}
@keyframes psychoSpin{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.08)}100%{transform:rotate(360deg) scale(1)}}
@keyframes rainbowShift{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}
@keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:.4}100%{transform:translateY(-120vh) scale(3.5);opacity:0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes slideUp{from{transform:translateY(52px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes popIn{0%{transform:scale(.4);opacity:0}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes recBlink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes wobble{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes gradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes titleBob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1deg)}}
@keyframes cloudDrift{0%{transform:translateX(-20px)}100%{transform:translateX(20px)}}
@keyframes ringPop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
@keyframes starTwinkle{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.3)}}
`;

function SimpsonsSky({ psycho = false }) {
  const clouds = [
    { top:"8%",  left:"5%",  w:140, h:60, delay:0,   dur:8  },
    { top:"18%", left:"55%", w:180, h:70, delay:1.5, dur:10 },
    { top:"6%",  left:"72%", w:110, h:50, delay:0.8, dur:7  },
    { top:"28%", left:"20%", w:160, h:65, delay:2,   dur:9  },
    { top:"35%", left:"68%", w:130, h:55, delay:3,   dur:11 },
  ];
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden",
      background: psycho
        ? "linear-gradient(180deg,#ff9ef5 0%,#a78bff 30%,#5bbfff 60%,#b8ffb0 100%)"
        : "linear-gradient(180deg,#3fa8f5 0%,#5bbfff 40%,#87d4ff 100%)",
      transition:"background 1.5s ease" }}>
      {psycho && (
        <div style={{ position:"absolute", inset:0, opacity:.35,
          background:"radial-gradient(ellipse at 20% 30%,#ff6bdf 0%,transparent 50%),radial-gradient(ellipse at 80% 70%,#6bffb8 0%,transparent 50%),radial-gradient(ellipse at 50% 50%,#ffe06b 0%,transparent 60%)",
          animation:"gradShift 4s linear infinite", backgroundSize:"200% 200%" }} />
      )}
      <div style={{ position:"absolute", top:"8%", right:"12%", width:72, height:72, borderRadius:"50%",
        background: psycho
          ? "radial-gradient(circle,#fff 20%,#ffe06b 60%,#ff9a00 100%)"
          : "radial-gradient(circle,#fff8c0 20%,#ffe566 60%,#ffb800 100%)",
        boxShadow: psycho
          ? "0 0 0 12px #ffe06b44,0 0 0 28px #ff9a0022,0 0 60px #ffe06b"
          : "0 0 0 10px #ffe56644,0 0 0 24px #ffb80022,0 0 48px #ffe566",
        animation: psycho ? "psychoSpin 6s linear infinite" : "wobble 4s ease-in-out infinite" }} />
      {clouds.map((c,i) => (
        <div key={i} style={{ position:"absolute", top:c.top, left:c.left,
          animation:`cloudDrift ${c.dur}s ${c.delay}s ease-in-out infinite alternate`,
          filter: psycho ? `hue-rotate(${i*60}deg) saturate(1.5)` : "none", transition:"filter 1.5s" }}>
          <SimpsonCloud w={c.w} h={c.h} />
        </div>
      ))}
      {psycho && Array.from({length:18},(_,i)=>(
        <div key={i} style={{ position:"absolute", top:`${10+Math.random()*75}%`, left:`${Math.random()*100}%`,
          fontSize:10+Math.random()*14, opacity:.3,
          animation:`starTwinkle ${1.5+Math.random()*2}s ${Math.random()*2}s infinite` }}>✦</div>
      ))}
    </div>
  );
}

function SimpsonCloud({ w, h }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <ellipse cx={w*.5}  cy={h*.72} rx={w*.46} ry={h*.28} fill="white" opacity=".95"/>
      <ellipse cx={w*.28} cy={h*.55} rx={w*.22} ry={h*.3}  fill="white" opacity=".95"/>
      <ellipse cx={w*.52} cy={h*.42} rx={w*.26} ry={h*.32} fill="white"/>
      <ellipse cx={w*.74} cy={h*.52} rx={w*.2}  ry={h*.28} fill="white" opacity=".95"/>
      <ellipse cx={w*.5}  cy={h*.72} rx={w*.45} ry={h*.27} fill="white"/>
    </svg>
  );
}

function StonerSmoke({ color="#b96eff" }) {
  const pts = Array.from({length:10},(_,i)=>({
    id:i, left:`${8+Math.random()*84}%`,
    delay:Math.random()*7, dur:6+Math.random()*6,
    size:40+Math.random()*100,
  }));
  return (
    <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:1}}>
      {pts.map(p=>(
        <div key={p.id} style={{
          position:"absolute",bottom:-120,left:p.left,
          width:p.size,height:p.size,borderRadius:"50%",
          background:`radial-gradient(circle,${color}18 0%,transparent 70%)`,
          animation:`floatUp ${p.dur}s ${p.delay}s infinite ease-in-out`,
        }}/>
      ))}
    </div>
  );
}

function ScoreRing({ score, size=160, color="#b96eff" }) {
  const r=size/2-14, circ=2*Math.PI*r, pct=Math.min(score/10,1);
  return (
    <svg width={size} height={size} style={{filter:`drop-shadow(0 0 22px ${color}aa)`,overflow:"visible"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#00000022" strokeWidth={12}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={12}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:"stroke-dashoffset 1.8s cubic-bezier(.4,0,.2,1)"}}/>
      <text x={size/2} y={size/2+10} textAnchor="middle" fill={color}
        style={{fontFamily:"'Fredoka One',cursive",fontSize:42,fontWeight:700}}>
        {score.toFixed(1)}
      </text>
      <text x={size/2} y={size/2+27} textAnchor="middle" fill={color+"99"}
        style={{fontFamily:"'DM Mono',monospace",fontSize:10}}>/10</text>
    </svg>
  );
}

function StatBar({ label, val, max, color }) {
  return (
    <div style={{marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#aaa",letterSpacing:1}}>{label}</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color}}>{val}/{max}</span>
      </div>
      <div style={{height:5,background:"#00000022",borderRadius:4}}>
        <div style={{height:"100%",borderRadius:4,width:`${(val/max)*100}%`,
          background:color,boxShadow:`0 0 8px ${color}`,transition:"width 1.2s ease"}}/>
      </div>
    </div>
  );
}

function CameraScreen({ trick, onResult, onBack }) {
  const videoRef=useRef(null),canvasRef=useRef(null),streamRef=useRef(null);
  const framesRef=useRef([]),frameTimerRef=useRef(null);
  const mrRef=useRef(null),chunksRef=useRef([]);
  const [phase,setPhase]=useState("preview");
  const [elapsed,setElapsed]=useState(0);
  const [scanY,setScanY]=useState(0);
  const [result,setResult]=useState(null);
  const [frozen,setFrozen]=useState(null);
  const [videoBlob,setVideoBlob]=useState(null);
  const [camError,setCamError]=useState(false);
  const t=TRICKS.find(x=>x.id===trick);

  useEffect(()=>{
    navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false})
      .then(s=>{streamRef.current=s;if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.play();}})
      .catch(()=>setCamError(true));
    return()=>{streamRef.current?.getTracks().forEach(t=>t.stop());clearInterval(frameTimerRef.current);};
  },[]);

  const startRecording=useCallback(()=>{
    framesRef.current=[];chunksRef.current=[];setElapsed(0);setPhase("recording");
    const mr=new MediaRecorder(streamRef.current,{mimeType:"video/webm"});
    mr.ondataavailable=e=>e.data.size&&chunksRef.current.push(e.data);
    mr.start();mrRef.current=mr;
    frameTimerRef.current=setInterval(()=>{
      if(videoRef.current&&canvasRef.current)
        framesRef.current.push(captureFrameB64(videoRef.current,canvasRef.current));
    },FRAME_INTERVAL_MS);
  },[]);

  const stopRecording=useCallback(()=>{
    clearInterval(frameTimerRef.current);mrRef.current?.stop();
    if(videoRef.current&&canvasRef.current){
      canvasRef.current.width=videoRef.current.videoWidth||640;
      canvasRef.current.height=videoRef.current.videoHeight||480;
      const ctx=canvasRef.current.getContext("2d");
      ctx.save();ctx.scale(-1,1);ctx.drawImage(videoRef.current,-canvasRef.current.width,0);ctx.restore();
      setFrozen(canvasRef.current.toDataURL("image/jpeg",0.9));
    }
    streamRef.current?.getTracks().forEach(t=>t.stop());
    setPhase("analyzing");
    setTimeout(()=>setVideoBlob(new Blob(chunksRef.current,{type:"video/webm"})),400);
    const frames=[...framesRef.current];
    analyzeFrames(frames.slice(0,8),trick).then(res=>{
      setTimeout(()=>{setResult(res);setPhase("result");},3600);
    }).catch(()=>{
      const fallback=trick==="orings"
        ?{score:3.0,ring_count:0,summary:"Could not analyze. Check your API key.",roundness:1,consistency:1,distance:1}
        :{score:3.0,summary:"Could not analyze. Check your API key.",cloud:1,retention:1,execution:1,flow:1,direction:1,volume:1};
      setTimeout(()=>{setResult(fallback);setPhase("result");},3600);
    });
  },[trick]);

  useEffect(()=>{
    if(phase!=="recording")return;
    const iv=setInterval(()=>setElapsed(e=>{
      if(e>=MAX_RECORD_SECS-1){stopRecording();return e;}
      return e+1;
    }),1000);
    return()=>clearInterval(iv);
  },[phase,stopRecording]);

  useEffect(()=>{
    if(phase!=="analyzing")return;
    let y=0;const iv=setInterval(()=>{y=(y+1.4)%101;setScanY(y);},16);
    return()=>clearInterval(iv);
  },[phase]);

  const handleSave=()=>{
    if(!result)return;
    onResult({id:Date.now(),trick,score:result.score,ringCount:result.ring_count??null,
      summary:result.summary,stats:result,date:new Date().toLocaleDateString(),
      videoUrl:videoBlob?URL.createObjectURL(videoBlob):null,thumbnail:frozen,
      roast:getRoast(trick,result.score)});
  };

  if(camError)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100%",gap:16,fontFamily:"'DM Mono',monospace",textAlign:"center",padding:32,
      background:"linear-gradient(180deg,#3fa8f5,#5bbfff)"}}>
      <SimpsonsSky/>
      <div style={{position:"relative",zIndex:2,color:"#1a1a4e"}}>
        <div style={{fontSize:52,marginBottom:12}}>📷</div>
        <div style={{fontSize:14,fontFamily:"'Boogaloo',cursive"}}>Camera access denied.<br/>Allow camera in browser settings.</div>
        <button onClick={onBack} style={{marginTop:16,background:"#b96eff",color:"#fff",border:"none",
          borderRadius:20,padding:"10px 24px",fontFamily:"'Boogaloo',cursive",fontSize:16,cursor:"pointer"}}>← Back</button>
      </div>
    </div>
  );

  return(
    <div style={{position:"relative",width:"100%",height:"100%",background:"#000",overflow:"hidden"}}>
      {phase!=="analyzing"&&phase!=="result"&&(
        <video ref={videoRef} autoPlay playsInline muted
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}}/>
      )}
      {(phase==="analyzing"||phase==="result")&&frozen&&(
        <img src={frozen} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",
          filter:phase==="analyzing"?"brightness(.45) saturate(.3)":"brightness(.25)"}}/>
      )}
      <canvas ref={canvasRef} style={{display:"none"}}/>

      {phase==="preview"&&(
        <div style={{position:"absolute",inset:0,zIndex:10,display:"flex",
          flexDirection:"column",justifyContent:"space-between",padding:"28px 22px 44px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={{background:"#00000088",border:"1px solid #ffffff33",
              color:"#fff",borderRadius:99,padding:"6px 14px",fontFamily:"'DM Mono',monospace",fontSize:12,cursor:"pointer"}}>← back</button>
            <div style={{background:"#00000088",border:`2px solid ${t.color}66`,borderRadius:99,
              padding:"6px 16px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>{t.emoji}</span>
              <span style={{fontFamily:"'Boogaloo',cursive",fontSize:15,color:t.color}}>{t.label}</span>
            </div>
          </div>
          <div style={{textAlign:"center"}}>
            <p style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#ffffffaa",marginBottom:26,letterSpacing:.5}}>{t.desc}</p>
            <button onClick={startRecording} style={{width:78,height:78,borderRadius:"50%",
              background:`radial-gradient(circle,${t.color},${t.dark})`,border:`4px solid ${t.color}`,
              boxShadow:`0 0 40px ${t.glow},0 0 10px ${t.color}`,cursor:"pointer",margin:"0 auto",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,color:"#fff"}}>●</button>
            <p style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#ffffff55",marginTop:12,letterSpacing:3}}>TAP TO RECORD</p>
          </div>
        </div>
      )}

      {phase==="recording"&&(
        <div style={{position:"absolute",inset:0,zIndex:10,display:"flex",
          flexDirection:"column",justifyContent:"space-between",padding:"28px 22px 44px"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:"#ffffff18"}}>
            <div style={{height:"100%",background:"#ff4d6d",transition:"width 1s linear",
              width:`${(elapsed/MAX_RECORD_SECS)*100}%`,boxShadow:"0 0 12px #ff4d6d"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,alignSelf:"flex-end",marginTop:6}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"#ff4d6d",animation:"recBlink 1s infinite"}}/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#fff"}}>{elapsed}s / {MAX_RECORD_SECS}s</span>
          </div>
          <div style={{textAlign:"center"}}>
            <button onClick={stopRecording} style={{width:78,height:78,borderRadius:"50%",
              background:"linear-gradient(135deg,#ff4d6d,#c7002e)",border:"4px solid #fff",
              boxShadow:"0 0 40px #ff4d6d88",cursor:"pointer",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:24,color:"#fff",margin:"0 auto"}}>■</button>
            <p style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#ffffff55",marginTop:12,letterSpacing:3}}>TAP TO STOP</p>
          </div>
        </div>
      )}

      {phase==="analyzing"&&(
        <div style={{position:"absolute",inset:0,zIndex:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
            <div style={{position:"absolute",left:0,right:0,height:5,
              background:`linear-gradient(90deg,transparent,${t.color},#fff,${t.color},transparent)`,
              boxShadow:`0 0 28px ${t.color},0 0 56px ${t.color}77`,top:`${scanY}%`}}/>
            <div style={{position:"absolute",inset:0,
              backgroundImage:`linear-gradient(${t.color}08 1px,transparent 1px),linear-gradient(90deg,${t.color}08 1px,transparent 1px)`,
              backgroundSize:"48px 48px"}}/>
          </div>
          <div style={{textAlign:"center",zIndex:2,animation:"fadeIn .4s ease"}}>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:42,color:t.color,
              letterSpacing:4,animation:"pulse 1s infinite",textShadow:`0 0 28px ${t.color},0 2px 0 #000`}}>ANALYZING</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#ffffff55",marginTop:8,letterSpacing:4}}>
              {trick==="orings"?"COUNTING RINGS...":"JUDGING TRICK..."}
            </div>
          </div>
        </div>
      )}

      {phase==="result"&&result&&(
        <ResultOverlay result={result} trick={trick} t={t} onSave={handleSave}
          onRetry={()=>{setPhase("preview");setResult(null);setFrozen(null);}} onBack={onBack}/>
      )}
    </div>
  );
}

function ResultOverlay({ result, trick, t, onSave, onRetry }) {
  const [show,setShow]=useState(false);
  useEffect(()=>{setTimeout(()=>setShow(true),80);},[]);
  const roast=getRoast(trick,result.score);
  const statMap={
    ghost: [{k:"cloud",l:"CLOUD SIZE",m:3},{k:"retention",l:"RETENTION",m:3},{k:"execution",l:"EXECUTION",m:4}],
    orings:[{k:"roundness",l:"ROUNDNESS",m:4},{k:"consistency",l:"CONSISTENCY",m:3},{k:"distance",l:"DISTANCE",m:3}],
    french:[{k:"flow",l:"FLOW",m:4},{k:"direction",l:"DIRECTION",m:3},{k:"volume",l:"VOLUME",m:3}],
  };
  const score=result.score;
  const scoreColor=score>=8?t.color:score>=5?"#f0c040":"#ff4d6d";

  return(
    <div style={{position:"absolute",inset:0,zIndex:30,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"flex-end",padding:"0 16px 24px",
      background:`linear-gradient(to top,${t.dark}ee 0%,transparent 55%)`}}>
      <div style={{width:"100%",maxWidth:420,
        background:"linear-gradient(160deg,#fffef0 0%,#fff8e0 100%)",
        border:`3px solid ${t.color}`,borderRadius:28,padding:"24px 20px 20px",
        boxShadow:`0 0 48px ${t.glow},0 24px 48px #00000077`,
        animation:show?"slideUp .5s ease both":"none",opacity:show?1:0}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:30,color:scoreColor,letterSpacing:1,
            textShadow:`2px 2px 0 ${scoreColor}44`,animation:"wobble 2s ease-in-out infinite",display:"inline-block"}}>
            {roast.title}
          </div>
          <div style={{fontFamily:"'Boogaloo',cursive",fontSize:14,color:"#666",marginTop:4}}>{roast.sub}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:16}}>
          <ScoreRing score={result.score} color={scoreColor} size={148}/>
          {trick==="orings"&&(
            <div style={{textAlign:"center",animation:"ringPop .6s .3s both ease"}}>
              <div style={{fontFamily:"'Fredoka One',cursive",fontSize:64,lineHeight:1,
                color:t.color,textShadow:`3px 3px 0 ${t.dark}`}}>{result.ring_count??0}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",letterSpacing:3}}>RINGS</div>
            </div>
          )}
        </div>
        <div style={{background:`${t.color}18`,borderRadius:12,padding:"10px 14px",
          marginBottom:14,borderLeft:`3px solid ${t.color}`}}>
          <p style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#444",lineHeight:1.6,fontStyle:"italic"}}>
            "{result.summary}"
          </p>
        </div>
        <div style={{marginBottom:18}}>
          {(statMap[trick]||[]).map(s=>(
            <StatBar key={s.k} label={s.l} val={result[s.k]??0} max={s.m} color={t.color}/>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onRetry} style={{flex:1,padding:"13px 0",borderRadius:14,
            background:"#f0e8ff",border:`2px solid ${t.color}66`,color:t.dark,
            fontFamily:"'Boogaloo',cursive",fontSize:15,cursor:"pointer"}}>↺ Retry</button>
          <button onClick={onSave} style={{flex:2,padding:"13px 0",borderRadius:14,
            background:`linear-gradient(135deg,${t.color},${t.dark})`,border:"none",color:"#fff",
            fontFamily:"'Boogaloo',cursive",fontSize:15,cursor:"pointer",
            boxShadow:`0 4px 20px ${t.glow}`,letterSpacing:.5}}>Archive Attempt →</button>
        </div>
      </div>
    </div>
  );
}

function ArchivePage({ entries }) {
  const [tab,setTab]=useState("ghost");
  const t=TRICKS.find(x=>x.id===tab);
  const filtered=entries.filter(e=>e.trick===tab);
  const bestRings=Math.max(0,...entries.filter(e=>e.trick==="orings"&&e.ringCount!=null).map(e=>e.ringCount));

  return(
    <div style={{width:"100%",height:"100%",overflowY:"auto",position:"relative",
      background:"linear-gradient(180deg,#3fa8f5 0%,#5bbfff 30%,#e8f4ff 100%)"}}>
      <SimpsonsSky psycho/>
      <StonerSmoke color="#b96eff"/>
      <div style={{position:"relative",zIndex:2}}>
        <div style={{padding:"44px 24px 16px",textAlign:"center"}}>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:44,color:"#1a1a6e",letterSpacing:3,
            textShadow:"3px 3px 0 #ffffff88,0 0 30px #b96eff88",animation:"titleBob 3s ease-in-out infinite",display:"inline-block"}}>
            📼 ARCHIVE
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#1a1a6eaa",letterSpacing:4,marginTop:6}}>
            {entries.length} ATTEMPT{entries.length!==1?"S":""} SAVED
          </div>
        </div>
        {entries.some(e=>e.trick==="orings")&&(
          <div style={{margin:"0 20px 16px",borderRadius:18,
            background:"linear-gradient(135deg,#fff8e0,#ffe4b5)",border:"3px solid #ff7c2a",padding:"14px 18px",
            display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 4px 20px #ff7c2a44"}}>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#ff7c2a",letterSpacing:4}}>ALL-TIME RECORD</div>
              <div style={{fontFamily:"'Fredoka One',cursive",color:"#c2440e",fontSize:16,marginTop:2}}>⭕ O-Rings</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Fredoka One',cursive",fontSize:52,color:"#ff7c2a",lineHeight:1,textShadow:"2px 2px 0 #c2440e"}}>{bestRings}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#ff7c2a99",letterSpacing:2}}>RINGS</div>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8,padding:"0 20px",marginBottom:16}}>
          {TRICKS.map(tr=>{
            const cnt=entries.filter(e=>e.trick===tr.id).length;
            const active=tab===tr.id;
            return(
              <button key={tr.id} onClick={()=>setTab(tr.id)} style={{
                flex:1,padding:"10px 4px",borderRadius:14,
                background:active?"#fff":"#ffffff55",border:`2px solid ${active?tr.color:"#ffffff88"}`,
                color:active?tr.dark:"#666",fontFamily:"'Boogaloo',cursive",fontSize:13,
                cursor:"pointer",transition:"all .2s",boxShadow:active?`0 4px 16px ${tr.glow}`:"none"}}>
                <div style={{fontSize:20,marginBottom:2}}>{tr.emoji}</div>
                <div>{tr.label}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,opacity:.5,marginTop:1}}>{cnt}</div>
              </button>
            );
          })}
        </div>
        <div style={{padding:"0 20px 52px",display:"flex",flexDirection:"column",gap:14}}>
          {filtered.length===0&&(
            <div style={{textAlign:"center",padding:"60px 0",fontFamily:"'Boogaloo',cursive",fontSize:18,color:"#1a1a6e99"}}>
              <div style={{fontSize:48,marginBottom:12}}>{t.emoji}</div>
              No {t.label} attempts yet.<br/>
              <span style={{fontSize:14,fontFamily:"'DM Mono',monospace",color:"#1a1a6e66"}}>Go make some smoke.</span>
            </div>
          )}
          {filtered.slice().reverse().map(entry=>(
            <ArchiveCard key={entry.id} entry={entry} t={t}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArchiveCard({ entry, t }) {
  const [playing,setPlaying]=useState(false);
  const vRef=useRef(null);
  const toggle=()=>{
    if(!entry.videoUrl)return;
    if(playing){vRef.current?.pause();setPlaying(false);}
    else{vRef.current?.play();setPlaying(true);}
  };
  const roast=entry.roast||getRoast(entry.trick,entry.score);
  return(
    <div style={{borderRadius:22,overflow:"hidden",
      background:"linear-gradient(160deg,#fffef0,#fff8e0)",
      border:`3px solid ${t.color}66`,boxShadow:`0 4px 20px ${t.glow},0 2px 8px #00000022`}}>
      <div style={{position:"relative",aspectRatio:"16/9",background:"#000",
        cursor:entry.videoUrl?"pointer":"default"}} onClick={toggle}>
        {entry.thumbnail&&!playing&&(
          <img src={entry.thumbnail} alt="" style={{width:"100%",height:"100%",objectFit:"cover",opacity:.85}}/>
        )}
        {entry.videoUrl&&(
          <video ref={vRef} src={entry.videoUrl} loop playsInline
            style={{display:playing?"block":"none",width:"100%",height:"100%",objectFit:"cover"}}
            onEnded={()=>setPlaying(false)}/>
        )}
        {entry.videoUrl&&!playing&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:48,height:48,borderRadius:"50%",background:"#00000099",border:`3px solid ${t.color}`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:t.color}}>▶</div>
          </div>
        )}
        <div style={{position:"absolute",bottom:8,left:8,background:"#000000cc",border:`2px solid ${t.color}`,
          borderRadius:10,padding:"4px 10px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:"'Fredoka One',cursive",fontSize:22,color:t.color}}>{entry.score.toFixed(1)}</span>
          {entry.trick==="orings"&&entry.ringCount!=null&&(
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#ff7c2a"}}>{entry.ringCount} rings</span>
          )}
        </div>
      </div>
      <div style={{padding:"12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{fontFamily:"'Fredoka One',cursive",fontSize:16,color:t.dark}}>{roast.title}</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#aaa"}}>{entry.date}</span>
        </div>
        <p style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#888",lineHeight:1.5,fontStyle:"italic"}}>
          "{entry.summary}"
        </p>
      </div>
    </div>
  );
}

function HomeScreen({ onSelect }) {
  const [psycho,setPsycho]=useState(false);
  useEffect(()=>{const iv=setInterval(()=>setPsycho(p=>!p),6000);return()=>clearInterval(iv);},[]);
  return(
    <div style={{width:"100%",height:"100%",overflow:"hidden",position:"relative"}}>
      <SimpsonsSky psycho={psycho}/>
      <StonerSmoke color={psycho?"#ff6bdf":"#b96eff"}/>
      <div style={{position:"relative",zIndex:3,display:"flex",flexDirection:"column",
        height:"100%",padding:"52px 26px 44px"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:62,lineHeight:.9,textAlign:"center",
            letterSpacing:2,color:"#1a0a5e",
            textShadow:"4px 4px 0 #ffffffcc,0 0 40px #b96effaa,-2px -2px 0 #b96eff",
            animation:"titleBob 3s ease-in-out infinite",display:"inline-block"}}>VAPE<br/>VALIDATOR</div>
          <div style={{fontFamily:"'Boogaloo',cursive",fontSize:13,color:"#1a0a5eaa",
            letterSpacing:4,marginTop:10,textShadow:"1px 1px 0 #fff"}}>RATE YOUR TRICK</div>
          <div style={{margin:"24px auto",width:120,textAlign:"center",fontFamily:"'Fredoka One',cursive",fontSize:22,
            animation:`rainbowShift ${psycho?"2s":"5s"} linear infinite`,color:"#b96eff"}}>~ ~ ~</div>
          <div style={{fontFamily:"'Boogaloo',cursive",fontSize:13,color:"#1a0a5eaa",
            letterSpacing:3,marginBottom:20,textShadow:"1px 1px 0 #fff"}}>SELECT YOUR TRICK</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {TRICKS.map((tr,i)=>(
            <button key={tr.id} onClick={()=>onSelect(tr.id)} style={{
              background:"linear-gradient(135deg,#ffffffee,#fff8e0ee)",border:`3px solid ${tr.color}`,
              borderRadius:22,padding:"16px 18px",display:"flex",alignItems:"center",gap:14,
              cursor:"pointer",textAlign:"left",boxShadow:`0 4px 20px ${tr.glow},0 2px 8px #00000022`,
              animation:`slideUp .4s ${i*.1}s both ease`,transition:"transform .15s,box-shadow .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.02)";e.currentTarget.style.boxShadow=`0 8px 32px ${tr.glow}`;}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow=`0 4px 20px ${tr.glow},0 2px 8px #00000022`;}}>
              <div style={{width:52,height:52,borderRadius:16,
                background:`linear-gradient(135deg,${tr.color}33,${tr.color}11)`,border:`2px solid ${tr.color}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,
                boxShadow:`0 0 14px ${tr.glow}`}}>{tr.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:tr.dark,letterSpacing:.5,
                  textShadow:`1px 1px 0 ${tr.color}44`}}>{tr.label}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#888",marginTop:2}}>{tr.desc}</div>
              </div>
              <div style={{color:tr.color,fontSize:22,fontFamily:"'Fredoka One',cursive"}}>›</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view,setView]=useState("home");
  const [trick,setTrick]=useState(null);
  const [entries,setEntries]=useState([]);
  const handleResult=entry=>{setEntries(p=>[...p,entry]);setView("archive");};
  return(
    <>
      <style>{CSS}</style>
      <div style={{width:"100vw",height:"100svh",maxWidth:430,margin:"0 auto",
        overflow:"hidden",position:"relative",display:"flex",flexDirection:"column"}}>
        <div style={{flex:1,overflow:"hidden",position:"relative"}}>
          {view==="home"   &&<HomeScreen onSelect={id=>{setTrick(id);setView("camera");}}/>}
          {view==="camera" &&<CameraScreen trick={trick} onResult={handleResult} onBack={()=>setView("home")}/>}
          {view==="archive"&&<ArchivePage entries={entries}/>}
        </div>
        {(view==="home"||view==="archive")&&(
          <div style={{display:"flex",background:"linear-gradient(180deg,#5bbfff,#3fa8f5)",
            borderTop:"3px solid #ffffff55",boxShadow:"0 -4px 20px #00000022"}}>
            {[{id:"home",icon:"🎯",label:"TRICKS"},{id:"archive",icon:"📼",label:"ARCHIVE"}].map(tab=>{
              const active=view===tab.id;
              return(
                <button key={tab.id} onClick={()=>setView(tab.id)} style={{
                  flex:1,padding:"12px 0 14px",background:active?"#ffffff33":"transparent",border:"none",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",transition:"background .2s"}}>
                  <span style={{fontSize:22,filter:active?"none":"opacity(.45)"}}>{tab.icon}</span>
                  <span style={{fontFamily:"'Boogaloo',cursive",fontSize:12,letterSpacing:2,
                    color:active?"#1a0a5e":"#1a0a5e77"}}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
