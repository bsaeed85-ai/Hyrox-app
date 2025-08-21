import React from "react";
import { createClient } from "@supabase/supabase-js";

/* ---------- Supabase (kept from your MVP) ---------- */
const supa = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try { if (!url || !key) return null; return createClient(url, key); } catch { return null; }
})();

/* ---------- Small utils ---------- */
const sec = (m, s = 0) => m * 60 + s;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function parseTimeToSeconds(str) {
  if (!str && str !== 0) return NaN;
  const parts = String(str).trim().split(":");
  if (parts.length === 1) { const m = Number(parts[0]); return isNaN(m) ? NaN : m * 60; }
  const m = Number(parts[0]); const s = Number(parts[1]);
  if ([m, s].some(Number.isNaN)) return NaN;
  return m * 60 + s;
}
function secondsToMMSS(total) {
  if (!isFinite(total)) return "--:--";
  const t = Math.round(total); const m = Math.floor(t / 60); const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function pacePerKmFrom5k(run5k) { const t = parseTimeToSeconds(run5k); return isFinite(t) ? t / 5 : 300; }
function ergPace500From1k(t1k) { const t = parseTimeToSeconds(t1k); return isFinite(t) ? t / 2 : 135; }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }

/* ---------- Race Twin (prediction from baseline) ---------- */
function estimateRaceFromBaseline(b) {
  const run5kSec = parseTimeToSeconds(b.run5k) || sec(25);
  const pacePerKm = run5kSec / 5;
  const runFatigueFactor = 1.08;
  const run8k = 8 * pacePerKm * runFatigueFactor;

  const estFromPace = (base, mult = 1) => clamp(base * mult, base * 0.7, base * 1.5);
  const ski = parseTimeToSeconds(b.ski1k) || estFromPace(4.5 * 60, pacePerKm / 300);
  const row = parseTimeToSeconds(b.row1k) || estFromPace(4 * 60, pacePerKm / 300);
  const sledPush = parseTimeToSeconds(b.sledPush50m) || estFromPace(180, 1.05);
  const sledPull = parseTimeToSeconds(b.sledPull50m) || estFromPace(170, 1.05);
  const burpees = parseTimeToSeconds(b.burpeeBroad80m) || estFromPace(360, 1.1);
  const farmer = parseTimeToSeconds(b.farmer200m) || estFromPace(160, 1.0);
  const lunges = parseTimeToSeconds(b.lunges100m) || estFromPace(240, 1.05);
  const wallballsRate = typeof b.wallballs100 === "number" && b.wallballs100 > 0 ? b.wallballs100 : 22;
  const wallballs = (100 / wallballsRate) * 60;

  const transPer = 12 + (6 - (b.readiness || 4)) * 1.5;
  const transitions = 8 * transPer;

  const splits = { run8k, ski, row, sledPush, sledPull, burpees, farmer, lunges, wallballs, transitions };
  const total = Object.values(splits).reduce((a, c) => a + c, 0);

  const ref = { ski: 270, sledPush: 200, sledPull: 190, burpees: 420, row: 250, farmer: 180, lunges: 260, wallballs: 270 };
  const deltas = {
    ski: splits.ski - ref.ski, sledPush: splits.sledPush - ref.sledPush, sledPull: splits.sledPull - ref.sledPull,
    burpees: splits.burpees - ref.burpees, row: splits.row - ref.row, farmer: splits.farmer - ref.farmer,
    lunges: splits.lunges - ref.lunges, wallballs: splits.wallballs - ref.wallballs,
  };
  const sortedLimiters = Object.entries(deltas).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({station:k, penalty:v}));

  return { total, splits, deltas, sortedLimiters };
}

