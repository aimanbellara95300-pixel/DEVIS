import { num, today, uid, addDays } from "./format.js";

export function blankLine(tva = 20) {
  return {
    id: uid(),
    designation: "",
    description: "",
    qte: 1,
    unite: "u",
    pu: 0,
    remise: 0,
    tva,
    achat: "",
    achatMode: "TTC",
    achatTva: 20,
    marge: 0
  };
}

export const achatHT = (l) => {
  const a = num(l.achat);
  return l.achatMode === "TTC" ? a / (1 + num(l.achatTva ?? 20) / 100) : a;
};

export function applyMarge(l) {
  if (num(l.achat) > 0) l.pu = (Math.round(achatHT(l) * (1 + num(l.marge) / 100) * 100) / 100).toFixed(2);
}

export const lineHT = (l) => num(l.qte) * num(l.pu) * (1 - num(l.remise) / 100);
export const lineMarge = (l) => (num(l.achat) > 0 ? lineHT(l) - achatHT(l) * num(l.qte) : 0);

export function compute(d) {
  let brut = 0;
  let remise = 0;
  const tvaMap = {};
  (d.lignes || []).forEach((l) => {
    const b = num(l.qte) * num(l.pu);
    const r = (b * num(l.remise)) / 100;
    const ht = b - r;
    brut += b;
    remise += r;
    const k = String(num(l.tva));
    tvaMap[k] = (tvaMap[k] || 0) + ht;
  });
  const ht = brut - remise;
  const tvas = Object.keys(tvaMap)
    .sort((a, b) => b - a)
    .map((k) => ({ taux: num(k), base: tvaMap[k], montant: (tvaMap[k] * num(k)) / 100 }));
  const tva = tvas.reduce((a, t) => a + t.montant, 0);
  const ttc = ht + tva;
  return { brut, remise, ht, tvas, tva, ttc, acompte: (ttc * num(d.acompte)) / 100 };
}

export const expHT = (x) => num(x.ht) || (num(x.ttc) ? num(x.ttc) - num(x.tva) : 0);

export function realMargin(d) {
  const t = compute(d);
  const dep = (d.depenses || []).reduce((a, x) => a + expHT(x), 0);
  const marge = t.ht - dep;
  return { ht: t.ht, dep, marge, taux: t.ht ? (marge / t.ht) * 100 : 0 };
}

export function norm(d) {
  d.categorie = d.categorie || "installation";
  d.statut = d.statut || "en_cours";
  d.depenses = Array.isArray(d.depenses) ? d.depenses : [];
  d.fiches = Array.isArray(d.fiches) ? d.fiches : [];
  d.lignes = Array.isArray(d.lignes) && d.lignes.length ? d.lignes : [blankLine(d.tvaDef ?? 20)];
  d.tvaDef = d.tvaDef ?? 20;
  d.client = d.client || { societe: "", nom: "", adresse: "", cp: "", ville: "", tel: "", email: "", siret: "", lieu: "" };
  return d;
}

export function nextNumber(devisList) {
  const y = new Date().getFullYear();
  const pre = `D-${y}-`;
  const max = devisList
    .map((d) => d.numero || "")
    .filter((n) => n.startsWith(pre))
    .map((n) => parseInt(n.slice(pre.length), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return pre + String(max + 1).padStart(3, "0");
}

export function nextFactureNumber(devisList) {
  const y = new Date().getFullYear();
  const pre = `F-${y}-`;
  const max = devisList
    .map((d) => d.facture?.numero || "")
    .filter((n) => n.startsWith(pre))
    .map((n) => parseInt(n.slice(pre.length), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return pre + String(max + 1).padStart(3, "0");
}

export function ensureFacture(d, devisList) {
  if (d.statut !== "accepte" || d.facture) return false;
  const dt = today();
  d.facture = {
    numero: nextFactureNumber(devisList.concat(d.facture ? [] : [d])),
    date: dt,
    travaux: "",
    echeance: addDays(dt, 30),
    acompteVerse: "",
    payee: "non"
  };
  return true;
}

export function hasContent(cur) {
  return !!(
    cur &&
    (cur.client?.nom || cur.client?.societe || cur.objet || cur.lignes?.some((l) => l.designation || num(l.pu)) || cur.depenses?.length)
  );
}

export const clientNom = (d) =>
  (d.type === "professionnel" && d.client?.societe ? d.client.societe : d.client?.nom) || "Sans nom";

export const cliName = (c) => (c.type === "professionnel" && c.societe ? c.societe : c.nom) || "Sans nom";

export const keyOf = (c) =>
  c.email
    ? "m:" + c.email.toLowerCase().trim()
    : "n:" + [c.type === "professionnel" && c.societe ? c.societe : c.nom, c.cp].join("|").toLowerCase().replace(/\s+/g, " ").trim();

export function fileName(d, mode) {
  const nom =
    (d.type === "professionnel" && d.client.societe ? d.client.societe : d.client.nom)
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_|_$/g, "") || "client";
  return mode === "facture" ? `Facture_${d.facture.numero}_${nom}.pdf` : `Devis_${d.numero}_${nom}.pdf`;
}

export function buyInfo(l) {
  if (!(num(l.achat) > 0)) return "Saisis le prix fournisseur puis choisis ta marge : le prix de vente se calcule tout seul.";
  return null;
}
