import { compute } from "./lib/calc.js";
import { eur } from "./lib/format.js";
import { TABS } from "./lib/constants.js";
import { useApp } from "./context/AppState.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DevisForm from "./components/DevisForm.jsx";
import Suivi from "./components/Suivi.jsx";
import Envoi from "./components/Envoi.jsx";
import Factures from "./components/Factures.jsx";
import Clients from "./components/Clients.jsx";
import Fiches from "./components/Fiches.jsx";
import Reglages from "./components/Reglages.jsx";
import Viewer from "./components/Viewer.jsx";

const NAV_TO = {
  devis: "devis",
  tout: "tout",
  installation: "installation",
  maintenance: "maintenance",
  depannage: "depannage",
  envoi: "envoi",
  factures: "factures",
  clients: "clients",
  fiches: "fiches",
  reglages: "reglages"
};

export default function App() {
  const app = useApp();
  const selected = (name) => {
    if (name === "tout") return app.tab === "suivi" && !app.suiviCat;
    if (name === "installation" || name === "maintenance" || name === "depannage") return app.tab === "suivi" && app.suiviCat === name;
    return app.tab === name;
  };
  const ttc = app.cur ? compute(app.cur).ttc : 0;

  if (!app.authReady) {
    return (
      <>
        <header><div className="bar"><div className="brand">Devis <span>Viviworks</span></div><div className="mode">Chargement…</div></div></header>
        <main><p className="muted">Connexion à Supabase…</p></main>
      </>
    );
  }
  if (!app.configured || !app.session) {
    return (
      <>
        <header><div className="bar"><div className="brand">Devis <span>Viviworks</span></div><div className="mode">Supabase</div></div></header>
        <AuthScreen configured={app.configured} onSignIn={app.signIn} onSignUp={app.signUp} />
      </>
    );
  }

  return (
    <div className="app-container">
      <Sidebar 
        selected={selected}
        onNavigate={(id) => app.showTab(NAV_TO[id])}
        userEmail={app.ready ? app.session.user.email : "Chargement…"}
        onSignOut={app.signOut}
      />
      <div className="main-content">
        <main>
          {!app.ready && <p className="muted">Chargement des devis…</p>}
          {app.ready && app.tab === "devis" && <DevisForm />}
          {app.ready && app.tab === "suivi" && <Suivi />}
          {app.ready && app.tab === "envoi" && <Envoi />}
          {app.ready && app.tab === "factures" && <Factures />}
          {app.ready && app.tab === "clients" && <Clients />}
          {app.ready && app.tab === "fiches" && <Fiches />}
          {app.ready && app.tab === "reglages" && <Reglages />}
        </main>
      {app.tab === "devis" && app.cur && (
        <div className="dock">
          <div className="in">
            <div className="sum">Total TTC<b>{eur(ttc)}</b></div>
            <div className={"savestate " + app.save.kind} aria-live="polite">{app.save.text}</div>
          </div>
          <div className="btns">
            <button className="btn" type="button" onClick={app.saveNow}>Enregistrer</button>
            <button className="btn danger" type="button" onClick={() => app.erase(app.cur.id)}>Effacer</button>
            <button className="btn" type="button" onClick={() => app.preview(app.cur, "devis")}>Aperçu</button>
            <button className="btn primary" type="button" onClick={() => app.exportCurrent("devis")}>PDF</button>
          </div>
        </div>
      )}
        {app.tab === "devis" && app.cur && (
          <div className="dock">
            <div className="in">
              <div className="sum">Total TTC<b>{eur(ttc)}</b></div>
              <div className={"savestate " + app.save.kind} aria-live="polite">{app.save.text}</div>
            </div>
            <div className="btns">
              <button className="btn" type="button" onClick={app.saveNow}>Enregistrer</button>
              <button className="btn danger" type="button" onClick={() => app.erase(app.cur.id)}>Effacer</button>
              <button className="btn" type="button" onClick={() => app.preview(app.cur, "devis")}>Aperçu</button>
              <button className="btn primary" type="button" onClick={() => app.exportCurrent("devis")}>PDF</button>
            </div>
          </div>
        )}
        {app.toastMsg && <div className="toast on" role="status">{app.toastMsg}</div>}
        {app.viewer && <Viewer />}
      </div>
    </div>
  );
}
