import { useEffect, useRef, useState } from "react";
import { loadPdf } from "../lib/images.js";
import { useApp } from "../context/AppState.jsx";

export default function Viewer() {
  const app = useApp();
  const v = app.viewer;
  const pagesRef = useRef(null);
  const pdfRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);

  useEffect(() => {
    if (!v?.bytes) return;
    let cancel = false;
    (async () => {
      const pdf = await loadPdf(new Uint8Array(v.bytes));
      if (cancel) return;
      pdfRef.current = pdf;
      await paint(pdf, 1);
    })().catch(() => {});
    return () => { cancel = true; pdfRef.current = null; };
  }, [v?.bytes]);

  async function paint(pdf, z) {
    const box = pagesRef.current;
    if (!box || !pdf) return;
    const base = Math.min(820, box.clientWidth - 20);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    box.innerHTML = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      const cssW = base * z;
      const target = Math.min(cssW * dpr, 3600);
      const vp = page.getViewport({ scale: target / vp1.width });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = cssW + "px";
      c.style.height = cssW * (vp.height / vp.width) + "px";
      c.setAttribute("aria-label", `Page ${i}`);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      box.appendChild(c);
    }
  }

  function changeZoom(z) {
    const next = Math.max(1, Math.min(4, z));
    zoomRef.current = next;
    setZoom(next);
    if (pdfRef.current) paint(pdfRef.current, next);
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") app.closeViewer(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [app]);

  if (!v) return null;
  return (
    <div className="viewer" role="dialog" aria-modal="true">
      <div className="vbar">
        <strong>{v.title}</strong>
        <div className="actions" style={{ flexWrap: "nowrap" }}>
          <button className="btn primary" type="button" onClick={() => v.d && app.download(v.d, v.mode)}>Télécharger</button>
          <button className="btn" type="button" onClick={app.closeViewer}>Fermer</button>
        </div>
      </div>
      <div className="zbar">
        <button className="btn" type="button" aria-label="Dézoomer" disabled={zoom <= 1} onClick={() => changeZoom(zoom / 1.4)}>−</button>
        <button className="btn zreset" type="button" onClick={() => changeZoom(zoom > 1.01 ? 1 : 2)}>{Math.round(zoom * 100)} %</button>
        <button className="btn" type="button" aria-label="Zoomer" disabled={zoom >= 4} onClick={() => changeZoom(zoom * 1.4)}>+</button>
      </div>
      <div className="vpages" ref={pagesRef}>
        {v.loading && <p>Préparation de l'aperçu…</p>}
        {v.error && <p>{v.error}</p>}
      </div>
    </div>
  );
}
