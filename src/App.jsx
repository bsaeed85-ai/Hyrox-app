import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function Button({ children, onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500">
      {children}
    </button>
  );
}

function safeGetLocalCloud() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem("hyrox.cloud");
      return raw ? JSON.parse(raw) : {};
    }
  } catch {}
  return {};
}

function safeGetEnv() {
  let url = "";
  let key = "";
  const saved = safeGetLocalCloud();
  if (saved && saved.url) url = saved.url;
  if (saved && saved.key) key = saved.key;
  try { if (!url && typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) url = import.meta.env.VITE_SUPABASE_URL; } catch {}
  try { if (!key && typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) key = import.meta.env.VITE_SUPABASE_ANON_KEY; } catch {}
  try { if (!url && typeof globalThis !== "undefined" && globalThis.SUPABASE_URL) url = globalThis.SUPABASE_URL; } catch {}
  try { if (!key && typeof globalThis !== "undefined" && globalThis.SUPABASE_ANON_KEY) key = globalThis.SUPABASE_ANON_KEY; } catch {}
  return { url, key };
}

function parseTimeToSeconds(str) {
  if (!str && str !== 0) return NaN;
  const s = String(str).trim();
  if (/^\d+$/.test(s)) return Number(s) * 60;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  if (ss > 59) return NaN;
  return mm * 60 + ss;
}
function secondsToMMSS(total) {
  if (!isFinite(total)) return "--:--";
  const t = Math.round(total);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function weekKeyOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dy = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dy}`;
}

function rndToken() {
  try { if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, ""); } catch {}
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function estimateMinutesFromBlocks(blocks) {
  const txt = (blocks || []).join("\n");
  let total = 0;
  const multi = [...txt.matchAll(/(\d+)×\s*(\d+)\s*[′']/g)];
  multi.forEach((m) => { total += Number(m[1]) * Number(m[2]); });
  const singles = [...txt.matchAll(/(?<!×)\b(\d+)\s*[′']/g)];
  singles.forEach((m) => { total += Number(m[1]); });
  if (total === 0) total = 45;
  return total;
}

export default function Dashboard({ user }) {
  const [{ url, key }, setEnv] = useState(() => safeGetEnv());
  const supabase = useMemo(() => (url && key ? createClient(url, key) : null), [url, key]);

  const [prs, setPrs] = useState([]);
  const [weeklyCards, setWeeklyCards] = useState([]);
  const [raceDate, setRaceDate] = useState("");
  const [checklist, setChecklist] = useState([
    { item: "Shoes", done: false },
    { item: "Hydration", done: false },
    { item: "Warm-up Plan", done: false },
    { item: "Race Pacing Notes", done: false },
    { item: "Transitions plan", done: false },
  ]);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [newExercise, setNewExercise] = useState("");
  const [newType, setNewType] = useState("time");
  const [newValue, setNewValue] = useState("");
  const [newUnit, setNewUnit] = useState("");

  useEffect(() => {
    const id = setInterval(() => setEnv(safeGetEnv()), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      try {
        if (!user?.id) { setMsg("No user."); return; }
        if (!supabase) { setMsg("Supabase not configured."); return; }
        const [prsRes, cardsRes, invRes] = await Promise.all([
          supabase.from("prs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("weekly_cards").select("*").eq("user_id", user.id).order("week", { ascending: false }),
          supabase.from("invites").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        ]);
        if (!prsRes.error && mounted) setPrs(prsRes.data || []);
        if (!cardsRes.error && mounted) setWeeklyCards(cardsRes.data || []);
        if (!invRes.error && mounted) setInvites(invRes.data || []);
        if (prsRes.error || cardsRes.error || invRes.error) setMsg("Load error.");
      } catch (e) {
        setMsg(`Load error: ${String(e.message || e)}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAll();
    return () => { mounted = false; };
  }, [user?.id, supabase]);

  useEffect(() => { if (!raceDate) return; (async () => {
    if (!supabase || !user?.id) return;
    const { data, error } = await supabase.from("checklists").select("item,done").eq("user_id", user.id).eq("race_date", raceDate).order("item");
    if (!error && data && data.length) setChecklist(data);
  })(); }, [raceDate, user?.id, supabase]);

  function bestByExercise(list) {
    const byX = {};
    list.forEach((r) => {
      const k = r.exercise;
      const cur = byX[k];
      if (!cur) byX[k] = r;
      else {
        if (r.is_time) {
          if (Number(r.value_num) < Number(cur.value_num)) byX[k] = r;
        } else {
          if (Number(r.value_num) > Number(cur.value_num)) byX[k] = r;
        }
      }
    });
    return byX;
  }

  const best = useMemo(() => bestByExercise(prs), [prs]);

  async function addPR({ exercise, type, value, unit }) {
    setMsg("");
    if (!supabase || !user?.id) { setMsg("Supabase not configured."); return; }
    const is_time = type === "time";
    const value_num = is_time ? parseTimeToSeconds(value) : Number(value);
    if (!exercise || !isFinite(value_num)) { setMsg("Enter a valid exercise and value."); return; }
    let wasPR = false;
    const currentBest = best[exercise];
    if (!currentBest) wasPR = true;
    else {
      wasPR = is_time ? value_num < Number(currentBest.value_num) : value_num > Number(currentBest.value_num);
    }
    const insert = { user_id: user.id, exercise, value, value_num, unit: unit || (is_time ? "mm:ss" : ""), is_time };
    const { data, error } = await supabase.from("prs").insert(insert).select().single();
    if (error) { setMsg(`PR save failed: ${error.message}`); return; }
    setPrs([data, ...prs]);
    setMsg(wasPR ? "New PR saved!" : "Saved as record.");
  }

  async function generateWeeklyCard() {
    setMsg("");
    if (!supabase || !user?.id) { setMsg("Supabase not configured."); return; }
    const wk = weekKeyOf();
    const start = new Date(wk + "T00:00:00");
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const { data, error } = await supabase
      .from("sessions")
      .select("ts, completed, readiness, session")
      .eq("user_id", user.id)
      .gte("ts", start.toISOString())
      .lt("ts", end.toISOString())
      .order("ts", { ascending: true });
    if (error) { setMsg(`Weekly generation failed: ${error.message}`); return; }
    const sessions = data || [];
    const done = sessions.filter((s) => s.completed).length;
    const total = sessions.length;
    const comp = total ? Math.round((done / total) * 100) : 0;
    const avgReadiness = total ? Math.round((sessions.reduce((a, c) => a + (c.readiness || 0), 0) / total) * 10) / 10 : 0;
    const estMinutes = sessions.reduce((a, c) => a + estimateMinutesFromBlocks(c.session?.blocks || []), 0);
    const summary = total ? `${done}/${total} sessions • ${comp}% complete • avg readiness ${avgReadiness}/5 • ~${estMinutes}′ trained.` : "No sessions logged this week.";
    const row = { user_id: user.id, week: wk, summary };
    const { data: ins, error: insErr } = await supabase.from("weekly_cards").upsert(row, { onConflict: "user_id,week" }).select().single();
    if (insErr) { setMsg(`Save failed: ${insErr.message}`); return; }
    const existingIdx = weeklyCards.findIndex((c) => c.week === wk);
    if (existingIdx >= 0) {
      const next = [...weeklyCards]; next[existingIdx] = ins; setWeeklyCards(next);
    } else {
      setWeeklyCards([ins, ...weeklyCards]);
    }
    setMsg("Weekly card generated.");
  }

  async function toggleChecklistIndex(index) {
    const updated = [...checklist];
    updated[index].done = !updated[index].done;
    setChecklist(updated);
    if (!supabase || !user?.id || !raceDate) return;
    const row = { user_id: user.id, race_date: raceDate, item: updated[index].item, done: updated[index].done };
    await supabase.from("checklists").upsert(row, { onConflict: "user_id,race_date,item" });
  }

  async function sendInvite() {
    setMsg("");
    if (!supabase || !user?.id) { setMsg("Supabase not configured."); return; }
    const email = inviteEmail.trim();
    if (!email) { setMsg("Enter an email."); return; }
    const token = rndToken();
    const { data, error } = await supabase.from("invites").insert({ user_id: user.id, email, status: "pending", token }).select();
    if (error) { setMsg(`Invite failed: ${error.message}`); return; }
    const row = data?.[0];
    setInvites([row, ...invites]);
    setInviteEmail("");
    setMsg("Invite sent.");
  }

  function shareLinkFor(inv) {
    const origin = (typeof location !== "undefined" && location.origin) ? location.origin : "";
    return `${origin}/share/${inv.token || ""}`;
  }

  async function saveChecklistPreset() {
    if (!raceDate) { setMsg("Pick a race date first."); return; }
    if (!supabase || !user?.id) { setMsg("Supabase not configured."); return; }
    const rows = checklist.map((c) => ({ user_id: user.id, race_date: raceDate, item: c.item, done: c.done }));
    const { error } = await supabase.from("checklists").upsert(rows, { onConflict: "user_id,race_date,item" });
    if (error) setMsg(`Checklist save failed: ${error.message}`); else setMsg("Checklist saved.");
  }

  async function upgradePro() {
    setMsg("Payments coming soon. We’ll wire Stripe Checkout to unlock Pro.");
  }

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🏋️‍♂️ Dashboard</h1>
        <div className="text-sm text-slate-400">{msg}</div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Personal Records</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-slate-800 rounded-xl p-3">
            <div className="text-sm font-medium mb-2">Best by exercise</div>
            {Object.keys(best).length === 0 ? <p className="text-sm">No PRs yet</p> : (
              <ul className="text-sm space-y-1">
                {Object.entries(best).map(([ex, r]) => (
                  <li key={ex} className="flex items-center justify-between">
                    <span>{ex}</span>
                    <span className="font-mono">{r.is_time ? secondsToMMSS(r.value_num) : r.value}{r.unit ? ` ${r.unit}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border border-slate-800 rounded-xl p-3">
            <div className="text-sm font-medium mb-2">Add new PR</div>
            <PRForm onSave={(payload) => addPR(payload)} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-sm font-medium mb-1">All PR entries</div>
          {prs.length === 0 ? <p className="text-sm">No entries</p> : (
            <ul className="text-sm grid md:grid-cols-2 gap-2">
              {prs.map((pr) => (
                <li key={pr.id} className="border border-slate-800 rounded px-2 py-1 flex items-center justify-between">
                  <span>{pr.exercise}</span>
                  <span className="font-mono">{pr.is_time ? secondsToMMSS(pr.value_num) : pr.value}{pr.unit ? ` ${pr.unit}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Weekly Progress</h2>
        <div className="flex items-center gap-2 mb-2">
          <Button onClick={generateWeeklyCard}>Generate this week</Button>
          <div className="text-xs text-slate-400">Week starts Monday • key {weekKeyOf()}</div>
        </div>
        {weeklyCards.length === 0 ? <p className="text-sm">No weekly cards yet</p> : (
          <ul className="grid md:grid-cols-2 gap-2">
            {weeklyCards.map((card) => (
              <li key={`${card.week}`} className="border p-3 rounded-xl">
                <div className="text-sm font-semibold">Week of {card.week}</div>
                <div className="text-sm text-slate-300 mt-1">{card.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Race Day Checklist</h2>
        <div className="flex items-center gap-2 mb-2">
          <input type="date" className="border rounded px-2 py-1 bg-slate-950" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
          <Button onClick={saveChecklistPreset}>Save</Button>
        </div>
        <ul className="space-y-1">
          {checklist.map((c, idx) => (
            <li key={c.item} className="flex items-center gap-2">
              <input type="checkbox" checked={!!c.done} onChange={() => toggleChecklistIndex(idx)} />
              <span>{c.item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Invite Friends (read‑only plan)</h2>
        <div className="flex items-center gap-2 mb-2">
          <InviteForm email={inviteEmail} onEmail={setInviteEmail} onSend={sendInvite} />
        </div>
        {invites.length === 0 ? <p className="text-sm">No invites yet</p> : (
          <ul className="text-sm space-y-1">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between">
                <span>{inv.email} — {inv.status}</span>
                <a className="text-sky-400 underline" href={shareLinkFor(inv)} target="_blank" rel="noreferrer">View link</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Pro Features</h2>
        <p className="text-sm text-slate-300 mb-2">Coming soon: Unlock Race Sim+, export, and multi‑athlete with Stripe Checkout.</p>
        <Button onClick={upgradePro}>Upgrade to Pro</Button>
      </section>
    </div>
  );
}

function PRForm({ onSave }) {
  const [exercise, setExercise] = useState("");
  const [type, setType] = useState("time");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input className="border rounded px-2 py-1 bg-slate-950" placeholder="Exercise (e.g., 5k run)" value={exercise} onChange={(e) => setExercise(e.target.value)} />
        <select className="border rounded px-2 py-1 bg-slate-950" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="time">Time (mm:ss)</option>
          <option value="number">Number</option>
        </select>
        <input className="border rounded px-2 py-1 bg-slate-950" placeholder={type === "time" ? "mm:ss" : "Value"} value={value} onChange={(e) => setValue(e.target.value)} />
        <input className="border rounded px-2 py-1 bg-slate-950" placeholder="Unit (optional)" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <Button onClick={() => onSave({ exercise: exercise.trim(), type, value: value.trim(), unit: unit.trim() })}>Save PR</Button>
    </div>
  );
}

function InviteForm({ email, onEmail, onSend }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <input type="email" className="border rounded px-2 py-1 bg-slate-950" placeholder="friend@email.com" value={email} onChange={(e) => onEmail(e.target.value)} />
      <Button onClick={onSend}>Send Invite</Button>
    </div>
  );
}

// --- TEST CASES ---
// 1. New user with no PRs or cards → shows empty state messages.
// 2. Add PR (time): exercise "5k run", value "23:45" → appears, marked as best for that exercise.
// 3. Add PR (number): exercise "Back squat", value "150" kg → appears; best logic uses higher-is-better.
// 4. Generate weekly card with no sessions → card says "No sessions logged this week." and inserts/upserts for current Monday key.
// 5. Checklist: set race date, toggle items, click save → rows upserted; reload page, loading same date should restore states.
// 6. Invites: enter valid email and send → invite row appears with a share link.
// 7. Payments: clicking Upgrade shows placeholder message.
// 8. Error handling: network failure / supabase error surfaces readable message in header.
// 9. Missing Supabase config → header shows "Supabase not configured." and no crashes.
// 10. SSR/no-window environment → no ReferenceError; component renders and shows "Supabase not configured."
