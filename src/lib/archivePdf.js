import { loadPdf } from "./images.js";
import { blankLine, lineHT } from "./calc.js";

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
  // Chercher différents formats de numéros de devis
  const patterns = [
    /\b(?:devis|quote)\s*n\s*[°ºo.]\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{1,})/i,
    /\bn\s*[°ºo.]\s*[:#-]?\s*(D[-_/]\d{4}[-_/]\d{3,})/i,
    /\bdevis\s*[:#-]?\s*([A-Z0-9]+-\d{4}-\d{3,})/i,
    /\bnumero\s*(?:de\s*)?devis\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]+)/i,
    /\b(D-\d{4}-\d{3,})\b/i
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  
  return "";
}

function extractTotals(lines) {
  const amountAfter = (pattern, excluded = null) => lines
    .filter((line) => pattern.test(line) && (!excluded || !excluded.test(line)))
    .reverse()
    .map((line) => money(line.replace(/^.*?\b(?:ht|ttc)\b/i, "")))
    .find(Boolean) || "";
  const ht = amountAfter(/\btotal\s*(?:g[ée]n[ée]ral\s*)?ht\b/i, /\bbrut\b/i);
  const ttc = amountAfter(/\btotal\s*(?:g[ée]n[ée]ral\s*)?ttc\b/i);
  const rates = [...new Set([...lines.join(" ").matchAll(/\b(?:TVA\s*)?(\d{1,2}(?:[,.]\d+)?)\s*%/gi)].map((match) => match[1].replace(",", ".")))];
  const tva = rates.length === 1 && ["0", "5.5", "10", "20"].includes(rates[0]) ? rates[0] : "";
  return { ht, ttc, tva };
}

function normalizeText(text) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();
}

function extractTableRows(items) {
  const rows = [];
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2.5);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform[4], text });
  }
  rows.sort((a, b) => b.y - a.y);

  const tableRows = [];
  let columns = null;
  for (const row of rows) {
    const text = normalizeText(row.parts.map((part) => part.text).join(" "));
    if (/\bdesignation\b/.test(text) && /\b(?:qte|quantite)\b/.test(text) && /\b(?:pu|prix unitaire)\b/.test(text)) {
      const aliases = [
        ["designation", /\bdesignation\b/],
        ["qte", /\bqte\b|quantite/],
        ["unite", /\bunite\b/],
        ["pu", /\bpu\b|prix unitaire/],
        ["remise", /\bremise\b/],
        ["tva", /\btva\b/],
        ["ht", /total ht/],
        ["ttc", /total ttc/]
      ];
      const found = aliases.map(([key, regex]) => {
        const part = row.parts.find((candidate) => regex.test(normalizeText(candidate.text)));
        return part ? { key, x: part.x } : null;
      }).filter(Boolean).sort((a, b) => a.x - b.x);
      if (found.some((entry) => entry.key === "designation") && found.some((entry) => entry.key === "qte") && found.some((entry) => entry.key === "pu")) {
        columns = found;
        continue;
      }
    }
    if (!columns) continue;
    if (/\btotal(?: general)? ht\b|\btotal ttc\b|\bconditions generales\b|\bmodalites de paiement\b/.test(text)) {
      columns = null;
      continue;
    }

    const cells = Object.fromEntries(columns.map(({ key }) => [key, []]));
    for (const part of row.parts) {
      let columnIndex = columns.findIndex((column, i) => i < columns.length - 1 && part.x < (column.x + columns[i + 1].x) / 2);
      if (columnIndex < 0) columnIndex = columns.length - 1;
      cells[columns[columnIndex].key].push(part.text);
    }
    const cell = (key) => (cells[key] || []).join(" ").replace(/\s+/g, " ").trim();
    const quantity = cell("qte").replace(",", ".");
    const unit = cell("unite").toLowerCase() || "u";
    const pu = money(cell("pu"));
    const designation = cell("designation");
    const isDataRow = /^\d+(?:\.\d+)?$/.test(quantity) && Boolean(unit) && Boolean(pu);
    if (!isDataRow) {
      if (designation && !/\b(d[eé]vis|client|total|acompte)\b/i.test(designation)) {
        tableRows.push({ y: row.y, designation });
      }
      continue;
    }
    const tvaText = cell("tva").replace("%", "").replace(",", ".");
    const taux = ["0", "5.5", "10", "20"].includes(tvaText) ? tvaText : "20";
    tableRows.push({
      y: row.y,
      line: {
        ...blankLine(Number(taux)),
        designation,
        qte: quantity,
        unite: ["u", "h", "forfait", "m", "ml", "kg", "lot"].includes(unit) ? unit : "u",
        pu,
        remise: cell("remise").includes("%") ? cell("remise").replace(/[^\d,.]/g, "").replace(",", ".") : "0",
        tva: Number(taux)
      }
    });
  }

  const dataRows = tableRows.filter((row) => row.line);
  for (const row of tableRows) {
    if (row.line || !dataRows.length) continue;
    const nearest = dataRows.reduce((best, candidate) =>
      Math.abs(candidate.y - row.y) < Math.abs(best.y - row.y) ? candidate : best
    );
    nearest.designationParts ||= [];
    nearest.designationParts.push({ y: row.y, text: row.designation });
  }
  return dataRows.map(({ line, y, designationParts = [] }) => {
    const parts = [
      ...(line.designation ? [{ y, text: line.designation }] : []),
      ...designationParts
    ].sort((a, b) => b.y - a.y).map((part) => part.text);
    line.designation = parts[0] || "Ligne de devis";
    line.description = parts.slice(1).join(" ");
    return line;
  });
}

