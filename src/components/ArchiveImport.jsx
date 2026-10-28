import { useRef, useState } from "react";
import { CATS, STATUTS } from "../lib/constants.js";
import { nextNumber } from "../lib/calc.js";
import { today } from "../lib/format.js";
import { extractArchivePdf } from "../lib/archivePdf.js";
import { useApp } from "../context/AppState.jsx";

export default function ArchiveImport({ onClose }) {
  const app = useApp();
  const [values, setValues] = useState({
    numero: nextNumber(app.devisList),
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
    montantHT: "",
    tva: "20"
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [readMessage, setReadMessage] = useState("");
  const readId = useRef(0);
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const selectPdf = async (selected) => {
    const id = ++readId.current;
    setFile(selected);
    setReadMessage("");
    if (!selected) return;
    setReading(true);
    try {
      const extracted = await extractArchivePdf(selected);
      if (id !== readId.current) return;
      setValues((current) => {
        const next = { ...current };
        for (const key of ["numero", "date", "objet", "montantHT", "nom", "societe", "siret", "adresse", "cp", "ville", "tel", "email"]) {
          if (extracted[key]) next[key] = extracted[key];
        }
        if (extracted.tva) next.tva = extracted.tva;
        if (extracted.type) next.type = extracted.type;
        if (extracted.categorie) next.categorie = extracted.categorie;
        return next;
      });
      setReadMessage(extracted.texteTrouve
        ? "Informations détectées automatiquement. Vérifie-les avant l’enregistrement ; le statut reste à confirmer."
        : "Aucun texte détecté dans ce PDF. Il est probablement scanné : complète les champs manuellement.");
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
        </div>
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
