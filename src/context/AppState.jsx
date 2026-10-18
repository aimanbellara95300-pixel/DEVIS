import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CATS, DEFAULT_SETTINGS } from "../lib/constants.js";
import {
  applyMarge,
  blankLine,
  cliName,
  clientNom,
  compute,
  ensureFacture,
  fileName,
  hasContent,
  keyOf,
  nextNumber,
  norm
} from "../lib/calc.js";
import { eur, hhmm, num, today, uid } from "../lib/format.js";
import {
  dbAddFiche,
  dbDelClient,
  dbDelDevis,
  dbDelFiche,
  dbFicheBytes,
  dbGetSettings,
  dbListClients,
  dbListDevis,
  dbListFiches,
  dbSaveClient,
  dbSaveDevis,
  dbSaveSettings,
  importLocalIfEmpty,
  isSupabaseConfigured,
  supabase
} from "../lib/supabase.js";
import { blobToDataUrl, toImages } from "../lib/images.js";
import { buildPdf, mergeFiches } from "../lib/pdf.js";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function freshDevis(list, settings, cat) {
  return {
    id: uid(),
    type: "particulier",
    client: { societe: "", nom: "", adresse: "", cp: "", ville: "", tel: "", email: "", siret: "", lieu: "" },
    numero: nextNumber(list),
    date: today(),
    objet: "",
    tvaDef: 20,
    acompte: num(settings.acompte) || 50,
    lignes: [blankLine(20)],
    fiches: [],
    notes: "",
    categorie: cat || "installation",
    statut: "en_cours",
    depenses: [],
    couleur: settings.couleur || "#1F5FA8"
  };
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [devisList, setDevisList] = useState([]);
  const [clients, setClients] = useState([]);
  const [fiches, setFiches] = useState([]);
  const [cur, setCur] = useState(null);
  const [tab, setTab] = useState("devis");
  const [suiviCat, setSuiviCat] = useState("");
  const [suiviSt, setSuiviSt] = useState("");
  const [factF, setFactF] = useState("");
  const [cliFilter, setCliFilter] = useState("");
  const [cliSearch, setCliSearch] = useState("");
  const [cliOpen, setCliOpen] = useState("");
  const [save, setSave] = useState({ kind: "", text: "Pas encore enregistré" });
  const [toastMsg, setToastMsg] = useState("");
  const [photoStatus, setPhotoStatus] = useState({ text: "", err: false });
  const [scanStatus, setScanStatus] = useState({ text: "", err: false });
  const [busy, setBusy] = useState("");
  const [viewer, setViewer] = useState(null);

  const settingsRef = useRef(settings);
  const listRef = useRef(devisList);
  const clientsRef = useRef(clients);
  const fichesRef = useRef(fiches);
  const curRef = useRef(cur);
  const dirtyRef = useRef(false);
  const saveQ = useRef(Promise.resolve());
  const toastT = useRef(0);
  const autoT = useRef(0);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { listRef.current = devisList; }, [devisList]);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { fichesRef.current = fiches; }, [fiches]);
  useEffect(() => { curRef.current = cur; }, [cur]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(""), 3200);
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSave({ kind: "dirty", text: "Modifications non enregistrées" });
  }, []);

  const edit = useCallback((fn) => {
    setCur((prev) => {
      const next = fn(structuredClone(prev));
      curRef.current = next;
      return next;
    });
    markDirty();
  }, [markDirty]);

  const syncClient = useCallback(async (d) => {
    const info = { type: d.type, ...d.client };
    delete info.lieu;
    if (!(info.nom || info.societe)) return d;
    let list = clientsRef.current.slice();
    let c = list.find((x) => x.id === d.clientId) || list.find((x) => keyOf(x) === keyOf(info));
    if (!c) {
      c = { id: uid(), cree: Date.now(), notes: "" };
      list.push(c);
    }
    Object.assign(c, info, { maj: Date.now() });
    d.clientId = c.id;
    await dbSaveClient(c);
    clientsRef.current = list;
    setClients(list);
    return d;
  }, []);

  const persistCur = useCallback(async () => {
    const run = async () => {
      let d = structuredClone(curRef.current);
      if (!hasContent(d)) return;
      await syncClient(d);
      d.maj = Date.now();
      await dbSaveDevis(d);
      curRef.current = d;
      setCur(d);
      const list = listRef.current.slice();
      const i = list.findIndex((x) => x.id === d.id);
      if (i >= 0) list[i] = d;
      else list.push(d);
      listRef.current = list;
      setDevisList(list);
      dirtyRef.current = false;
      setSave({ kind: "ok", text: `Enregistré à ${hhmm()}` });
    };
    saveQ.current = saveQ.current.catch(() => {}).then(run);
    try {
      await saveQ.current;
    } catch (e) {
      console.error(e);
      setSave({ kind: "dirty", text: e.message || "Échec de l'enregistrement" });
      throw e;
    }
  }, [syncClient]);

  const scheduleSave = useCallback(() => {
    clearTimeout(autoT.current);
    autoT.current = setTimeout(() => {
      if (dirtyRef.current && hasContent(curRef.current)) persistCur().catch(() => {});
    }, 2500);
  }, [persistCur]);

  const touch = useCallback((fn) => {
    edit(fn);
    scheduleSave();
  }, [edit, scheduleSave]);

  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current && hasContent(curRef.current)) persistCur().catch(() => {});
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persistCur]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthReady(true);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
      if (!next) setReady(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !session) return;
    let stop = false;
    (async () => {
      await importLocalIfEmpty();
      let s = { ...DEFAULT_SETTINGS };
      const saved = await dbGetSettings();
      if (saved) s = { ...DEFAULT_SETTINGS, ...saved };
      if (!s.iban) s.iban = DEFAULT_SETTINGS.iban;
      if (!s.bic) s.bic = DEFAULT_SETTINGS.bic;
      const metas = await dbListFiches();
      let list = (await dbListDevis()).map((d) => norm(structuredClone(d)));
      let cls = await dbListClients();
      for (const d of list.filter((x) => x.statut === "accepte" && !x.facture).sort((a, b) => (a.date || "").localeCompare(b.date || ""))) {
        ensureFacture(d, list);
        await dbSaveDevis(d);
      }
      for (const d of list.filter((x) => !x.clientId)) {
        const info = { type: d.type, ...d.client };
        delete info.lieu;
        if (info.nom || info.societe) {
          let c = cls.find((x) => keyOf(x) === keyOf(info));
          if (!c) {
            c = { id: uid(), cree: Date.now(), notes: "", ...info, maj: Date.now() };
            cls.push(c);
            await dbSaveClient(c);
          }
          d.clientId = c.id;
          await dbSaveDevis(d);
        }
      }
      if (stop) return;
      settingsRef.current = s;
      listRef.current = list;
      clientsRef.current = cls;
      fichesRef.current = metas;
      const start = freshDevis(list, s, "installation");
      curRef.current = start;
      setSettings(s);
      setDevisList(list);
      setClients(cls);
      setFiches(metas);
      setCur(start);
      setReady(true);
    })().catch((e) => {
      console.error(e);
      const start = freshDevis([], DEFAULT_SETTINGS, "installation");
      setCur(start);
      curRef.current = start;
      setReady(true);
      setSave({ kind: "dirty", text: e.message || "Connexion à Supabase impossible" });
    });
    return () => { stop = true; };
  }, [authReady, session?.user?.id]);

  const showTab = useCallback((name) => {
    if (name !== "devis" && dirtyRef.current && hasContent(curRef.current)) persistCur().catch(() => {});
    const suivi = name === "tout" || name in CATS;
    if (suivi) {
      setSuiviCat(name === "tout" ? "" : name);
      setSuiviSt("");
    }
    if (name === "envoi") setCur((c) => structuredClone(curRef.current || c));
    setTab(suivi ? "suivi" : name);
    window.scrollTo(0, 0);
  }, [persistCur]);

  const newDevis = useCallback(async (cat) => {
    if (dirtyRef.current && hasContent(curRef.current)) await persistCur().catch(() => {});
    const d = freshDevis(listRef.current, settingsRef.current, cat || suiviCat || "installation");
    curRef.current = d;
    dirtyRef.current = false;
    setCur(d);
    setSave({ kind: "", text: "Pas encore enregistré" });
    setTab("devis");
    window.scrollTo(0, 0);
    toast(`Nouveau devis ${d.numero}`);
    return d;
  }, [persistCur, suiviCat, toast]);

  const newDevisForClient = useCallback(async (id) => {
    const c = clientsRef.current.find((x) => x.id === id);
    if (!c) return;
    if (dirtyRef.current && hasContent(curRef.current)) await persistCur().catch(() => {});
    const d = freshDevis(listRef.current, settingsRef.current, "installation");
    d.clientId = c.id;
    d.type = c.type || "particulier";
    d.client = {
      societe: c.societe || "", nom: c.nom || "", adresse: c.adresse || "", cp: c.cp || "",
      ville: c.ville || "", tel: c.tel || "", email: c.email || "", siret: c.siret || "", lieu: ""
    };
    if (d.type === "professionnel") {
      d.tvaDef = 20;
      d.lignes.forEach((l) => { l.tva = 20; });
    }
    curRef.current = d;
    dirtyRef.current = true;
    setCur(d);
    setSave({ kind: "dirty", text: "Modifications non enregistrées" });
    setTab("devis");
    window.scrollTo(0, 0);
    toast(`Nouveau devis pour ${cliName(c)}.`);
    scheduleSave();
  }, [persistCur, scheduleSave, toast]);

  const openDevis = useCallback(async (id, opts = {}) => {
    if (dirtyRef.current && hasContent(curRef.current)) await persistCur().catch(() => {});
    const d = listRef.current.find((x) => x.id === id);
    if (!d) return;
    const copy = norm(structuredClone(d));
    copy.fiches = copy.fiches.filter((fid) => fichesRef.current.some((f) => f.id === fid));
    curRef.current = copy;
    dirtyRef.current = false;
    setCur(copy);
    setSave({ kind: "ok", text: "Enregistré dans la base" });
    if (!opts.keepTab) {
      setTab("devis");
      window.scrollTo(0, 0);
    }
    if (opts.scrollFact) setTimeout(() => document.getElementById("factCard")?.scrollIntoView({ block: "start" }), 50);
  }, [persistCur]);

  const duplicate = useCallback((id) => {
    const d = listRef.current.find((x) => x.id === id);
    if (!d) return;
    const copy = norm(structuredClone(d));
    copy.id = uid();
    copy.numero = nextNumber(listRef.current);
    copy.date = today();
    copy.statut = "en_cours";
    copy.depenses = [];
    delete copy.facture;
    delete copy.envoyeLe;
    curRef.current = copy;
    dirtyRef.current = true;
    setCur(copy);
    setSave({ kind: "dirty", text: "Modifications non enregistrées" });
    setTab("devis");
    toast(`Copie créée : ${copy.numero}`);
    scheduleSave();
  }, [scheduleSave, toast]);

  const erase = useCallback(async (id) => {
    const d = id === curRef.current?.id ? curRef.current : listRef.current.find((x) => x.id === id);
    if (!d) return false;
    const saved = listRef.current.some((x) => x.id === d.id);
    if (!saved) {
      if (hasContent(d) && !confirm("Ce devis n'est pas enregistré. Tout effacer et repartir d'un devis vide ?")) return false;
      const n = freshDevis(listRef.current, settingsRef.current, d.categorie);
      curRef.current = n;
      dirtyRef.current = false;
      setCur(n);
      setSave({ kind: "", text: "Pas encore enregistré" });
      toast("Devis effacé.");
      return true;
    }
    if (d.facture) {
      toast(`Impossible d'effacer : la facture ${d.facture.numero} a été émise. Passe plutôt le devis en « Refusé ».`);
      return false;
    }
    if (!confirm(`Effacer définitivement le devis ${d.numero} de la base ? Cette action est irréversible.`)) return false;
    await dbDelDevis(d.id);
    const list = listRef.current.filter((x) => x.id !== d.id);
    listRef.current = list;
    setDevisList(list);
    if (curRef.current?.id === d.id) {
      const n = freshDevis(list, settingsRef.current, "installation");
      curRef.current = n;
      dirtyRef.current = false;
      setCur(n);
      setSave({ kind: "", text: "Pas encore enregistré" });
    }
    toast(`Devis ${d.numero} effacé.`);
    return true;
  }, [toast]);

  const saveNow = useCallback(async () => {
    if (!hasContent(curRef.current)) return toast("Le devis est vide : rien à enregistrer.");
    try {
      await persistCur();
      toast(`Devis ${curRef.current.numero} enregistré dans la base.`);
    } catch {
      toast("L'enregistrement a échoué. Réessaie.");
    }
  }, [persistCur, toast]);

  const setType = useCallback((type) => {
    touch((d) => {
      d.type = type;
      if (type === "professionnel") {
        d.tvaDef = 20;
        d.lignes.forEach((l) => { l.tva = 20; });
      }
      return d;
    });
    if (type === "particulier") toast("Choisis la TVA : 20 %, 10 % ou 5,5 %.");
  }, [toast, touch]);

  const setTvaAll = useCallback((v) => {
    touch((d) => {
      d.tvaDef = v;
      d.lignes.forEach((l) => { l.tva = v; });
      return d;
    });
    toast(`TVA ${String(v).replace(".", ",")} % appliquée à toutes les lignes.`);
  }, [toast, touch]);

  const pickClient = useCallback((id) => {
    if (!id) {
      touch((d) => {
        d.clientId = "";
        d.client = { societe: "", nom: "", adresse: "", cp: "", ville: "", tel: "", email: "", siret: "", lieu: d.client.lieu || "" };
        return d;
      });
      return;
    }
    const c = clientsRef.current.find((x) => x.id === id);
    if (!c) return;
    touch((d) => {
      d.clientId = c.id;
      d.type = c.type || "particulier";
      if (d.type === "professionnel") {
        d.tvaDef = 20;
        d.lignes.forEach((l) => { l.tva = 20; });
      }
      d.client = {
        societe: c.societe || "",
        nom: c.nom || "",
        adresse: c.adresse || "",
        cp: c.cp || "",
        ville: c.ville || "",
        tel: c.tel || "",
        email: c.email || "",
        siret: c.siret || "",
        lieu: d.client.lieu || ""
      };
      return d;
    });
    toast(`Client ${(c.type === "professionnel" && c.societe) || c.nom || ""} repris.`);
  }, [toast, touch]);

  const setStatut = useCallback(async (id, statut, fromForm) => {
    const apply = (d) => {
      d.statut = statut;
      const created = ensureFacture(d, listRef.current);
      return created;
    };
    if (fromForm || id === curRef.current?.id) {
      const d = structuredClone(curRef.current);
      const created = apply(d);
      curRef.current = d;
      setCur(d);
      try {
        await persistCur();
        if (created) toast(`Devis accepté : facture ${d.facture.numero} créée.`);
      } catch { /* persist already flags */ }
      return;
    }
    const list = listRef.current.map((x) => structuredClone(x));
    const d = list.find((x) => x.id === id);
    if (!d) return;
    const created = apply(d);
    await dbSaveDevis(d);
    listRef.current = list;
    setDevisList(list);
    if (curRef.current?.id === id) {
      curRef.current = structuredClone(d);
      setCur(curRef.current);
    }
    toast(created ? `Devis accepté : facture ${d.facture.numero} créée.` : `Devis ${d.numero} : ${statut === "accepte" ? "accepté" : statut === "refuse" ? "refusé" : "en cours"}.`);
  }, [persistCur, toast]);

  const ficheBytes = useCallback(async (f) => dbFicheBytes(f), []);

  const makeBytes = useCallback(async (d, mode) => {
    let bytes = buildPdf(d, settingsRef.current, mode);
    if (mode !== "facture" && d.fiches?.length) bytes = await mergeFiches(bytes, d.fiches, fichesRef.current, ficheBytes);
    return bytes;
  }, [ficheBytes]);

  const check = useCallback((d) => {
    if (!d.client.nom && !d.client.societe) { toast("Indique le nom du client."); return false; }
    if (!d.lignes.length) { toast("Ajoute au moins une ligne au devis."); return false; }
    return true;
  }, [toast]);

  const download = useCallback(async (d, mode) => {
    if (!check(d)) return;
    try {
      const bytes = await makeBytes(d, mode);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(d, mode);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast(mode === "facture" ? "Facture téléchargée." : "PDF téléchargé.");
    } catch (e) {
      console.error(e);
      toast(e?.message && !e.code ? e.message : "La création du PDF a échoué.");
    }
  }, [check, makeBytes, toast]);

  const preview = useCallback(async (d, mode) => {
    if (!check(d)) return;
    setViewer({ title: mode === "facture" ? `Facture ${d.facture.numero}` : `Devis ${d.numero}`, loading: true, bytes: null, d, mode, error: "" });
    try {
      const bytes = await makeBytes(d, mode);
      setViewer({ title: mode === "facture" ? `Facture ${d.facture.numero}` : `Devis ${d.numero}`, loading: false, bytes, d, mode, error: "" });
    } catch (e) {
      console.error(e);
      setViewer({ title: "Aperçu", loading: false, bytes: null, d, mode, error: "L'aperçu n'a pas pu s'afficher. Tu peux quand même télécharger le PDF." });
    }
  }, [check, makeBytes]);

  const exportCurrent = useCallback(async (mode) => {
    const d = curRef.current;
    if (!check(d)) return;
    if (mode !== "facture") await persistCur().catch(() => {});
    else await persistCur().catch(() => {});
    await download(curRef.current, mode);
  }, [check, download, persistCur]);

  const addFiches = useCallback(async (marque, files) => {
    if (!marque) return toast("Indique la marque avant d'ajouter les PDF.");
    if (!files.length) return toast("Choisis au moins un fichier PDF.");
    let ok = 0;
    const next = fichesRef.current.slice();
    for (const f of files) {
      if (!/\.pdf$/i.test(f.name)) { toast(`${f.name} n'est pas un PDF.`); continue; }
      if (f.size > 20 * 1048576) { toast(`${f.name} dépasse 20 Mo.`); continue; }
      try {
        const id = uid();
        const meta = await dbAddFiche(f, { id, marque, nom: f.name, taille: f.size, ajoute: Date.now() });
        next.push(meta);
        ok++;
      } catch (e) {
        console.error(e);
        toast(`Échec de l'ajout de ${f.name}.`);
      }
    }
    fichesRef.current = next;
    setFiches(next);
    if (ok) toast(`${ok} fiche${ok > 1 ? "s" : ""} ajoutée${ok > 1 ? "s" : ""} pour ${marque}.`);
  }, [toast]);

  const delFiche = useCallback(async (id) => {
    const f = fichesRef.current.find((x) => x.id === id);
    if (!f || !confirm(`Supprimer « ${f.nom} » de la bibliothèque ?`)) return;
    await dbDelFiche(f);
    const next = fichesRef.current.filter((x) => x.id !== id);
    fichesRef.current = next;
    setFiches(next);
    touch((d) => { d.fiches = d.fiches.filter((x) => x !== id); return d; });
    toast("Fiche supprimée.");
  }, [toast, touch]);

  const saveSettings = useCallback(async (next) => {
    const s = { ...settingsRef.current, ...next };
    settingsRef.current = s;
    setSettings(s);
    try {
      await dbSaveSettings(s);
      toast("Réglages enregistrés.");
    } catch (e) {
      console.error(e);
      toast("L'enregistrement des réglages a échoué.");
    }
  }, [toast]);

  const pickColor = useCallback((hx) => {
    const s = { ...settingsRef.current, couleur: hx };
    settingsRef.current = s;
    setSettings(s);
    dbSaveSettings(s).catch(() => {});
    touch((d) => { d.couleur = hx; return d; });
    toast("Couleur appliquée au devis.");
  }, [toast, touch]);

  const onOfferFile = useCallback(async (file) => {
    if (!file) return;
    setBusy("offre");
    setPhotoStatus({ text: "Préparation de l'image…", err: false });
    try {
      await toImages(file);
      setPhotoStatus({
        text: "La lecture automatique des offres n'est pas disponible sur le site hébergé. Ajoute les lignes à la main, avec le prix d'achat et la marge.",
        err: true
      });
    } catch (e) {
      console.error(e);
      setPhotoStatus({ text: "Cette image ne peut pas être ouverte. Fais une capture d'écran JPG.", err: true });
    } finally {
      setBusy("");
    }
  }, []);

  const onScanFile = useCallback(async (file) => {
    if (!file) return;
    setBusy("scan");
    setScanStatus({ text: "Ajout de la facture…", err: false });
    try {
      const images = await toImages(file);
      const photo = await blobToDataUrl(images[0]);
      touch((d) => {
        d.depenses.push({ id: uid(), fournisseur: "", categorie: "Matériel", date: today(), ht: "", tva: "", ttc: "", photo });
        return d;
      });
      setScanStatus({
        text: "Facture ajoutée. Complète le fournisseur et les montants : la lecture automatique n'est pas disponible sur cette version hébergée.",
        err: true
      });
    } catch (e) {
      console.error(e);
      setScanStatus({ text: "Cette image ne peut pas être ouverte. Fais une capture d'écran JPG.", err: true });
    } finally {
      setBusy("");
    }
  }, [touch]);

  const defaultMail = useCallback((d) => {
    const s = settingsRef.current;
    const part = d.type === "particulier";
    return {
      subject: `Devis n° ${d.numero}${d.objet ? " - " + d.objet : ""} - ${s.nom || "VIVIWORKS"}`,
      body: `Bonjour${d.client.nom ? " " + d.client.nom : ""},\n\nVeuillez trouver ci-joint notre devis n° ${d.numero} d'un montant de ${eur(compute(d).ttc)} TTC${d.fiches.length ? ", accompagné des fiches techniques du matériel proposé" : ""}.\n\nCe devis est valable ${num(s.validite) || 30} jours. Pour l'accepter, il vous suffit de nous le retourner daté et signé avec la mention « Bon pour accord ».${part ? " Vous disposez d'un délai de rétractation de 14 jours, détaillé en annexe." : ""}\n\nJe reste à votre disposition pour toute question.\n\nCordialement,\n${s.signataire || ""}\n${s.nom || "VIVIWORKS"}${s.tel ? "\n" + s.tel : ""}${s.email ? "\n" + s.email : ""}`
    };
  }, []);

  const sendDossier = useCallback(async (mail) => {
    const d = structuredClone(curRef.current);
    d.mail = { devisId: d.id, ...mail };
    curRef.current = d;
    setCur(d);
    if (!check(d)) return;
    try {
      const bytes = await makeBytes(d, "devis");
      const name = fileName(d, "devis");
      const file = new File([bytes], name, { type: "application/pdf" });
      let shared = false;
      if (navigator.canShare && navigator.share) {
        try {
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: mail.subject, text: mail.body });
            shared = true;
          }
        } catch (e) {
          if (e?.name === "AbortError") return "Envoi annulé.";
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        let copied = false;
        try { await navigator.clipboard.writeText(mail.body); copied = true; } catch { /* ignore */ }
        d.envoyeLe = today();
        curRef.current = d;
        setCur(d);
        await persistCur();
        return `Le dossier « ${name} » est téléchargé${copied ? " et le message est copié" : ""}. Ouvre ton application de mail, écris à ${mail.to || "ton client"}, colle le message et joins le PDF.`;
      }
      d.envoyeLe = today();
      curRef.current = d;
      setCur(d);
      await persistCur();
      return "Dossier partagé. Choisis ton application de mail et vérifie le destinataire.";
    } catch (e) {
      console.error(e);
      return "La préparation du dossier a échoué. Vérifie les fiches jointes.";
    }
  }, [check, makeBytes, persistCur]);

  const saveClientNotes = useCallback((id, notes) => {
    const list = clientsRef.current.map((c) => (c.id === id ? { ...c, notes } : c));
    clientsRef.current = list;
    setClients(list);
    const c = list.find((x) => x.id === id);
    clearTimeout(autoT.current);
    autoT.current = setTimeout(() => dbSaveClient(c).catch(() => {}), 800);
  }, []);

  const deleteClient = useCallback(async (id) => {
    const c = clientsRef.current.find((x) => x.id === id);
    if (!c || !confirm(`Supprimer ${clientNom({ type: c.type, client: c })} de la base clients ? Ses devis restent dans le suivi.`)) return;
    await dbDelClient(id);
    const list = clientsRef.current.filter((x) => x.id !== id);
    clientsRef.current = list;
    setClients(list);
    setCliOpen("");
    toast("Client supprimé.");
  }, [toast]);

  const setPayee = useCallback(async (id, payee) => {
    const list = listRef.current.map((x) => structuredClone(x));
    const d = list.find((x) => x.id === id);
    if (!d?.facture) return;
    d.facture.payee = payee;
    await dbSaveDevis(d);
    listRef.current = list;
    setDevisList(list);
    if (curRef.current?.id === id && curRef.current.facture) {
      const c = structuredClone(curRef.current);
      c.facture.payee = payee;
      curRef.current = c;
      setCur(c);
    }
    toast(`Facture ${d.facture.numero} : ${payee === "oui" ? "payée" : "à encaisser"}.`);
  }, [toast]);

  const applyAllMarge = useCallback((m) => {
    const targets = (curRef.current?.lignes || []).filter((l) => num(l.achat) > 0);
    if (!targets.length) return toast("Aucune ligne n'a de prix d'achat fournisseur.");
    touch((d) => {
      d.lignes.forEach((l) => {
        if (num(l.achat) > 0) { l.marge = m; applyMarge(l); }
      });
      return d;
    });
    toast(`Marge de ${m} % appliquée sur ${targets.length} ligne${targets.length > 1 ? "s" : ""}.`);
  }, [toast, touch]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw new Error(error.message);
    return { needsConfirm: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setReady(false);
    setCur(null);
  }, []);

  const value = useMemo(() => ({
    ready, authReady, configured: isSupabaseConfigured(), session, settings, devisList, clients, fiches, cur, tab, suiviCat, suiviSt, factF, cliFilter, cliSearch, cliOpen,
    save, toastMsg, photoStatus, scanStatus, busy, viewer, signIn, signUp, signOut,
    showTab, newDevis, newDevisForClient, openDevis, duplicate, erase, saveNow, touch, setType, setTvaAll, pickClient, setStatut,
    setSuiviSt, setFactF, setCliFilter, setCliSearch, setCliOpen, addFiches, delFiche, saveSettings, pickColor,
    onOfferFile, onScanFile, preview, download, exportCurrent, closeViewer: () => setViewer(null),
    defaultMail, sendDossier, saveClientNotes, deleteClient, setPayee, applyAllMarge, applyMarge
  }), [
    ready, authReady, session, settings, devisList, clients, fiches, cur, tab, suiviCat, suiviSt, factF, cliFilter, cliSearch, cliOpen,
    save, toastMsg, photoStatus, scanStatus, busy, viewer, signIn, signUp, signOut,
    showTab, newDevis, newDevisForClient, openDevis, duplicate, erase, saveNow, touch, setType, setTvaAll, pickClient, setStatut,
    addFiches, delFiche, saveSettings, pickColor, onOfferFile, onScanFile, preview, download, exportCurrent,
    defaultMail, sendDossier, saveClientNotes, deleteClient, setPayee, applyAllMarge
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
