import { createClient } from "@supabase/supabase-js";
import { idbAll, idbGet } from "./idb.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Session expirée. Reconnecte-toi.");
  return data.user.id;
}

function check(error, action) {
  if (!error) return;
  const msg = error.message || "";
  if (/relation .* does not exist|schema cache/i.test(msg)) {
    throw new Error("Les tables Supabase ne sont pas créées. Exécute le script supabase/schema.sql dans l'éditeur SQL.");
  }
  throw new Error(action + " : " + msg);
}

export async function dbGetSettings() {
  const uid = await userId();
  const { data, error } = await supabase.from("settings").select("data").eq("user_id", uid).maybeSingle();
  check(error, "Lecture des réglages");
  return data?.data || null;
}

export async function dbSaveSettings(settings) {
  const uid = await userId();
  const { error } = await supabase.from("settings").upsert({
    user_id: uid,
    data: plain(settings),
    updated_at: new Date().toISOString()
  });
  check(error, "Enregistrement des réglages");
}

export async function dbListDevis() {
  const uid = await userId();
  const { data, error } = await supabase.from("devis").select("data").eq("user_id", uid);
  check(error, "Lecture des devis");
  return (data || []).map((row) => row.data);
}

export async function dbSaveDevis(devis) {
  const uid = await userId();
  const { error } = await supabase.from("devis").upsert({
    id: devis.id,
    user_id: uid,
    data: plain(devis),
    updated_at: new Date().toISOString()
  });
  check(error, "Enregistrement du devis");
}

export async function dbDelDevis(id) {
  const uid = await userId();
  const { error } = await supabase.from("devis").delete().eq("id", id).eq("user_id", uid);
  check(error, "Suppression du devis");
}

export async function dbListClients() {
  const uid = await userId();
  const { data, error } = await supabase.from("clients").select("data").eq("user_id", uid);
  check(error, "Lecture des clients");
  return (data || []).map((row) => row.data);
}

export async function dbSaveClient(client) {
  const uid = await userId();
  const { error } = await supabase.from("clients").upsert({
    id: client.id,
    user_id: uid,
    data: plain(client),
    updated_at: new Date().toISOString()
  });
  check(error, "Enregistrement du client");
}

export async function dbDelClient(id) {
  const uid = await userId();
  const { error } = await supabase.from("clients").delete().eq("id", id).eq("user_id", uid);
  check(error, "Suppression du client");
}

export async function dbListFiches() {
  const uid = await userId();
  const { data, error } = await supabase.from("fiches").select("id, marque, nom, taille, path, ajoute").eq("user_id", uid);
  check(error, "Lecture des fiches");
  return data || [];
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
  const cloud = await dbListDevis();
  if (cloud.length) {
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
