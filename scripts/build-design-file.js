// Builds a single self-contained HTML file for claude.design.
// Inlines picks/results/recap/outlook/chirps JSON and intercepts fetch()
// so the page renders fully with no network/relative-file requests.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const files = ["picks.json", "results.json", "recap.json", "outlook.json", "chirps.json"];
const data = {};
for (const f of files) {
  try { data["./" + f] = JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); }
  catch { /* skip missing */ }
}

const interceptor = `<script>
/* ===== claude.design self-contained data shim =====
   Baked-in snapshot of the live JSON feeds. Intercepts the
   page's fetch("./*.json") calls so everything renders offline.
   This block exists ONLY for the design environment. ===== */
(function () {
  var BAKED = ${JSON.stringify(data, null, 2)};
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var key = url.split("?")[0];
    if (key.indexOf("./") !== 0 && key.indexOf("/") === -1) key = "./" + key;
    if (BAKED.hasOwnProperty(key)) {
      return Promise.resolve(new Response(JSON.stringify(BAKED[key]), {
        status: 200, headers: { "Content-Type": "application/json" }
      }));
    }
    return realFetch ? realFetch(input) : Promise.reject(new Error("offline: " + url));
  };
})();
</script>
`;

const marker = "<script>";
const idx = html.indexOf(marker);
if (idx === -1) throw new Error("no <script> tag found in index.html");
const out = html.slice(0, idx) + interceptor + html.slice(idx);

const dest = path.join(root, "the-group-DESIGN.html");
fs.writeFileSync(dest, out, "utf8");
console.log("Wrote " + dest + " (" + out.length + " bytes)");
