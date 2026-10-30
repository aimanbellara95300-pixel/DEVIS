import { useState } from "react";
import { COULEURS, EXP_CATS, MARGES, TVA_OPTIONS, TVAS, UNITES } from "../lib/constants.js";
import { achatHT, blankLine, clientNom, cliName, compute, lineHT, lineMarge, realMargin } from "../lib/calc.js";
import { eur, frDate, num, pct, today, uid } from "../lib/format.js";
import { useApp } from "../context/AppState.jsx";

function PasteZone({ target, onFile }) {
  const [drag, setDrag] = useState(false);
  const take = (f) => { if (f) onFile(f); };
  return (
    <>
      <div
        className={"pastezone" + (drag ? " drag" : "")}
        contentEditable
        spellCheck={false}
        inputMode="none"
        role="textbox"
        aria-label="Zone pour coller une image"
        onPaste={(e) => {
          e.preventDefault();
          const items = e.clipboardData?.items;
          let file = null;
          for (const it of items || []) {
            if (it.kind === "file" && /^image\/|application\/pdf/.test(it.type)) file = it.getAsFile();
          }
          file = file || e.clipboardData?.files?.[0];
          e.currentTarget.textContent = "Si la galerie ne s'ouvre pas : copie la photo, puis appuie longtemps ici → Coller.";
          if (file) take(file);
        }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer?.files?.[0]); }}
      >
        Si la galerie ne s'ouvre pas : copie la photo dans WhatsApp ou la galerie, puis <b>appuie longtemps ici → Coller</b>.
      </div>
      <button
        className="btn"
        type="button"
        style={{ marginTop: 8 }}
        onClick={async () => {
          try {
            const items = await navigator.clipboard.read();
            for (const it of items) {
              const type = it.types.find((x) => x.startsWith("image/"));
              if (type) {
                const blob = await it.getType(type);
                take(new File([blob], "image." + type.split("/")[1], { type }));
                return;
              }
            }
          } catch { /* bouton souvent bloqué sur mobile */ }
        }}
      >
        Coller l'image copiée
      </button>
      <span hidden>{target}</span>
    </>
  );
}

function FilePickers({ target, busy, onFile }) {
  return (
    <div className="pickers">
      {[
        ["Prendre une photo", "image/*", "environment", "btn primary filebtn"],
        ["Galerie photos", "image/*", "", "btn filebtn"],
        ["WhatsApp / Fichiers / PDF", "image/*,application/pdf,.pdf", "", "btn filebtn"]
      ].map(([label, accept, capture, cls]) => (
        <label key={label} className={cls + (busy ? " busy" : "")}>
          {label}
          <input
            type="file"
            accept={accept}
            capture={capture || undefined}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
        </label>
      ))}
    </div>
  );
}

