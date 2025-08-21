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
      {status && <div