/* ---------- Blocks & Week Plan ---------- */
function stationBlocks(name, variant = "std") {
  const blocks = {
    ski: ["Technique: catch-drive timing 10′","6×250m @ 2k pace; rest 60–75s","1,000m steady @ race RPE 7"],
    row: ["Technique: sequencing 8′","5×300m @ 2k pace; rest 60–75s","1,000m steady @ race RPE 7"],
    sledPush: ["Warm-up: empty sled 2×20m","4×20m @ moderate; rest 90s","3×20m @ heavy (race+); rest 2′"],
    sledPull: ["Warm-up: 2×20m light drag","5×20m @ moderate; rest 90s","3×20m @ heavy; rest 2′"],
    burpees: ["Drill: broad jump mechanics 6×3 reps; walk back","6×12 burpee broad jumps; rest 90s","80m continuous @ race effort"],
    farmer: ["Carry ladder: 3×(50m light + 30m moderate + 20m heavy); rest 2′","Core brace carries 3×40m suitcase each side"],
    lunges: ["Goblet lunge 3×12/leg; rest 90s","100m sandbag walking lunge broken as needed"],
    wallballs: ["Warm-up: 2×15 air squats + 10 light wall balls","EMOM 12′: 12 reps","2×50 reps for time; rest 3′"],
  };
  let arr = blocks[name] || ["Technique + intervals 30–40′"];
  if (variant === "deload") {
    arr = arr.map((l) =>
      l.replace(/(\d+)×/g, (m, n) => `${Math.max(1, Math.round(Number(n) * 0.7))}×`)
       .replace(/EMOM *(\d+)[′']/i, (m, n) => `EMOM ${Math.max(8, Math.round(Number(n) * 0.8))}′`)
    );
  }
  return arr;
}
function annotateBlocks(blocks, p) {
  const fkm = (s) => `${secondsToMMSS(Math.round(s))}/km`;
  const f500 = (s) => `${String(Math.floor(s / 60)).padStart(1,"0")}:${String(Math.round(s % 60)).padStart(2,"0")}/500m`;
  return (blocks||[]).map((line) => {
    let out = line;
    out = out.replace(/@ *5k pace(?![^(])/gi, `@ 5k pace (${fkm(p.run5k)})`);
    if (p.goalRun) out = out.replace(/@ *(goal|target) pace/gi, `@ target pace (${fkm(p.goalRun)})`);
    out = out.replace(/2k pace(?![^(])/gi, `2k pace (${f500(p.row2k500)})`);
    out = out.replace(/SkiErg *1000m|Ski *1000m/gi, (m) => `${m} (≈ ${String(secondsToMMSS(Math.round(p.ski500 * 2)))} total)`);
    out = out.replace(/Row *1000m/gi, (m) => `${m} (≈ ${String(secondsToMMSS(Math.round(p.row500 * 2)))} total)`);
    return out;
  });
}
function getPhase(weeksToRace) { if (weeksToRace == null) return "Health"; if (weeksToRace <= 1) return "Taper"; if (weeksToRace <= 4) return "Specific"; if (weeksToRace <= 9) return "Build"; return "Base"; }
function getWeeksToRace(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00"); const now = new Date();
  const ms = d.getTime() - now.getTime(); return Math.ceil(ms / (7 * 24 * 3600 * 1000));
}
function isDeloadWeek() {
  const now = new Date(); const start = new Date(now.getFullYear(),0,1);
  const diff = Math.floor((now - start) / (7*24*3600*1000)); return diff % 3 === 2;
}
function makeWeekPlan(athlete, analysis) {
  const wtr = getWeeksToRace(athlete.raceDate);
  const phase = athlete.goalType === "Health" || !athlete.raceDate ? "Health" : getPhase(wtr);
  const deload = phase !== "Taper" && isDeloadWeek();
  const top3 = analysis.sortedLimiters.slice(0,3).map(x=>x.station);
  const focus = (name) => ({ type: `Station Skill${deload ? " (Deload)" : ""}`, focus: name, blocks: stationBlocks(name, deload ? "deload" : "std") });

  const paces = {
    run5k: pacePerKmFrom5k(athlete.run5k || "25:00"),
    goalRun: analysis.splits.run8k / 8,
    ski500: ergPace500From1k(athlete.ski1k || "4:30"),
    row500: ergPace500From1k(athlete.row1k || "4:00"),
    row2k500: ergPace500From1k(athlete.row1k || "4:00") + 2,
  };
  const enrich = (session) => ({ ...session, blocks: annotateBlocks(session.blocks, paces) });

  const runSessions = {
    easyStrides: { type: "Run Easy + Strides", blocks: ["35–45′ Z2 run", "6×20s strides, walk back"] },
    threshold: { type: "Run Threshold", blocks: ["Warm-up 10′", "3×10′ @ 5k pace; 2′ easy", "Cooldown 10′"] },
    vo2: { type: "Run VO2", blocks: ["Warm-up 10′", "6×3′ hard; 2′ easy", "Cooldown 10′"] },
    racePace: { type: "Run Race-Pace", blocks: ["Warm-up 10′", "6×1 km @ target pace; 90″ easy", "Cooldown 10′"] },
    longEasy: { type: "Long Easy", blocks: ["50–70′ easy mixed modality"] },
  };
  const ergSessions = {
    skiPyramid: { type: "Ski Pyramids", blocks: ["Technique 8′", "250/500/250 @ 2k pace; 90″ easy"] },
    skiFastFinish: { type: "Ski Fast-Finish", blocks: ["600 steady + 400 fast ×3; 2′ easy"] },
    rowPyramid: { type: "Row Pyramids", blocks: ["Technique 8′", "250/500/250 @ 2k pace; 90″ easy"] },
    rowFastFinish: { type: "Row Fast-Finish", blocks: ["600 steady + 400 fast ×3; 2′ easy"] },
  };
  const strengthSessions = {
    strengthA: { type: "Strength A", blocks: ["Back squat 4×5 @ RPE 7; rest 2–3′", "RDL 3×8 @ RPE 7; rest 2′", "DB bench 4×6 @ RPE 7", "Core: 3×20s hollow + side plank"] },
    strengthHybrid: { type: "Strength Hybrid", blocks: ["Front squat 5×3 @ RPE 8; rest 2–3′", "Trap bar DL 4×5 @ RPE 7; rest 2′", "Push press 5×3 @ RPE 8; rest 2′", "Finisher: 10′ easy row"] },
    strengthPower: { type: "Strength Power", blocks: ["Jump squat 5×3 (light, fast)", "Clean pull 4×3 (moderate)", "Push press 4×3"] },
  };
  const bricks = {
    A: { type: "Brick A", blocks: ["3× [1 km @ target pace + sled push 20 m + sled pull 20 m]; 3′"] },
    B: { type: "Brick B", blocks: ["2× [1 km @ target pace + 40 m burpee broad + 50 wall balls as 30/20]; 4′"] },
    C: { type: "Race Sim Lite", blocks: ["4× [1 km + 2 stations from limiter list]; 3′"] },
    Primer: { type: "Race Primer", blocks: ["2× [800 m @ target pace + sled push 15 m + sled pull 15 m]; full rest"] },
  };

  if (phase === "Health") {
    const plan = [enrich(runSessions.easyStrides),focus(top3[0]||"sledPush"),strengthSessions.strengthA,enrich(ergSessions.rowPyramid),focus(top3[1]||"burpees"),runSessions.longEasy,{ type:"Recovery", blocks:["Walk 20–30′","Mobility 20′"] }];
    return plan.map((s,i)=>({ day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], session:s, phase }));
  }
  if (phase === "Base") {
    const plan = [enrich(runSessions.threshold),focus(top3[0]||"sledPush"),strengthSessions.strengthA,enrich(runSessions.easyStrides),focus(top3[1]||"burpees"),bricks.A,{ type:"Recovery", blocks:["Mobility 30–40′","Easy walk 30′"] }];
    return plan.map((s,i)=>({ day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], session:s, phase }));
  }
  if (phase === "Build") {
    const plan = [enrich(runSessions.vo2),focus(top3[0]||"sledPush"),strengthSessions.strengthHybrid,focus(top3[1]||"wallballs"),enrich(ergSessions.skiFastFinish),bricks.B,runSessions.longEasy];
    return plan.map((s,i)=>({ day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], session:s, phase }));
  }
  if (phase === "Specific") {
    const plan = [enrich(runSessions.racePace),focus(top3[0]||"sledPush"),strengthSessions.strengthPower,focus(top3[1]||"sledPull"),enrich(ergSessions.rowFastFinish),bricks.C,{ type:"Recovery", blocks:["Mobility 30–40′","Easy walk 30′"] }];
    return plan.map((s,i)=>({ day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], session:s, phase }));
  }
  if (phase === "Taper") {
    const plan = [enrich(runSessions.easyStrides),bricks.Primer,{ type:"Recovery", blocks:["30–35′ recovery + mobility"] },{ type:"Tune-up", blocks:["20′ easy + 4×10″ pickups"] },{ type:"Activation", blocks:["10′ easy + 10 wall balls + 10 burpees"] },{ type:"Off / Travel", blocks:["Gentle walk, hydration focus"] },{ type:"Recovery", blocks:["Mobility 20′"] }];
    return plan.map((s,i)=>({ day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], session:s, phase }));
  }
  return [];
}

