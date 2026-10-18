import { useState } from "react";
import { useApp } from "../context/AppState.jsx";

export default function Fiches() {
  const app = useApp();
  const [marque, setMarque] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const brands = [...new Set(app.fiches.map((f) => f.marque))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <section className="tab on">
      <div className="card">
        <h2>Ajouter des fiches PDF</h2>
        <div className="grid">
          <label>Marque
            <input list="marquesList" placeholder="Daikin, Mitsubishi, Atlantic…" value={marque} onChange={(e) => setMarque(e.target.value)} />
          </label>
          <label>Fichiers PDF
            <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => setFiles([...e.target.files])} />
          </label>
        </div>
        <datalist id="marquesList">{brands.map((b) => <option key={b} value={b} />)}</datalist>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn primary" type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            await app.addFiches(marque.trim(), files);
            setFiles([]);
            setBusy(false);
          }}>Ajouter à la bibliothèque</button>
        </div>
      </div>
      <div className="card">
        <h2>Bibliothèque</h2>
        <div className="list">
          {!app.fiches.length && <p className="empty">Aucune fiche. Choisis une marque et ajoute ses PDF (fiches techniques, notices, garanties).</p>}
          {brands.map((b) => (
            <div key={b}>
              <h3>{b}</h3>
              {app.fiches.filter((f) => f.marque === b).map((f) => (
                <div className="item" key={f.id}>
                  <div>{f.nom}<div className="meta">{(f.taille / 1048576).toFixed(1).replace(".", ",")} Mo</div></div>
                  <button className="btn ghost danger" type="button" onClick={() => app.delFiche(f.id)}>Supprimer</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
