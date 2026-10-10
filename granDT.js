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
 * en el mismo orden que RATING_STATS.
 * ===================================================================== */
// Atributos que entran en la valoración (mismo orden que los pesos); los nombres son los de pes6-core.js
const RATING_STATS = ["Attack", "Defence", "Balance", "Stamina", "Speed", "Acceleration", "Response", "Agility",
  "Dribble Accuracy", "Dribble Speed", "Short Pass Accuracy", "Short Pass Speed", "Long Pass Accuracy",
  "Long Pass Speed", "Shot Accuracy", "Shot Power", "Shot Technique", "Heading", "Jump", "Technique",
  "Aggression", "GK Skills", "Mentality"].map(label => ABILITY_FIELDS.find(f => f.label === label).stat);

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

function overallRating(id) {
  const weights = POSITION_WEIGHTS[readStat(id, REG_POS.stat)] || WEIGHTS.CF;   // por defecto, como CF
  const total = RATING_STATS.reduce((sum, s, i) => sum + readStat(id, s) * weights[i], 0) / 100;
  return Math.min(99, Math.max(1, Math.round(total)));
}

/* =====================================================================
 * 2. LEER LOS JUGADORES DEL OPTION FILE
 * Los jugadores salen directo del option file abierto (no de un CSV), así se conserva
 * TODO el registro de 124 bytes: pelo, cara, nombre de locución, etc.
 * Entra al juego quien está en el plantel de un club. Se ignoran los "<...>" (duplicados o
 * para editar), los "Player" y los equipos "Team A-R".
 * ===================================================================== */
const fieldStat = label => GENERAL_FIELDS.find(f => f.label === label).stat;