/* ---------- Reusable UI bits ---------- */
function Card({ title, children, right }) {
  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between", marginBottom:8}}>
        <h2 style={{margin:0}}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function RowInput({ placeholder, value, onChange, style }) {
  return <input placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)} style={style} />;
}

/* ---------- Auth bar (unchanged) ---------- */
function AuthBar() {
  if (!supa) return <div className="card"><div className="muted">Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Environment Variables, then redeploy.</div></div>;
  const [email, setEmail] = React.useState(""); const [code, setCode] = React.useState(""); const [status, setStatus] = React.useState("");
  const [user, setUser] = React.useState(null);
  React.useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supa.auth.getSession(); setUser(data?.session?.user || null);
      const res = supa.auth.onAuthStateChange((_e, session) => setUser(session?.user || null)); sub = res.data?.subscription;
    })(); return () => sub?.unsubscribe?.();
  }, []);
  async function sendLink() {
    setStatus("Sending…");
    const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
    setStatus(error ? `Error: ${error.message}` : "Check your email for the link or 6-digit code.");
  }
  async function verify() { setStatus("Verifying…"); const { error } = await supa.auth.verifyOtp({ type: "email", email, token: code }); setStatus(error ? `Error: ${error.message}` : "Signed in."); }
  async function signOut() { await supa.auth.signOut(); setUser(null); }
  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div><div style={{fontWeight:600, marginBottom:6}}>Account</div><div className="muted">{user ? `Signed in as ${user.email || user.id}` : "Not signed in"}</div></div>
        <div className="row">
          {!user && (<><input placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)} /><button className="btn" onClick={sendLink}>Send magic link</button><input placeholder="123456" value={code} onChange={e=>setCode(e.target.value)} style={{width:100}} /><button onClick={verify}>Verify code</button></>)}
          {user && <button onClick={signOut}>Sign out</button>}
        </div>
      </div>
      {status && <div className="muted" style={{marginTop:8}}>{status}</div>}
    </div>
  );
}

