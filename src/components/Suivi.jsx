import { useState } from "react";
import { CATS, STATUTS } from "../lib/constants.js";
import { clientNom, compute, norm, realMargin } from "../lib/calc.js";
import { eur, frDate } from "../lib/format.js";
import { useApp } from "../context/AppState.jsx";
import ArchiveImport from "./ArchiveImport.jsx";

export default function Suivi() {
  const app = useApp();
  const [importing, setImporting] = useState(false);
  const inCat = app.devisList.filter((d) => !app.suiviCat || d.categorie === app.suiviCat);
  const grp = (k) => inCat.filter((d) => d.statut === k);
  const sumHT = (arr) => arr.reduce((a, d) => a + compute(d).ht, 0);
  const acc = grp("accepte");
  const caAcc = sumHT(acc);
  const depAcc = acc.map(realMargin).reduce((a, r) => a + r.dep, 0);
  const decided = acc.length + grp("refuse").length;
  const list = inCat
    .filter((d) => !app.suiviSt || d.statut === app.suiviSt)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.numero || "").localeCompare(a.numero || ""));

  return (
    <section className="tab on">
      <div className="card">
        <div className="suivihead">
          <h2 style={{ margin: 0 }}>{app.suiviCat ? CATS[app.suiviCat] : "Suivi des devis"}</h2>
          <button className="btn primary" type="button" onClick={() => app.newDevis(app.suiviCat || "installation")}>
            {app.suiviCat ? `Nouveau devis ${CATS[app.suiviCat].toLowerCase()}` : "Nouveau devis"}
          </button>
          <button className="btn" type="button" onClick={() => setImporting((open) => !open)}>
            Ajouter un ancien devis
          </button>
        </div>
        <div className="stats">
          <div className="stat enc"><div className="n">{grp("en_cours").length}</div><div className="l">En cours</div><div className="a">{eur(sumHT(grp("en_cours")))} HT</div></div>
          <div className="stat acc"><div className="n">{acc.length}</div><div className="l">Acceptés</div><div className="a">{eur(caAcc)} HT</div></div>
          <div className="stat ref"><div className="n">{grp("refuse").length}</div><div className="l">Refusés</div><div className="a">{eur(sumHT(grp("refuse")))} HT</div></div>
          <div className="margebox" style={{ gridColumn: "1 / -1" }}>
            <div><span>Total des devis</span><span><b>{inCat.length}</b></span></div>
            <div><span>Taux d'acceptation (hors en cours)</span><span>{decided ? Math.round((acc.length / decided) * 100) + " %" : "-"}</span></div>
            <div><span>Dépenses sur devis acceptés</span><span>{eur(depAcc)} HT</span></div>
            <div><span><b>Marge réelle sur devis acceptés</b></span><span><b>{eur(caAcc - depAcc)}</b></span></div>
          </div>
        </div>
      </div>
      {importing && <ArchiveImport onClose={() => setImporting(false)} />}
      <div className="card">
        <div className="filters" role="group">
          {[["", "Tous"], ["en_cours", "En cours"], ["accepte", "Acceptés"], ["refuse", "Refusés"]].map(([k, label]) => (
            <button key={label} type="button" aria-pressed={app.suiviSt === k} onClick={() => app.setSuiviSt(k)}>{label}</button>
          ))}
        </div>
        <div className="list">
          {!list.length && <p className="empty">{inCat.length ? "Aucun devis avec ce statut." : "Aucun devis ici pour l'instant. Crée-en un avec le bouton ci-dessus."}</p>}
          {list.map((raw) => {
            const d = norm({ ...raw, client: { ...raw.client }, lignes: raw.lignes, depenses: raw.depenses });
            const r = realMargin(d);
            return (
              <div className="item" key={d.id}>
                <div style={{ minWidth: 0 }}>
                  <strong>{d.numero}</strong>
                  {d.archive && <span className="tag">PDF archivé</span>}
                  <span className={"st " + d.statut}>{STATUTS[d.statut]}</span>
                  <span className={"tag" + (d.type === "particulier" ? " part" : "")}>{d.type === "particulier" ? "Particulier" : "Pro"}</span>
                  {d.archive?.numeroOriginal && <div className="meta">Numéro sur le PDF original : {d.archive.numeroOriginal}</div>}
                  <div className="meta">{clientNom(d)} · {CATS[d.categorie]} · {frDate(d.date)}</div>
                  <div className="meta">{eur(r.ht)} HT · {eur(compute(d).ttc)} TTC{d.depenses.length ? ` · marge réelle ${eur(r.marge)}` : ""}</div>
                  <label style={{ marginTop: 6, maxWidth: 170 }}>Statut
                    <select value={d.statut} onChange={(e) => app.setStatut(d.id, e.target.value, false)}>
                      {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                </div>
                <div className="actions" style={{ flexDirection: "column", alignItems: "flex-end" }}>
                  {d.archive && <button className="btn ghost" onClick={() => app.downloadArchivePdf(d)}>Télécharger le PDF original</button>}
                  {!d.archive && <button className="btn ghost" onClick={() => app.openDevis(d.id)}>Ouvrir</button>}
                  <button className="btn ghost" onClick={() => app.duplicate(d.id)}>Dupliquer</button>
                  <button className="btn ghost danger" onClick={() => app.erase(d.id)}>Effacer</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