function readPlayersFromOptionFile() {
  const players = new Map();                                   // por ID (si está en dos clubes, queda el último)
  for (const team of buildTeamList().filter(t => t.group === "Clubes" && !IGNORED_CLUB.test(t.name))) {
    for (const { id } of getSquad(team)) {
      if (!isValidPlayerId(id)) continue;
      const name = playerName(id);
      const group = PES_POSITION_GROUP[readStat(id, REG_POS.stat)];
      if (name.startsWith("<") || IGNORED_NAME.test(name) || !group) continue;
      const base = playerAddress(id);
      const age = readStat(id, fieldStat("Age")) + 15, height = readStat(id, fieldStat("Height")) + 148;
      players.set(id, { id, name, club: team.name, group, overall: overallRating(id), price: 0, finalPrice: 0,
        info: `${NATIONS[readStat(id, fieldStat("Nationality"))]} · ${age} años · ${height} cm`,
        record: data.slice(base, base + PLAYER_SIZE) });       // copia de los 124 bytes originales
    }
  }
  return [...players.values()];
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
 * COPIAR EL EQUIPO AL OPTION FILE
 * Equipos del PES 6 que se pueden reemplazar y el ID de su primer jugador (cada uno tiene 18).
 * Cada jugador elegido se copia byte a byte (los 124 bytes) sobre su lugar:
 *   primer ID = arquero titular, luego defensores, volantes, delanteros y por último el banco.
 * ===================================================================== */
/* Formaciones del PES 6 (una sola variante, la "A", de las que ofrece PES Editor en FormPanel.java).
 * Son 31 bytes por formación: 20 de coordenadas (x,y de los jugadores 2 al 11) y 11 de roles (0 = arquero).
 * Los lugares van ordenados igual que los slots del Gran DT: arquero, defensores, volantes, delanteros. */
const PES_FORMATIONS = {
  "4-4-2": [9, 63, 9, 41, 11, 85, 11, 19, 18, 52, 26, 75, 26, 29, 34, 52, 43, 66, 43, 38, 0, 7, 1, 9, 8, 12, 23, 22, 26, 40, 36],
  "4-3-3": [9, 63, 9, 41, 11, 85, 11, 19, 18, 52, 30, 64, 30, 40, 43, 72, 43, 32, 43, 52, 0, 7, 1, 9, 8, 12, 28, 24, 30, 29, 38],
  "3-4-3": [9, 72, 9, 52, 9, 32, 18, 52, 26, 77, 26, 27, 34, 52, 43, 72, 43, 32, 43, 52, 0, 7, 3, 1, 12, 23, 22, 26, 30, 29, 38],
  "4-5-1": [9, 63, 9, 41, 11, 85, 11, 19, 18, 52, 26, 75, 26, 29, 34, 64, 34, 40, 43, 52, 0, 7, 1, 9, 8, 12, 23, 22, 28, 24, 38],
  "3-5-2": [9, 72, 9, 52, 9, 32, 18, 52, 26, 77, 26, 27, 34, 64, 34, 40, 43, 66, 43, 38, 0, 7, 3, 1, 12, 23, 22, 28, 24, 40, 36],
  "5-3-2": [9, 72, 9, 52, 9, 32, 12, 87, 12, 17, 18, 52, 34, 64, 34, 40, 43, 66, 43, 38, 0, 7, 3, 1, 9, 8, 12, 28, 24, 40, 36],
  "5-4-1": [9, 72, 9, 52, 9, 32, 12, 87, 12, 17, 18, 52, 26, 75, 26, 29, 34, 52, 43, 52, 0, 7, 3, 1, 9, 8, 12, 23, 22, 26, 38],
  "3-6-1": [9, 72, 9, 52, 9, 32, 18, 52, 26, 52, 26, 77, 26, 27, 34, 64, 34, 40, 43, 52, 0, 7, 3, 1, 12, 19, 23, 22, 28, 24, 38]
};
const FORMATIONS = Object.keys(PES_FORMATIONS);

const PES_TEAMS = [
  { name: "Team A", firstId: 4000 },
  { name: "Team B", firstId: 4023 },
  { name: "Team C", firstId: 4046 },
  { name: "Team D", firstId: 4069 },
  { name: "Team E", firstId: 4092 },
  { name: "Team F", firstId: 4115 },
  { name: "Team G", firstId: 4138 },
  { name: "Team H", firstId: 4161 },
  { name: "Team I", firstId: 4184 },
  { name: "Team J", firstId: 4207 },
  { name: "Team K", firstId: 4230 },
  { name: "Team L", firstId: 4253 },
  { name: "Team M", firstId: 4276 },
  { name: "Team N", firstId: 4299 },
  { name: "Team O", firstId: 4322 },
  { name: "Team P", firstId: 4345 },
  { name: "Team Q", firstId: 4368 },
  { name: "Team R", firstId: 4391 }
];

function copyTeamIntoOptionFile(firstId) {
  // Igual que PES Editor al importar un jugador: se marcan como "editados" para que el juego use estos datos.
  const editedFlags = [EXTRA_STATS["Name edited"], EXTRA_STATS["Call edited"], EXTRA_STATS["Shirt edited"], ABILITY_EDITED];
  state.slots.forEach((slot, i) => {
    const id = firstId + i;
    data.set(slot.player.record, playerAddress(id));
    editedFlags.forEach(flag => writeStat(id, flag, 1));
  });
}

/* Team A-R son clubes del PES. Se encuentra el club por su primer jugador (no por el nombre, que ahora se puede cambiar).
 * Como fixSquads ya dejó el plantel ordenado, el lugar i del plantel es el lugar i de la formación. */
const CLUB_SQUAD_ADDRESS = 667730, CLUB_NAME_ADDRESS = 751472, CLUB_RECORD_SIZE = 88;
const CAPTAIN_JOB = 5, OVERLAP_CB_OFFSET = 106, PLAN_OFFSET = 118, ROLES_OFFSET = 138;

function findClubOfPlayer(playerId) {
  for (let club = 0; club < 140; club++) {
    for (let p = 0; p < 32; p++) if (u16(CLUB_SQUAD_ADDRESS + club * 64 + p * 2) === playerId) return club;
  }
  return -1;
}

const formationAddress = club => FORMATIONS_ADDRESS + FORMATION_SIZE * (64 + club);   // los clubes van después de las 64 selecciones

function checkClubSquad(club, firstId) {         // los 18 lugares tienen que ser firstId, firstId+1, ...
  for (let i = 0; i < SQUAD_SIZE; i++) {
    if (u16(CLUB_SQUAD_ADDRESS + club * 64 + i * 2) !== firstId + i) throw new Error("el plantel de ese equipo no tiene el orden original");
  }
}

function setFormation(club, formation) {        // lo mismo que elegir la formación en PES Editor (plan "Normal")
  const address = formationAddress(club);
  data.set(PES_FORMATIONS[formation], address + PLAN_OFFSET);
  const overlapRole = data[address + ROLES_OFFSET + data[address + OVERLAP_CB_OFFSET]];
  if (overlapRole < 1 || overlapRole > 7) data[address + OVERLAP_CB_OFFSET] = 0;   // PES Editor lo limpia si ya no es defensor
}

function setCaptain(club, slotIndex) { data[formationAddress(club) + JOBS_OFFSET + CAPTAIN_JOB] = slotIndex; }

const fitClubName = name => {                    // el nombre del club ocupa como máximo 48 bytes (UTF-8)
  while (new TextEncoder().encode(name).length > 48) name = name.slice(0, -1);
  return name;
};

function setClubName(club, name) {              // Clubs.setName / setAbv de PES Editor
  const start = CLUB_NAME_ADDRESS + club * CLUB_RECORD_SIZE;
  const encoder = new TextEncoder();
  data.fill(0, start, start + 49);
  data.set(encoder.encode(name), start);
  data[start + 56] = 1;                          // "nombre editado"
  const abbreviation = name.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3);
  if (abbreviation.length === 3) data.set(encoder.encode(abbreviation), start + 49);   // sigla de 3 letras
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
              el("small", "", player.info));
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
 * De acá salen los jugadores. Al confirmar, los 18 elegidos se copian a los IDs del equipo PES elegido (Team A-R).
 * Chrome/Edge: se guarda directamente sobre el archivo original (pide permiso).
 * Otros navegadores: se descarga el option file modificado. */