/* ---------- Main App ---------- */
export default function App() {
  /* keep existing MVP bits */
  const [prForm, setPrForm] = React.useState({ exercise:"", value:"", unit:"" });
  const [prs, setPrs] = React.useState([]);
  const [weekKey, setWeekKey] = React.useState(() => { const d=new Date(); const day=d.getDay(); const diff=(day===0?-6:1-day); const monday=new Date(d); monday.setDate(d.getDate()+diff); return monday.toISOString().slice(0,10); });
  const [weekly, setWeekly] = React.useState([]);
  const [raceDateChecklist, setRaceDateChecklist] = React.useState("");
  const [checklist, setChecklist] = React.useState({ Shoes:false, Hydration:false, "Warm-up Plan":false, "Race Pacing Notes":false, "Transitions plan":false });
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { if (!supa) return; let sub; (async () => { const { data } = await supa.auth.getSession(); setUser(data?.session?.user || null); const res = supa.auth.onAuthStateChange((_e, session) => setUser(session?.user || null)); sub = res.data?.subscription; })(); return () => sub?.unsubscribe?.(); }, []);

  async function savePR() {
    if (!user) return alert("Sign in first.");
    if (!prForm.exercise || !prForm.value) return alert("Fill exercise and time.");
    const row = { user_id: user.id, exercise: prForm.exercise, value: prForm.value, unit: prForm.unit || null, is_time: true };
    const { error } = await supa.from("prs").insert(row);
    if (error) return alert("Error: " + error.message);
    setPrs([row, ...prs]); setPrForm({ exercise:"", value:"", unit:"" });
  }
  async function genThisWeek() {
    if (!user) return alert("Sign in first.");
    const summary = `Week of ${weekKey}: 3 sessions • ~180 min • Avg RPE 6.`;
    const row = { user_id: user.id, week: weekKey, summary };
    const { error } = await supa.from("weekly_cards").upsert(row);
    if (error) return alert("Error: " + error.message);
    setWeekly([row, ...weekly.filter(w => w.week !== weekKey)]);
  }
  async function saveChecklist() {
    if (!user) return alert("Sign in first.");
    const date = raceDateChecklist || new Date().toISOString().slice(0,10);
    await supa.from("checklists").delete().eq("user_id", user.id).eq("race_date", date);
    const rows = Object.entries(checklist).map(([item,done]) => ({ user_id:user.id, race_date:date, item, done }));
    const { error } = await supa.from("checklists").insert(rows);
    if (error) return alert("Error: " + error.message);
    alert("Checklist saved.");
  }

  /* ---------- NEW: Baseline + Race Twin + Plan + Train Today ---------- */
  const [athlete, setAthlete] = React.useState(load("hyrox.athlete", { name:"", division:"Open", goalType:"Race", raceDate:"" }));
  const [base, setBase] = React.useState(load("hyrox.base", { run5k:"25:00", ski1k:"4:30", row1k:"4:00", sledPush50m:"3:00", sledPull50m:"2:50", burpeeBroad80m:"6:00", farmer200m:"3:00", lunges100m:"4:30", wallballs100:22, readiness:4 }));
  React.useEffect(()=>save("hyrox.athlete",athlete),[athlete]);
  React.useEffect(()=>save("hyrox.base",base),[base]);

  const analysis = React.useMemo(()=>estimateRaceFromBaseline(base),[base]);
  const plan = React.useMemo(()=>makeWeekPlan({ goalType: athlete.goalType, raceDate: athlete.raceDate, ...base }, analysis),[athlete, base, analysis]);

  // Train Today (readiness-aware)
  const weekday = new Date().getDay(); const map = [6,0,1,2,3,4,5]; const idx = map[weekday] ?? 0;
  const todays = plan[idx] || plan[0] || { day:"Mon", session:{ type:"Rest", blocks:["Walk 20′"] } };
  const [readiness, setReadiness] = React.useState(3);
  const paces = React.useMemo(()=>({ run5k: pacePerKmFrom5k(base.run5k||"25:00"), goalRun: analysis.splits.run8k/8, ski500: ergPace500From1k(base.ski1k||"4:30"), row500: ergPace500From1k(base.row1k||"4:00"), row2k500: ergPace500From1k(base.row1k||"4:00")+2 }),[base.run5k, base.ski1k, base.row1k, analysis.splits.run8k]);

  const adjusted = React.useMemo(()=>{
    const s = { ...todays.session }; let blocks = s.blocks ? [...s.blocks] : s.notes ? [s.notes] : [];
    blocks = annotateBlocks(blocks, paces);
    const scale = (arr, mode) => arr.map((line)=>{
      let out = line;
      if (mode==="easy") { out = out.replace(/(\d+)×/g,(m,p1)=>`${Math.max(1,Math.round(Number(p1)*0.65))}×`).replace(/@ *[^;\n]+pace/g,"@ easy pace").replace(/rest *([0-9]+) *([′'smin]+)/gi,(m,n,u)=>`rest ${Math.round(Number(n)*1.3)}${String(u).toLowerCase().includes("min")?" min":"s"}`).replace(/EMOM *([0-9]+)[′']/i,(m,min)=>`EMOM ${Math.max(8,Math.round(Number(min)*0.85))}′`); }
      else if (mode==="hard") { out = out.replace(/(\d+)×/g,(m,p1)=>`${Number(p1)+1}×`).replace(/@ *5k pace/g,"@ 5k pace − 5–8s/km").replace(/rest *([0-9]+) *([′'smin]+)/gi,(m,n,u)=>`rest ${Math.max(20,Math.round(Number(n)*0.85))}${String(u).toLowerCase().includes("min")?" min":"s"}`); }
      return out;
    });
    if (readiness<=2) { s.type = `${s.type} (Easy)`; s.blocks = scale(blocks,"easy"); }
    else if (readiness>=4) { s.type = `${s.type} (Challenging)`; s.blocks = scale(blocks,"hard"); }
    else { s.blocks = scale(blocks,"normal"); }
    return s;
  },[todays, readiness, paces]);

  /* ---------- UI ---------- */
  return (
    <>
      <header>
        <div className="inner">
          <div className="title">
            <div className="logo">🏆</div>
            <div><div style={{fontWeight:700}}>HYROX AI Coach</div><div className="muted" style={{fontSize:12}}>MVP • Cloud-ready</div></div>
          </div>
          <div className="muted">v1.1</div>
        </div>
      </header>

      <main className="wrap">
        <h1>Dashboard</h1>

        <AuthBar />

        {/* Baseline inputs */}
        <Card title="Baseline (quick)">
          <div className="row" style={{marginBottom:8}}>
            <RowInput placeholder="5k run (mm:ss)" value={base.run5k} onChange={(v)=>setBase({...base, run5k:v})} />
            <RowInput placeholder="SkiErg 1k (mm:ss)" value={base.ski1k} onChange={(v)=>setBase({...base, ski1k:v})} />
            <RowInput placeholder="Row 1k (mm:ss)" value={base.row1k} onChange={(v)=>setBase({...base, row1k:v})} />
            <RowInput placeholder="Sled push 50m (mm:ss)" value={base.sledPush50m} onChange={(v)=>setBase({...base, sledPush50m:v})} />
            <RowInput placeholder="Sled pull 50m (mm:ss)" value={base.sledPull50m} onChange={(v)=>setBase({...base, sledPull50m:v})} />
            <RowInput placeholder="Burpee broad 80m (mm:ss)" value={base.burpeeBroad80m} onChange={(v)=>setBase({...base, burpeeBroad80m:v})} />
            <RowInput placeholder="Farmers 200m (mm:ss)" value={base.farmer200m} onChange={(v)=>setBase({...base, farmer200m:v})} />
            <RowInput placeholder="Lunges 100m (mm:ss)" value={base.lunges100m} onChange={(v)=>setBase({...base, lunges100m:v})} />
            <input type="number" placeholder="Wall-balls rate (reps/min)" value={base.wallballs100} onChange={(e)=>setBase({...base, wallballs100:Number(e.target.value)})} />
            <div className="row" style={{alignItems:"center"}}><span className="muted">Readiness today</span><input type="range" min={1} max={5} value={base.readiness} onChange={(e)=>setBase({...base, readiness:Number(e.target.value)})} /></div>
          </div>
        </Card>

        {/* Race Twin */}
        <Card title="Race Twin (prediction)">
          <div className="row" style={{gap:16, flexWrap:"wrap"}}>
            <div className="pill">Predicted finish: <b>{secondsToMMSS(analysis.total)}</b></div>
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

        {/* Week plan */}
        <Card title={`Your next 7 days — ${plan[0]?.phase || "Health"}${isDeloadWeek() && (plan[0]?.phase!=="Taper") ? " (Deload)" : ""}`}>
          <div className="grid grid-3">
            {plan.map((d)=>(
              <div key={d.day} className="card" style={{padding:12}}>
                <div className="muted" style={{fontSize:12}}>{d.day}</div>
                <div style={{fontWeight:700, marginBottom:6}}>{d.session.type}</div>
                {d.session.blocks ? (
                  <ul style={{margin:0, paddingLeft:16}}>
                    {d.session.blocks.map((b,i)=><li key={i}>{b}</li>)}
                  </ul>
                ) : (<div className="muted">{d.session.notes}</div>)}
              </div>
            ))}
          </div>
        </Card>

        {/* Train Today */}
        <Card title="Train Today" right={<div className="row"><span className="muted">Readiness</span><input type="range" min={1} max={5} value={readiness} onChange={(e)=>setReadiness(Number(e.target.value))} /></div>}>
          <div className="muted" style={{marginBottom:6}}>{todays.day}</div>
          <div style={{fontWeight:700}}>{adjusted.type}</div>
          <ul style={{marginTop:6, paddingLeft:16}}>
            {adjusted.blocks?.map((b,i)=><li key={i}>{b}</li>)}
          </ul>
          <div className="muted" style={{marginTop:8, fontSize:12}}>
            {readiness<=2 ? "Low readiness: fewer sets, easier pace, longer rests." : readiness>=4 ? "High readiness: +1 set, slightly faster paces, shorter rests." : "Normal readiness: planned prescription."}
          </div>
        </Card>

        {/* Existing MVP cards kept (PRs, Weekly, Checklist) */}
        <div className="grid grid-3">
          <Card title="Personal Records" right={<span className="pill">Coach grade</span>}>
            <div className="muted" style={{marginBottom:8}}>Best by exercise</div>
            {prs.length === 0 && <div className="muted">No PRs yet</div>}
            {prs.length > 0 && (<ul style={{margin:0,paddingLeft:16}}>{prs.map((p,i)=><li key={i}>{p.exercise}: {p.value}{p.unit?` ${p.unit}`:""}</li>)}</ul>)}
            <hr/>
            <div className="row" style={{marginBottom:8}}>
              <input placeholder="Exercise (e.g., 5K)" value={prForm.exercise} onChange={e=>setPrForm({...prForm, exercise:e.target.value})} />
              <input placeholder="Time (mm:ss)" value={prForm.value} onChange={e=>setPrForm({...prForm, value:e.target.value})} />
              <input placeholder="Unit (optional)" value={prForm.unit} onChange={e=>setPrForm({...prForm, unit:e.target.value})} />
              <button className="btn" onClick={savePR}>Save PR</button>
            </div>
          </Card>

          <Card title="Weekly Progress" right={<button className="btn" onClick={genThisWeek}>Generate this week</button>}>
            <div className="muted">Week starts Monday • key {weekKey}</div>
            <ul style={{marginTop:8,paddingLeft:16}}>
              {weekly.length === 0 && <li className="muted">No weekly cards yet</li>}
              {weekly.map((w,i)=>(<li key={i}>{w.summary}</li>))}
            </ul>
          </Card>

          <Card title="Race Day Checklist">
            <div className="row" style={{marginBottom:8}}>
              <input type="date" value={raceDateChecklist} onChange={e=>setRaceDateChecklist(e.target.value)} />
              <button onClick={saveChecklist}>Save</button>
            </div>
            <ul style={{listStyle:"none",paddingLeft:0,margin:0}}>
              {Object.keys(checklist).map((k)=>(
                <li key={k} className="row">
                  <input type="checkbox" checked={!!checklist[k]} onChange={e=>setChecklist({...checklist,[k]:e.target.checked})}/>
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </main>
    </>
  );
}
