const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const resultEl = document.getElementById("result");
const diagramEl = document.getElementById("diagram");

const SOURCES = new Set(["kjel", "varmepumpe", "fjernvarme", "solfanger"]);
const CONSUMERS = new Set(["radiator", "gulvvarme", "ventilasjonsbatteri"]);

let currentAnalysis = null;

// --- Enkle P&ID-inspirerte symboler (SVG) ---

const SYMBOL_DEFS = `
<defs>
  <symbol id="ic-kjel" viewBox="0 0 24 24">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M12 7c2 2.5 3.5 4 3.5 6.2A3.5 3.5 0 0 1 12 16.8a3.5 3.5 0 0 1-3.5-3.6C8.5 11 10 9.5 12 7z" fill="currentColor"/>
  </symbol>
  <symbol id="ic-varmepumpe" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M12 8.5v7M8.9 10.2l6.2 3.6M8.9 13.8l6.2-3.6" stroke="currentColor" stroke-width="1.2"/>
  </symbol>
  <symbol id="ic-fjernvarme" viewBox="0 0 24 24">
    <path d="M3 21V9l5 3V9l5 3V9l5 3v9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M6 6c0-1.5 1.5-1.5 1.5-3M10 6c0-1.5 1.5-1.5 1.5-3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </symbol>
  <symbol id="ic-solfanger" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </symbol>
  <symbol id="ic-pumpe" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M8.5 7.5L17 12l-8.5 4.5z" fill="currentColor"/>
  </symbol>
  <symbol id="ic-varmeveksler" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M3 12h4l2.5-4 3 8 2.5-4h6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  </symbol>
  <symbol id="ic-ventil" viewBox="0 0 24 24">
    <path d="M4 7v10l8-5zM20 7v10l-8-5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  </symbol>
  <symbol id="ic-shuntventil" viewBox="0 0 24 24">
    <path d="M4 7v10l8-5zM20 7v10l-8-5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M12 12V4" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="3.5" r="1.6" fill="currentColor"/>
  </symbol>
  <symbol id="ic-radiator" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M7 5v14M11 5v14M15 5v14" stroke="currentColor" stroke-width="1.3"/>
  </symbol>
  <symbol id="ic-gulvvarme" viewBox="0 0 24 24">
    <path d="M3 20h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M4 16c0-4 4-4 4-8s-4-4-4-8" transform="translate(2 4) scale(0.8)" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M4 16c0-4 4-4 4-8s-4-4-4-8" transform="translate(8 4) scale(0.8)" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M4 16c0-4 4-4 4-8s-4-4-4-8" transform="translate(14 4) scale(0.8)" fill="none" stroke="currentColor" stroke-width="1.4"/>
  </symbol>
  <symbol id="ic-ventilasjonsbatteri" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
    <path d="M12 10.2c0-3-1-4.7-3-5.7M13.8 12c3 0 4.7-1 5.7-3M12 13.8c0 3 1 4.7 3 5.7M10.2 12c-3 0-4.7 1-5.7 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </symbol>
  <symbol id="ic-tank" viewBox="0 0 24 24">
    <path d="M5 6a7 3 0 0 1 14 0v12a7 3 0 0 1-14 0z" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.3"/>
  </symbol>
  <symbol id="ic-ekspansjonskar" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M3.5 12h17" stroke="currentColor" stroke-width="1.4"/>
    <path d="M12 12v8.5" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"/>
  </symbol>
  <symbol id="ic-maaler" viewBox="0 0 24 24">
    <circle cx="12" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M12 13L16.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="12" cy="13" r="1.4" fill="currentColor"/>
  </symbol>
  <symbol id="ic-annet" viewBox="0 0 24 24">
    <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/>
  </symbol>
</defs>`;

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
  currentAnalysis = analysis;
  document.getElementById("systemName").textContent = analysis.systemName;
  document.getElementById("summary").textContent = analysis.summary;
  renderDiagram(analysis);
  renderOptimizations(analysis.optimizations);
  initSimulation(analysis);
  resultEl.classList.remove("hidden");
}

const W = 1150, H = 720, PAD = 80;
const BOX_W = 124, BOX_H = 48;

function sx(x) { return PAD + (x / 100) * (W - 2 * PAD); }
function sy(y) { return PAD + (y / 100) * (H - 2 * PAD); }

