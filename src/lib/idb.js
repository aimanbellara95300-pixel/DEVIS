const DB = "devis-viviworks";

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

let dbp;
function db() {
  if (!dbp) dbp = open();
  return dbp;
}

function txDone(t) {
  return new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export async function idbGet(k) {
  const d = await db();
  const t = d.transaction("kv", "readonly");
  const req = t.objectStore("kv").get(k);
  const value = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  await txDone(t);
  return value;
}

export async function idbSet(k, v) {
  const d = await db();
  const t = d.transaction("kv", "readwrite");
  t.objectStore("kv").put(v, k);
  await txDone(t);
}

export async function idbDel(k) {
  const d = await db();
  const t = d.transaction("kv", "readwrite");
  t.objectStore("kv").delete(k);
  await txDone(t);
}

export async function idbAll(prefix) {
  const d = await db();
  const t = d.transaction("kv", "readonly");
  const out = [];
  await new Promise((res, rej) => {
    const c = t.objectStore("kv").openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (cur) {
        if (String(cur.key).startsWith(prefix)) out.push(cur.value);
        cur.continue();
      } else res();
    };
    c.onerror = () => rej(c.error);
  });
  return out;
}
