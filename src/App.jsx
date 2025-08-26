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
/* ---------- helpers (add) ---------- */
function safeGetEnv() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
    (typeof window !== "undefined" && window.VITE_SUPABASE_URL) ||
    "";
  const key =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    (typeof window !== "undefined" && window.VITE_SUPABASE_ANON_KEY) ||
    "";
  return { url, key };
}
<HistoryPage user={user} />

function estimateMinutesFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return 0;
  let total = 0;
  for (const line of blocks) {
    const s = String(line);

    // match patterns like "3x6’" / "3 x 6 min"
    const repsMatch = s.match(/(\d+)\s*[x×]\s*(\d+)\s*(?:min|m|′|')/i);
    if (repsMatch) {
      const reps = Number(repsMatch[1] || 0);
      const mins = Number(repsMatch[2] || 0);
      total += reps * mins;
      continue;
    }

    // match simple minutes like "10 min", "12’"
    const minMatch = s.match(/(\d+)\s*(?:min|m|′|')/i);
    if (minMatch) {
      total += Number(minMatch[1] || 0);
      continue;
    }
  }
  return total;
}

function weekKeyOf(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = (day + 6) % 7; // 0 for Mon
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - diffToMon);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}


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

/* ---------- Guided Baseline ---------- */
function Stopwatch({running,onToggle,onReset,seconds}){ const mmss=secondsToMMSS(seconds); return(<div className="row"><div style={{fontFamily:"monospace",fontSize:24}}>{mmss}</div><button className="btn" onClick={onToggle}>{running?"Stop":"Start"}</button><button onClick={onReset}>Reset</button></div>); }
function GuidedBaseline({ base, setBase }){
  const tests=[["run5k","Run 5k"],["ski1k","SkiErg 1,000 m"],["row1k","Row 1,000 m"],["sledPush50m","Sled Push 50 m"],["sledPull50m","Sled Pull 50 m"],["burpeeBroad80m","Burpee Broad 80 m"],["farmer200m","Farmer’s Carry 200 m"],["lunges100m","Walking Lunges 100 m"]];
  const [idx,setIdx]=React.useState(0); const [running,setRunning]=React.useState(false); const [secElapsed,setSecElapsed]=React.useState(0);
  React.useEffect(()=>{ if(!running) return; const id=setInterval(()=>setSecElapsed(s=>s+1),1000); return()=>clearInterval(id); },[running]);
  const atEnd=idx>=tests.length; const curr=tests[idx]||null;
  function saveTime(){ const mmss=secondsToMMSS(secElapsed); const k=tests[idx][0]; setBase({...base,[k]:mmss}); }
  return(<Card title="Guided Baseline"><div className="muted" style={{marginBottom:8}}>Use the stopwatch to time each test. Click Save after each, then Next.</div>{!atEnd?(<><div style={{fontWeight:600,marginBottom:6}}>{curr[1]}</div><Stopwatch running={running} onToggle={()=>setRunning(r=>!r)} onReset={()=>{setRunning(false);setSecElapsed(0);}} seconds={secElapsed}/><div className="row" style={{marginTop:8}}><button className="btn" onClick={saveTime}>Save time</button><button onClick={()=>{setIdx(i=>i+1); setRunning(false); setSecElapsed(0);}}>Next</button><button onClick={()=>setIdx(tests.length)}>Skip to summary</button></div><div className="muted" style={{marginTop:8}}>Saved: {tests.map(t=>base[t[0]]?t[1]:null).filter(Boolean).join(", ")||"None"}</div></>):(<><div style={{fontWeight:600,marginBottom:6}}>Summary</div><ul style={{margin:0,paddingLeft:16}}>{tests.map(t=><li key={t[0]}>{t[1]}: {base[t[0]]||"--:--"}</li>)}</ul></>)}</Card>);
}

/* ---------- Profile card (FIXED) ---------- */
function ProfileCard({ user, profile, setProfile }) {
  async function saveCloud() {
    if (!supa || !user) return alert("Sign in first.");
    const payload = {
      id: user.id,
      email: user.email || null,
      experience: profile.experience,
      goal: profile.goal,
    };
    const { error } = await supa.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) return alert("Error: " + error.message);
    alert("Profile saved.");
  }

  async function loadCloud() {
    if (!supa || !user) return alert("Sign in first.");
    const { data, error } = await supa.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) return alert("Error: " + error.message);
    if (!data) return alert("No profile in cloud yet.");
    setProfile({
      experience: data.experience || "beginner",
      goal: data.goal || "balanced",
    });
    alert("Profile loaded from cloud.");
  }

  async function generateWeek1ToCloud() {
    if (!supa || !user) return alert("Sign in first.");
    if (!plan.length) return alert("No plan generated.");
    const rows = plan.map((d, i) => ({
      user_id: user.id,
      week_index: 1,
      day_index: i,
      session_date: null,
      title: d.session.type,
      blocks: d.session.blocks || [],
      focus: d.session.focus || null,
      phase: d.phase,
      targets: null,
      completed: false,
    }));
    const { error } = await supa.from("workouts").upsert(rows, { onConflict: "user_id,week_index,day_index" });
    if (error) return alert("Error: " + error.message);
    alert("Week 1 plan saved to cloud.");
    window.dispatchEvent(new Event("workouts:changed"));
  }

  return (
    <Card
      title="Profile"
      right={
        <div className="row">
          <button onClick={saveCloud}>Save to cloud</button>
          <button onClick={loadCloud}>Load from cloud</button>
        </div>
      }
    >
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <label className="row" style={{ gap: 6 }}>
          <span className="muted">Experience</span>
          <select value={profile.experience} onChange={(e) => setProfile({ ...profile, experience: e.target.value })}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label className="row" style={{ gap: 6 }}>
          <span className="muted">Goal</span>
          <select value={profile.goal} onChange={(e) => setProfile({ ...profile, goal: e.target.value })}>
            <option value="balanced">Balanced</option>
            <option value="endurance">Endurance</option>
            <option value="strength">Strength</option>
          </select>
        </label>
      </div>
    </Card>
  );
}


  // 👇 Add this line so the ThisWeek panel refreshes immediately
  window.dispatchEvent(new Event("workouts:changed"));
}

  }
  return (
    <Card title="Profile" right={<div className="row"><button onClick={saveCloud}>Save to cloud</button><button onClick={loadCloud}>Load from cloud</button></div>}>
      <div className="row" style={{gap:12,flexWrap:"wrap"}}>
        <label className="row" style={{gap:6}}>
          <span className="muted">Experience</span>
          <select value={profile.experience} onChange={e=>setProfile({...profile,experience:e.target.value})}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label className="row" style={{gap:6}}>
          <span className="muted">Goal</span>
          <select value={profile.goal} onChange={e=>setProfile({...profile,goal:e.target.value})}>
            <option value="balanced">Balanced</option>
            <option value="endurance">Endurance</option>
            <option value="strength">Strength</option>
          </select>
        </label>
      </div>
    </Card>
  );

