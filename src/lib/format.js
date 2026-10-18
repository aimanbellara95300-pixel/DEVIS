export const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const eur = (n) => {
  const neg = n < 0;
  const s = (Math.abs(Math.round(n * 100) / 100)).toFixed(2);
  const [i, d] = s.split(".");
  return (neg ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + d + " €";
};

export const pct = (n) => String(n).replace(".", ",") + " %";

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const today = () => new Date().toISOString().slice(0, 10);

export const frDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const addDays = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const hhmm = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
