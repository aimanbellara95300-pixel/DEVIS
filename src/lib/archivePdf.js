import { loadPdf } from "./images.js";

function linesFrom(items, maxX) {
  const rows = [];
  for (const item of items) {
    const text = item.str?.trim();
    if (!text || item.transform[4] > maxX) continue;
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform[4], text });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function labeled(lines, labels) {
  const pattern = new RegExp(`^(?:${labels})\\s*[:#-]?\\s*(.*)$`, "i");
  for (let i = 0; i < lines.length; i++) {
    const match = pattern.exec(lines[i]);
    if (!match) continue;
    const sameLine = match[1].trim();
    if (sameLine) return sameLine;
    return lines[i + 1] || "";
  }
  return "";
}

function money(value) {
  const cleaned = value.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";
}

function isoDate(value) {
  const match = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(value);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(value);
  if (iso) return iso[0];
  const french = /(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(20\d{2})/i.exec(value);
  if (!french) return "";
  const month = french[2].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const months = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  return `${french[3]}-${String(months.indexOf(month) + 1).padStart(2, "0")}-${french[1].padStart(2, "0")}`;
}

function findNumber(text) {
  const match = /\b(?:devis|quote)\s*(?:n[°ºo.]|num(?:é|e)ro)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{1,})/i.exec(text)
    || /^\s*n[°ºo.]?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{1,})\s*$/im.exec(text);
  return match?.[1] || "";
}

function extractTotals(lines) {
  const htLine = lines.find((line) => /\btotal\s*(?:g[ée]n[ée]ral\s*)?ht\b/i.test(line) && !/\bbrut\b/i.test(line))
    || lines.find((line) => /\btotal\s*(?:g[ée]n[ée]ral\s*)?ht\b/i.test(line));
  const ttcLine = lines.find((line) => /\btotal\s*(?:g[ée]n[ée]ral\s*)?ttc\b/i.test(line));
  const ht = htLine ? money(htLine.replace(/^.*?\bht\b/i, "")) : "";
  const ttc = ttcLine ? money(ttcLine.replace(/^.*?\bttc\b/i, "")) : "";
  const rates = [...new Set([...lines.join(" ").matchAll(/\b(?:TVA\s*)?(\d{1,2}(?:[,.]\d+)?)\s*%/gi)].map((match) => match[1].replace(",", ".")))];
  const tva = rates.length === 1 && ["0", "5.5", "10", "20"].includes(rates[0]) ? rates[0] : "";
  return { ht, ttc, tva };
}

function extractClient(lines) {
  const heading = lines.findIndex((line) => /\bclient\s+(particulier|professionnel|pro)\b/i.test(line));
  const isPro = heading >= 0 && /\b(?:professionnel|pro)\b/i.test(lines[heading]);
  const block = heading >= 0 ? lines.slice(heading + 1, heading + 10) : [];
  const email = lines.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const tel = lines.join(" ").match(/(?:\+?\d[\d\s()./-]{7,}\d)/)?.[0]?.trim() || "";
  const siret = lines.join(" ").match(/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/)?.[0] || "";
  const address = labeled(lines, "adresse|address");
  const postalCity = lines.find((line) => /\b\d{5}\s+\D/.test(line)) || "";
  const postalMatch = /\b(\d{5})\s+(.+)$/.exec(postalCity);
  let societe = labeled(lines, "soci[ée]t[ée]|entreprise|raison sociale|company");
  let nom = labeled(lines, "nom du client|contact|nom");
  let adresseClient = "";
  if (heading >= 0 && block.length) {
    const clean = block.filter((line) => !/@/.test(line) && !/\b(?:t[ée]l|siret|TVA)\b/i.test(line));
    if (isPro) {
      societe ||= clean[0] || "";
      nom ||= clean[1] || "";
      adresseClient = clean[2] || "";
    } else {
      nom ||= clean[0] || "";
      adresseClient = clean[1] || "";
    }
  }
  return {
    type: isPro || siret ? "professionnel" : "particulier",
    societe,
    nom,
    adresse: address || adresseClient,
    cp: labeled(lines, "code postal|cp") || postalMatch?.[1] || "",
    ville: labeled(lines, "ville|city") || postalMatch?.[2]?.trim() || "",
    tel: labeled(lines, "t[ée]l[ée]phone|t[ée]l\\.?|phone") || tel,
    email: labeled(lines, "e-?mail|courriel") || email,
    siret: labeled(lines, "siret|n[°o] ?tva|tva intracommunautaire") || siret
  };
}

export async function extractArchivePdf(file) {
  const pdf = await loadPdf(new Uint8Array(await file.arrayBuffer()));
  const allLines = [];
  const leftLines = [];
  const pages = [...new Set([1, 2, pdf.numPages].filter((pageNum) => pageNum <= pdf.numPages))];
  for (const pageNum of pages) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const width = page.getViewport({ scale: 1 }).width;
    allLines.push(...linesFrom(content.items, width));
    leftLines.push(...linesFrom(content.items, width * 0.62));
  }
  const allText = allLines.join("\n");
  const totals = extractTotals(allLines);
  const client = extractClient(leftLines);
  const inferredTva = totals.tva || (totals.ht && totals.ttc
    ? ["20", "10", "5.5", "0"].find((rate) => Math.abs(Number(totals.ht) * (1 + Number(rate) / 100) - Number(totals.ttc)) < 0.03) || "20"
    : "20");
  const object = labeled(allLines, "objet|objet du devis|nature des travaux|description des travaux");
  const dateLine = allLines.find((line) => /\bdate\b/i.test(line)) || "";
  const categoryText = object || allLines.join(" ");
  const categorie = /\b(?:d[ée]pannage|r[ée]paration)\b/i.test(categoryText)
    ? "depannage"
    : /\bmaintenance\b/i.test(categoryText)
      ? "maintenance"
      : /\binstallation\b/i.test(categoryText)
        ? "installation"
        : "";
  const montantHT = totals.ht || (totals.ttc
    ? (Number(totals.ttc) / (1 + Number(inferredTva) / 100)).toFixed(2)
    : "");
  return {
    numero: findNumber(allText),
    date: isoDate(dateLine) || isoDate(allText),
    objet: object,
    montantHT,
    tva: inferredTva,
    categorie,
    ...client,
    texteTrouve: allLines.length > 0
  };
}
