"use strict";

/* =====================================================================
 * 1. REGLAS DEL JUEGO
 * ===================================================================== */
const SQUAD_SIZE = 18;           // 11 titulares + 7 suplentes
const MAX_PER_CLUB = 3;
const BUDGET = 85000000;         // presupuesto inicial
const LIST_LIMIT = 120;          // máximo de jugadores dibujados en la lista

const GROUP_ORDER = ["GK", "DEF", "MID", "FWD"];
const GROUP_LABEL = { GK: "ARQ", DEF: "DEF", MID: "VOL", FWD: "DEL" };
const BENCH = { GK: 1, DEF: 2, MID: 2, FWD: 2 };          // suplentes obligatorios por puesto
const FORMATIONS = ["4-4-2", "4-3-3", "3-4-3", "4-5-1", "3-5-2", "5-3-2", "3-3-4", "4-2-4", "5-2-3"];

// Posición registrada de PES (columna REGISTERED POSITION) -> puesto del Gran DT
//   GK | CWP-CBT-SB | DM-WB-CM-SM-AM | WG-SS-CF
const PES_POSITION_GROUP = { 0: "GK", 2: "DEF", 3: "DEF", 4: "DEF",
  5: "MID", 6: "MID", 7: "MID", 8: "MID", 9: "MID", 10: "FWD", 11: "FWD", 12: "FWD" };

const IGNORED_CLUB = /^Team [A-R]$/;     // equipos de relleno del PES
const IGNORED_NAME = /^Player\d*$/;      // jugadores de relleno del PES
const SALARY_MULTIPLIER = 10000;         // precio = salario del PES * 10.000 (provisorio)

/* =====================================================================
 * VALORACIÓN GLOBAL (1-99)
 * Promedio ponderado de atributos del PES. Cada puesto tiene sus pesos (suman 100),
 * en el mismo orden que RATING_COLUMNS.
 * ===================================================================== */
const RATING_COLUMNS = ["ATTACK", "DEFENSE", "BALANCE", "STAMINA", "TOP SPEED", "ACCELERATION", "RESPONSE",
  "AGILITY", "DRIBBLE ACCURACY", "DRIBBLE SPEED", "SHORT PASS ACCURACY", "SHORT PASS SPEED",
  "LONG PASS ACCURACY", "LONG PASS SPEED", "SHOT ACCURACY", "SHOT POWER", "SHOT TECHNIQUE", "HEADING",
  "JUMP", "TECHNIQUE", "AGGRESSION", "GOAL KEEPING", "MENTALITY"];

const WEIGHTS = {
  CF: [10, 0, 5, 1, 4, 4, 9, 0, 4, 1, 3, 1, 0, 0, 17, 8, 5, 10, 4, 8, 6, 0, 0],
  SS: [9, 0, 4, 2, 6, 7, 8, 0, 7, 2, 5, 1, 0, 0, 13, 7, 5, 5, 2, 10, 7, 0, 0],
  WG: [6, 0, 1, 3, 7, 7, 5, 3, 12, 7, 5, 1, 2, 1, 8, 5, 5, 0, 2, 12, 8, 0, 0],
  AM: [6, 0, 0, 2, 4, 5, 4, 6, 11, 4, 15, 3, 6, 2, 5, 2, 7, 0, 0, 15, 3, 0, 0],
  CM: [4, 5, 2, 9, 2, 2, 6, 0, 7, 2, 15, 3, 13, 3, 2, 3, 6, 0, 0, 15, 1, 0, 0],
  DM: [0, 25, 5, 15, 3, 1, 15, 0, 0, 0, 10, 2, 12, 4, 0, 0, 0, 0, 2, 7, 0, 0, 0],
  SM: [5, 0, 0, 6, 7, 7, 3, 3, 12, 6, 7, 3, 8, 5, 3, 2, 4, 0, 0, 12, 7, 0, 0],
  SB: [3, 6, 2, 16, 9, 9, 4, 3, 3, 5, 6, 2, 10, 6, 0, 0, 0, 2, 3, 7, 4, 0, 0],   // también WB
  CB: [0, 40, 15, 1, 3, 0, 18, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 12, 5, 3, 0, 0, 0], // también CWP
  GK: [0, 15, 5, 0, 0, 0, 30, 10, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 12, 1, 2, 18, 4],
};
// REGISTERED POSITION del CSV -> pesos
const POSITION_WEIGHTS = { 0: WEIGHTS.GK, 2: WEIGHTS.CB, 3: WEIGHTS.CB, 4: WEIGHTS.SB, 5: WEIGHTS.DM,
  6: WEIGHTS.SB, 7: WEIGHTS.CM, 8: WEIGHTS.SM, 9: WEIGHTS.AM, 10: WEIGHTS.WG, 11: WEIGHTS.SS, 12: WEIGHTS.CF };