export default function DevisForm() {
  const app = useApp();
  const d = app.cur;
  if (!d) return null;
  const t = compute(d);
  const brands = [...new Set(app.fiches.map((f) => f.marque))].sort((a, b) => a.localeCompare(b, "fr"));
  const savedDevis = [...app.devisList].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") || (b.numero || "").localeCompare(a.numero || "")
  );
  const bought = d.lignes.filter((l) => num(l.achat) > 0);
  const ach = bought.reduce((a, l) => a + achatHT(l) * num(l.qte), 0);
  const mg = bought.reduce((a, l) => a + lineMarge(l), 0);
  const r = realMargin(d);
  const color = (d.couleur || app.settings.couleur || "#1F5FA8").toUpperCase();

  const setClient = (k, v) => app.touch((x) => { x.client[k] = v; return x; });
  const setField = (k, v) => app.touch((x) => { x[k] = v; return x; });

  return (
    <section className="tab on">
      <div className="card">
        <h2>Client</h2>
        <label style={{ marginBottom: 12 }}>
          Ouvrir un devis enregistré
          <select
            value={app.devisList.some((devis) => devis.id === d.id) ? d.id : ""}
            onChange={(e) => { if (e.target.value) app.openDevis(e.target.value); }}
          >
            <option value="">Choisir un devis enregistré</option>
            {savedDevis.map((devis) => (
              <option key={devis.id} value={devis.id}>
                {devis.numero} · {clientNom(devis)} · {frDate(devis.date)}{devis.archive ? " · PDF archivé" : ""}
              </option>
            ))}
          </select>
        </label>
        <label style={{ marginBottom: 12 }}>
          Reprendre un client enregistré
          <select value={app.clients.some((c) => c.id === d.clientId) ? d.clientId : ""} onChange={(e) => app.pickClient(e.target.value)}>
            <option value="">Nouveau client</option>
            {[...app.clients].sort((a, b) => cliName(a).localeCompare(cliName(b), "fr")).map((c) => (
              <option key={c.id} value={c.id}>{cliName(c)}{c.ville ? " - " + c.ville : ""}</option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ marginTop: -4 }}>
          Choisir un client préremplit un nouveau devis. Pour reprendre un devis existant, sélectionne-le dans la liste ci-dessus.
        </p>
        {d.archive && (
          <div className="notice">
            Ce devis archivé est modifiable. Enregistre les changements pour conserver ses informations et ses lignes ; « Aperçu » affiche le devis régénéré. Le PDF original reste inchangé.
            <div className="actions" style={{ marginTop: 8 }}>
              <button className="btn primary" type="button" onClick={() => app.preview(d, "devis")}>
                Aperçu du devis régénéré
              </button>
              <button className="btn ghost" type="button" onClick={() => app.previewArchivePdf(d)}>
                Afficher le PDF original
              </button>
            </div>
          </div>
        )}
        <h3 style={{ marginTop: 4 }}>Type de client</h3>
        <div className="seg">
          <button type="button" aria-pressed={d.type === "particulier"} onClick={() => app.setType("particulier")}>Particulier</button>
          <button type="button" aria-pressed={d.type === "professionnel"} onClick={() => app.setType("professionnel")}>Professionnel</button>
        </div>
        <div className="tvapick">
          <strong>TVA du devis</strong>
          <div className="chips">
            {TVAS.map((v) => (
              <button key={v} type="button" aria-pressed={num(d.tvaDef) === v} onClick={() => app.setTvaAll(v)}>{pct(v)}</button>
            ))}
          </div>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {d.type === "particulier"
              ? "Particulier : 20 % en logement neuf ou de moins de 2 ans, 10 % pour la pose dans un logement de plus de 2 ans, 5,5 % pour les travaux de rénovation énergétique éligibles. L'attestation TVA du client est nécessaire pour 10 % et 5,5 %."
              : "Professionnel : 20 %."}
          </p>
        </div>
        {d.type === "particulier" && (
          <div className="notice">Client particulier : le PDF inclut automatiquement le droit de rétractation de 14 jours, la page d'information légale et le formulaire de rétractation. L'acompte devient exigible 7 jours après signature.</div>
        )}
        <div className="grid">
          {d.type !== "particulier" && (
            <label className="full">Société<input value={d.client.societe} autoComplete="organization" onChange={(e) => setClient("societe", e.target.value)} /></label>
          )}
          <label className="full">Nom du client<input value={d.client.nom} autoComplete="name" onChange={(e) => setClient("nom", e.target.value)} /></label>
          <label className="full">Adresse<input value={d.client.adresse} autoComplete="street-address" onChange={(e) => setClient("adresse", e.target.value)} /></label>
          <label>Code postal<input value={d.client.cp} inputMode="numeric" onChange={(e) => setClient("cp", e.target.value)} /></label>
          <label>Ville<input value={d.client.ville} onChange={(e) => setClient("ville", e.target.value)} /></label>
          <label>Téléphone<input value={d.client.tel} type="tel" onChange={(e) => setClient("tel", e.target.value)} /></label>
          <label>E-mail<input value={d.client.email} type="email" onChange={(e) => setClient("email", e.target.value)} /></label>
          {d.type !== "particulier" && (
            <label className="full">SIRET / N° TVA<input value={d.client.siret} onChange={(e) => setClient("siret", e.target.value)} /></label>
          )}
          <label className="full">Lieu d'intervention (si différent)<input value={d.client.lieu} onChange={(e) => setClient("lieu", e.target.value)} /></label>
        </div>
      </div>

      <div className="card">
        <h2>Devis</h2>
        <div className="grid">
          <label>Numéro<input value={d.numero} onChange={(e) => setField("numero", e.target.value)} /></label>
          <label>Date<input type="date" value={d.date} onChange={(e) => setField("date", e.target.value)} /></label>
          <label className="full">Objet<input value={d.objet} placeholder="Ex. Fourniture et pose d'une climatisation réversible" onChange={(e) => setField("objet", e.target.value)} /></label>
          <label>Type d'intervention
            <select value={d.categorie} onChange={(e) => setField("categorie", e.target.value)}>
              <option value="installation">Installation</option>
              <option value="maintenance">Maintenance</option>
              <option value="depannage">Dépannage</option>
            </select>
          </label>
          <label>Statut
            <select value={d.statut} onChange={(e) => app.setStatut(d.id, e.target.value, true)}>
              <option value="en_cours">En cours</option>
              <option value="accepte">Accepté</option>
              <option value="refuse">Refusé</option>
            </select>
          </label>
          <label>Acompte à la commande (%)<input type="number" min="0" max="100" step="1" value={d.acompte} onChange={(e) => setField("acompte", num(e.target.value))} /></label>
        </div>
      </div>

      <div className="card">
        <h2>Offre fournisseur en photo</h2>
        <p className="muted" style={{ marginTop: -6 }}>Prends en photo l'offre de prix du fournisseur. Sur le site hébergé, les articles se saisissent à la main.</p>
        <FilePickers target="offre" busy={app.busy === "offre"} onFile={app.onOfferFile} />
        <PasteZone target="offre" onFile={app.onOfferFile} />
        {app.photoStatus.text && <p className={"muted" + (app.photoStatus.err ? " status-err" : "")} style={{ margin: "8px 0 0" }}>{app.photoStatus.text}</p>}
      </div>

      <div className="card">
        <h2>Lignes du devis</h2>
        <div className="globalmarge">
          <span className="muted">Marge sur toutes les lignes avec prix d'achat :</span>
          <div className="chips">
            {MARGES.map((m) => <button key={m} type="button" onClick={() => app.applyAllMarge(m)}>+{m} %</button>)}
          </div>
        </div>
        {d.lignes.map((l, i) => (
          <div className="line" key={l.id || i}>
            <div className="head"><strong>Ligne {i + 1}</strong><span className="tot">{eur(lineHT(l))} HT</span></div>
            <label>Désignation<input value={l.designation} placeholder="Ex. Unité extérieure Daikin RXM35R" onChange={(e) => app.touch((x) => { x.lignes[i].designation = e.target.value; return x; })} /></label>
            <label style={{ marginTop: 8 }}>Détail (facultatif)<input value={l.description} onChange={(e) => app.touch((x) => { x.lignes[i].description = e.target.value; return x; })} /></label>
            <div className="buy">
              <div className="row" style={{ marginTop: 0 }}>
                <label>Prix d'achat fournisseur<input inputMode="decimal" value={l.achat} placeholder="0,00" onChange={(e) => app.touch((x) => { const line = x.lignes[i]; line.achat = e.target.value; if (num(line.marge)) app.applyMarge(line); return x; })} /></label>
                <label>Prix fournisseur en
                  <select value={l.achatMode === "HT" ? "HT" : "TTC"} onChange={(e) => app.touch((x) => { const line = x.lignes[i]; line.achatMode = e.target.value; if (num(line.marge)) app.applyMarge(line); return x; })}>
                    <option>TTC</option><option>HT</option>
                  </select>
                </label>
                <label>TVA fournisseur
                  <select value={String(num(l.achatTva ?? 20))} disabled={l.achatMode === "HT"} onChange={(e) => app.touch((x) => { const line = x.lignes[i]; line.achatTva = num(e.target.value); if (num(line.marge)) app.applyMarge(line); return x; })}>
                    {TVA_OPTIONS.map((v) => <option key={v} value={v}>{pct(v)}</option>)}
                  </select>
                </label>
              </div>
              <div className="chips">
                {MARGES.map((m) => (
                  <button key={m} type="button" aria-pressed={num(l.marge) === m} onClick={() => {
                    if (!(num(l.achat) > 0)) return;
                    app.touch((x) => { const line = x.lignes[i]; line.marge = m; app.applyMarge(line); return x; });
                  }}>+{m} %</button>
                ))}
              </div>
              <div className="buyinfo">
                {num(l.achat) > 0
                  ? <>Achat {eur(achatHT(l))} HT · Vente {eur(num(l.pu))} HT · Ta marge sur la ligne : <b>{eur(lineMarge(l))}</b></>
                  : "Saisis le prix fournisseur puis choisis ta marge : le prix de vente se calcule tout seul."}
              </div>
            </div>
            <div className="row">
              <label>Quantité<input inputMode="decimal" value={l.qte} onChange={(e) => app.touch((x) => { x.lignes[i].qte = e.target.value; return x; })} /></label>
              <label>Unité
                <select value={l.unite} onChange={(e) => app.touch((x) => { x.lignes[i].unite = e.target.value; return x; })}>
                  {UNITES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
              <label>Prix unit. HT<input inputMode="decimal" value={l.pu} onChange={(e) => app.touch((x) => { x.lignes[i].pu = e.target.value; x.lignes[i].marge = 0; return x; })} /></label>
            </div>
            <div className="row2">
              <label>Remise %<input inputMode="decimal" value={l.remise} onChange={(e) => app.touch((x) => { x.lignes[i].remise = e.target.value; return x; })} /></label>
              <label>TVA
                <select value={String(num(l.tva))} onChange={(e) => app.touch((x) => { x.lignes[i].tva = num(e.target.value); return x; })}>
                  {TVA_OPTIONS.map((v) => <option key={v} value={v}>{pct(v)}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: 4 }}>
                <button className="btn ghost" type="button" aria-label="Monter la ligne" onClick={() => app.touch((x) => { if (i > 0) [x.lignes[i - 1], x.lignes[i]] = [x.lignes[i], x.lignes[i - 1]]; return x; })}>↑</button>
                <button className="btn ghost danger" type="button" onClick={() => app.touch((x) => { x.lignes.splice(i, 1); return x; })}>Supprimer</button>
              </div>
            </div>
          </div>
        ))}
        {!d.lignes.length && <p className="empty">Aucune ligne. Ajoute la première ligne du devis.</p>}
        <div className="actions">
          <button className="btn" type="button" onClick={() => app.touch((x) => { x.lignes.push(blankLine(x.tvaDef ?? 20)); return x; })}>+ Ajouter une ligne</button>
        </div>
      </div>

      <div className="card">
        <h2>Couleur du devis</h2>
        <div className="swatches" role="radiogroup" aria-label="Couleur du devis">
          {COULEURS.map(([n, hx]) => (
            <button key={hx} type="button" className="sw" role="radio" aria-checked={hx.toUpperCase() === color} onClick={() => app.pickColor(hx)}>
              <i style={{ background: hx }} />{n}
            </button>
          ))}
        </div>
        <label className="custom">Autre couleur<input type="color" value={color.toLowerCase()} onChange={(e) => app.pickColor(e.target.value.toUpperCase())} /></label>
      </div>

      <div className="card">
        <h2>Fiches constructeurs à joindre</h2>
        <p className="muted" style={{ marginTop: -6 }}>Les PDF cochés sont placés avant le devis : le devis est toujours en dernier. L'ordre se règle dans l'onglet Envoyer.</p>
        {!app.fiches.length && <p className="empty">La bibliothèque est vide. Ajoute des PDF dans l'onglet Fiches marques.</p>}
        {brands.map((b) => (
          <div key={b}>
            <h3>{b}</h3>
            {app.fiches.filter((f) => f.marque === b).map((f) => (
              <label className="chk" key={f.id}>
                <input type="checkbox" checked={d.fiches.includes(f.id)} onChange={(e) => app.touch((x) => {
                  x.fiches = e.target.checked ? [...new Set([...x.fiches, f.id])] : x.fiches.filter((id) => id !== f.id);
                  return x;
                })} />
                {f.nom}
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Notes sur le devis</h2>
        <textarea value={d.notes || ""} placeholder="Remarques visibles sur le devis (facultatif)" onChange={(e) => setField("notes", e.target.value)} />
      </div>

      <div className="card">
        <h2>Dépenses du projet</h2>
        <p className="muted" style={{ marginTop: -6 }}>Scanne tes factures pour connaître ta marge réelle. Elles n'apparaissent jamais sur le devis client.</p>
        <FilePickers target="scan" busy={app.busy === "scan"} onFile={app.onScanFile} />
        <PasteZone target="scan" onFile={app.onScanFile} />
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn" type="button" onClick={() => app.touch((x) => { x.depenses.push({ id: uid(), fournisseur: "", categorie: "Matériel", date: today(), ht: "", tva: "", ttc: "", photo: "" }); return x; })}>Ajouter à la main</button>
        </div>
        {app.scanStatus.text && <p className={"muted" + (app.scanStatus.err ? " status-err" : "")} style={{ margin: "8px 0 0" }}>{app.scanStatus.text}</p>}
        <div className="list" style={{ marginTop: 12 }}>
          {!d.depenses.length && <p className="empty">Aucune facture pour ce projet.</p>}
          {d.depenses.map((x, i) => (
            <div className="exp" key={x.id || i}>
              <div className="top">
                <label>Fournisseur<input value={x.fournisseur} onChange={(e) => app.touch((q) => { q.depenses[i].fournisseur = e.target.value; return q; })} /></label>
                <label>Catégorie
                  <select value={x.categorie} onChange={(e) => app.touch((q) => { q.depenses[i].categorie = e.target.value; return q; })}>
                    {EXP_CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label>Date<input type="date" value={x.date} onChange={(e) => app.touch((q) => { q.depenses[i].date = e.target.value; return q; })} /></label>
              </div>
              <div className="row">
                <label>Total HT<input inputMode="decimal" value={x.ht} onChange={(e) => app.touch((q) => { q.depenses[i].ht = e.target.value; return q; })} /></label>
                <label>TVA<input inputMode="decimal" value={x.tva} onChange={(e) => app.touch((q) => { q.depenses[i].tva = e.target.value; return q; })} /></label>
                <label>Total TTC<input inputMode="decimal" value={x.ttc} onChange={(e) => app.touch((q) => { q.depenses[i].ttc = e.target.value; return q; })} /></label>
              </div>
              <div className="foot">
                <span>{x.photo ? <img src={x.photo} alt="Facture" /> : null}</span>
                <button className="btn ghost danger" type="button" onClick={() => { if (confirm("Supprimer cette dépense ?")) app.touch((q) => { q.depenses.splice(i, 1); return q; }); }}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card totals">
        <h2>Récapitulatif</h2>
        <div><span>Total HT brut</span><span>{eur(t.brut)}</span></div>
        {t.remise ? <div><span>Remise</span><span>-{eur(t.remise)}</span></div> : null}
        <div><span>Total HT</span><span>{eur(t.ht)}</span></div>
        {t.tvas.map((v) => <div key={v.taux}><span>TVA {pct(v.taux)}</span><span>{eur(v.montant)}</span></div>)}
        <div className="ttc"><span>Total TTC</span><span>{eur(t.ttc)}</span></div>
        <div><span>Acompte {pct(num(d.acompte))}{d.type === "particulier" ? " (exigible à J+7)" : ""}</span><span>{eur(t.acompte)}</span></div>
        {bought.length ? (
          <>
            <div className="private"><span>Achats fournisseur HT</span><span>{eur(ach)}</span></div>
            <div className="private"><span>Marge prévue sur le matériel</span><span><b>{eur(mg)}</b></span></div>
          </>
        ) : null}
        {d.depenses.length ? (
          <div className="margebox">
            <div><span>Dépenses réelles HT ({d.depenses.length} facture{d.depenses.length > 1 ? "s" : ""})</span><span>{eur(r.dep)}</span></div>
            <div><span><b>Marge réelle du projet</b></span><span><b>{eur(r.marge)}</b> ({r.taux.toFixed(1).replace(".", ",")} %)</span></div>
          </div>
        ) : null}
        <p className="muted" style={{ margin: "6px 0 0" }}>Achats, dépenses et marges ne figurent jamais sur le PDF client.</p>
      </div>

      <div className="card" id="factCard">
        <h2>Facture</h2>
        {!d.facture ? (
          <>
            <p className="muted" style={{ marginTop: -6 }}>La facture est créée automatiquement dès que le devis passe en « Accepté ».</p>
            <button className="btn primary" type="button" onClick={() => app.setStatut(d.id, "accepte", true)}>Devis accepté : créer la facture</button>
          </>
        ) : (
          <>
            <div className="grid">
              <label>N° de facture<input value={d.facture.numero} readOnly /></label>
              <label>Date de facture<input type="date" value={d.facture.date || ""} onChange={(e) => app.touch((x) => { x.facture.date = e.target.value; return x; })} /></label>
              <label>Date des travaux<input type="date" value={d.facture.travaux || ""} onChange={(e) => app.touch((x) => { x.facture.travaux = e.target.value; return x; })} /></label>
              <label>Échéance de paiement<input type="date" value={d.facture.echeance || ""} onChange={(e) => app.touch((x) => { x.facture.echeance = e.target.value; return x; })} /></label>
              <label>Acompte déjà versé (TTC)<input inputMode="decimal" placeholder="0,00" value={d.facture.acompteVerse || ""} onChange={(e) => app.touch((x) => { x.facture.acompteVerse = e.target.value; return x; })} /></label>
              <label>Paiement
                <select value={d.facture.payee || "non"} onChange={(e) => app.touch((x) => { x.facture.payee = e.target.value; return x; })}>
                  <option value="non">À encaisser</option>
                  <option value="oui">Payée</option>
                </select>
              </label>
            </div>
            <div className="margebox">
              <div><span>Total TTC</span><span>{eur(t.ttc)}</span></div>
              {num(d.facture.acompteVerse) ? <div><span>Acompte déjà versé</span><span>-{eur(num(d.facture.acompteVerse))}</span></div> : null}
              <div><span><b>Net à payer</b></span><span><b>{eur(t.ttc - num(d.facture.acompteVerse))}</b></span></div>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn" type="button" onClick={() => app.preview(d, "facture")}>Aperçu de la facture</button>
              <button className="btn primary" type="button" onClick={() => app.exportCurrent("facture")}>Télécharger la facture</button>
            </div>
          </>
        )}
      </div>

      <div className="actions">
        <button className="btn" type="button" onClick={() => app.newDevis(d.categorie)}>Nouveau devis</button>
      </div>
    </section>
  );
}
