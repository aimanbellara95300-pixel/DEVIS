import { createClient } from "@supabase/supabase-js";
import { idbAll, idbDel, idbGet, idbSet } from "./idb.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
}) : null;

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeById(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const item of list || []) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      if (!prev || (item.maj || 0) >= (prev.maj || 0)) map.set(item.id, item);
    }
  }
  return [...map.values()];
}

async function userId() {
  const { data, error } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (error || !id) throw new Error("Session expirée. Reconnecte-toi.");
  return id;
}

function check(error, action) {
  if (!error) return;
  const msg = error.message || error.toString?.() || "";
  if (/relation .* does not exist|schema cache/i.test(msg)) {
    throw new Error("Les tables Supabase ne sont pas créées. Exécute le script supabase/schema.sql dans l'éditeur SQL.");
  }
  if (/payload|too large|request entity|413|json/i.test(msg)) {
    throw new Error(action + " : le devis est trop lourd (photos de factures). Réessaie après avoir retiré une photo.");
  }
  throw new Error(action + " : " + msg);
}

async function saveLocal(prefix, record) {
  if (!record?.id) return false;
  await idbSet(prefix + record.id, plain(record));
  return true;
}

export async function dbGetSettings() {
  if (supabase) {
    try {
      const uid = await userId();
      const { data, error } = await supabase.from("settings").select("data").eq("user_id", uid).maybeSingle();
      if (!error && data?.data) return data.data;
    } catch (e) {
      console.warn(e);
    }
  }
  try {
    return (await idbGet("settings")) || null;
  } catch {
    return null;
  }
}

