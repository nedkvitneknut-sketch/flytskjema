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
    <path d="M5 16c0-3 3-3 3-6S5 7 5 4M10 16c0-3 3-3 3-6s-3-3-3-6M15 16c0-3 3-3 3-6s-3-3-3-6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
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
    try { localStorage.setItem("lastAnalysis", JSON.stringify(json)); } catch {}
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

const W = 1200, H = 640;
const PAD = 56;
const BOX_W = 124, BOX_H = 48;

// Fjerner følere/målere som likevel kom med, og brokobler rørene gjennom dem
function pruneMeters(analysis) {
  const meters = new Set(
    analysis.components.filter((c) => c.type === "maaler").map((c) => c.id)
  );
  if (!meters.size) return analysis;

  const byId = {};
  for (const c of analysis.components) byId[c.id] = c;

  let conns = analysis.connections;
  for (const mid of meters) {
    const incoming = conns.filter((c) => c.to === mid && !meters.has(c.from));
    const outgoing = conns.filter((c) => c.from === mid && !meters.has(c.to));
    const bridged = [];
    if (incoming.length === 1 && outgoing.length === 1) {
      const m = byId[mid];
      bridged.push({
        from: incoming[0].from,
        to: outgoing[0].to,
        type: outgoing[0].type,
        label: incoming[0].label || m.info || m.label || "",
      });
    }
    conns = conns.filter((c) => c.from !== mid && c.to !== mid).concat(bridged);
  }

  return {
    ...analysis,
    components: analysis.components.filter((c) => !meters.has(c.id)),
    connections: conns,
  };
}

