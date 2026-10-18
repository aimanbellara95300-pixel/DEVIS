import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
import { addDays, eur, frDate, num, pct } from "./format.js";
import { compute } from "./calc.js";

const INK = [24, 35, 46];
const GREY = [96, 110, 124];

const hexRgb = (hx) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hx || "");
  if (!m) return [31, 95, 168];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

export function buildPdf(d, s, mode) {
  const BLUE = hexRgb(d.couleur || s.couleur || "#1F5FA8");
  const LIGHT = BLUE.map((c) => Math.round(c * 0.12 + 255 * 0.88));
  const ON = lum(BLUE) > 0.62 ? [24, 35, 46] : [255, 255, 255];
  const ACC = lum(BLUE) > 0.62 ? BLUE.map((c) => Math.round(c * 0.6)) : BLUE;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 15;
  const CW = W - 2 * M;
  const part = d.type === "particulier";
  const t = compute(d);
  const inv = mode === "facture" && d.facture;
  const F = inv ? d.facture : null;
  const dejaVerse = inv ? num(F.acompteVerse) : 0;
  const need = (y, h) => {
    if (y + h > H - 20) {
      doc.addPage();
      return 18;
    }
    return y;
  };
  const txt = (str, x, y, o = {}) => {
    doc.setFont("helvetica", o.b ? "bold" : "normal");
    doc.setFontSize(o.size || 9);
    doc.setTextColor(...(o.c || INK));
    doc.text(String(str), x, y, o.align ? { align: o.align } : undefined);
  };

  let y = 15;
  if (s.logo && s.logoW) {
    const h = 18;
    const w = Math.min(55, (h * s.logoW) / s.logoH);
    try {
      doc.addImage(s.logo, "JPEG", M, y - 2, w, h);
    } catch {
      /* logo illisible */
    }
    y += 20;
  } else {
    txt(s.nom || "VIVIWORKS", M, y + 6, { b: 1, size: 20, c: ACC });
    y += 12;
  }
  [s.adresse, s.ville, s.numero, [s.email, s.tel].filter(Boolean).join("  |  ")].filter(Boolean).forEach((l) => {
    txt(l, M, y, { size: 8.5, c: GREY });
    y += 4;
  });
  txt(inv ? "FACTURE" : "DEVIS", W - M, 21, { b: 1, size: 24, c: ACC, align: "right" });
  txt(`N° ${inv ? F.numero : d.numero}`, W - M, 28, { b: 1, size: 10, align: "right" });
  if (inv) {
    txt(`Date : ${frDate(F.date)}`, W - M, 33, { size: 9, align: "right" });
    txt(`Échéance : ${frDate(F.echeance)}`, W - M, 38, { size: 9, align: "right" });
    txt(`Devis n° ${d.numero} du ${frDate(d.date)}`, W - M, 43, { size: 8.5, c: GREY, align: "right" });
    if (F.payee === "oui") {
      doc.setDrawColor(46, 125, 79);
      doc.setLineWidth(0.8);
      doc.roundedRect(W - M - 30, 47, 30, 10, 1.5, 1.5);
      txt("PAYÉE", W - M - 15, 53.8, { b: 1, size: 13, c: [46, 125, 79], align: "center" });
    }
  } else {
    txt(`Date : ${frDate(d.date)}`, W - M, 33, { size: 9, align: "right" });
    txt(`Valable jusqu'au : ${frDate(addDays(d.date, num(s.validite) || 30))}`, W - M, 38, { size: 9, align: "right" });
  }

  y = Math.max(y, 42) + 4;
  const c = d.client;
  const cl = [
    part ? null : c.societe,
    c.nom,
    c.adresse,
    [c.cp, c.ville].filter(Boolean).join(" "),
    c.tel ? "Tél. " + c.tel : null,
    c.email,
    !part && c.siret ? "SIRET / TVA : " + c.siret : null
  ].filter(Boolean);
  const boxH = 10 + cl.length * 4.4;
  const boxW = 92;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, boxW, boxH, 1.5, 1.5);
  txt(part ? "CLIENT PARTICULIER" : "CLIENT PROFESSIONNEL", M + 4, y + 5.5, { b: 1, size: 7.5, c: ACC });
  cl.forEach((l, i) => txt(l, M + 4, y + 10.5 + i * 4.4, { b: i === 0, size: 9 }));
  let ry = y + 5.5;
  const rx = M + boxW + 8;
  const rw = W - M - rx;
  if (d.objet) {
    txt("Objet", rx, ry, { b: 1, size: 7.5, c: ACC });
    ry += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const ol = doc.splitTextToSize(d.objet, rw);
    doc.setTextColor(...INK);
    doc.text(ol, rx, ry);
    ry += ol.length * 4 + 3;
  }
  if (c.lieu) {
    txt("Lieu d'intervention", rx, ry, { b: 1, size: 7.5, c: ACC });
    ry += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const ll = doc.splitTextToSize(c.lieu, rw);
    doc.text(ll, rx, ry);
    ry += ll.length * 4;
  }
  y = Math.max(y + boxH, ry) + 7;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 22 },
    head: [["Désignation", "Qté", "Unité", "PU HT", "Remise", "TVA", "Total HT", "Total TTC"]],
    body: d.lignes.map((l) => {
      const ht = num(l.qte) * num(l.pu) * (1 - num(l.remise) / 100);
      return [
        l.designation + (l.description ? "\n" + l.description : ""),
        String(num(l.qte)).replace(".", ","),
        l.unite,
        eur(num(l.pu)),
        num(l.remise) ? pct(num(l.remise)) : "-",
        pct(num(l.tva)),
        eur(ht),
        eur(ht * (1 + num(l.tva) / 100))
      ];
    }),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: INK, lineColor: [210, 220, 230], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: BLUE, textColor: ON, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 10 },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "right", cellWidth: 21 },
      4: { halign: "right", cellWidth: 14 },
      5: { halign: "right", cellWidth: 12 },
      6: { halign: "right", cellWidth: 22 },
      7: { halign: "right", cellWidth: 23 }
    }
  });
  y = doc.lastAutoTable.finalY + 6;

  const rows = [["Total HT brut", eur(t.brut)]];
  if (t.remise) rows.push(["Remise", "-" + eur(t.remise)]);
  rows.push(["Total HT", eur(t.ht)]);
  t.tvas.forEach((v) => rows.push([`TVA ${pct(v.taux)} (base ${eur(v.base)})`, eur(v.montant)]));
  const tw = 88;
  const tx = W - M - tw;
  y = need(y, rows.length * 6 + 22);
  rows.forEach(([a, b]) => {
    txt(a, tx, y, { size: 9, c: GREY });
    txt(b, W - M, y, { size: 9, align: "right" });
    y += 5.5;
  });
  doc.setFillColor(...BLUE);
  doc.rect(tx - 2, y - 3.5, tw + 2, 8, "F");
  txt("TOTAL TTC", tx, y + 1.8, { b: 1, size: 10.5, c: ON });
  txt(eur(t.ttc), W - M - 1, y + 1.8, { b: 1, size: 10.5, c: ON, align: "right" });
  y += 10;
  if (inv) {
    if (dejaVerse) {
      txt("Acompte déjà versé", tx, y, { size: 9, c: GREY });
      txt("-" + eur(dejaVerse), W - M, y, { size: 9, align: "right" });
      y += 6;
    }
    txt("NET À PAYER", tx, y, { b: 1, size: 10.5, c: ACC });
    txt(eur(t.ttc - dejaVerse), W - M, y, { b: 1, size: 10.5, c: ACC, align: "right" });
    y += 8;
  } else {
    txt(`Acompte ${pct(num(d.acompte))} à la commande`, tx, y, { size: 9, c: GREY });
    txt(eur(t.acompte), W - M, y, { b: 1, size: 9, align: "right" });
    y += 8;
  }

  if (d.notes && d.notes.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY);
    const nl = doc.splitTextToSize(d.notes.trim(), CW);
    y = need(y, nl.length * 4 + 4);
    doc.text(nl, M, y);
    y += nl.length * 4 + 4;
  }

  const ac = num(d.acompte);
  const solde = 100 - ac;
  const conds = (
    inv
      ? [
          `Facture établie suivant le devis n° ${d.numero} du ${frDate(d.date)}${F.travaux ? `, travaux réalisés le ${frDate(F.travaux)}` : ""}.`,
          `Paiement à régler au plus tard le ${frDate(F.echeance)} par virement : ${s.titulaire || s.nom}${s.iban ? " - IBAN " + s.iban : ""}${s.bic ? " - BIC " + s.bic : ""}. Merci d'indiquer le n° ${F.numero} en référence.`,
          "En cas de retard de paiement, des pénalités sont exigibles au taux de trois fois le taux d'intérêt légal. Pas d'escompte pour paiement anticipé.",
          part ? null : "Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 € (art. L441-10 du Code de commerce).",
          s.garantie ? `Garantie : ${s.garantie} à compter de la mise en service.` : null,
          part && s.mediateur ? `Médiation de la consommation : en cas de litige, le client peut recourir gratuitement au médiateur suivant : ${s.mediateur}.` : null
        ]
      : [
          `Devis valable ${num(s.validite) || 30} jours à compter de sa date d'émission.`,
          part
            ? `Règlement : acompte de ${pct(ac)} à la signature, exigible au plus tôt 7 jours après la signature du devis (art. L221-10 du Code de la consommation)${solde > 0 ? `, solde de ${pct(solde)} à la fin des travaux` : ""}.`
            : `Règlement : acompte de ${pct(ac)} à la commande${solde > 0 ? `, solde de ${pct(solde)} à la fin des travaux` : ""}.`,
          `Paiement par virement : ${s.titulaire || s.nom}${s.iban ? " - IBAN " + s.iban : ""}${s.bic ? " - BIC " + s.bic : ""}.`,
          s.garantie ? `Garantie : ${s.garantie} à compter de la mise en service.` : null,
          ...String(s.conditions || "")
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
          part
            ? "Droit de rétractation : le client dispose d'un délai de 14 jours à compter de la signature du présent devis pour se rétracter, sans motif ni pénalité (art. L221-18 du Code de la consommation). Les modalités et le formulaire de rétractation figurent en annexe."
            : null,
          part && s.mediateur ? `Médiation de la consommation : en cas de litige, le client peut recourir gratuitement au médiateur suivant : ${s.mediateur}.` : null
        ]
  ).filter(Boolean);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const condLines = conds.map((cd) => doc.splitTextToSize("•  " + cd, CW - 8));
  const condH = 9 + condLines.reduce((a, l) => a + l.length * 3.6 + 1, 0) + 2;
  y = need(y, condH + 4);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.4);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, condH, 1.5, 1.5, "FD");
  txt(inv ? "Modalités de paiement" : "Conditions générales & modalités", M + 4, y + 5.5, { b: 1, size: 9, c: ACC });
  let cy = y + 10;
  condLines.forEach((l) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(l, M + 4, cy);
    cy += l.length * 3.6 + 1;
  });
  y += condH + 6;

  if (part && !inv) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const ex = doc.splitTextToSize(
      "Je demande expressément que les travaux commencent avant la fin du délai de rétractation de 14 jours. Je reconnais qu'en cas de rétractation, je devrai payer le montant correspondant aux prestations déjà réalisées (art. L221-25 du Code de la consommation).",
      CW - 10
    );
    y = need(y, ex.length * 3.6 + 6);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.rect(M, y - 3, 3.6, 3.6);
    doc.setTextColor(...INK);
    doc.text(ex, M + 7, y);
    y += ex.length * 3.6 + 5;
  }

  const sw = (CW - 8) / 2;
  const sh = 34;
  if (!inv) {
    y = need(y, sh + 2);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, sw, sh, 1.5, 1.5);
    doc.roundedRect(M + sw + 8, y, sw, sh, 1.5, 1.5);
    txt("Le client", M + 4, y + 5.5, { b: 1, size: 9, c: ACC });
    txt("Date :", M + 4, y + 11, { size: 8, c: GREY });
    txt("Signature précédée de la mention « Bon pour accord »", M + 4, y + 15.5, { size: 7.5, c: GREY });
    txt(`Pour ${s.nom || "VIVIWORKS"}`, M + sw + 12, y + 5.5, { b: 1, size: 9, c: ACC });
    if (s.signataire) txt(s.signataire, M + sw + 12, y + 11, { size: 8.5 });
    txt("Date et signature", M + sw + 12, y + 15.5, { size: 7.5, c: GREY });
  }

  if (part && !inv) {
    doc.addPage();
    let a = 20;
    const who = `${s.nom || "VIVIWORKS"}, ${[s.adresse, s.ville].filter(Boolean).join(", ")}${s.email ? ", " + s.email : ""}`;
    txt("Annexe - Droit de rétractation", M, a, { b: 1, size: 15, c: ACC });
    a += 6;
    txt(`Devis n° ${d.numero} du ${frDate(d.date)}`, M, a, { size: 9, c: GREY });
    a += 8;
    const paras = [
      "Conformément aux articles L221-18 et suivants du Code de la consommation, le client consommateur dispose d'un délai de quatorze (14) jours pour exercer son droit de rétractation, sans avoir à motiver sa décision ni à supporter d'autres coûts que ceux prévus aux articles L221-23 à L221-25.",
      "Le délai court à compter du jour de la signature du devis. S'il expire un samedi, un dimanche ou un jour férié ou chômé, il est prolongé jusqu'au premier jour ouvrable suivant.",
      `Pour exercer ce droit, le client notifie sa décision à ${who}, au moyen d'une déclaration dénuée d'ambiguïté (lettre recommandée avec accusé de réception ou courrier électronique), ou en utilisant le formulaire ci-dessous. Il suffit que la décision soit envoyée avant l'expiration du délai.`,
      `En cas de rétractation, ${s.nom || "VIVIWORKS"} rembourse la totalité des sommes versées au plus tard quatorze jours à compter de la réception de la décision, par le même moyen de paiement que celui utilisé par le client, sauf accord exprès de celui-ci.`,
      "Si le client a expressément demandé que les travaux commencent avant la fin du délai de rétractation, il reste redevable d'un montant proportionnel aux prestations réalisées jusqu'à la communication de sa décision (art. L221-25). Le droit de rétractation ne peut plus être exercé pour une prestation pleinement exécutée avant la fin du délai dont l'exécution a commencé après accord préalable exprès du client et renoncement exprès à son droit (art. L221-28, 1°).",
      "Aucun paiement ni aucune contrepartie ne peut être exigé du client avant l'expiration d'un délai de sept jours à compter de la signature du devis (art. L221-10).",
      s.mediateur ? `Médiation : en cas de litige non résolu, le client peut saisir gratuitement le médiateur de la consommation : ${s.mediateur}.` : null
    ].filter(Boolean);
    paras.forEach((p) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const l = doc.splitTextToSize(p, CW);
      doc.text(l, M, a);
      a += l.length * 4.1 + 3;
    });
    a += 3;
    doc.setLineDashPattern([2, 1.5], 0);
    doc.setDrawColor(...GREY);
    doc.setLineWidth(0.3);
    doc.line(M, a, W - M, a);
    doc.setLineDashPattern([], 0);
    txt("Découper ou recopier ce formulaire", W - M, a - 1.5, { size: 7, c: GREY, align: "right" });
    a += 8;
    txt("Formulaire de rétractation", M, a, { b: 1, size: 12, c: ACC });
    a += 5;
    txt("(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)", M, a, { size: 8, c: GREY });
    a += 7;
    const form = [
      `À l'attention de ${who} :`,
      `Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*) / pour la prestation de services (*) ci-dessous : devis n° ${d.numero} du ${frDate(d.date)}${d.objet ? " - " + d.objet : ""}.`
    ];
    form.forEach((p) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const l = doc.splitTextToSize(p, CW);
      doc.text(l, M, a);
      a += l.length * 4.1 + 3;
    });
    ["Commandé le (*) / reçu le (*) :", "Nom du (des) consommateur(s) :", "Adresse du (des) consommateur(s) :", "", "Signature du (des) consommateur(s) (uniquement en cas de notification sur papier) :", "", "Date :"].forEach((lbl) => {
      a += 7;
      if (lbl) txt(lbl, M, a, { size: 9 });
      doc.setDrawColor(190, 200, 210);
      doc.setLineWidth(0.2);
      doc.line(lbl ? M + doc.getTextWidth(lbl) + 3 : M, a + 0.8, W - M, a + 0.8);
    });
    a += 8;
    txt("(*) Rayez la mention inutile.", M, a, { size: 8, c: GREY });
  }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.3);
    doc.line(M, H - 16, W - M, H - 16);
    txt([s.nom, s.adresse, s.ville, s.numero, s.email].filter(Boolean).join(" - "), M, H - 11.5, { size: 7, c: GREY });
    const bank = [s.titulaire || s.nom, s.iban ? "IBAN " + s.iban : "", s.bic ? "BIC " + s.bic : ""].filter(Boolean).join("  -  ");
    if (s.iban || s.bic) txt(bank, M, H - 7.5, { b: 1, size: 7.5, c: ACC });
    txt(`Page ${i}/${n}`, W - M, H - 11.5, { size: 7, c: GREY, align: "right" });
  }
  return doc.output("arraybuffer");
}

export async function mergeFiches(base, ids, fiches, getBytes) {
  const out = await PDFDocument.create();
  for (const id of ids) {
    const f = fiches.find((x) => x.id === id);
    if (!f) continue;
    const src = await PDFDocument.load(await getBytes(f), { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const dv = await PDFDocument.load(base);
  (await out.copyPages(dv, dv.getPageIndices())).forEach((p) => out.addPage(p));
  return out.save();
}
