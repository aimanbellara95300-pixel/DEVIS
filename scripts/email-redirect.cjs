const http = require("http");

http
  .createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<meta charset="utf-8">
<title>Devis Viviworks</title>
<p>Connexion en cours…</p>
<script>location.replace("http://127.0.0.1:5173/" + location.search + location.hash)</script>`);
  })
  .listen(3000, "127.0.0.1", () => {
    console.log("redirect ready on http://127.0.0.1:3000");
  });
