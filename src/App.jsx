import React from "react";
import { createClient } from "@supabase/supabase-js";

/* ---------- Supabase ---------- */
const supa = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try { if (!url || !key) return null; return createClient(url, key); } catch { return null; }
})();

/* ---------- utils ---------- */
const sec = (m, s = 0) => m * 60 + s;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function parseTimeToSeconds(str){ if(!str&&str!==0)return NaN; const p=String(str).trim().split(":"); if(p.length===1){const m=Number(p[0]);return isNaN(m)?NaN:m*60;} const m=Number(p[0]),s=Number(p[1]); if([m,s].some(Number.isNaN))return NaN; return m*60+s; }
function secondsToMMSS(t){ if(!isFinite(t))return "--:--"; const x=Math.round(t),m=Math.floor(x/60),s=x%60; return `${m}:${String(s).padStart(2,"0")}`; }
function pacePerKmFrom5k(v){ const t=parseTimeToSeconds(v); return isFinite(t)?t/5:300; }
function ergPace500From1k(v){ const t=parseTimeToSeconds(v); return isFinite(t)?t/2:135; }
function save(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch{} }
function load(k,f){ try{const v=localStorage.getItem(k); return v?JSON.parse(v):f;}catch{return f;} }

/* ---------- race twin ---------- */
function estimateRaceFromBaseline(b){
  const run5kSec=parseTimeToSeconds(b.run5k)||sec(25), pacePerKm=run5kSec/5;
  const runFatigue=1.08, run8k=8*pacePerKm*runFatigue;
  const est=(base,m=1)=>clamp(base*m,base*0.7,base*1.5);
  const ski=parseTimeToSeconds(b.ski1k)||est(4.5*60, pacePerKm/300);
  const row=parseTimeToSeconds(b.row1k)||est(4*60, pacePerKm/300);
  const sledPush=parseTimeToSeconds(b.sledPush50m)||est(180,1.05);
  const sledPull=parseTimeToSeconds(b.sledPull50m)||est(170,1.05);
  const burpees=parseTimeToSeconds(b.burpeeBroad80m)||est(360,1.1);
  const farmer=parseTimeToSeconds(b.farmer200m)||est(160,1.0);
  const lunges=parseTimeToSeconds(b.lunges100m)||est(240,1.05);
  const wallRate=(typeof b.wallballs100==="number"&&b.wallballs100>0)?b.wallballs100:22;
  const wallballs=(100/wallRate)*60;
  const transPer=12+(6-(b.readiness||4))*1.5, transitions=8*transPer;
  const splits={run8k,ski,row,sledPush,sledPull,burpees,farmer,lunges,wallballs,transitions};
  const total=Object.values(splits).reduce((a,c)=>a+c,0);
  const ref={ski:270,sledPush:200,sledPull:190,burpees:420,row:250,farmer:180,lunges:260,wallballs:270};
  const deltas={ ski:splits.ski-ref.ski, sledPush:splits.sledPush-ref.sledPush, sledPull:splits.sledPull-ref.sledPull, burpees:splits.burpees-ref.burpees, row:splits.row-ref.row, farmer:splits.farmer-ref.farmer, lunges:splits.lunges-ref.lunges, wallballs:splits.wallballs-ref.wallballs };
  const sortedLimiters=Object.entries(deltas).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({station:k,penalty:v}));
  return { total, splits, deltas, sortedLimiters };
}

