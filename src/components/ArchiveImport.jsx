import { useRef, useState } from "react";
import { CATS, STATUTS } from "../lib/constants.js";
import { blankLine, nextNumber } from "../lib/calc.js";
import { today } from "../lib/format.js";
import { extractArchivePdf } from "../lib/archivePdf.js";
import { useApp } from "../context/AppState.jsx";

function emptyValues(app) {
  return {
    numero: nextNumber(app.devisList),
    numeroOriginal: "",
    date: today(),
    categorie: app.suiviCat || "installation",
    statut: "en_cours",
    type: "particulier",
    nom: "",
    societe: "",
    siret: "",
    adresse: "",
    cp: "",
    ville: "",
    tel: "",
    email: "",
    objet: "",
    notes: "",
    montantHT: "",
    tva: "20",
    acompte: "",
    lignes: []
  };
}

export default function ArchiveImport({ onClose }) {
  const app = useApp();
  const [values, setValues] = useState(() => emptyValues(app));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [readMessage, setReadMessage] = useState("");
  const readId = useRef(0);
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const setLine = (index, key, value) => setValues((current) => ({
    ...current,
    lignes: current.lignes.map((line, i) => i === index ? { ...line, [key]: value } : line)
  }));
  const selectPdf = async (selected) => {
    const id = ++readId.current;
    setFile(selected);
    setReadMessage("");
    if (!selected) {
      setReading(false);
      setValues(emptyValues(app));
      return;
    }
    const defaults = emptyValues(app);
    setValues(defaults);
    setReading(true);
    try {
      const extracted = await extractArchivePdf(selected);
      if (id !== readId.current) return;
      const numberAlreadyUsed = Boolean(extracted.numero) && app.devisList.some(
        (devis) => String(devis.numero).trim().toLowerCase() === extracted.numero.trim().toLowerCase()
      );
      const suggestedNumber = numberAlreadyUsed ? nextNumber(app.devisList) : extracted.numero;
      setValues(() => {
        const next = { ...defaults };
        for (const key of ["date", "objet", "notes", "montantHT", "nom", "societe", "siret", "adresse", "cp", "ville", "tel", "email"]) {
          if (extracted[key]) next[key] = extracted[key];
        }
        if (extracted.numero) {
          next.numero = suggestedNumber;
          next.numeroOriginal = extracted.numero;
        }
        if (extracted.tva) next.tva = extracted.tva;
        if (extracted.type) next.type = extracted.type;
        if (extracted.categorie) next.categorie = extracted.categorie;
        if (extracted.acompte) next.acompte = extracted.acompte;
        if (extracted.lignes?.length) next.lignes = extracted.lignes;
        return next;
      });
      setReadMessage(extracted.texteTrouve
        ? `${extracted.lignes?.length || 0} ligne(s) extraite(s). Vérifie les informations détectées avant l’enregistrement. Le statut initial est « En cours ».${numberAlreadyUsed ? ` Le numéro ${extracted.numero} existe déjà : ${suggestedNumber} a été proposé. Le PDF original reste inchangé.` : ""}`
        : "Aucun texte détecté dans ce PDF. Il est probablement scanné : complète les champs manuellement. Le statut initial est « En cours ».");
    } catch (e) {
      console.error(e);
      if (id === readId.current) setReadMessage("Lecture impossible pour ce PDF. Tu peux renseigner les champs manuellement.");
    } finally {
      if (id === readId.current) setReading(false);
    }
  };

  return (
    <div className="card">
      <h2>Enregistrer un ancien devis</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Sélectionne le PDF : les informations reconnues seront préremplies. Vérifie-les, complète ce qui manque, puis enregistre le devis et le client.
      </p>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!file || busy) return;
        setBusy(true);
        const saved = await app.importArchive(values, file);
        setBusy(false);
        if (saved) onClose();
      }}>
        <div className="grid">
          <label>PDF original
            <input type="file" accept="application/pdf,.pdf" required onChange={(e) => selectPdf(e.target.files?.[0] || null)} />
          </label>
          <label>Numéro du devis
            <input required value={values.numero} onChange={(e) => set("numero", e.target.value)} />
            {values.numeroOriginal && values.numeroOriginal !== values.numero && (
              <span className="muted">Numéro indiqué sur le PDF original : {values.numeroOriginal}</span>
            )}
          </label>
          <label>Date du devis
            <input type="date" required value={values.date} onChange={(e) => set("date", e.target.value)} />
          </label>
          <label>Catégorie
            <select value={values.categorie} onChange={(e) => set("categorie", e.target.value)}>
              {Object.entries(CATS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Statut
            <select value={values.statut} onChange={(e) => set("statut", e.target.value)}>
              {Object.entries(STATUTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Type de client
            <select value={values.type} onChange={(e) => set("type", e.target.value)}>
              <option value="particulier">Particulier</option>
              <option value="professionnel">Professionnel</option>
            </select>
          </label>
          {values.type === "professionnel" && (
            <>
              <label>Société
                <input required value={values.societe} onChange={(e) => set("societe", e.target.value)} />
              </label>
              <label>SIRET / N° TVA
                <input value={values.siret} onChange={(e) => set("siret", e.target.value)} />
              </label>
            </>
          )}
          <label>Nom du client
            <input required={values.type === "particulier"} value={values.nom} onChange={(e) => set("nom", e.target.value)} />
          </label>
          <label>Adresse
            <input value={values.adresse} onChange={(e) => set("adresse", e.target.value)} />
          </label>
          <label>Code postal
            <input value={values.cp} onChange={(e) => set("cp", e.target.value)} />
          </label>
          <label>Ville
            <input value={values.ville} onChange={(e) => set("ville", e.target.value)} />
          </label>
          <label>Téléphone
            <input type="tel" value={values.tel} onChange={(e) => set("tel", e.target.value)} />
          </label>
          <label>E-mail
            <input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
          </label>
          <label className="full">Objet du devis
            <input value={values.objet} onChange={(e) => set("objet", e.target.value)} />
          </label>
          <label className="full">Notes du devis
            <textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} />
          </label>
          <label>Montant total HT
            <input required inputMode="decimal" placeholder="0,00" value={values.montantHT} onChange={(e) => set("montantHT", e.target.value)} />
          </label>
          <label>Taux de TVA
            <select value={values.tva} onChange={(e) => set("tva", e.target.value)}>
              <option value="20">20 %</option>
              <option value="10">10 %</option>
              <option value="5.5">5,5 %</option>
              <option value="0">0 %</option>
            </select>
          </label>
          <label>Acompte prévu (%)
            <input inputMode="decimal" value={values.acompte} onChange={(e) => set("acompte", e.target.value)} />
          </label>
        </div>
        {values.lignes.length > 0 && (
          <div className="card" style={{ margin: "14px 0 0", padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Lignes extraites du devis</h3>
            <div className="list">
              {values.lignes.map((line, index) => (
                <div key={line.id || index} className="line">
                  <label>Désignation
                    <input value={line.designation} onChange={(e) => setLine(index, "designation", e.target.value)} />
                  </label>
                  {line.description && <label>Description
                    <input value={line.description} onChange={(e) => setLine(index, "description", e.target.value)} />
                  </label>}
                  <div className="grid" style={{ marginTop: 8 }}>
                    <label>Quantité<input inputMode="decimal" value={line.qte} onChange={(e) => setLine(index, "qte", e.target.value)} /></label>
                    <label>Unité<input value={line.unite} onChange={(e) => setLine(index, "unite", e.target.value)} /></label>
                    <label>Prix unitaire HT<input inputMode="decimal" value={line.pu} onChange={(e) => setLine(index, "pu", e.target.value)} /></label>
                    <label>Remise (%)<input inputMode="decimal" value={line.remise} onChange={(e) => setLine(index, "remise", e.target.value)} /></label>
                    <label>TVA (%)<input inputMode="decimal" value={line.tva} onChange={(e) => setLine(index, "tva", e.target.value)} /></label>
                  </div>
                  <button className="btn ghost danger" type="button" onClick={() => setValues((current) => ({
                    ...current,
                    lignes: current.lignes.filter((_, i) => i !== index)
                  }))}>Retirer la ligne</button>
                </div>
              ))}
            </div>
            <button className="btn" type="button" onClick={() => setValues((current) => ({
              ...current,
              lignes: [...current.lignes, blankLine(Number(current.tva) || 20)]
            }))}>Ajouter une ligne</button>
          </div>
        )}
        {reading && <p className="muted" role="status">Lecture des informations du PDF…</p>}
        {!reading && readMessage && <p className="muted" role="status">{readMessage}</p>}
        <p className="muted">PDF limité à 20 Mo. Le document est conservé dans l’espace privé de l’application.</p>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy || reading || !file}>{busy ? "Enregistrement…" : "Enregistrer le devis et le client"}</button>
          <button className="btn" type="button" disabled={busy || reading} onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}