function overallRating(raw) {
  const weights = POSITION_WEIGHTS[raw["REGISTERED POSITION"]] || WEIGHTS.CF;   // por defecto, como CF
  const total = RATING_COLUMNS.reduce((sum, column, i) => sum + Number(raw[column]) * weights[i], 0) / 100;
  return Math.min(99, Math.max(1, Math.round(total)));
}

/* =====================================================================
 * 2. LEER EL CSV Y ARMAR LOS JUGADORES
 * Cada jugador conserva en `raw` las 100 columnas del CSV tal cual,
 * así después se pueden volver a importar al PES.
 * ===================================================================== */
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim() !== "");
  const headers = lines[0].split(",");
  const players = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const raw = Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
    const group = PES_POSITION_GROUP[raw["REGISTERED POSITION"]];
    const ignored = raw.NAME.startsWith("<") || IGNORED_NAME.test(raw.NAME)       // "<" = duplicado/para editar
                 || raw["CLUB TEAM"] === "" || IGNORED_CLUB.test(raw["CLUB TEAM"]) || !group;
    if (ignored) continue;
    players.push({ id: Number(raw.ID), name: raw.NAME, club: raw["CLUB TEAM"], group,
                   overall: overallRating(raw), price: 0, finalPrice: 0, raw });
  }
  return players;
}

// SALARIOS.csv ("id,SALARY") -> { id: salario }
function parseSalaries(text) {
  const salaries = {};
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
    const [id, salary] = line.split(",");
    if (id && salary !== undefined) salaries[Number(id)] = Number(salary);
  }
  return salaries;
}

// FÓRMULA DEL PRECIO: salario * 10.000 * global / 100
const calculatePrice = (salary, overall) => salary * SALARY_MULTIPLIER * overall / 100;

function applySalaries(players, salaries) {
  for (const player of players) player.price = calculatePrice(salaries[player.id] || 0, player.overall);
}

/* =====================================================================
 * 3. ESTADO DEL EQUIPO (sin tocar el DOM)
 * Un "slot" es un lugar del equipo: { group, bench, player }.
 * Los titulares van primero en la lista, así los jugadores los ocupan antes que el banco.
 * ===================================================================== */
const state = {
  players: [],
  formation: "4-4-2",
  slots: [],
  captainId: null,
  filter: { text: "", group: null, club: "", sort: "name" },
};

function buildSlots(formation) {
  const [def, mid, fwd] = formation.split("-").map(Number);
  const starters = { GK: 1, DEF: def, MID: mid, FWD: fwd };
  const slots = [];
  for (const [counts, bench] of [[starters, false], [BENCH, true]]) {
    for (const group of GROUP_ORDER) {
      for (let i = 0; i < counts[group]; i++) slots.push({ group, bench, player: null });
    }
  }
  return slots;
}

const pickedPlayers = () => state.slots.filter(s => s.player).map(s => s.player);
const remainingBudget = () => BUDGET - pickedPlayers().reduce((sum, p) => sum + p.price, 0);

function place(player) {                       // primer lugar libre de su puesto (titular antes que suplente)
  const slot = state.slots.find(s => s.group === player.group && !s.player);
  if (slot) slot.player = player;
  return Boolean(slot);
}

// Devuelve un texto de error, o null si el jugador se agregó.
function tryAddPlayer(player) {
  const team = pickedPlayers();
  if (team.some(p => p.id === player.id)) return "Ese jugador ya está en tu equipo";
  if (team.filter(p => p.club === player.club).length >= MAX_PER_CLUB) {
    return `Máximo ${MAX_PER_CLUB} jugadores de ${player.club}`;
  }
  if (player.price > remainingBudget()) return "No te alcanza el presupuesto para este jugador";
  if (!place(player)) return `No tenés más lugares de ${GROUP_LABEL[player.group]}`;
  return null;
}