/* ---------- blocks & weekly ---------- */
function stationBlocks(name, variant="std"){
  const b={
    ski:["Technique: catch-drive timing 10′","6×250m @ 2k pace; rest 60–75s","1,000m steady @ race RPE 7"],
    row:["Technique: sequencing 8′","5×300m @ 2k pace; rest 60–75s","1,000m steady @ race RPE 7"],
    sledPush:["Warm-up: empty sled 2×20m","4×20m @ moderate; rest 90s","3×20m @ heavy (race+); rest 2′"],
    sledPull:["Warm-up: 2×20m light drag","5×20m @ moderate; rest 90s","3×20m @ heavy; rest 2′"],
    burpees:["Drill: broad jump mechanics 6×3 reps; walk back","6×12 burpee broad jumps; rest 90s","80m continuous @ race effort"],
    farmer:["Carry ladder: 3×(50m light + 30m moderate + 20m heavy); rest 2′","Core brace carries 3×40m suitcase each side"],
    lunges:["Goblet lunge 3×12/leg; rest 90s","100m sandbag walking lunge broken as needed"],
    wallballs:["Warm-up: 2×15 air squats + 10 light wall balls","EMOM 12′: 12 reps","2×50 reps for time; rest 3′"],
  };
  let arr=b[name]||["Technique + intervals 30–40′"];
  if(variant==="deload"){
    arr=arr.map(l=>l
      .replace(/(\d+)×/g,(m,n)=>`${Math.max(1,Math.round(Number(n)*0.7))}×`)
      .replace(/EMOM *(\d+)[′']/i,(m,n)=>`EMOM ${Math.max(8,Math.round(Number(n)*0.8))}′`));
  }
  return arr;
}
function annotateBlocks(blocks,p){
  const fkm=(s)=>`${secondsToMMSS(Math.round(s))}/km`;
  const f500=(s)=>`${String(Math.floor(s/60)).padStart(1,"0")}:${String(Math.round(s%60)).padStart(2,"0")}/500m`;
  return (blocks||[]).map(line=>{
    let out=line;
    out=out.replace(/@ *5k pace(?![^(])/gi,`@ 5k pace (${fkm(p.run5k)})`);
    if(p.goalRun) out=out.replace(/@ *(goal|target) pace/gi,`@ target pace (${fkm(p.goalRun)})`);
    out=out.replace(/2k pace(?![^(])/gi,`2k pace (${f500(p.row2k500)})`);
    out=out.replace(/SkiErg *1000m|Ski *1000m/gi,m=>`${m} (≈ ${String(secondsToMMSS(Math.round(p.ski500*2)))} total)`);
    out=out.replace(/Row *1000m/gi,m=>`${m} (≈ ${String(secondsToMMSS(Math.round(p.row500*2)))} total)`);
    return out;
  });
}
function getWeeksToRace(dateStr){ if(!dateStr)return null; const d=new Date(dateStr+"T00:00:00"), now=new Date(); return Math.ceil((d-now)/(7*24*3600*1000)); }
function getPhase(w){ if(w==null) return "Health"; if(w<=1) return "Taper"; if(w<=4) return "Specific"; if(w<=9) return "Build"; return "Base"; }
function isDeloadWeek(){ const now=new Date(), start=new Date(now.getFullYear(),0,1); const diff=Math.floor((now-start)/(7*24*3600*1000)); return diff%3===2; }
function makeWeekPlan(athlete, analysis){
  const wtr=getWeeksToRace(athlete.raceDate);
  const phase=athlete.goalType==="Health"||!athlete.raceDate?"Health":getPhase(wtr);
  const deload=phase!=="Taper" && isDeloadWeek();
  const top3=analysis.sortedLimiters.slice(0,3).map(x=>x.station);
  const focus=(n)=>({ type:`Station Skill${deload?" (Deload)":""}`, focus:n, blocks:stationBlocks(n, deload?"deload":"std") });

  const paces={
    run5k: pacePerKmFrom5k(athlete.run5k||"25:00"),
    goalRun: analysis.splits.run8k/8,
    ski500: ergPace500From1k(athlete.ski1k||"4:30"),
    row500: ergPace500From1k(athlete.row1k||"4:00"),
    row2k500: ergPace500From1k(athlete.row1k||"4:00")+2,
  };
  const enrich=(s)=>({...s, blocks:annotateBlocks(s.blocks,paces)});

  const run={ easyStrides:{type:"Run Easy + Strides",blocks:["35–45′ Z2 run","6×20s strides, walk back"]},
              threshold:{type:"Run Threshold",blocks:["Warm-up 10′","3×10′ @ 5k pace; 2′ easy","Cooldown 10′"]},
              vo2:{type:"Run VO2",blocks:["Warm-up 10′","6×3′ hard; 2′ easy","Cooldown 10′"]},
              racePace:{type:"Run Race-Pace",blocks:["Warm-up 10′","6×1 km @ target pace; 90″ easy","Cooldown 10′"]},
              longEasy:{type:"Long Easy",blocks:["50–70′ easy mixed modality"]} };
  const erg={ skiPyramid:{type:"Ski Pyramids",blocks:["Technique 8′","250/500/250 @ 2k pace; 90″ easy"]},
              skiFastFinish:{type:"Ski Fast-Finish",blocks:["600 steady + 400 fast ×3; 2′ easy"]},
              rowPyramid:{type:"Row Pyramids",blocks:["Technique 8′","250/500/250 @ 2k pace; 90″ easy"]},
              rowFastFinish:{type:"Row Fast-Finish",blocks:["600 steady + 400 fast ×3; 2′ easy"]}};
  const strength={ strengthA:{type:"Strength A",blocks:["Back squat 4×5 @ RPE 7; rest 2–3′","RDL 3×8 @ RPE 7; rest 2′","DB bench 4×6 @ RPE 7","Core: 3×20s hollow + side plank"]},
                   strengthHybrid:{type:"Strength Hybrid",blocks:["Front squat 5×3 @ RPE 8; rest 2–3′","Trap bar DL 4×5 @ RPE 7; rest 2′","Push press 5×3 @ RPE 8; rest 2′","Finisher: 10′ easy row"]},
                   strengthPower:{type:"Strength Power",blocks:["Jump squat 5×3 (light, fast)","Clean pull 4×3 (moderate)","Push press 4×3"]}};
  const bricks={ A:{type:"Brick A",blocks:["3× [1 km @ target pace + sled push 20 m + sled pull 20 m]; 3′"]},
                 B:{type:"Brick B",blocks:["2× [1 km @ target pace + 40 m burpee broad + 50 wall balls as 30/20]; 4′"]},
                 C:{type:"Race Sim Lite",blocks:["4× [1 km + 2 stations from limiter list]; 3′"]},
                 Primer:{type:"Race Primer",blocks:["2× [800 m @ target pace + sled push 15 m + sled pull 15 m]; full rest"]} };

  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  function out(plan){ return plan.map((s,i)=>({day:days[i],session:s,phase})); }

  if(phase==="Health")  return out([enrich(run.easyStrides), focus(top3[0]||"sledPush"), strength.strengthA, enrich(erg.rowPyramid), focus(top3[1]||"burpees"), run.longEasy, {type:"Recovery",blocks:["Walk 20–30′","Mobility 20′"]}]);
  if(phase==="Base")    return out([enrich(run.threshold),   focus(top3[0]||"sledPush"), strength.strengthA, enrich(run.easyStrides),  focus(top3[1]||"burpees"), bricks.A, {type:"Recovery",blocks:["Mobility 30–40′","Easy walk 30′"]}]);
  if(phase==="Build")   return out([enrich(run.vo2),         focus(top3[0]||"sledPush"), strength.strengthHybrid, focus(top3[1]||"wallballs"), enrich(erg.skiFastFinish), bricks.B, run.longEasy]);
  if(phase==="Specific")return out([enrich(run.racePace),    focus(top3[0]||"sledPush"), strength.strengthPower,  focus(top3[1]||"sledPull"),  enrich(erg.rowFastFinish), bricks.C, {type:"Recovery",blocks:["Mobility 30–40′","Easy walk 30′"]}]);
  if(phase==="Taper")   return out([enrich(run.easyStrides), bricks.Primer, {type:"Recovery",blocks:["30–35′ recovery + mobility"]}, {type:"Tune-up",blocks:["20′ easy + 4×10″ pickups"]}, {type:"Activation",blocks:["10′ easy + 10 wall balls + 10 burpees"]}, {type:"Off / Travel",blocks:["Gentle walk, hydration focus"]}, {type:"Recovery",blocks:["Mobility 20′"]}]);
  return [];
}

/* ---------- UI primitives ---------- */
function Card({ title, children, right }){ return(<div className="card"><div className="row" style={{justifyContent:"space-between",marginBottom:8}}><h2 style={{margin:0}}>{title}</h2>{right}</div>{children}</div>); }

/* ---------- Auth bar ---------- */
function AuthBar(){
  if(!supa) return <div className="card"><div className="muted">Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Environment Variables.</div></div>;
  const [email,setEmail]=React.useState(""); const [code,setCode]=React.useState(""); const [status,setStatus]=React.useState(""); const [user,setUser]=React.useState(null);
  React.useEffect(()=>{ let sub; (async()=>{const {data}=await supa.auth.getSession(); setUser(data?.session?.user||null); const res=supa.auth.onAuthStateChange((_e,session)=>setUser(session?.user||null)); sub=res.data?.subscription;})(); return()=>sub?.unsubscribe?.(); },[]);
  async function sendLink(){ setStatus("Sending…"); const {error}=await supa.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+window.location.pathname}}); setStatus(error?`Error: ${error.message}`:"Check your email for the link or 6-digit code."); }
  async function verify(){ setStatus("Verifying…"); const {error}=await supa.auth.verifyOtp({type:"email",email,token:code}); setStatus(error?`Error: ${error.message}`:"Signed in."); }
  async function signOut(){ await supa.auth.signOut(); setUser(null); }
  return (<div className="card"><div className="row" style={{justifyContent:"space-between"}}><div><div style={{fontWeight:600,marginBottom:6}}>Account</div><div className="muted">{user?`Signed in as ${user.email||user.id}`:"Not signed in"}</div></div><div className="row">{!user?(<><input placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><button className="btn" onClick={sendLink}>Send magic link</button><input placeholder="123456" value={code} onChange={e=>setCode(e.target.value)} style={{width:100}}/><button onClick={verify}>Verify code</button></>):(<button onClick={signOut}>Sign out</button>)}</div></div>{status&&<div className="muted" style={{marginTop:8}}>{status}</div>}</div>);
}

/* ---------- Guided Baseline (stopwatch flow) ---------- */
function Stopwatch({running,onToggle,onReset,seconds}){ const mmss=secondsToMMSS(seconds); return(<div className="row"><div style={{fontFamily:"monospace",fontSize:24}}>{mmss}</div><button className="btn" onClick={onToggle}>{running?"Stop":"Start"}</button><button onClick={onReset}>Reset</button></div>); }
function GuidedBaseline({ base, setBase }){
  const tests=[["run5k","Run 5k"],["ski1k","SkiErg 1,000 m"],["row1k","Row 1,000 m"],["sledPush50m","Sled Push 50 m"],["sledPull50m","Sled Pull 50 m"],["burpeeBroad80m","Burpee Broad 80 m"],["farmer200m","Farmer’s Carry 200 m"],["lunges100m","Walking Lunges 100 m"]];
  const [idx,setIdx]=React.useState(0); const [running,setRunning]=React.useState(false); const [secElapsed,setSecElapsed]=React.useState(0);
  React.useEffect(()=>{ if(!running) return; const id=setInterval(()=>setSecElapsed(s=>s+1),1000); return()=>clearInterval(id); },[running]);
  const atEnd=idx>=tests.length; const curr=tests[idx]||null;
  function saveTime(){ const mmss=secondsToMMSS(secElapsed); const k=tests[idx][0]; setBase({...base,[k]:mmss}); }
  return(<Card title="Guided Baseline"><div className="muted" style={{marginBottom:8}}>Use the stopwatch to time each test. Click Save after each, then Next.</div>{!atEnd?(<><div style={{fontWeight:600,marginBottom:6}}>{curr[1]}</div><Stopwatch running={running} onToggle={()=>setRunning(r=>!r)} onReset={()=>{setRunning(false);setSecElapsed(0);}} seconds={secElapsed}/><div className="row" style={{marginTop:8}}><button className="btn" onClick={saveTime}>Save time</button><button onClick={()=>{setIdx(i=>i+1); setRunning(false); setSecElapsed(0);}}>Next</button><button onClick={()=>setIdx(tests.length)}>Skip to summary</button></div><div className="muted" style={{marginTop:8}}>Saved: {tests.map(t=>base[t[0]]?t[1]:null).filter(Boolean).join(", ")||"None"}</div></>):(<><div style={{fontWeight:600,marginBottom:6}}>Summary</div><ul style={{margin:0,paddingLeft:16}}>{tests.map(t=><li key={t[0]}>{t[1]}: {base[t[0]]||"--:--"}</li>)}</ul></>)}</Card>);
}

/* ---------- Main App ---------- */
export default function App(){
  // viewer mode for shared snapshots
  const [snapshot,setSnapshot]=React.useState(null);
  React.useEffect(()=>{ try{ const url=new URL(window.location.href); const snap=url.searchParams.get("snapshot"); if(snap){ setSnapshot(JSON.parse(decodeURIComponent(atob(snap)))); } }catch{} },[]);
  if(snapshot) return <SharedViewer data={snapshot} />;

  const [athlete,setAthlete]=React.useState(load("hyrox.athlete",{ name:"", division:"Open", goalType:"Race", raceDate:"" }));
  const [base,setBase]=React.useState(load("hyrox.base",{ run5k:"25:00", ski1k:"4:30", row1k:"4:00", sledPush50m:"3:00", sledPull50m:"2:50", burpeeBroad80m:"6:00", farmer200m:"3:00", lunges100m:"4:30", wallballs100:22, readiness:4 }));
  React.useEffect(()=>save("hyrox.athlete",athlete),[athlete]); React.useEffect(()=>save("hyrox.base",base),[base]);

  const analysis=React.useMemo(()=>estimateRaceFromBaseline(base),[base]);
  const plan=React.useMemo(()=>makeWeekPlan({ goalType:athlete.goalType, raceDate:athlete.raceDate, ...base }, analysis),[athlete,base,analysis]);

  // today + readiness adjust
  const weekday=new Date().getDay(); const map=[6,0,1,2,3,4,5]; const idx=map[weekday]??0;
  const todays=plan[idx]||plan[0]||{ day:"Mon", session:{type:"Rest",blocks:["Walk 20′"]} };
  const [readiness,setReadiness]=React.useState(3);
  const paces=React.useMemo(()=>({ run5k:pacePerKmFrom5k(base.run5k||"25:00"), goalRun:analysis.splits.run8k/8, ski500:ergPace500From1k(base.ski1k||"4:30"), row500:ergPace500From1k(base.row1k||"4:00"), row2k500:ergPace500From1k(base.row1k||"4:00")+2 }),[base.run5k,base.ski1k,base.row1k,analysis.splits.run8k]);
  const adjusted=React.useMemo(()=>{ const s={...todays.session}; let blocks=s.blocks?[...s.blocks]:(s.notes?[s.notes]:[]); blocks=annotateBlocks(blocks,paces); const scale=(arr,mode)=>arr.map(line=>{ let out=line; if(mode==="easy"){ out=out.replace(/(\d+)×/g,(m,p1)=>`${Math.max(1,Math.round(Number(p1)*0.65))}×`).replace(/@ *[^;\n]+pace/g,"@ easy pace").replace(/rest *([0-9]+) *([′'smin]+)/gi,(m,n,u)=>`rest ${Math.round(Number(n)*1.3)}${String(u).toLowerCase().includes("min")?" min":"s"}`).replace(/EMOM *([0-9]+)[′']/i,(m,min)=>`EMOM ${Math.max(8,Math.round(Number(min)*0.85))}′`);} else if(mode==="hard"){ out=out.replace(/(\d+)×/g,(m,p1)=>`${Number(p1)+1}×`).replace(/@ *5k pace/g,"@ 5k pace − 5–8s/km").replace(/rest *([0-9]+) *([′'smin]+)/gi,(m,n,u)=>`rest ${Math.max(20,Math.round(Number(n)*0.85))}${String(u).toLowerCase().includes("min")?" min":"s"}`);} return out; }); if(readiness<=2){ s.type=`${s.type} (Easy)`; s.blocks=scale(blocks,"easy"); } else if(readiness>=4){ s.type=`${s.type} (Challenging)`; s.blocks=scale(blocks,"hard"); } else { s.blocks=scale(blocks,"normal"); } return s; },[todays,readiness,paces]);

  // cloud helpers
  const [user,setUser]=React.useState(null);
  React.useEffect(()=>{ if(!supa) return; let sub; (async()=>{ const {data}=await supa.auth.getSession(); setUser(data?.session?.user||null); const res=supa.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null)); sub=res.data?.subscription; })(); return()=>sub?.unsubscribe?.(); },[]);
  const cleanNum=(v)=>(v===""||v==null||Number.isNaN(Number(v))?null:Number(v));

  async function pushBaseline(){
    if(!supa||!user) return alert("Sign in first.");
    const payload={ user_id:user.id, run5k:base.run5k||null, ski1k:base.ski1k||null, row1k:base.row1k||null, sledpush50m:base.sledPush50m||null, sledpull50m:base.sledPull50m||null, burpeebroad80m:base.burpeeBroad80m||null, farmer200m:base.farmer200m||null, lunges100m:base.lunges100m||null, wallballs100:cleanNum(base.wallballs100), readiness:cleanNum(base.readiness), updated_at:new Date().toISOString() };
    const { error } = await supa.from("baselines").upsert(payload,{ onConflict:"user_id" });
    if(error) return alert("Error: "+error.message); alert("Baseline synced.");
  }
  async function pullBaseline(){
    if(!supa||!user) return alert("Sign in first.");
    const { data, error } = await supa.from("baselines").select("*").eq("user_id",user.id).limit(1).maybeSingle();
    if(error) return alert("Error: "+error.message);
    if(!data) return alert("No baseline on server.");
    const next={...base};
    if(data.run5k!=null) next.run5k=data.run5k;
    if(data.ski1k!=null) next.ski1k=data.ski1k;
    if(data.row1k!=null) next.row1k=data.row1k;
    if(data.sledpush50m!=null) next.sledPush50m=data.sledpush50m;
    if(data.sledpull50m!=null) next.sledPull50m=data.sledpull50m;
    if(data.burpeebroad80m!=null) next.burpeeBroad80m=data.burpeebroad80m;
    if(data.farmer200m!=null) next.farmer200m=data.farmer200m;
    if(data.lunges100m!=null) next.lunges100m=data.lunges100m;
    if(data.wallballs100!=null) next.wallballs100=data.wallballs100;
    if(data.readiness!=null) next.readiness=data.readiness;
    setBase(next); alert("Baseline pulled.");
  }
  async function saveSession(){
    const entry={ ts:new Date().toISOString(), dayIdx:idx, session:adjusted, rpe:null, notes:null, readiness, completed:false };
    const local=load("hyrox.sessions",[]); local.push(entry); save("hyrox.sessions",local);
    if(supa&&user){ const { error } = await supa.from("sessions").insert({ user_id:user.id, ts:entry.ts, day_idx:entry.dayIdx, session:entry.session, rpe:entry.rpe, notes:entry.notes, readiness:entry.readiness, completed:entry.completed }); if(error) return alert("Saved locally. Cloud error: "+error.message); alert("Saved locally + cloud."); } else { alert("Saved locally. Sign in to sync to cloud."); }
  }

  function makeShareLink(){
    const payload={ plan, analysis:{ total:analysis.total, splits:analysis.splits }, athlete:{ name:athlete.name, division:athlete.division, goalType:athlete.goalType, raceDate:athlete.raceDate } };
    const enc=btoa(encodeURIComponent(JSON.stringify(payload)));
    const url=`${window.location.origin}${window.location.pathname}?snapshot=${enc}`;
    navigator.clipboard.writeText(url); alert("Share link copied!");
  }

  return (
    <>
      <header>
        <div className="inner">
          <div className="title"><div className="logo">🏆</div><div><div style={{fontWeight:700}}>HYROX AI Coach</div><div className="muted" style={{fontSize:12}}>v1.2 • Cloud • Share • Guided baseline</div></div></div>
        </div>
      </header>

      <main className="wrap">
        <h1>Dashboard</h1>
        <AuthBar/>

        {/* Athlete top line */}
        <Card title="Athlete">
          <div className="row">
            <input placeholder="Name" value={athlete.name} onChange={e=>setAthlete({...athlete, name:e.target.value})}/>
            <select value={athlete.division} onChange={e=>setAthlete({...athlete, division:e.target.value})}><option>Open</option><option>Pro</option><option>Doubles</option><option>Relay</option></select>
            <select value={athlete.goalType} onChange={e=>setAthlete({...athlete, goalType:e.target.value})}><option value="Race">Race</option><option value="Health">Health</option></select>
            <input type="date" value={athlete.raceDate} onChange={e=>setAthlete({...athlete, raceDate:e.target.value})}/>
          </div>
        </Card>

        {/* Baseline quick + cloud */}
        <Card title="Baseline (quick)" right={<div className="row"><button onClick={pushBaseline}>Save to cloud</button><button onClick={pullBaseline}>Pull from cloud</button></div>}>
          <div className="row" style={{flexWrap:"wrap"}}>
            {[
              ["run5k","5k run (mm:ss)"],["ski1k","SkiErg 1k"],["row1k","Row 1k"],
              ["sledPush50m","Sled push 50m"],["sledPull50m","Sled pull 50m"],
              ["burpeeBroad80m","Burpee broad 80m"],["farmer200m","Farmers 200m"],["lunges100m","Lunges 100m"]
            ].map(([k,label])=>(
              <input key={k} placeholder={label} value={base[k]} onChange={e=>setBase({...base,[k]:e.target.value})}/>
            ))}
            <input type="number" placeholder="Wall-balls rate (reps/min)" value={base.wallballs100} onChange={e=>setBase({...base,wallballs100:Number(e.target.value)})}/>
            <div className="row" style={{alignItems:"center"}}><span className="muted">Readiness</span><input type="range" min={1} max={5} value={base.readiness} onChange={e=>setBase({...base, readiness:Number(e.target.value)})}/></div>
          </div>
        </Card>

        <GuidedBaseline base={base} setBase={setBase} />

        {/* Race Twin */}
        <Card title="Race Twin (prediction)">
          <div className="row" style={{gap:16,flexWrap:"wrap"}}>
            <div className="pill">Predicted: <b>{secondsToMMSS(analysis.total)}</b></div>
            <div className="muted">Limiters: {analysis.sortedLimiters.slice(0,4).map(x=>x.station).join(", ")}</div>
            <button className="btn" onClick={makeShareLink}>Share plan (read-only)</button>
          </div>
          <hr/>
          <div className="grid grid-3">
            {Object.entries(analysis.splits).map(([k,v])=>(
              <div key={k} className="card" style={{padding:12}}>
                <div className="muted" style={{fontSize:12}}>{k}</div>
                <div style={{fontWeight:600}}>{secondsToMMSS(v)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Week plan */}
        <Card title={`Your next 7 days — ${plan[0]?.phase||"Health"}${isDeloadWeek()&&(plan[0]?.phase!=="Taper")?" (Deload)":""}`}>
          <div className="grid grid-3">
            {plan.map(d=>(
              <div key={d.day} className="card" style={{padding:12}}>
                <div className="muted" style={{fontSize:12}}>{d.day}</div>
                <div style={{fontWeight:700,marginBottom:6}}>{d.session.type}</div>
                {d.session.blocks?(
                  <ul style={{margin:0,paddingLeft:16}}>{d.session.blocks.map((b,i)=><li key={i}>{b}</li>)}</ul>
                ):<div className="muted">{d.session.notes}</div>}
              </div>
            ))}
          </div>
        </Card>

        {/* Train Today */}
        <Card title="Train Today" right={<div className="row"><span className="muted">Readiness</span><input type="range" min={1} max={5} value={readiness} onChange={e=>setReadiness(Number(e.target.value))}/></div>}>
          <div className="muted" style={{marginBottom:6}}>{todays.day}</div>
          <div style={{fontWeight:700}}>{adjusted.type}</div>
          <ul style={{marginTop:6,paddingLeft:16}}>{adjusted.blocks?.map((b,i)=><li key={i}>{b}</li>)}</ul>
          <div className="row" style={{marginTop:8}}><button className="btn" onClick={saveSession}>Save session</button></div>
        </Card>

        {/* Existing simple cards kept for now */}
        <Card title="Pro Features"><div className="muted">Coming soon: Race Sim+, export, multi-athlete with Stripe Checkout.</div></Card>
      </main>
    </>
  );
}

/* ---------- Share viewer ---------- */
function SharedViewer({ data }){
  const total=secondsToMMSS(data.analysis.total);
  return (
    <div className="wrap">
      <h1>HYROX Plan — Viewer</h1>
      <div className="muted" style={{marginBottom:8}}>{data.athlete.name||"Athlete"} • {data.athlete.division}</div>
      <div className="pill">Predicted: <b>{total}</b></div>
      <div className="grid grid-3" style={{marginTop:16}}>
        {data.plan.map(d=>(
          <div key={d.day} className="card" style={{padding:12}}>
            <div className="muted" style={{fontSize:12}}>{d.day}</div>
            <div style={{fontWeight:700,marginBottom:6}}>{d.session.type}</div>
            {d.session.blocks?(
              <ul style={{margin:0,paddingLeft:16}}>{d.session.blocks.map((b,i)=><li key={i}>{b}</li>)}</ul>
            ):(<div className="muted">{d.session.notes}</div>)}
          </div>
        ))}
      </div>
      <div className="muted" style={{marginTop:12}}>Read-only snapshot</div>
    </div>
  );
}