// Klassisk systemskjema: rød tur-skinne og blå retur-skinne horisontalt,
// produksjon til venstre (kjeler hevet over skinnene), kurser som tapper
// av vertikalt oppover, ekspansjonskar under.
function renderDiagram(rawAnalysis) {
  const analysis = pruneMeters(rawAnalysis);
  const comps = analysis.components;
  const ids = new Set(comps.map((c) => c.id));
  const conns = analysis.connections.filter((c) => ids.has(c.from) && ids.has(c.to));
  const neighborsOf = (id) =>
    conns.filter((c) => c.from === id || c.to === id).map((c) => (c.from === id ? c.to : c.from));

  // Klassifisering
  const consumers = comps.filter((c) => CONSUMERS.has(c.type));
  const consumerIds = new Set(consumers.map((c) => c.id));
  const vessels = comps.filter((c) => c.type === "ekspansjonskar" || c.type === "tank");
  const vesselIds = new Set(vessels.map((c) => c.id));
  const feeders = comps.filter(
    (c) =>
      (c.type === "ventil" || c.type === "shuntventil") &&
      neighborsOf(c.id).some((n) => consumerIds.has(n))
  );
  const feederIds = new Set(feeders.map((c) => c.id));

  const elevated = comps.filter(
    (c) => c.type === "kjel" && !consumerIds.has(c.id)
  );
  const elevatedIds = new Set(elevated.map((c) => c.id));

  const chainScore = { fjernvarme: 0, varmepumpe: 0, solfanger: 0, varmeveksler: 1, kjel: 2, pumpe: 3 };
  const chainSeq = comps
    .filter((c) => !consumerIds.has(c.id) && !feederIds.has(c.id) && !vesselIds.has(c.id))
    .sort((a, b) => (chainScore[a.type] ?? 4) - (chainScore[b.type] ?? 4) || a.x - b.x);

  // Geometri
  const turY = H * 0.62;
  const retY = turY + 24;
  const topY = H * 0.16;
  const feederY = H * 0.385;
  const kjelY = turY - 120;
  const vesselY = H * 0.9;

  const layout = {};
  let cursor = PAD + BOX_W / 2;
  const chainStep = Math.min(
    BOX_W + 46,
    chainSeq.length > 1 ? (W * 0.42 - PAD) / (chainSeq.length - 1) : BOX_W + 46
  );
  for (const c of chainSeq) {
    layout[c.id] = { x: cursor, y: elevatedIds.has(c.id) ? kjelY : (turY + retY) / 2 };
    cursor += chainStep;
  }
  const chainEndX = cursor - chainStep;

  // Kursene etter hverandre øverst, i samme rekkefølge som i originaltegningen
  const sortedCons = [...consumers].sort((a, b) => a.x - b.x || a.y - b.y);
  const consStart = Math.max(chainEndX + BOX_W, W * 0.46);
  const consEnd = W - PAD - BOX_W / 2;
  const kSpacing = sortedCons.length > 1 ? (consEnd - consStart) / (sortedCons.length - 1) : 0;
  const stagger = kSpacing > 0 && kSpacing < BOX_W + 14;
  sortedCons.forEach((c, i) => {
    layout[c.id] = {
      x: sortedCons.length > 1 ? consStart + i * kSpacing : consEnd,
      y: topY + (stagger && i % 2 === 1 ? BOX_H + 22 : 0),
    };
  });

  // Shunter på stigerøret til kursene de betjener
  for (const f of feeders) {
    const served = neighborsOf(f.id).filter((n) => consumerIds.has(n));
    const xs = served.map((n) => layout[n]?.x ?? W * 0.6);
    layout[f.id] = { x: xs.reduce((s, v) => s + v, 0) / xs.length, y: feederY };
  }

  // Ekspansjonskar/tanker under skinnene
  vessels.forEach((c, i) => {
    layout[c.id] = { x: Math.max(PAD + BOX_W / 2, chainEndX - i * (BOX_W + 40)), y: vesselY };
  });

  // Temperatur-etiketter per kurs (fra modellens forbindelser)
  const consLabel = {};
  for (const cn of conns) {
    if (cn.label) {
      if (consumerIds.has(cn.to)) consLabel[cn.to] = consLabel[cn.to] || cn.label;
      if (consumerIds.has(cn.from)) consLabel[cn.from] = consLabel[cn.from] || cn.label;
    }
  }

  // --- Tegn ---
  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`);
  svg.push(SYMBOL_DEFS);

  const trunkStart = PAD - 14;
  const lastRiserX = sortedCons.length ? Math.max(...sortedCons.map((c) => layout[c.id].x)) : chainEndX;
  const trunkEnd = Math.min(W - 24, lastRiserX + 40);

  // Hovedskinner: tur mot høyre, retur tilbake mot venstre
  const turPath = `M ${trunkStart} ${turY} L ${trunkEnd} ${turY}`;
  const retPath = `M ${trunkEnd} ${retY} L ${trunkStart} ${retY}`;
  svg.push(`<path class="pipe tur" d="${turPath}"/>`);
  svg.push(`<path class="flow tur" d="${turPath}"/>`);
  svg.push(`<path class="pipe retur" d="${retPath}"/>`);
  svg.push(`<path class="flow retur" d="${retPath}"/>`);

  // Spisslastkjeler over skinnene: fall ned til tur, løft fra retur
  for (const c of elevated) {
    const { x } = layout[c.id];
    const boxBottom = kjelY + BOX_H / 2;
    const tur = `M ${x - 8} ${boxBottom} L ${x - 8} ${turY}`;
    const ret = `M ${x + 8} ${retY} L ${x + 8} ${boxBottom}`;
    svg.push(`<path class="pipe tur" d="${tur}"/><path class="flow tur" d="${tur}"/>`);
    svg.push(`<path class="pipe retur" d="${ret}"/><path class="flow retur" d="${ret}"/>`);
  }

  // Stigerør til hver kurs: tur opp, retur ned
  for (const c of sortedCons) {
    const { x, y } = layout[c.id];
    const boxBottom = y + BOX_H / 2;
    const tur = `M ${x - 8} ${turY} L ${x - 8} ${boxBottom}`;
    const ret = `M ${x + 8} ${boxBottom} L ${x + 8} ${retY}`;
    svg.push(`<path class="pipe tur" d="${tur}"/><path class="flow tur" d="${tur}"/>`);
    svg.push(`<path class="pipe retur" d="${ret}"/><path class="flow retur" d="${ret}"/>`);
    if (consLabel[c.id]) {
      svg.push(
        `<text class="pipe-label" x="${x - 14}" y="${(turY + boxBottom) / 2}" text-anchor="end">${esc(consLabel[c.id])}</text>`
      );
    }
  }

  // Ekspansjonskar: enkel ledning ned fra returskinnen
  for (const c of vessels) {
    const { x, y } = layout[c.id];
    const line = `M ${x} ${retY} L ${x} ${y - BOX_H / 2}`;
    svg.push(`<path class="pipe annet" d="${line}" stroke-dasharray="4 5"/>`);
  }

  // Komponentbokser (over linjene)
  for (const c of comps) {
    if (!layout[c.id]) continue;
    const { x: cx, y: cy } = layout[c.id];
    const cls = SOURCES.has(c.type) ? "source" : CONSUMERS.has(c.type) ? "consumer" : "";
    const icon = `ic-${ICON_TYPES[c.type] ? c.type : "annet"}`;
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

  // Skinne-etiketter
  svg.push(`<text class="pipe-label" x="${trunkStart + 4}" y="${turY - 8}" text-anchor="start">Tur</text>`);
  svg.push(`<text class="pipe-label" x="${trunkStart + 4}" y="${retY + 16}" text-anchor="start">Retur</text>`);

  svg.push(`</svg>`);
  diagramEl.innerHTML = svg.join("");
  applyFlowSpeed();
}

const ICON_TYPES = {
  kjel: 1, varmepumpe: 1, fjernvarme: 1, solfanger: 1, pumpe: 1,
  varmeveksler: 1, ventil: 1, shuntventil: 1, radiator: 1, gulvvarme: 1,
  ventilasjonsbatteri: 1, tank: 1, ekspansjonskar: 1, maaler: 1, annet: 1,
};

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

// Vannstrøm-animasjonen følger pumpeturtallet.
// Settes som CSS-variabel på containeren så den treffer alle rør, også nye.
function applyFlowSpeed() {
  const pumpPct = parseFloat(sim.pump.value) || 100;
  const duration = Math.pow(100 / pumpPct, 1.8); // 100 % -> 1s, 50 % -> ~3,5s
  diagramEl.style.setProperty("--flow-dur", `${duration.toFixed(2)}s`);
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

// Gjenopprett forrige analyse ved sideinnlasting (sparer API-kall under testing)
try {
  const saved = localStorage.getItem("lastAnalysis");
  if (saved) {
    dropzone.classList.add("hidden");
    render(JSON.parse(saved));
  }
} catch {}