function removeSlotPlayer(slot) {
  if (slot.player && slot.player.id === state.captainId) state.captainId = null;
  slot.player = null;
}

function changeFormation(formation) {          // al cambiar, se reubican los jugadores ya elegidos
  const team = pickedPlayers();
  state.formation = formation;
  state.slots = buildSlots(formation);
  team.forEach(place);                          // los que no entren quedan afuera
  const captainIsStarter = state.slots.some(s => !s.bench && s.player && s.player.id === state.captainId);
  if (!captainIsStarter) state.captainId = null;
}

/* =====================================================================
 * EXPORTAR EL EQUIPO A EQUIPO.csv
 * Copia las 100 columnas de cada jugador tal cual, y cambia SOLO estas:
 *   ID -> 4000, 4001, ... (arquero titular, defensores, volantes, delanteros, y después el banco)
 *   CLUB TEAM -> Team A | INTERNATIONAL NUMBER -> 0 | CLASSIC NUMBER -> 0
 * ===================================================================== */
const FIRST_TEAM_ID = 4000;

function buildTeamCsv() {
  const players = state.slots.map(slot => slot.player);       // el orden de los slots es el orden de los IDs
  const headers = Object.keys(players[0].raw);                 // mismas columnas y orden que JUGADORES.csv
  const rows = players.map((player, i) => {
    const row = { ...player.raw, "ID": FIRST_TEAM_ID + i, "CLUB TEAM": "Team A",
                  "INTERNATIONAL NUMBER": 0, "CLASSIC NUMBER": 0 };
    return headers.map(header => row[header]).join(",");
  });
  return [headers.join(","), ...rows].join("\r\n") + "\r\n";
}

/* =====================================================================
 * 4. INTERFAZ
 * ===================================================================== */
const $ = id => document.getElementById(id);
const norm = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const el = (tag, className = "", text = "") => Object.assign(document.createElement(tag), { className, textContent: text });
const makeButton = (text, className, onClick) => Object.assign(el("button", className, text), { onclick: onClick });

const byName = (a, b) => a.name.localeCompare(b.name);
const SORTERS = {
  name: byName,
  high: (a, b) => b.price - a.price || byName(a, b),
  low: (a, b) => a.price - b.price || byName(a, b),
};

const money = amount => `$${(amount / 1e6).toFixed(1)}M`;
const setStatus = text => { $("status").textContent = text; };
const message = text => { $("message").textContent = text; };

function render() {
  renderPitch();
  renderCounters();
  renderList();
}

/* ----- cancha y banco ----- */
function rowOf(slots) {
  const row = el("div", "row");
  row.append(...slots.map(slotElement));
  return row;
}

function renderPitch() {
  $("pitch").replaceChildren(...GROUP_ORDER.map(g => rowOf(state.slots.filter(s => !s.bench && s.group === g))));
  $("bench").replaceChildren(el("h3", "", "SUPLENTES"), rowOf(state.slots.filter(s => s.bench)));
  $("formationBtn").textContent = state.formation;
}

function slotElement(slot) {
  if (!slot.player) {                           // lugar vacío: click = filtrar la lista por ese puesto
    const empty = el("div", `slot ${slot.group}`, GROUP_LABEL[slot.group]);
    empty.onclick = () => { state.filter.group = slot.group; syncGroupButtons(); renderList(); };
    return empty;
  }
  const box = el("div", `slot filled ${slot.group}`);
  box.append(el("div", "name", slot.player.name), el("div", "club", slot.player.club),
             el("div", "ovr", money(slot.player.price)));
  box.append(makeButton("×", "del", () => { removeSlotPlayer(slot); render(); }));
  if (!slot.bench) {                            // solo los titulares pueden ser capitán
    const isCaptain = slot.player.id === state.captainId;
    box.append(makeButton("C", "cap" + (isCaptain ? " on" : ""), () => { state.captainId = slot.player.id; render(); }));
  }
  return box;
}

