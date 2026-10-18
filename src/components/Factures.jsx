import { CATS } from "../lib/constants.js";
import { clientNom, compute } from "../lib/calc.js";
import { eur, frDate, num, today } from "../lib/format.js";
import { useApp } from "../context/AppState.jsx";

export default function Factures() {
  const app = useApp();
  const all = app.devisList.filter((d) => d.facture);
  const ttc = (d) => compute(d).ttc;
  const reste = (d) => (d.facture.payee === "oui" ? 0 : ttc(d) - num(d.facture.acompteVerse));
  const tot = all.reduce((a, d) => a + ttc(d), 0);
  const due = all.reduce((a, d) => a + reste(d), 0);
  const list = all.filter((d) => !app.factF || (d.facture.payee || "non") === app.factF).sort((a, b) => (b.facture.numero || "").localeCompare(a.facture.numero || ""));

  return (
    <section className="tab on">
      <div className="card">
        <h2>Facturation</h2>
        <div className="stats">
          <div className="stat enc"><div className="n">{all.length}</div><div className="l">Factures</div><div className="a">{eur(tot)} TTC</div></div>
          <div className="stat acc"><div className="n">{all.filter((d) => d.facture.payee === "oui").length}</div><div className="l">Payées</div><div className="a">{eur(tot - due)}</div></div>
          <div className="stat ref"><div className="n">{all.filter((d) => d.facture.payee !== "oui").length}</div><div className="l">À encaisser</div><div className="a">{eur(due)}</div></div>
        </div>
      </div>
      <div className="card">
        <div className="filters">
          {[["", "Toutes"], ["non", "À encaisser"], ["oui", "Payées"]].map(([k, label]) => (
            <button key={label} type="button" aria-pressed={app.factF === k} onClick={() => app.setFactF(k)}>{label}</button>
          ))}
        </div>
        <div className="list">
          {!list.length && <p className="empty">{all.length ? "Aucune facture ici." : "Aucune facture pour l'instant. Passe un devis en « Accepté » pour créer sa facture."}</p>}
          {list.map((d) => {
            const pay = d.facture.payee === "oui" ? "oui" : "non";
            const late = pay === "non" && d.facture.echeance && d.facture.echeance < today();
            return (
              <div className="item" key={d.id}>
                <div style={{ minWidth: 0 }}>
                  <strong>{d.facture.numero}</strong>
                  <span className={"st " + pay}>{pay === "oui" ? "Payée" : late ? "En retard" : "À encaisser"}</span>
                  <div className="meta">{clientNom(d)} · {CATS[d.categorie]} · devis {d.numero}</div>
                  <div className="meta">{frDate(d.facture.date)} · {eur(ttc(d))} TTC{pay === "non" ? ` · reste ${eur(reste(d))} (échéance ${frDate(d.facture.echeance)})` : ""}</div>
                  <label style={{ marginTop: 6, maxWidth: 170 }}>Paiement
                    <select value={pay} onChange={(e) => app.setPayee(d.id, e.target.value)}>
                      <option value="non">À encaisser</option>
                      <option value="oui">Payée</option>
                    </select>
                  </label>
                </div>
                <div className="actions" style={{ flexDirection: "column", alignItems: "flex-end" }}>
                  <button className="btn ghost" onClick={() => app.preview(d, "facture")}>Aperçu</button>
                  <button className="btn ghost" onClick={() => app.download(d, "facture")}>PDF</button>
                  <button className="btn ghost" onClick={() => app.openDevis(d.id, { scrollFact: true })}>Ouvrir</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
