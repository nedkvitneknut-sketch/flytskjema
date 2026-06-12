const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const resultEl = document.getElementById("result");
const diagramEl = document.getElementById("diagram");
const speedSlider = document.getElementById("speedSlider");

const ICONS = {
  kjel: "🔥",
  varmepumpe: "♨️",
  fjernvarme: "🏭",
  solfanger: "☀️",
  pumpe: "🔄",
  varmeveksler: "🔁",
  ventil: "🔀",
  shuntventil: "🔀",
  radiator: "🌡️",
  gulvvarme: "🌡️",
  ventilasjonsbatteri: "💨",
  tank: "🛢️",
  ekspansjonskar: "⚪",
  maaler: "📊",
  annet: "⚙️",
};

const SOURCES = new Set(["kjel", "varmepumpe", "fjernvarme", "solfanger"]);
const CONSUMERS = new Set(["radiator", "gulvvarme", "ventilasjonsbatteri"]);

// --- Filhåndtering ---

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  resultEl.classList.add("hidden");
  errorEl.classList.add("hidden");
  dropzone.classList.remove("hidden");
  fileInput.value = "";
});

const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];

async function handleFile(file) {
  errorEl.classList.add("hidden");

  if (!ALLOWED.includes(file.type)) {
    showError("Filtypen støttes ikke. Bruk PDF, PNG, JPG eller WEBP.");
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    showError("Fila er for stor (maks 30 MB).");
    return;
  }

  dropzone.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  try {
    const data = await fileToBase64(file);
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaType: file.type, data }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Analysen feilet.");
    render(json);
  } catch (err) {
    showError(err.message);
    dropzone.classList.remove("hidden");
  } finally {
    loadingEl.classList.add("hidden");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showError(msg) {
  errorEl.textContent = "⚠️ " + msg;
  errorEl.classList.remove("hidden");
}

// --- Rendering ---

function render(analysis) {
  document.getElementById("systemName").textContent = analysis.systemName;
  document.getElementById("summary").textContent = analysis.summary;
  renderDiagram(analysis);
  renderOptimizations(analysis.optimizations);
  resultEl.classList.remove("hidden");
}

const W = 1000, H = 650, PAD = 70;
const BOX_W = 116, BOX_H = 52;

function sx(x) { return PAD + (x / 100) * (W - 2 * PAD); }
function sy(y) { return PAD + (y / 100) * (H - 2 * PAD); }

function renderDiagram(analysis) {
  const byId = {};
  for (const c of analysis.components) byId[c.id] = c;

  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`);

  // Rør først (bak komponentene)
  for (const conn of analysis.connections) {
    const a = byId[conn.from];
    const b = byId[conn.to];
    if (!a || !b) continue;

    const offset = conn.type === "tur" ? -7 : conn.type === "retur" ? 7 : 0;
    const path = pipePath(a, b, offset);

    svg.push(`<path class="pipe ${conn.type}" d="${path}"/>`);
    svg.push(`<path class="flow ${conn.type}" d="${path}"/>`);

    if (conn.label) {
      const mx = (sx(a.x) + sx(b.x)) / 2;
      const my = (sy(a.y) + sy(b.y)) / 2 + offset - 4;
      svg.push(`<text class="pipe-label" x="${mx}" y="${my}">${esc(conn.label)}</text>`);
    }
  }

  // Komponenter
  for (const c of analysis.components) {
    const cx = sx(c.x), cy = sy(c.y);
    const cls = SOURCES.has(c.type) ? "source" : CONSUMERS.has(c.type) ? "consumer" : "";
    svg.push(`<g>`);
    svg.push(
      `<rect class="comp-box ${cls}" x="${cx - BOX_W / 2}" y="${cy - BOX_H / 2}" width="${BOX_W}" height="${BOX_H}" rx="8"/>`
    );
    svg.push(`<text class="comp-icon" x="${cx - BOX_W / 2 + 18}" y="${cy + 6}">${ICONS[c.type] || ICONS.annet}</text>`);
    svg.push(`<text class="comp-label" x="${cx + 9}" y="${cy + (c.info ? 0 : 4)}">${esc(trunc(c.label, 16))}</text>`);
    if (c.info) {
      svg.push(`<text class="comp-info" x="${cx + 9}" y="${cy + 14}">${esc(trunc(c.info, 20))}</text>`);
    }
    svg.push(`</g>`);
  }

  svg.push(`</svg>`);
  diagramEl.innerHTML = svg.join("");
  applySpeed();
}

// Ortogonal rute mellom to komponenter, med liten offset så tur/retur ikke overlapper
function pipePath(a, b, offset) {
  const x1 = sx(a.x), y1 = sy(a.y) + offset;
  const x2 = sx(b.x), y2 = sy(b.y) + offset;

  if (Math.abs(y1 - y2) < 8) return `M ${x1} ${y1} L ${x2} ${y2}`;
  if (Math.abs(x1 - x2) < 8) return `M ${x1 + offset} ${y1} L ${x2 + offset} ${y2}`;

  const mx = (x1 + x2) / 2 + offset;
  return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
}

speedSlider.addEventListener("input", applySpeed);

function applySpeed() {
  const speed = parseFloat(speedSlider.value);
  const duration = 1 / speed;
  diagramEl.querySelectorAll(".flow").forEach((el) => {
    el.style.animationDuration = `${duration}s`;
  });
}

function renderOptimizations(opts) {
  const order = { hoy: 0, middels: 1, lav: 2 };
  const sorted = [...opts].sort((a, b) => order[a.savingPotential] - order[b.savingPotential]);
  const labels = { hoy: "Høyt potensial", middels: "Middels potensial", lav: "Lavt potensial" };

  document.getElementById("optimizations").innerHTML = sorted
    .map(
      (o) => `
      <div class="opt-card">
        <h4>${esc(o.title)}</h4>
        <p>${esc(o.description)}</p>
        <div class="opt-meta">
          <span class="badge badge-${o.savingPotential}">${labels[o.savingPotential]}</span>
          <span class="badge badge-cat">${esc(o.category)}</span>
        </div>
      </div>`
    )
    .join("");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function trunc(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