// Dytter overlappende bokser fra hverandre til alle har luft rundt seg
function resolveOverlaps(components) {
  const pos = components.map((c) => ({ c, x: sx(c.x), y: sy(c.y) }));
  const minDx = BOX_W + 26;
  const minDy = BOX_H + 24;

  for (let iter = 0; iter < 300; iter++) {
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i], b = pos[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = minDx - Math.abs(dx);
        const oy = minDy - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          moved = true;
          // dytt langs aksen med minst overlapp
          if (ox / minDx < oy / minDy) {
            const push = (ox / 2 + 1) * (dx >= 0 ? 1 : -1);
            a.x -= push;
            b.x += push;
          } else {
            const push = (oy / 2 + 1) * (dy >= 0 ? 1 : -1);
            a.y -= push;
            b.y += push;
          }
        }
      }
    }
    if (!moved) break;
  }

  const layout = {};
  for (const p of pos) {
    layout[p.c.id] = {
      x: Math.max(PAD, Math.min(W - PAD, p.x)),
      y: Math.max(PAD - 30, Math.min(H - PAD + 30, p.y)),
    };
  }
  return layout;
}

function renderDiagram(analysis) {
  const byId = {};
  for (const c of analysis.components) byId[c.id] = c;
  const layout = resolveOverlaps(analysis.components);

  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`);
  svg.push(SYMBOL_DEFS);

  // Rør først (bak komponentene)
  for (const conn of analysis.connections) {
    const a = byId[conn.from];
    const b = byId[conn.to];
    if (!a || !b) continue;
    const pa = layout[a.id], pb = layout[b.id];

    const offset = conn.type === "tur" ? -6 : conn.type === "retur" ? 6 : 0;
    const { path, mid } = pipePath(pa, pb, offset);

    svg.push(`<path class="pipe ${conn.type}" d="${path}"/>`);
    svg.push(`<path class="flow ${conn.type}" d="${path}"/>`);

    if (conn.label) {
      svg.push(`<text class="pipe-label" x="${mid.x}" y="${mid.y - 5}">${esc(conn.label)}</text>`);
    }
  }

  // Komponenter
  for (const c of analysis.components) {
    const { x: cx, y: cy } = layout[c.id];
    const cls = SOURCES.has(c.type) ? "source" : CONSUMERS.has(c.type) ? "consumer" : "";
    const icon = `ic-${c.type in ICON_TYPES ? c.type : "annet"}`;
    svg.push(`<g>`);
    svg.push(
      `<rect class="comp-box ${cls}" x="${cx - BOX_W / 2}" y="${cy - BOX_H / 2}" width="${BOX_W}" height="${BOX_H}" rx="9"/>`
    );
    svg.push(
      `<use href="#${icon}" class="comp-symbol ${cls}" x="${cx - BOX_W / 2 + 8}" y="${cy - 12}" width="24" height="24"/>`
    );
    const tx = cx + 14;
    svg.push(`<text class="comp-label" x="${tx}" y="${cy + (c.info ? -2 : 4)}">${esc(trunc(c.label, 15))}</text>`);
    if (c.info) {
      svg.push(`<text class="comp-info" x="${tx}" y="${cy + 13}">${esc(trunc(c.info, 19))}</text>`);
    }
    svg.push(`</g>`);
  }

  svg.push(`</svg>`);
  diagramEl.innerHTML = svg.join("");
  applyFlowSpeed();
}

const ICON_TYPES = {
  kjel: 1, varmepumpe: 1, fjernvarme: 1, solfanger: 1, pumpe: 1,
  varmeveksler: 1, ventil: 1, shuntventil: 1, radiator: 1, gulvvarme: 1,
  ventilasjonsbatteri: 1, tank: 1, ekspansjonskar: 1, maaler: 1, annet: 1,
};

// Ortogonal rute som går fra kant til kant på boksene, ikke gjennom dem
function pipePath(pa, pb, offset) {
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // koble høyre kant -> venstre kant (eller omvendt)
    const dir = dx >= 0 ? 1 : -1;
    const x1 = pa.x + dir * (BOX_W / 2);
    const y1 = pa.y + offset;
    const x2 = pb.x - dir * (BOX_W / 2);
    const y2 = pb.y + offset;
    const mx = (x1 + x2) / 2 + offset;
    if (Math.abs(y1 - y2) < 6) {
      return { path: `M ${x1} ${y1} L ${x2} ${y2}`, mid: { x: (x1 + x2) / 2, y: y1 } };
    }
    return {
      path: `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`,
      mid: { x: mx, y: (y1 + y2) / 2 },
    };
  } else {
    // koble bunn -> topp (eller omvendt)
    const dir = dy >= 0 ? 1 : -1;
    const x1 = pa.x + offset;
    const y1 = pa.y + dir * (BOX_H / 2);
    const x2 = pb.x + offset;
    const y2 = pb.y - dir * (BOX_H / 2);
    const my = (y1 + y2) / 2 + offset;
    if (Math.abs(x1 - x2) < 6) {
      return { path: `M ${x1} ${y1} L ${x2} ${y2}`, mid: { x: x1, y: (y1 + y2) / 2 } };
    }
    return {
      path: `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`,
      mid: { x: (x1 + x2) / 2, y: my },
    };
  }
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

// --- Simulering av sparepotensial ---

const sim = {
  demand: document.getElementById("simDemand"),
  price: document.getElementById("simPrice"),
  dT: document.getElementById("simDT"),
  pump: document.getElementById("simPump"),
  night: document.getElementById("simNight"),
};

function initSimulation(analysis) {
  // Faktor for turtemperatur-senking avhenger av varmekilde
  const hasHeatPump = analysis.components.some((c) => c.type === "varmepumpe");
  sim.dtFactor = hasHeatPump ? 2.5 : 0.7;
  sim.sourceLabel = hasHeatPump
    ? "varmepumpe (~2,5 % per °C lavere turtemp)"
    : "kjel/fjernvarme (~0,7 % per °C lavere turtemp)";

  sim.dT.value = 0;
  sim.pump.value = 100;
  sim.night.value = 0;
  updateSimulation();
}

["input", "change"].forEach((ev) => {
  for (const el of [sim.demand, sim.price, sim.dT, sim.pump, sim.night]) {
    el.addEventListener(ev, updateSimulation);
  }
});

function updateSimulation() {
  if (!currentAnalysis) return;

  const demand = Math.max(0, parseFloat(sim.demand.value) || 0);
  const price = Math.max(0, parseFloat(sim.price.value) || 0);
  const dT = parseFloat(sim.dT.value);
  const pumpPct = parseFloat(sim.pump.value);
  const nightH = parseFloat(sim.night.value);

  // 1) Lavere turtemperatur: bedre virkningsgrad/COP + lavere tap
  const dtSave = dT * sim.dtFactor;

  // 2) Pumpeturtall: affinitetslovene, effekt ~ turtall^3.
  //    Antar pumpeenergi tilsvarer ~4 % av varmebehovet.
  const pumpShare = 4;
  const pumpSave = pumpShare * (1 - Math.pow(pumpPct / 100, 3));

  // 3) Nattsenking: ~0,3 % av varmebehovet per time med senket temperatur
  const nightSave = nightH * 0.3;

  const totalPct = Math.min(40, dtSave + pumpSave + nightSave);
  const kwh = (demand * totalPct) / 100;
  const kr = kwh * price;

  document.getElementById("simDTVal").textContent = `−${dT} °C`;
  document.getElementById("simPumpVal").textContent = `${pumpPct} %`;
  document.getElementById("simNightVal").textContent = `${nightH} t/døgn`;

  document.getElementById("simTotal").textContent = `${totalPct.toFixed(1)} %`;
  document.getElementById("simKwh").textContent = `${Math.round(kwh).toLocaleString("nb-NO")} kWh/år`;
  document.getElementById("simKr").textContent = `${Math.round(kr).toLocaleString("nb-NO")} kr/år`;

  document.getElementById("simBreakdown").innerHTML = `
    <li>Turtemperatur: <strong>${dtSave.toFixed(1)} %</strong> <span class="sim-note">(${esc(sim.sourceLabel)})</span></li>
    <li>Pumpedrift: <strong>${pumpSave.toFixed(1)} %</strong> <span class="sim-note">(effekt ∝ turtall³)</span></li>
    <li>Nattsenking: <strong>${nightSave.toFixed(1)} %</strong> <span class="sim-note">(~0,3 % per time)</span></li>`;

  applyFlowSpeed();
}

// Vannstrøm-animasjonen følger pumpeturtallet
function applyFlowSpeed() {
  const pumpPct = parseFloat(sim.pump.value) || 100;
  const duration = 1 / Math.max(0.15, pumpPct / 100);
  diagramEl.querySelectorAll(".flow").forEach((el) => {
    el.style.animationDuration = `${duration}s`;
  });
}

// --- Hjelpere ---

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function trunc(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