function renderCounters() {
  const count = pickedPlayers().length;
  $("budget").textContent = money(remainingBudget());   // lo que te queda por gastar
  $("count").textContent = `${count}/${SQUAD_SIZE}`;
  $("confirmBtn").disabled = !(count === SQUAD_SIZE && state.captainId !== null);
  if (count === SQUAD_SIZE) {                    // equipo completo: solo falta el capitán para confirmar
    message(state.captainId === null ? "Falta elegir el capitán: tocá la C de uno de tus titulares" : "");
  }
}

/* ----- lista de jugadores (mercado) ----- */
function playerRow(player, picked) {
  const row = el("li", player.group + (picked ? " picked" : ""));   // la clase del puesto da el color (--c)
  const info = el("div", "info");
  info.append(el("b", "", player.name),
              el("small", "", `${GROUP_LABEL[player.group]} - ${player.club}`),
              el("small", "", `${player.raw.NATIONALITY} · ${player.raw.AGE} años · ${player.raw.HEIGHT} cm`));
  row.append(el("div", `shirt ${player.group}`), info, el("div", "ovr", player.overall), el("div", "price", money(player.price)));
  row.onclick = () => {
    const error = tryAddPlayer(player);
    message(error || "");
    if (!error) render();
  };
  return row;
}

function renderList() {
  const { text, group, club, sort } = state.filter;
  const query = norm(text);
  const picked = new Set(pickedPlayers().map(p => p.id));
  const found = state.players
    .filter(p => (!group || p.group === group) && (!club || p.club === club) && norm(p.name).includes(query))
    .sort(SORTERS[sort]);
  $("playerList").replaceChildren(...found.slice(0, LIST_LIMIT).map(p => playerRow(p, picked.has(p.id))));
  $("listInfo").textContent = found.length > LIST_LIMIT
    ? `Mostrando ${LIST_LIMIT} de ${found.length} jugadores (usá los filtros)`
    : `${found.length} jugadores`;
}

function syncGroupButtons() {
  document.querySelectorAll("#groupFilters button").forEach(b =>
    b.classList.toggle("active", b.dataset.group === state.filter.group));
}

/* ----- eventos ----- */
$("search").oninput = e => { state.filter.text = e.target.value; renderList(); };
$("clubSelect").onchange = e => { state.filter.club = e.target.value; renderList(); };
$("sortSelect").onchange = e => { state.filter.sort = e.target.value; renderList(); };
document.querySelectorAll("#groupFilters button").forEach(b => b.onclick = () => {
  state.filter.group = state.filter.group === b.dataset.group ? null : b.dataset.group;
  syncGroupButtons();
  renderList();
});

// Selector de formación: cada botón dibuja la táctica con puntos.
function buildFormationDialog() {
  $("formationGrid").replaceChildren(...FORMATIONS.map(formation => {
    const dots = el("div", "dots");
    formation.split("-").forEach(n => dots.append(Object.assign(el("span"), { innerHTML: "<i></i>".repeat(n) })));
    const button = makeButton(formation, formation === state.formation ? "active" : "", () => {
      changeFormation(formation);
      $("formationDialog").close();
      render();
    });
    button.append(dots);
    return button;
  }));
}
$("formationBtn").onclick = () => { buildFormationDialog(); $("formationDialog").showModal(); };

/* ----- option file (KONAMI-WIN32PES6OPT) -----
 * Con el option file abierto, Confirmar escribe los 18 jugadores en los IDs 4000-4017.
 * Chrome/Edge: guarda directamente sobre el archivo original (pide permiso).
 * Otros navegadores: descarga el option file modificado.
 * Sin option file: descarga EQUIPO.csv. */
let optionFile = null;      // option file abierto y desencriptado (lo maneja pes6-core.js)
let optionHandle = null;    // permiso para escribir sobre el archivo original (solo Chrome/Edge)

function loadOptionFile(bytes, name) {
  try {
    optionFile = parseOptionFile(bytes, name);
    setStatus(`Option file abierto: ${name}`);
  } catch (error) {
    optionFile = optionHandle = null;
    setStatus("Error: " + error.message);
  }
}

