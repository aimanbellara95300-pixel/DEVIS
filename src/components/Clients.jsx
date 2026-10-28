import { CATS, STATUTS } from "../lib/constants.js";
import { cliName, compute } from "../lib/calc.js";
import { eur, frDate } from "../lib/format.js";
import { useApp } from "../context/AppState.jsx";

export default function Clients() {
  const app = useApp();
  const q = app.cliSearch.trim().toLowerCase();
  const devisOf = (c) => app.devisList.filter((d) => d.clientId === c.id);
  const statusOf = (c) => {
    const ds = devisOf(c);
    if (ds.some((d) => d.statut === "accepte")) return "accepte";
    if (ds.length && ds.every((d) => d.statut === "refuse")) return "refuse";
    return "en_cours";
  };
  const all = app.clients.map((c) => ({ c, st: statusOf(c), ds: devisOf(c) }));
  const n = (k) => all.filter((x) => x.st === k).length;
  const caAcc = all.reduce((a, x) => a + x.ds.filter((d) => d.statut === "accepte").reduce((s, d) => s + compute(d).ht, 0), 0);
  const list = all
    .filter((x) => !app.cliFilter || x.st === app.cliFilter)
    .filter((x) => !q || [x.c.nom, x.c.societe, x.c.ville, x.c.cp, x.c.tel, x.c.email].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.c.maj || 0) - (a.c.maj || 0));

  return (
    <section className="tab on">
      <div className="card">
        <h2>Base clients</h2>
        <div className="stats">
          <div className="stat acc"><div className="n">{n("accepte")}</div><div className="l">Clients acceptés</div></div>
          <div className="stat enc"><div className="n">{n("en_cours")}</div><div className="l">En cours</div></div>
          <div className="stat ref"><div className="n">{n("refuse")}</div><div className="l">Refusés</div></div>
          <div className="margebox" style={{ gridColumn: "1 / -1" }}>
            <div><span>Total clients</span><span><b>{app.clients.length}</b></span></div>
            <div><span>Chiffre d'affaires accepté</span><span><b>{eur(caAcc)} HT</b></span></div>
          </div>
        </div>
      </div>
      <div className="card">
        <label>Rechercher (nom, ville, téléphone, e-mail)<input type="search" autoComplete="off" value={app.cliSearch} onChange={(e) => app.setCliSearch(e.target.value)} /></label>
        <div className="filters" style={{ marginTop: 12 }}>
          {[["", "Tous"], ["accepte", "Acceptés"], ["en_cours", "En cours"], ["refuse", "Refusés"]].map(([k, label]) => (
            <button key={label} type="button" aria-pressed={app.cliFilter === k} onClick={() => app.setCliFilter(k)}>{label}</button>
          ))}
        </div>
        <div className="list">
          {!list.length && <p className="empty">{app.clients.length ? "Aucun client ne correspond." : "Aucun client pour l'instant. Chaque client est ajouté automatiquement dès que tu enregistres un devis."}</p>}
          {list.map(({ c, st, ds }) => {
            const acc = ds.filter((d) => d.statut === "accepte");
            const ref = ds.filter((d) => d.statut === "refuse");
            const open = app.cliOpen === c.id;
            return (
              <div className="item cli" key={c.id}>
                <div className="top">
                  <div style={{ minWidth: 0 }}>
                    <strong>{cliName(c)}</strong>
                    <span className={"st " + st}>{STATUTS[st]}</span>
                    <span className={"tag" + (c.type === "particulier" ? " part" : "")}>{c.type === "particulier" ? "Particulier" : "Pro"}</span>
                    <div className="meta">{[c.ville, c.tel].filter(Boolean).join(" · ") || "Pas de coordonnées"}</div>
                    <div className="meta">{ds.length} devis · {acc.length} accepté{acc.length > 1 ? "s" : ""} · {ref.length} refusé{ref.length > 1 ? "s" : ""}{acc.length ? ` · ${eur(acc.reduce((s, d) => s + compute(d).ht, 0))} HT` : ""}</div>
                  </div>
                  <button className="btn ghost" onClick={() => app.setCliOpen(open ? "" : c.id)}>{open ? "Fermer" : "Voir"}</button>
                </div>
                {open && (
                  <div className="det">
                    {c.type === "professionnel" && c.nom ? <span className="meta">Contact : {c.nom}</span> : null}
                    <span className="meta">{[c.adresse, [c.cp, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
                    {c.email ? <span className="meta">{c.email}</span> : null}
                    {c.siret ? <span className="meta">SIRET / TVA : {c.siret}</span> : null}
                    <label style={{ marginTop: 8 }}>Notes sur le client
                      <textarea value={c.notes || ""} placeholder="Code portail, matériel installé, préférences…" onChange={(e) => app.saveClientNotes(c.id, e.target.value)} />
                    </label>
                    <h3>Devis</h3>
                    {ds.length ? [...ds].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((d) => (
                      <div className="meta" key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0" }}>
                        <span>{d.numero} · {CATS[d.categorie]} · {frDate(d.date)} <span className={"st " + d.statut}>{STATUTS[d.statut]}</span></span>
                        {d.archive
                          ? <button className="btn ghost" onClick={() => app.downloadArchivePdf(d)}>PDF original</button>
                          : <button className="btn ghost" onClick={() => app.openDevis(d.id)}>Ouvrir</button>}
                      </div>
                    )) : <p className="empty">Aucun devis lié.</p>}
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="btn primary" onClick={() => app.newDevisForClient(c.id)}>Nouveau devis pour ce client</button>
                      <button className="btn ghost danger" onClick={() => app.deleteClient(c.id)}>Supprimer le client</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