export async function dbSaveSettings(settings) {
  const copy = plain(settings);
  try {
    await idbSet("settings", copy);
  } catch (e) {
    console.error(e);
  }
  if (!supabase) return;
  const uid = await userId();
  const { error } = await supabase.from("settings").upsert({
    user_id: uid,
    data: copy,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  check(error, "Enregistrement des réglages");
}

export async function dbListDevis() {
  let cloud = [];
  let cloudErr = null;
  if (supabase) {
    try {
      const uid = await userId();
      const { data, error } = await supabase.from("devis").select("data").eq("user_id", uid);
      if (error) cloudErr = error;
      else cloud = (data || []).map((row) => row.data).filter(Boolean);
    } catch (e) {
      cloudErr = e;
    }
  }
  let local = [];
  try {
    local = await idbAll("devis:");
  } catch {
    local = [];
  }
  const merged = mergeById(cloud, local);
  if (merged.length || !cloudErr) return merged;
  check(cloudErr, "Lecture des devis");
  return [];
}

export async function dbSaveDevis(devis) {
  if (!devis?.id) return;
  const copy = plain(devis);
  let localOk = false;
  try {
    localOk = await saveLocal("devis:", copy);
  } catch (e) {
    console.error(e);
  }
  if (!supabase) {
    if (!localOk) throw new Error("Impossible d'enregistrer : ni Supabase ni le cache local ne sont disponibles.");
    return;
  }
  try {
    const uid = await userId();
    const { error } = await supabase.from("devis").upsert({
      id: devis.id,
      user_id: uid,
      data: copy,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    check(error, "Enregistrement du devis");
  } catch (e) {
    if (localOk) {
      console.warn("Supabase indisponible, devis sauvegardé localement :", e.message);
      return;
    }
    throw e;
  }
}

export async function dbSaveArchiveDevis(devis, file) {
  const uid = await userId();
  const path = `${uid}/devis/${devis.id}.pdf`;
  const storage = supabase.storage.from("viviworks");
  const uploaded = await storage.upload(path, file, { contentType: "application/pdf", upsert: true });
  check(uploaded.error, "Envoi du PDF du devis");

  const copy = plain({ ...devis, archive: { ...devis.archive, pdfPath: path } });
  try {
    const { error } = await supabase.from("devis").upsert({
      id: copy.id,
      user_id: uid,
      data: copy,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    check(error, "Enregistrement du devis archivé");
    try {
      await saveLocal("devis:", copy);
    } catch (e) {
      console.error("Le devis archivé est enregistré dans Supabase, mais pas dans le cache local :", e);
    }
    return copy;
  } catch (e) {
    const removed = await storage.remove([path]);
    if (removed.error) console.error("Impossible de supprimer le PDF après l'échec de l'enregistrement :", removed.error);
    throw e;
  }
}

export async function dbGetArchivePdf(path) {
  const { data, error } = await supabase.storage.from("viviworks").download(path);
  check(error, "Téléchargement du PDF archivé");
  return data;
}

export async function dbDelArchivePdf(path) {
  if (!path) return;
  const { error } = await supabase.storage.from("viviworks").remove([path]);
  check(error, "Suppression du PDF archivé");
}

export async function dbDelDevis(id) {
  try {
    await idbDel("devis:" + id);
  } catch (e) {
    console.error(e);
  }
  const uid = await userId();
  const { error } = await supabase.from("devis").delete().eq("id", id).eq("user_id", uid);
  check(error, "Suppression du devis");
}

export async function dbListClients() {
  let cloud = [];
  let cloudErr = null;
  if (supabase) {
    try {
      const uid = await userId();
      const { data, error } = await supabase.from("clients").select("data").eq("user_id", uid);
      if (error) cloudErr = error;
      else cloud = (data || []).map((row) => row.data).filter(Boolean);
    } catch (e) {
      cloudErr = e;
    }
  }
  let local = [];
  try {
    local = await idbAll("client:");
  } catch {
    local = [];
  }
  const merged = mergeById(cloud, local);
  if (merged.length || !cloudErr) return merged;
  check(cloudErr, "Lecture des clients");
  return [];
}

export async function dbSaveClient(client) {
  if (!client?.id) return;
  const copy = plain(client);
  let localOk = false;
  try {
    localOk = await saveLocal("client:", copy);
  } catch (e) {
    console.error(e);
  }
  if (!supabase) return;
  try {
    const uid = await userId();
    const { error } = await supabase.from("clients").upsert({
      id: client.id,
      user_id: uid,
      data: copy,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    check(error, "Enregistrement du client");
  } catch (e) {
    if (localOk) {
      console.warn("Supabase indisponible, client sauvegardé localement :", e.message);
      return;
    }
    throw e;
  }
}

export async function dbDelClient(id) {
  try {
    await idbDel("client:" + id);
  } catch (e) {
    console.error(e);
  }
  const uid = await userId();
  const { error } = await supabase.from("clients").delete().eq("id", id).eq("user_id", uid);
  check(error, "Suppression du client");
}

export async function dbListFiches() {
  if (!supabase) return [];
  try {
    const uid = await userId();
    const { data, error } = await supabase.from("fiches").select("id, marque, nom, taille, path, ajoute").eq("user_id", uid);
    if (error) {
      console.warn(error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn(e);
    return [];
  }
}

export async function dbAddFiche(file, meta) {
  const uid = await userId();
  const path = `${uid}/${meta.id}.pdf`;
  const up = await supabase.storage.from("viviworks").upload(path, file, { contentType: "application/pdf", upsert: true });
  check(up.error, "Envoi du PDF");
  const row = { ...meta, path, user_id: uid };
  const { error } = await supabase.from("fiches").upsert(row);
  check(error, "Enregistrement de la fiche");
  return row;
}

export async function dbDelFiche(fiche) {
  const uid = await userId();
  if (fiche.path) {
    const rm = await supabase.storage.from("viviworks").remove([fiche.path]);
    check(rm.error, "Suppression du PDF");
  }
  const { error } = await supabase.from("fiches").delete().eq("id", fiche.id).eq("user_id", uid);
  check(error, "Suppression de la fiche");
}

export async function dbFicheBytes(fiche) {
  const { data, error } = await supabase.storage.from("viviworks").download(fiche.path);
  check(error, "Téléchargement de " + (fiche.nom || "la fiche"));
  return data.arrayBuffer();
}

export async function importLocalIfEmpty() {
  const uid = await userId();
  const flag = "viviworks-imported-" + uid;
  if (localStorage.getItem(flag)) return;
  const { data, error } = await supabase.from("devis").select("id").eq("user_id", uid).limit(1);
  if (error) return;
  if (data?.length) {
    localStorage.setItem(flag, "1");
    return;
  }
  let localDevis = [];
  let localClients = [];
  let localFiches = [];
  let localSettings = null;
  try {
    localDevis = await idbAll("devis:");
    localClients = await idbAll("client:");
    localFiches = await idbAll("fiche:");
    localSettings = await idbGet("settings");
  } catch {
    localStorage.setItem(flag, "1");
    return;
  }
  if (!localDevis.length && !localClients.length && !localFiches.length && !localSettings) {
    localStorage.setItem(flag, "1");
    return;
  }
  if (localSettings) await dbSaveSettings(localSettings);
  for (const c of localClients) await dbSaveClient(c);
  for (const d of localDevis) await dbSaveDevis(d);
  for (const f of localFiches) {
    if (f.blob) await dbAddFiche(f.blob, { id: f.id, marque: f.marque, nom: f.nom, taille: f.taille, ajoute: f.ajoute });
  }
  localStorage.setItem(flag, "1");
}