function extractClient(lines) {
  // Chercher la section client dans tout le document, pas seulement à gauche
  const heading = lines.findIndex((line) => /\bclient\s+(particulier|professionnel|pro)\b/i.test(line));
  if (heading < 0) {
    // Essayer de trouver un bloc client sans label explicite
    // Chercher email, téléphone, SIRET comme indices
    const emailLine = lines.findIndex((line) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line));
    const siretLine = lines.findIndex((line) => /\b(?:SIRET|TVA)\b.*\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/i.test(line));
    const start = Math.min(
      emailLine >= 0 ? emailLine : Infinity,
      siretLine >= 0 ? siretLine : Infinity
    );
    
    if (start < Infinity) {
      // Récupérer 5 lignes avant pour capturer nom/adresse
      const begin = Math.max(0, start - 5);
      const block = lines.slice(begin, start + 3);
      
      const email = block.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
      const tel = block.join(" ").match(/(?:\+?\d[\d\s()./-]{7,}\d)/)?.[0]?.trim() || "";
      const siret = block.join(" ").match(/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/)?.[0] || "";
      const postalCity = block.find((line) => /\b\d{5}\s+\D/.test(line)) || "";
      const postalMatch = /\b(\d{5})\s+(.+)$/.exec(postalCity);
      
      return {
        type: "particulier",
        societe: "",
        nom: "",
        adresse: "",
        cp: postalMatch?.[1] || "",
        ville: postalMatch?.[2]?.trim() || "",
        tel,
        email,
        siret
      };
    }
    
    return { type: "particulier", societe: "", nom: "", adresse: "", cp: "", ville: "", tel: "", email: "", siret: "" };
  }
  
  const isPro = heading >= 0 && /\b(?:professionnel|pro)\b/i.test(lines[heading]);
  const block = [];
  for (const line of lines.slice(heading + 1)) {
    // Ignorer les lignes qui sont clairement de l'entreprise émettrice (Viviworks)
    if (/\bviviworks\b/i.test(line)) continue;
    if (/^(?:objet|lieu d'intervention|d[ée]signation|qt[ée]|total ht)\b/i.test(line)) break;
    if (block.length >= 10) break;
    block.push(line);
  }
  
  const email = block.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const tel = block.join(" ").match(/(?:\+?\d[\d\s()./-]{7,}\d)/)?.[0]?.trim() || "";
  const siret = block.join(" ").match(/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/)?.[0] || "";
  const postalCity = block.find((line) => /\b\d{5}\s+\D/.test(line)) || "";
  const postalMatch = /\b(\d{5})\s+(.+)$/.exec(postalCity);
  const clean = block.filter((line) =>
    !/@/.test(line) &&
    !/\b(?:t[ée]l|siret|TVA)\b/i.test(line) &&
    !/^\d{4,5}\s+\D/.test(line) &&
    !/\bviviworks\b/i.test(line)
  );
  const secondLineIsAddress = isPro && /^(?:\d+\s+)?(?:rue|r\.|avenue|av\.?|boulevard|bd\.?|impasse|chemin|route|place|all[ée]e|quai|cours|passage|résidence|residence)\b/i.test(clean[1] || "");
  const societe = isPro ? clean[0] || "" : "";
  const nom = isPro ? (secondLineIsAddress ? "" : clean[1] || "") : clean[0] || "";
  const adresseClient = clean.slice(isPro ? (secondLineIsAddress ? 1 : 2) : 1).join(" ");
  const address = labeled(block, "adresse|address");
  return {
    type: isPro ? "professionnel" : "particulier",
    societe,
    nom,
    adresse: address || adresseClient,
    cp: postalMatch?.[1] || "",
    ville: postalMatch?.[2]?.trim() || "",
    tel,
    email,
    siret
  };
}

function extractObject(items, lines) {
  const rows = [];
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform[4], text });
  }
  rows.sort((a, b) => b.y - a.y);
  for (let i = 0; i < rows.length; i++) {
    const parts = rows[i].parts.sort((a, b) => a.x - b.x);
    const labelIndex = parts.findIndex((part) => /^objet(?: du devis)?\s*[:#-]?$/i.test(part.text));
    if (labelIndex < 0) continue;
    const label = parts[labelIndex];
    const inline = /^objet(?: du devis)?\s*[:#-]\s*(.+)$/i.exec(label.text)?.[1];
    if (inline) return inline.trim();
    const sameRow = parts.filter((part) => part.x > label.x + 4).map((part) => part.text);
    if (sameRow.length) return sameRow.join(" ").trim();
    const next = rows[i + 1]?.parts
      .filter((part) => part.x >= label.x - 4)
      .map((part) => part.text) || [];
    if (next.length) return next.join(" ").trim();
  }
  return labeled(lines, "objet|objet du devis|nature des travaux|description des travaux");
}

export async function extractArchivePdf(file) {
  const pdf = await loadPdf(new Uint8Array(await file.arrayBuffer()));
  const allLines = [];
  const allItems = [];
  const tablePages = [];
  const pages = Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  
  console.log("=== DÉBUT EXTRACTION PDF ===");
  console.log(`Nombre de pages: ${pdf.numPages}`);
  
  for (const pageNum of pages) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const width = page.getViewport({ scale: 1 }).width;
    const pageLines = linesFrom(content.items, width);
    allLines.push(...pageLines);
    allItems.push(...content.items);
    tablePages.push(content.items);
    
    console.log(`Page ${pageNum}: ${pageLines.length} lignes extraites`);
    if (pageNum === 1) {
      console.log("Premières lignes de la page 1:", pageLines.slice(0, 15));
    }
  }
  
  const allText = allLines.join("\n");
  console.log("Texte total extrait (500 premiers caractères):", allText.substring(0, 500));
  
  // Extraction des informations - utiliser allLines au lieu de leftLines
  const totals = extractTotals(allLines);
  console.log("Totaux extraits:", totals);
  
  const client = extractClient(allLines);
  console.log("Client extrait:", client);
  
  const inferredTva = totals.tva || (totals.ht && totals.ttc
    ? ["20", "10", "5.5", "0"].find((rate) => Math.abs(Number(totals.ht) * (1 + Number(rate) / 100) - Number(totals.ttc)) < 0.03) || "20"
    : "20");
  console.log("TVA déduite:", inferredTva);
  
  const object = extractObject(tablePages[0] || [], allLines);
  console.log("Objet extrait:", object);
  
  const dateLine = allLines.find((line) => /\bdate\b/i.test(line)) || "";
  const extractedDate = isoDate(dateLine) || isoDate(allText);
  console.log("Date ligne:", dateLine);
  console.log("Date extraite:", extractedDate);
  
  const categoryText = object || allLines.join(" ");
  const categorie = /\b(?:d[ée]pannage|r[ée]paration)\b/i.test(categoryText)
    ? "depannage"
    : /\bmaintenance\b/i.test(categoryText)
      ? "maintenance"
      : /\binstallation\b/i.test(categoryText)
        ? "installation"
        : "";
  console.log("Catégorie détectée:", categorie);
  
  const lignes = tablePages.flatMap((items) => extractTableRows(items));
  console.log(`Lignes de tableau extraites: ${lignes.length}`);
  lignes.forEach((ligne, i) => {
    console.log(`Ligne ${i + 1}:`, ligne);
  });
  
  const amountFromLines = lignes.reduce((total, line) => total + lineHT(line), 0);
  const montantHT = totals.ht || (totals.ttc
    ? (Number(totals.ttc) / (1 + Number(inferredTva) / 100)).toFixed(2)
    : amountFromLines ? amountFromLines.toFixed(2) : "");
  console.log("Montant HT final:", montantHT);
  
  const numeroExtracted = findNumber(allText);
  console.log("Numéro extrait:", numeroExtracted);
  
  const acompteText = allLines.find((line) => /\bacompte\b.*\d+(?:[,.]\d+)?\s*%/i.test(line)) || "";
  const acompte = /\bacompte\b.*?(\d+(?:[,.]\d+)?)\s*%/i.exec(acompteText)?.[1]?.replace(",", ".") || "";
  console.log("Acompte extrait:", acompte);
  
  const acompteIndex = allLines.indexOf(acompteText);
  const conditionsIndex = allLines.findIndex((line, index) => index > acompteIndex && /\bconditions generales\b|\bmodalites de paiement\b/.test(normalizeText(line)));
  const notes = acompteIndex >= 0 && conditionsIndex > acompteIndex
    ? allLines.slice(acompteIndex + 1, conditionsIndex).filter((line) => !/\b(?:total|net a payer)\b/i.test(line)).join("\n").trim()
    : "";
  
  const result = {
    numero: numeroExtracted,
    date: extractedDate,
    objet: object,
    montantHT,
    tva: inferredTva,
    acompte,
    notes,
    lignes,
    categorie,
    ...client,
    texteTrouve: allLines.length > 0
  };
  
  console.log("=== RÉSULTAT FINAL ===", result);
  console.log("=== FIN EXTRACTION PDF ===");
  
  return result;
}
