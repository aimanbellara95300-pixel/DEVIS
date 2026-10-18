import { useEffect, useState } from "react";
import { useApp } from "../context/AppState.jsx";

const FIELDS = [
  ["nom", "Raison sociale", "text", true],
  ["adresse", "Adresse", "text", true],
  ["ville", "Pays / ville", "text", false],
  ["numero", "N° d'immatriculation", "text", false],
  ["email", "E-mail", "email", false],
  ["tel", "Téléphone", "tel", false],
  ["signataire", "Signataire", "text", true]
];

export default function Reglages() {
  const app = useApp();
  const [form, setForm] = useState(app.settings);
  useEffect(() => setForm(app.settings), [app.settings]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="tab on">
      <div className="card">
        <h2>Entreprise</h2>
        <div className="grid">
          {FIELDS.map(([k, label, type, full]) => (
            <label key={k} className={full ? "full" : undefined}>{label}
              <input type={type} value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
          <label className="full">Logo (PNG ou JPG)
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const img = new Image();
              const url = URL.createObjectURL(f);
              img.onload = () => {
                const max = 600;
                const sc = Math.min(1, max / img.width);
                const c = document.createElement("canvas");
                c.width = Math.round(img.width * sc);
                c.height = Math.round(img.height * sc);
                const ctx = c.getContext("2d");
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                setForm((prev) => ({ ...prev, logo: c.toDataURL("image/jpeg", 0.9), logoW: c.width, logoH: c.height }));
                URL.revokeObjectURL(url);
              };
              img.src = url;
            }} />
          </label>
          {form.logo && (
            <div className="full">
              <img className="logo-prev" alt="Logo" src={form.logo} />
              <button className="btn ghost danger" type="button" onClick={() => setForm((f) => ({ ...f, logo: "", logoW: 0, logoH: 0 }))}>Retirer le logo</button>
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <h2>Paiement</h2>
        <div className="grid">
          <label className="full">Titulaire du compte<input value={form.titulaire ?? ""} onChange={(e) => set("titulaire", e.target.value)} /></label>
          <label className="full">IBAN<input value={form.iban ?? ""} onChange={(e) => set("iban", e.target.value)} /></label>
          <label>BIC<input value={form.bic ?? ""} onChange={(e) => set("bic", e.target.value)} /></label>
          <label>Acompte par défaut (%)<input type="number" min="0" max="100" value={form.acompte ?? 0} onChange={(e) => set("acompte", e.target.value)} /></label>
        </div>
      </div>
      <div className="card">
        <h2>Conditions</h2>
        <div className="grid">
          <label>Validité du devis (jours)<input type="number" min="1" value={form.validite ?? 30} onChange={(e) => set("validite", e.target.value)} /></label>
          <label>Garantie<input value={form.garantie ?? ""} onChange={(e) => set("garantie", e.target.value)} /></label>
          <label className="full">Médiateur de la consommation (obligatoire pour les particuliers)
            <input placeholder="Nom, adresse et site du médiateur" value={form.mediateur ?? ""} onChange={(e) => set("mediateur", e.target.value)} />
          </label>
          <label className="full">Conditions supplémentaires (une par ligne)
            <textarea value={form.conditions ?? ""} onChange={(e) => set("conditions", e.target.value)} />
          </label>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn primary" type="button" onClick={() => app.saveSettings({
            ...form,
            nom: String(form.nom || "").trim(),
            adresse: String(form.adresse || "").trim(),
            ville: String(form.ville || "").trim(),
            numero: String(form.numero || "").trim(),
            email: String(form.email || "").trim(),
            tel: String(form.tel || "").trim(),
            signataire: String(form.signataire || "").trim(),
            titulaire: String(form.titulaire || "").trim(),
            iban: String(form.iban || "").trim(),
            bic: String(form.bic || "").trim(),
            garantie: String(form.garantie || "").trim(),
            mediateur: String(form.mediateur || "").trim(),
            conditions: String(form.conditions || "").trim()
          })}>Enregistrer les réglages</button>
        </div>
      </div>
    </section>
  );
}