/* ---------- This Week from cloud (NEW) ---------- */
function ThisWeek({ user }) {
  const [groups, setGroups] = React.useState([]); // [{day_index, items: [...] }]
  const [open, setOpen] = React.useState(new Set()); // accordion
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  async function fetchWeek() {
    if (!supa || !user) {
      setGroups([]);
      return;
    }
    setLoading(true);
    setErr("");
    const { data, error } = await supa
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_index", 1)
      .order("day_index", { ascending: true });

    if (error) {
      setErr(error.message);
      setGroups([]);
    } else {
      // group by day_index
      const byDay = new Map();
      (data || []).forEach((r) => {
        const key = r.day_index ?? 0;
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key).push(r);
      });
      const grouped = Array.from(byDay.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([day_index, items]) => ({ day_index, items }));
      setGroups(grouped);
    }
    setLoading(false);
  }

  async function toggleComplete(row) {
    const newVal = !row.completed;
    // optimistic UI
    setGroups((g) =>
      g.map((grp) => ({
        ...grp,
        items: grp.items.map((it) =>
          it.id === row.id ? { ...it, completed: newVal } : it
        ),
      }))
    );
    const { error } = await supa.from("workouts").update({ completed: newVal }).eq("id", row.id);
    if (error) {
      alert("Error: " + error.message);
      // revert on failure
      setGroups((g) =>
        g.map((grp) => ({
          ...grp,
          items: grp.items.map((it) =>
            it.id === row.id ? { ...it, completed: row.completed } : it
          ),
        }))
      );
    }
  }

  async function saveRpeNotes(row, rpe, notes) {
    const { error } = await supa.from("workouts").update({ rpe, notes }).eq("id", row.id);
    if (error) alert("Error: " + error.message);
  }

  function toggleAccordion(dayIndex) {
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  }

  React.useEffect(() => {
    fetchWeek();
    // listen for “workouts changed” events so this refreshes right after generate
    const onChanged = () => fetchWeek();
    window.addEventListener("workouts:changed", onChanged);
    return () => window.removeEventListener("workouts:changed", onChanged);
  }, [user?.id]);

  return (
    <Card
      title="This Week (cloud)"
      right={<button onClick={fetchWeek} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>}
    >
      {err && <div className="muted" style={{ color: "#fca5a5" }}>Error: {err}</div>}
      {!loading && (!groups || groups.length === 0) ? (
        <div className="muted">No workouts saved to cloud yet.</div>
      ) : null}

      <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        {groups.map((grp) => {
          const dayName = days[grp.day_index] ?? `Day ${grp.day_index}`;
          const isOpen = open.has(grp.day_index);
          return (
            <div key={grp.day_index} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", cursor: "pointer" }} onClick={() => toggleAccordion(grp.day_index)}>
                <div style={{ fontWeight: 700 }}>{dayName}</div>
                <div className="muted">{isOpen ? "Hide" : "Show"}</div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {grp.items.map((w) => (
                    <div key={w.id} className="card" style={{ padding: 12 }}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{w.title}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {w.phase ? `Phase: ${w.phase}` : null}
                            {w.focus ? ` • Focus: ${w.focus}` : null}
                          </div>
                        </div>
                        <label className="row" style={{ gap: 6 }}>
                          <input type="checkbox" checked={!!w.completed} onChange={() => toggleComplete(w)} />
                          <span className="muted">Completed</span>
                        </label>
                      </div>

                      {Array.isArray(w.blocks) && w.blocks.length > 0 ? (
                        <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                          {w.blocks.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="muted" style={{ marginTop: 6 }}>No blocks specified.</div>
                      )}

                      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                        <input
                          placeholder="RPE (1–10)"
                          defaultValue={w.rpe ?? ""}
                          onBlur={(e) => saveRpeNotes(w, e.target.value === "" ? null : Number(e.target.value), w.notes ?? null)}
                          style={{ width: 90 }}
                          type="number"
                          min={1}
                          max={10}
                        />
                        <input
                          placeholder="Notes"
                          defaultValue={w.notes ?? ""}
                          onBlur={(e) => saveRpeNotes(w, w.rpe ?? null, e.target.value)}
                          style={{ flex: 1, minWidth: 200 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Main App ---------- */
function startOfDayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function endOfDayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}
function dowIndex(d = new Date()) {
  // 0=Mon ... 6=Sun (to match our week/day convention used in workouts)
  const js = d.getDay(); // 0=Sun..6=Sat
  return js === 0 ? 6 : js - 1;
}

function TrainTodayCard({ user }) {
  const [{ url, key }] = React.useState(() => safeGetEnv());
  const supa = React.useMemo(() => (url && key ? createClient(url, key) : null), [url, key]);

  const [loading, setLoading] = React.useState(true);
  const [sessionId, setSessionId] = React.useState(null);
  const [title, setTitle] = React.useState("");
  const [blocks, setBlocks] = React.useState([]); // array of strings
  const [completed, setCompleted] = React.useState(false);
  const [readiness, setReadiness] = React.useState(3);
  const [notes, setNotes] = React.useState("");
  const [msg, setMsg] = React.useState("");

  // Load today's session if it exists
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!supa || !user?.id) { setMsg("Not signed in"); setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supa
        .from("sessions")
        .select("id, ts, session, completed, readiness, notes")
        .eq("user_id", user.id)
        .gte("ts", startOfDayISO())
        .lt("ts", endOfDayISO())
        .order("ts", { ascending: true })
        .limit(1);
      if (!alive) return;
      if (error) { setMsg(error.message); setLoading(false); return; }

      const row = (data && data[0]) || null;
      if (row) {
        setSessionId(row.id);
        const s = row.session || {};
        setTitle(s.title || "");
        setBlocks(Array.isArray(s.blocks) ? s.blocks : []);
        setCompleted(!!row.completed);
        setReadiness(row.readiness ?? 3);
        setNotes(row.notes || "");
      } else {
        // Nothing logged yet → try importing something helpful from workouts
        await tryImportFromWorkouts();
      }
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supa, user?.id]);

  async function tryImportFromWorkouts() {
    if (!supa || !user?.id) return;
    // strategy: pick a workout for today's DOW from the highest week_index the user has
    const di = dowIndex(new Date());
    const { data: lastWeek, error: weekErr } = await supa
      .from("workouts")
      .select("week_index")
      .eq("user_id", user.id)
      .order("week_index", { ascending: false })
      .limit(1);
    if (weekErr) { setMsg(weekErr.message); return; }
    const wk = lastWeek?.[0]?.week_index ?? null;
    if (!wk) return; // user might not have cloud plan yet

    const { data, error } = await supa
      .from("workouts")
      .select("title, blocks, focus, phase")
      .eq("user_id", user.id)
      .eq("week_index", wk)
      .eq("day_index", di)
      .limit(1);
    if (error) { setMsg(error.message); return; }
    const w = data?.[0];
    if (w) {
      setTitle(w.title || "");
      setBlocks(Array.isArray(w.blocks) ? w.blocks : []);
      setMsg(`Imported from week ${wk} • day ${di}`);
    }
  }

  function blocksTextarea(value) {
    // Convert between textarea (newline text) and string[]
    setBlocks(
      String(value)
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  async function save() {
    setMsg("");
    if (!supa || !user?.id) { setMsg("Supabase not configured"); return; }
    const payload = {
      user_id: user.id,
      ts: new Date().toISOString(),
      session: { title, blocks },
      completed,
      readiness,
      notes: notes || null,
    };
    let res;
    if (sessionId) {
      res = await supa.from("sessions").update(payload).eq("id", sessionId).select().single();
    } else {
      res = await supa.from("sessions").insert(payload).select().single();
      if (!res.error) setSessionId(res.data.id);
    }
    if (res.error) { setMsg(res.error.message); return; }
    setMsg("Saved.");
  }

  const estMins = React.useMemo(() => estimateMinutesFromBlocks(blocks), [blocks]);
  const todayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dowIndex(new Date())];

  return (
    <section className="border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Train Today</h2>
        <div className="text-xs text-slate-400">{msg}</div>
      </div>

      {loading ? (
        <p className="text-sm">Loading…</p>
      ) : (
        <>
          <div className="text-sm text-slate-300 mb-1">{todayName}</div>

          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-1">Title</label>
              <input
                className="border rounded px-2 py-1 w-full bg-slate-950"
                placeholder="e.g., Run Threshold 3x6"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs block mb-1">
                Blocks <span className="text-slate-400">(one per line) • ~{estMins}′</span>
              </label>
              <textarea
                className="border rounded px-2 py-1 w-full bg-slate-950 min-h-[96px]"
                placeholder={"Warm-up 10′\n3 x 6′ steady; 2′ easy\nCooldown 10′"}
                value={blocks.join("\n")}
                onChange={(e) => blocksTextarea(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
                Done
              </label>

              <div className="flex items-center gap-2">
                <span className="text-sm">Readiness</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={readiness}
                  onChange={(e) => setReadiness(Number(e.target.value))}
                />
                <span className="text-sm">{readiness}/5</span>
              </div>
            </div>

            <div>
              <label className="text-xs block mb-1">Notes</label>
              <textarea
                className="border rounded px-2 py-1 w-full bg-slate-950 min-h-[64px]"
                placeholder="How did it feel? Any issues?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500" onClick={save}>
                Save session
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600" onClick={tryImportFromWorkouts}>
                Try import from cloud plan
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
/* ---------- HISTORY PAGE (paste above `export default function ...`) ---------- */

function groupByWeek(rows) {
  const by = {};
  for (const r of rows) {
    const d = new Date(r.ts || r.created_at || Date.now());
    const key = weekKeyOf(d);
    if (!by[key]) by[key] = [];
    by[key].push(r);
  }
  return by;
}

function HistoryPage({ user }) {
  const [{ url, key }] = React.useState(() => safeGetEnv());
  const supa = React.useMemo(() => (url && key ? createClient(url, key) : null), [url, key]);
  const [loading, setLoading] = React.useState(true);
  const [sessions, setSessions] = React.useState([]);
  const [prs, setPrs] = React.useState([]);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!supa || !user?.id) { setErr("Not signed in"); setLoading(false); return; }

      // Pull last ~8 weeks of sessions
      const since = new Date();
      since.setDate(since.getDate() - 56);
      const [sRes, pRes] = await Promise.all([
        supa.from("sessions")
            .select("id, ts, session, completed, readiness")
            .eq("user_id", user.id)
            .gte("ts", since.toISOString())
            .order("ts", { ascending: false }),
        supa.from("prs")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(12),
      ]);

      if (!alive) return;
      if (sRes.error) setErr(sRes.error.message);
      if (pRes.error) setErr((e) => e || pRes.error.message);
      setSessions(sRes.data || []);
      setPrs(pRes.data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [supa, user?.id]);

  const byWeek = React.useMemo(() => groupByWeek(sessions), [sessions]);
  const weekKeys = React.useMemo(
    () => Object.keys(byWeek).sort((a, b) => (a < b ? 1 : -1)),
    [byWeek]
  );

  // Compute a minutes bar per week
  const weekStats = React.useMemo(() => {
    const arr = weekKeys.map((wk) => {
      const rows = byWeek[wk];
      const total = rows.length;
      const done = rows.filter((r) => r.completed).length;
      const comp = total ? Math.round((done / total) * 100) : 0;
      const mins = rows.reduce(
        (acc, r) => acc + estimateMinutesFromBlocks(r.session?.blocks || []),
        0
      );
      const avgReadiness = total
        ? Math.round(
            (rows.reduce((a, r) => a + (r.readiness || 0), 0) / total) * 10
          ) / 10
        : 0;
      return { wk, total, done, comp, mins, avgReadiness };
    });
    const maxMins = Math.max(60, ...arr.map((x) => x.mins));
    return { rows: arr, maxMins };
  }, [byWeek, weekKeys]);

  return (
    <section className="border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">History</h2>
        <div className="text-xs text-slate-400">{err}</div>
      </div>

      {loading ? (
        <p className="text-sm">Loading…</p>
      ) : (
        <>
          {/* Weekly bars */}
          <div className="space-y-2">
            {weekStats.rows.length === 0 && (
              <p className="text-sm">No sessions logged yet.</p>
            )}
            {weekStats.rows.map(({ wk, mins, done, total, comp, avgReadiness }) => (
              <div key={wk}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">Week of {wk}</span>
                  <span className="text-slate-400">
                    {done}/{total} • {comp}% • ~{mins}′ • readiness {avgReadiness}/5
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded">
                  <div
                    className="h-2 bg-sky-500 rounded"
                    style={{ width: `${Math.min(100, Math.round((mins / weekStats.maxMins) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Recent PRs */}
          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Recent PRs</div>
            {prs.length === 0 ? (
              <p className="text-sm">No PRs yet</p>
            ) : (
              <ul className="text-sm grid md:grid-cols-2 gap-2">
                {prs.map((pr) => (
                  <li key={pr.id} className="border border-slate-800 rounded px-2 py-1 flex items-center justify-between">
                    <span>{pr.exercise}</span>
                    <span className="font-mono">
                      {pr.is_time ? secondsToMMSS(pr.value_num) : pr.value}
                      {pr.unit ? ` ${pr.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default function App(){
  function SharePage() {
  const [{ url, key }] = React.useState(() => safeGetEnv());
  const token = React.useMemo(() => {
    if (typeof location === "undefined") return "";
    const m = location.pathname.match(/\/share\/([^/?#]+)/);
    return m ? m[1] : "";
  }, []);
  const sclient = React.useMemo(() => {
    if (!url || !key || !token) return null;
    return createClient(url, key, { global: { headers: { "x-invite-token": token } } });
  }, [url, key, token]);

  const [workouts, setWorkouts] = React.useState([]);
  const [prs, setPrs] = React.useState([]);
  const [cards, setCards] = React.useState([]);
  const [msg, setMsg] = React.useState("Loading…");

  React.useEffect(() => {
    let alive = true;
    async function load() {
      if (!sclient) { setMsg("Missing config"); return; }
      try {
        const [w, p, c] = await Promise.all([
          sclient.from("share_workouts").select("*"),
          sclient.from("share_prs").select("*"),
          sclient.from("share_weekly_cards").select("*"),
        ]);
        if (!alive) return;
        if (w.error || p.error || c.error) {
          setMsg((w.error?.message || p.error?.message || c.error?.message || "Load error"));
          return;
        }
        setWorkouts(w.data || []);
        setPrs(p.data || []);
        setCards(c.data || []);
        setMsg("");
      } catch (e) {
        if (!alive) return;
        setMsg(String(e.message || e));
      }
    }
    load();
    return () => { alive = false; };
  }, [sclient]);

  return (
    <div className="p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🏁 Shared Plan</h1>
        <div className="text-sm text-slate-400">{msg}</div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Week-by-Week Workouts</h2>
        {workouts.length === 0 ? <p className="text-sm">No workouts visible for this token.</p> : (
          <ul className="grid md:grid-cols-2 gap-2">
            {workouts.map((w, i) => (
              <li key={`${w.week_index}-${w.day_index}-${i}`} className="border border-slate-800 rounded-xl p-3">
                <div className="text-sm font-semibold">Week {w.week_index} • Day {w.day_index} {w.session_date ? `• ${w.session_date}` : ""}</div>
                <div className="text-sm mt-1">{w.title}</div>
                {Array.isArray(w.blocks) && w.blocks.length > 0 && (
                  <ul className="text-xs mt-2 list-disc pl-5 space-y-1">
                    {w.blocks.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
                <div className="text-xs text-slate-400 mt-1">{w.focus} • {w.phase}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Personal Records</h2>
        {prs.length === 0 ? <p className="text-sm">No PRs shared yet.</p> : (
          <ul className="text-sm grid md:grid-cols-2 gap-2">
            {prs.map((r, i) => (
              <li key={i} className="border border-slate-800 rounded px-2 py-1 flex items-center justify-between">
                <span>{r.exercise}</span>
                <span className="font-mono">
                  {r.is_time ? secondsToMMSS(r.value_num) : r.value}{r.unit ? ` ${r.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Weekly Summaries</h2>
        {cards.length === 0 ? <p className="text-sm">No summaries yet.</p> : (
          <ul className="grid md:grid-cols-2 gap-2">
            {cards.map((card, i) => (
              <li key={`${card.week}-${i}`} className="border p-3 rounded-xl">
                <div className="text-sm font-semibold">Week of {card.week}</div>
                <div className="text-sm text-slate-300 mt-1">{card.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

  const [snapshot,setSnapshot]=React.useState(null);
  React.useEffect(()=>{ try{ const url=new URL(window.location.href); const snap=url.searchParams.get("snapshot"); if(snap){ setSnapshot(JSON.parse(decodeURIComponent(btoa.atob?atob(snap):atob(snap)))); } }catch{} },[]);
  if(snapshot) return <div className="wrap"><h1>Shared plan</h1></div>;

  const [athlete,setAthlete]=React.useState(load("hyrox.athlete",{ name:"", division:"Open", goalType:"Race", raceDate:"" }));
  const [base,setBase]=React.useState(load("hyrox.base",{ run5k:"25:00", ski1k:"4:30", row1k:"4:00", sledPush50m:"3:00", sledPull50m:"2:50", burpeeBroad80m:"6:00", farmer200m:"3:00", lunges100m:"4:30", wallballs100:22, readiness:4 }));
  const [profile,setProfile]=React.useState(load("hyrox.profile",{ experience:"beginner", goal:"balanced" }));
  React.useEffect(()=>save("hyrox.athlete",athlete),[athlete]);
  React.useEffect(()=>save("hyrox.base",base),[base]);
  React.useEffect(()=>save("hyrox.profile",profile),[profile]);

  const analysis=React.useMemo(()=>estimateRaceFromBaseline(base),[base]);
  const plan=React.useMemo(()=>makeWeekPlan({ goalType:athlete.goalType, raceDate:athlete.raceDate, ...base }, analysis),[athlete,base,analysis]);

  const [user,setUser]=React.useState(null);
  React.useEffect(()=>{ if(!supa) return; let sub; (async()=>{ const {data}=await supa.auth.getSession(); setUser(data?.session?.user||null); const res=supa.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null)); sub=res.data?.subscription; })(); return()=>sub?.unsubscribe?.(); },[]);

  async function generateWeek1ToCloud(){
    if(!supa||!user) return alert("Sign in first.");
    if(!plan.length) return alert("No plan generated.");
    const rows = plan.map((d,i)=>({
      user_id:user.id, week_index:1, day_index:i, session_date:null,
      title:d.session.type, blocks:d.session.blocks||[], focus:d.session.focus||null,
      phase:d.phase, targets:null, completed:false
    }));
    const { error } = await supa.from("workouts").upsert(rows, { onConflict:"user_id,week_index,day_index" });
    if(error) return alert("Error: "+error.message);
    alert("Week 1 plan saved to cloud.");
  }
  const weekday=new Date().getDay(); const map=[6,0,1,2,3,4,5]; const idx=map[weekday]??0;
  const todays=plan[idx]||plan[0]||{ day:"Mon", session:{type:"Rest",blocks:["Walk 20′"]} };
  const [readiness,setReadiness]=React.useState(3);
  const paces=React.useMemo(()=>({ run5k:pacePerKmFrom5k(base.run5k||"25:00"), goalRun:analysis.splits.run8k/8, ski500:ergPace500From1k(base.ski1k||"4:30"), row500:ergPace500From1k(base.row1k||"4:00"), row2k500:ergPace500From1k(base.row1k||"4:00")+2 }),[base.run5k,base.ski1k,base.row1k,analysis.splits.run8k]);
  const adjusted=React.useMemo(()=>{ const s={...todays.session}; let blocks=s.blocks?[...s.blocks]:(s.notes?[s.notes]:[]); blocks=annotateBlocks(blocks,paces); const scale=(arr,mode)=>arr.map(line=>{ let out=line; if(mode==="easy"){ out=out.replace(/(\d+)×/g,(m,p1)=>`${Math.max(1,Math.round(Number(p1)*0.65))}×`).replace(/@ *[^;\n]+pace/g,"@ easy pace").replace(/rest *([0-9]+) *([′'smin]+)/gi,(m,n,u)=>`rest ${Math.round(Number(n)*1.3)}${String(u).toLowerCase().includes("min")?" min":"s"}`).replace(/EMOM *([0-9]+)[′']/i,(m,min)=>`EMOM ${Math.max(8,Math.round(Number(min)*0.85))}′`);} else if(mode==="hard"){ out=out.replace(/(\d+)×/g,(m,p1)=>`${Number(p1)+1}×`).replace(/@ *5k pace/g,"@ 5k pace − 5–8s/km").replace(/rest *([0-9]+) *([′'smin]+)/gi,(m,n,u)=>`rest ${Math.max(20,Math.round(Number(n)*0.85))}${String(u).toLowerCase().includes("min")?" min":"s"}`);} return out; }); if(readiness<=2){ s.type=`${s.type} (Easy)`; s.blocks=scale(blocks,"easy"); } else if(readiness>=4){ s.type=`${s.type} (Challenging)`; s.blocks=scale(blocks,"hard"); } else { s.blocks=scale(blocks,"normal"); } return s; },[todays,readiness,paces]);

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
          <div className="title"><div className="logo">🏆</div><div><div style={{fontWeight:700}}>HYROX AI Coach</div><div className="muted" style={{fontSize:12}}>v1.3 • Profile • Week plan to cloud • Check off</div></div></div>
        </div>
      </header>

      <main className="wrap">
        <h1>Dashboard</h1>
        <AuthBar/>

        <Card title="Athlete">
          <div className="row">
            <input placeholder="Name" value={athlete.name} onChange={e=>setAthlete({...athlete, name:e.target.value})}/>
            <select value={athlete.division} onChange={e=>setAthlete({...athlete, division:e.target.value})}><option>Open</option><option>Pro</option><option>Doubles</option><option>Relay</option></select>
            <select value={athlete.goalType} onChange={e=>setAthlete({...athlete, goalType:e.target.value})}><option value="Race">Race</option><option value="Health">Health</option></select>
            <input type="date" value={athlete.raceDate} onChange={e=>setAthlete({...athlete, raceDate:e.target.value})}/>
          </div>
        </Card>

        <ProfileCard user={user} profile={profile} setProfile={setProfile} />

        <Card title="Baseline (quick)" right={<div className="row"><button className="btn" onClick={generateWeek1ToCloud}>Generate Week 1 plan → Cloud</button><button onClick={makeShareLink}>Share plan</button></div>}>
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

        <Card title="Race Twin (prediction)">
          <div className="row" style={{gap:16,flexWrap:"wrap"}}>
            <div className="pill">Predicted: <b>{secondsToMMSS(analysis.total)}</b></div>
            <div className="muted">Limiters: {analysis.sortedLimiters.slice(0,4).map(x=>x.station).join(", ")}</div>
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

        <Card title={`Train Today`}>
          <div className="muted" style={{marginBottom:6}}>{(plan[idx]?.day)||"Mon"}</div>
          <div style={{fontWeight:700}}>{(plan[idx]?.session?.type)||"Rest"}</div>
          <ul style={{marginTop:6,paddingLeft:16}}>{(plan[idx]?.session?.blocks||["Walk 20′"]).map((b,i)=><li key={i}>{b}</li>)}</ul>
          <div className="row" style={{marginTop:8}}><span className="muted">Readiness</span><input type="range" min={1} max={5} value={readiness} onChange={e=>setReadiness(Number(e.target.value))}/></div>
        </Card>

        <ThisWeek user={user} />

        <Card title="Pro Features"><div className="muted">Coming soon: Race Sim+, export, multi-athlete with Stripe Checkout.</div></Card>
      </main>
    </>
  );
}
