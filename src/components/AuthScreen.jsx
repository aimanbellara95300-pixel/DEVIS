import { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function AuthScreen({ configured, onSignIn, onSignUp }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <main>
        <div className="card">
          <h2>Connexion Supabase</h2>
          <p>Crée un projet sur supabase.com, puis ajoute ces variables avant de lancer ou de publier le site :</p>
          <p className="muted">VITE_SUPABASE_URL<br />VITE_SUPABASE_ANON_KEY</p>
          <p>En local, place-les dans un fichier <b>.env</b> à la racine. Sur Netlify, ajoute-les dans Site configuration → Environment variables, puis relance le déploiement.</p>
          <p>Dans Supabase, ouvre SQL Editor et exécute le fichier <b>supabase/schema.sql</b>.</p>
        </div>
      </main>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") await onSignIn(email.trim(), password);
      else {
        const res = await onSignUp(email.trim(), password);
        if (res?.needsConfirm) setInfo("Compte créé. Ouvre le lien reçu par e-mail, puis connecte-toi. Dans Supabase tu peux aussi désactiver la confirmation d'e-mail.");
      }
    } catch (ex) {
      setErr(ex.message || "La connexion a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="card">
        <h2>{mode === "login" ? "Connexion" : "Créer un compte"}</h2>
        <p className="muted" style={{ marginTop: -6 }}>Les devis, clients et factures sont enregistrés dans Supabase, liés à ce compte.</p>
        <form onSubmit={submit}>
          <div className="grid">
            <label className="full">E-mail<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="full">Mot de passe<input type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          </div>
          {err && <p className="status-err" style={{ marginTop: 10 }}>{err}</p>}
          {info && <p className="notice" style={{ marginTop: 10 }}>{info}</p>}
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn primary" type="submit" disabled={busy || !supabase}>{busy ? "Patiente…" : mode === "login" ? "Se connecter" : "Créer le compte"}</button>
            <button className="btn" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); setInfo(""); }}>
              {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