$("optionBtn").onclick = async () => {
  if (!window.showOpenFilePicker) return $("optionInput").click();   // navegador sin permiso de escritura
  try {
    [optionHandle] = await window.showOpenFilePicker();
    const file = await optionHandle.getFile();
    loadOptionFile(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (error) { /* el usuario canceló */ }
};
$("optionInput").onchange = async e => {
  const file = e.target.files[0];
  optionHandle = null;
  if (file) loadOptionFile(new Uint8Array(await file.arrayBuffer()), file.name);
};

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  link.click();
  URL.revokeObjectURL(link.href);
}

const report = text => { message(text); setStatus(text); };   // se muestra abajo de la cancha y arriba, en la barra

$("confirmBtn").onclick = async () => {
  const teamCsv = buildTeamCsv();
  if (!optionFile) {
    downloadFile("EQUIPO.csv", teamCsv, "text/csv;charset=utf-8");
    return message("EQUIPO.csv descargado (abrí un option file para modificarlo directamente)");
  }
  try {
    data = optionFile.data;                              // importCsv (pes6-core.js) escribe sobre `data`
    const { updated, warnings } = importCsv(teamCsv);    // aplica los 18 jugadores a los IDs 4000-4017
    warnings.forEach(w => console.warn(w));
    const bytes = buildOptionFile(optionFile);

    // Verificación: se vuelve a abrir lo que se va a guardar y se controla que los jugadores estén ahí.
    const saved = parseOptionFile(bytes, optionFile.name);
    data = saved.data;
    const names = state.slots.map((slot, i) => ({ expected: slot.player.name, found: playerName(FIRST_TEAM_ID + i) }));
    data = optionFile.data;
    const wrong = names.filter(n => n.expected.length <= 15 && n.expected !== n.found);
    if (wrong.length) throw new Error(`falló la verificación en ${wrong.length} jugadores (ej: ${wrong[0].found})`);
    const preview = names.slice(0, 3).map(n => n.found).join(", ");

    if (optionHandle) {
      const writable = await optionHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
      report(`${optionFile.name} modificado directamente y verificado: Team A ahora tiene ${preview}... (${updated} jugadores, 4000-4017)`);
    } else {
      downloadFile(optionFile.name, bytes, "application/octet-stream");
      report(`${optionFile.name} descargado y verificado: Team A ahora tiene ${preview}... (${updated} jugadores, 4000-4017). Abrí el archivo descargado, no el original.`);
    }
  } catch (error) {
    report("No se pudo guardar: " + error.message);
  }
};

/* ----- carga de los CSV ----- */
const csvTexts = { players: null, salaries: null };

function receiveCsv(text) {                      // detecta de qué archivo se trata por su encabezado
  csvTexts[/SALARY/i.test(text.split(/\r?\n/)[0]) ? "salaries" : "players"] = text;
}

function loadData() {
  if (!csvTexts.players) return;
  state.players = parseCsv(csvTexts.players);
  if (csvTexts.salaries) applySalaries(state.players, parseSalaries(csvTexts.salaries));
  const clubs = [...new Set(state.players.map(p => p.club))].sort((a, b) => a.localeCompare(b));
  $("clubSelect").replaceChildren(new Option("Todos los clubes", ""), ...clubs.map(c => new Option(c, c)));
  state.filter = { text: "", group: null, club: "", sort: "name" };
  changeFormation("4-4-2");
  state.captainId = null;
  syncGroupButtons();
  render();
  setStatus(`${state.players.length} jugadores de ${clubs.length} clubes` +
            (csvTexts.salaries ? "" : " (falta SALARIOS.csv: precios en $0)"));
}

$("csvInput").onchange = async e => {            // se pueden elegir los dos archivos juntos
  for (const file of e.target.files) receiveCsv(await file.text());
  loadData();
};
// Si la página se abre desde un servidor, intenta cargar ambos CSV sola (con doble click no puede).
Promise.all(["JUGADORES.csv", "SALARIOS.csv"].map(name => fetch(name).then(r => r.ok ? r.text() : Promise.reject())))
  .then(texts => { texts.forEach(receiveCsv); loadData(); })
  .catch(() => {});
changeFormation("4-4-2");
render();