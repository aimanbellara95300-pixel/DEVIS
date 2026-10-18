import { useEffect, useState } from "react";
import { CATS, STATUTS } from "../lib/constants.js";
import { clientNom, compute } from "../lib/calc.js";
import { eur, frDate } from "../lib/format.js";
import { useApp } from "../context/AppState.jsx";

export default function Envoi() {
  const app = useApp();
  const d = app.cur;
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [mail, setMail] = useState({ to: "", subject: "", body: "" });

  useEffect(() => {
    if (!d) return;
    const m = d.mail && d.mail.devisId === d.id ? d.mail : { to: d.client.email || "", ...app.defaultMail(d) };
    setMail({ to: m.to || "", subject: m.subject || "", body: m.body || "" });
    setStatus("");
  }, [d?.id]);

  if (!d) return null;
  const others = app.devisList.filter((x) => x.id !== d.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const brands = [...new Set(app.fiches.map((f) => f.marque))].sort((a, b) => a.localeCompare(b, "fr"));
  const avail = app.fiches.filter((f) => !d.fiches.includes(f.id));

  const move = (i, dir) => app.touch((x) => {
    const a = x.fiches;
    if (dir === "up" && i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]];
    if (dir === "down" && i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]];
    if (dir === "del") a.splice(i, 1);
    return x;
  });

  return (
    <section className="tab on">
      <div className="card">
        <h2>Devis à envoyer</h2>
        <select value={d.id} aria-label="Devis à envoyer" onChange={(e) => app.openDevis(e.target.value, { keepTab: true })}>
          <option value={d.id}>{d.numero} - {clientNom(d)} (ouvert)</option>
          {others.map((x) => <option key={x.id} value={x.id}>{x.numero} - {clientNom(x)}</option>)}
        </select>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {eur(compute(d).ttc)} TTC · {CATS[d.categorie] || ""} · {STATUTS[d.statut] || ""}{d.envoyeLe ? ` · déjà envoyé le ${frDate(d.envoyeLe)}` : ""}
        </p>
      </div>
      <div className="card">
        <h2>Ordre du dossier PDF</h2>
        <p className="muted" style={{ marginTop: -6 }}>Les fiches constructeurs d'abord, dans l'ordre ci-dessous. Le devis est toujours la dernière partie.</p>
        <ol className="order">
          {d.fiches.map((id, i) => {
            const f = app.fiches.find((x) => x.id === id);
            if (!f) return null;
            return (
              <li key={id}>
                <span className="nm">{f.nom}<small>{f.marque}</small></span>
                <button className="btn ghost" type="button" disabled={i === 0} onClick={() => move(i, "up")}>↑</button>
                <button className="btn ghost" type="button" disabled={i === d.fiches.length - 1} onClick={() => move(i, "down")}>↓</button>
                <button className="btn ghost danger" type="button" onClick={() => move(i, "del")}>✕</button>
              </li>
            );
          })}
          <li className="last"><span className="nm"><b>Devis n° {d.numero}</b><small>Toujours en dernier{d.type === "particulier" ? ", avec l'annexe de rétractation" : ""}</small></span></li>
        </ol>
        <div className="addrow">
          <select id="eAddSel" defaultValue="" key={avail.map((f) => f.id).join()}>
            {avail.length ? brands.map((b) => {
              const fs = avail.filter((f) => f.marque === b);
              if (!fs.length) return null;
              return <optgroup key={b} label={b}>{fs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}</optgroup>;
            }) : <option value="">{app.fiches.length ? "Toutes les fiches sont déjà ajoutées" : "Aucune fiche : ajoute-en dans Fiches marques"}</option>}
          </select>
          <button className="btn" type="button" disabled={!avail.length} onClick={() => {
            const sel = document.getElementById("eAddSel");
            if (!sel?.value) return;
            app.touch((x) => { x.fiches.push(sel.value); return x; });
          }}>Ajouter</button>
        </div>
      </div>
      <div className="card">
        <h2>Message</h2>
        <div className="grid">
          <label className="full">Destinataire<input type="email" placeholder="e-mail du client" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} /></label>
          <label className="full">Objet<input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} /></label>
          <label className="full">Message<textarea style={{ minHeight: 150 }} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} /></label>
        </div>
      </div>
      <div className="card">
        <div className="actions">
          <button className="btn" type="button" onClick={() => app.preview(d, "devis")}>Aperçu du dossier</button>
          <button className="btn" type="button" onClick={() => app.exportCurrent("devis")}>Télécharger le dossier</button>
          <button className="btn primary" type="button" disabled={sending} onClick={async () => {
            setSending(true);
            const msg = await app.sendDossier(mail);
            setStatus(msg || "");
            setSending(false);
          }}>{sending ? "Préparation…" : "Envoyer"}</button>
        </div>
        {status && <p className="muted" style={{ margin: "10px 0 0" }}>{status}</p>}
      </div>
    </section>
  );
}