let optionFile = null;      // option file abierto y desencriptado (lo maneja pes6-core.js)
let optionHandle = null;    // permiso para escribir sobre el archivo original (solo Chrome/Edge)
let salaries = null;        // { id: salario } leído de SALARIOS.csv

function loadOptionFile(bytes, name) {
  try {
    optionFile = parseOptionFile(bytes, name);
    data = optionFile.data;                      // las funciones de pes6-core.js trabajan sobre `data`
    loadMarket();
  } catch (error) {
    optionFile = optionHandle = null;
    state.players = [];
    setStatus("Error: " + error.message);
  }
}

function loadMarket() {                          // arma la lista de jugadores con el option file abierto
  state.players = readPlayersFromOptionFile();
  if (salaries) applySalaries(state.players, salaries);
  const clubs = [...new Set(state.players.map(p => p.club))].sort((a, b) => a.localeCompare(b));
  $("clubSelect").replaceChildren(new Option("Todos los clubes", ""), ...clubs.map(c => new Option(c, c)));
  state.filter = { text: "", group: null, club: "", sort: "name" };
  state.slots.forEach(slot => { slot.player = null; });   // equipo nuevo para el option file nuevo
  changeFormation("4-4-2");
  state.captainId = null;
  syncGroupButtons();
  render();
  setStatus(`${optionFile.name}: ${state.players.length} jugadores de ${clubs.length} clubes` +
            (salaries ? "" : " (falta SALARIOS.csv: precios en $0)"));
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
  console.log(file)
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

// Al confirmar se pregunta qué equipo del PES reemplazar (se muestra cómo se llama hoy cada uno).
const captainSlotIndex = () => state.slots.findIndex(s => s.player && s.player.id === state.captainId);
const newTeamName = () => $("teamName").value.trim() || "Mi equipo";

$("confirmBtn").onclick = () => {
  if (!optionFile) return message("Primero abrí el option file");
  data = optionFile.data;
  $("teamSummary").textContent = `Se guarda como "${newTeamName()}" · ${state.formation} · ` +
                                 `Capitán: ${state.slots[captainSlotIndex()].player.name}`;
  $("teamGrid").replaceChildren(...PES_TEAMS.map(team => {
    const club = findClubOfPlayer(team.firstId);
    const button = makeButton(team.name, "", () => { $("teamDialog").close(); saveTeam(team); });
    button.append(el("small", "", `IDs ${team.firstId}-${team.firstId + SQUAD_SIZE - 1}`),
                  el("small", "", club < 0 ? "No encontrado" : `Hoy: ${clubName(club)}`));
    return button;
  }));
  $("teamDialog").showModal();
};
$("teamCancel").onclick = () => $("teamDialog").close();

async function saveTeam(team) {
  try {
    data = optionFile.data;
    const club = findClubOfPlayer(team.firstId);
    if (club < 0) throw new Error(`no encontré a ${team.name} en el option file`);
    checkClubSquad(club, team.firstId);
    const name = fitClubName(newTeamName()), captainSlot = captainSlotIndex();
    copyTeamIntoOptionFile(team.firstId);
    setFormation(club, state.formation);
    setCaptain(club, captainSlot);
    setClubName(club, name);
    const bytes = buildOptionFile(optionFile);

    // Verificación: se vuelve a abrir lo que se va a guardar y se controla nombre y pelo de cada copia.
    const saved = parseOptionFile(bytes, optionFile.name);
    data = saved.data;
    const hair = EXTRA_STATS["Hair"];
    const copies = state.slots.map((slot, i) => ({ source: slot.player, copyId: team.firstId + i }));
    const wrong = copies.filter(c => playerName(c.copyId) !== c.source.name
                                  || readStat(c.copyId, hair) !== readStat(c.source.id, hair));
    const formationBytes = data.subarray(formationAddress(club) + PLAN_OFFSET, formationAddress(club) + PLAN_OFFSET + 31);
    if (formationBytes.some((b, i) => b !== PES_FORMATIONS[state.formation][i])) throw new Error("la formación no quedó bien guardada");
    if (data[formationAddress(club) + JOBS_OFFSET + CAPTAIN_JOB] !== captainSlot) throw new Error("el capitán no quedó bien guardado");
    if (clubName(club) !== name) throw new Error("el nombre del equipo no quedó bien guardado");
    const range = `IDs ${team.firstId}-${team.firstId + SQUAD_SIZE - 1}`;
    const summary = `"${name}" (${team.name}, ${range}) · ${state.formation} · capitán ${state.slots[captainSlot].player.name}`;
    data = optionFile.data;
    if (wrong.length) throw new Error(`falló la verificación en ${wrong.length} jugadores (ej: ${wrong[0].source.name})`);

    if (optionHandle) {
      const writable = await optionHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
      report(`${optionFile.name} modificado directamente y verificado: ${summary}`);
    } else {
      downloadFile(optionFile.name, bytes, "application/octet-stream");
      report(`${optionFile.name} descargado y verificado: ${summary}. Abrí el archivo descargado, no el original.`);
    }
  } catch (error) {
    report("No se pudo guardar: " + error.message);
  }
}

/* ----- salarios (SALARIOS.csv) ----- */
function loadSalaries(text) {
  salaries = parseSalaries(text);
  applySalaries(state.players, salaries);
  render();
  setStatus(`Salarios cargados (${Object.keys(salaries).length} jugadores)`);
}
$("csvInput").onchange = async e => {
  if (e.target.files[0]) loadSalaries(await e.target.files[0].text());
};
// Si la página se abre desde un servidor, intenta cargar SALARIOS.csv sola (con doble click no puede).
fetch("SALARIOS.csv").then(r => r.ok ? r.text() : Promise.reject()).then(loadSalaries).catch(() => {});
changeFormation("4-4-2");
render();


// const file = 
fetch("KONAMI-WIN32PES6OPT")
  .then(r => r.blob())
  .then(async blob => {
    const file = new File(
      [blob],
      "KONAMI-WIN32PES6OPT",
      {
        type: blob.type,
        lastModified: new Date("2026-10-04T12:57:44-03:00").getTime()
      }
    );

    optionHandle = null;
    if (file) loadOptionFile(new Uint8Array(await file.arrayBuffer()), file.name);
  });
