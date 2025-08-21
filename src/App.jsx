import React from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client from Vercel env vars
const supa = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function AuthBar() {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supa.auth.getSession();
      setUser(data?.session?.user || null);
      const res = supa.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
      sub = res.data?.subscription;
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  async function sendLink() {
    setStatus("Sending…");
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    setStatus(error ? `Error: ${error.message}` : "Check your email for the link or code.");
  }
  async function verify() {
    setStatus("Verifying…");
    const { error } = await supa.auth.verifyOtp({ type: "email", email, token: code });
    setStatus(error ? `Error: ${error.message}` : "Signed in.");
  }
  async function signOut() { await supa.auth.signOut(); setUser(null); }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:600, marginBottom:6}}>Account</div>
          <div className="muted">{user ? `Signed in as ${user.email || user.id}` : "Not signed in"}</div>
        </div>
        <div className="row">
          {!user && (
            <>
              <input placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)} />
              <button className="btn" onClick={sendLink}>Send magic link</button>
              <input placeholder="123456" value={code} onChange={e=>setCode(e.target.value)} style={{width:100}} />
              <button onClick={verify}>Verify code</button>
            </>
          )}
          {user && <button onClick={signOut}>Sign out</button>}
        </div>
      </div>
      {status && <div className="muted" style={{marginTop:8}}>{status}</div>}
    </div>
  );
}

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

export default function App() {
  const [prForm, setPrForm] = React.useState({ exercise:"", value:"", unit:"" });
  const [prs, setPrs] = React.useState([]);
  const [weekKey, setWeekKey] = React.useState(() => {
    const d = new Date(); const day = d.getDay(); const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(d); monday.setDate(d.getDate()+diff); return monday.toISOString().slice(0,10);
  });
  const [weekly, setWeekly] = React.useState([]);
  const [raceDate, setRaceDate] = React.useState("");
  const [checklist, setChecklist] = React.useState({
    Shoes:false, Hydration:false, "Warm-up Plan":false, "Race Pacing Notes":false, "Transitions plan":false
  });
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supa.auth.getSession();
      setUser(data?.session?.user || null);
      const res = supa.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
      sub = res.data?.subscription;
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  async function savePR() {
    if (!user) return alert("Sign in first.");
    if (!prForm.exercise || !prForm.value) return alert("Fill exercise and time.");
    const row = { user_id: user.id, exercise: prForm.exercise, value: prForm.value, unit: prForm.unit || null, is_time: true };
    const { error } = await supa.from("prs").insert(row);
    if (error) return alert("Error: " + error.message);
    setPrs([row, ...prs]);
    setPrForm({ exercise:"", value:"", unit:"" });
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
    const items = Object.entries(checklist).map(([item,done]) => ({ user_id:user.id, race_date: raceDate || new Date().toISOString().slice(0,10), item, done }));
    // simple upsert: delete then insert
    await supa.from("checklists").delete().eq("user_id", user.id).eq("race_date", raceDate || new Date().toISOString().slice(0,10));
    const { error } = await supa.from("checklists").insert(items);
    if (error) return alert("Error: " + error.message);
    alert("Checklist saved.");
  }

  return (
    <>
      <header>
        <div className="inner">
          <div className="title">
            <div className="logo">🏆</div>
            <div>
              <div style={{fontWeight:700}}>HYROX AI Coach</div>
              <div className="muted" style={{fontSize:12}}>MVP • Cloud-ready</div>
            </div>
          </div>
          <div className="muted">v1.0</div>
        </div>
      </header>

      <main className="wrap">
        <h1>Dashboard</h1>

        <AuthBar />

        <div className="grid grid-3">
          <Card title="Personal Records" right={<span className="pill">Coach grade</span>}>
            <div className="muted" style={{marginBottom:8}}>Best by exercise</div>
            {prs.length === 0 && <div className="muted">No PRs yet</div>}
            {prs.length > 0 && (
              <ul style={{margin:0,paddingLeft:16}}>
                {prs.map((p, i) => <li key={i}>{p.exercise}: {p.value}{p.unit?` ${p.unit}`:""}</li>)}
              </ul>
            )}
            <hr/>
            <div className="row" style={{marginBottom:8}}>
              <input placeholder="Exercise (e.g., 5k run)" value={prForm.exercise} onChange={e=>setPrForm({...prForm, exercise:e.target.value})} />
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
              <input type="date" value={raceDate} onChange={e=>setRaceDate(e.target.value)} />
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

        <div className="grid" style={{marginTop:16}}>
          <Card title="Invite Friends (read-only plan)">
            <div className="muted" style={{marginBottom:8}}>Coming next: email-based invites that share a view-only link.</div>
            <div className="row">
              <input placeholder="friend@email.com" />
              <button disabled>Send Invite</button>
            </div>
          </Card>
          <Card title="Pro Features">
            <div className="muted">Coming soon: Race Sim+, export, multi-athlete with Stripe Checkout.</div>
            <div style={{marginTop:8}}><button disabled>Upgrade to Pro</button></div>
          </Card>
        </div>
      </main>
    </>
  );
}
