"use strict";

/* =====================================================================
 * 4. INTERFAZ
 * ===================================================================== */
const $ = id => document.getElementById(id);
const cell = text => Object.assign(document.createElement("span"), { textContent: text });

let optionFile = null, teams = [], currentTeam = null, currentPlayer = null;

function setStatus(text) { $("status").textContent = text; }

function positionLabel(id) {
  const role = ROLES.find(r => r[1] === readStat(id, REG_POS.stat));
  return role ? role[0] : "?";
}

/* ----- lista de equipos y plantel ----- */
function fillTeamSelect() {
  const select = $("teamSelect");
  select.innerHTML = "";
  const groups = {};
  teams.forEach((team, index) => {
    if (!groups[team.group]) {
      groups[team.group] = document.createElement("optgroup");
      groups[team.group].label = team.group;
      select.append(groups[team.group]);
    }
    groups[team.group].append(new Option(team.name, index));
  });
}

function renderSquad() {
  const list = $("squad");
  list.innerHTML = "";
  for (const member of getSquad(currentTeam)) {
    const item = document.createElement("li");
    if (member.id === 0) {
      item.className = "empty";
      item.append(cell(""), cell("<empty>"), cell(""));
    } else {
      item.append(cell(member.number), cell(playerName(member.id)), cell(positionLabel(member.id)));
      if (member.id === currentPlayer) item.className = "sel";
      item.onclick = () => selectPlayer(member.id);
    }
    list.append(item);
  }
}

/* ----- formulario del jugador ----- */
function buildInput(field) {
  let input;
  if (field.options) {
    input = document.createElement("select");
    for (const o of field.options) input.append(new Option(o.label, o.value));
  } else if (field.check) {
    input = Object.assign(document.createElement("input"), { type: "checkbox" });
  } else {
    input = Object.assign(document.createElement("input"), { type: "number", min: field.number.min, max: field.number.max });
  }
  input.addEventListener("change", () => onFieldChange(field));
  field.input = input;

  const label = document.createElement("label");
  if (field.check) { label.className = "check"; label.append(input, field.label); }
  else label.append(field.label, input);
  return label;
}

function buildEditor() {
  const editor = $("editor");
  editor.innerHTML = '<h2 id="playerTitle"></h2><div class="groups"></div>';
  for (const [title, fields] of FIELD_GROUPS) {
    const box = document.createElement("fieldset");
    box.append(Object.assign(document.createElement("legend"), { textContent: title }));
    for (const field of fields) box.append(buildInput(field));
    editor.querySelector(".groups").append(box);
  }
}

function loadPlayer(id) {
  $("playerTitle").textContent = `Edit Player - ${id} - ${playerName(id)}`;
  for (const [, fields] of FIELD_GROUPS) {
    for (const field of fields) {
      const raw = readStat(id, field.stat);
      if (field.check) field.input.checked = raw === 1;
      else if (field.number) field.input.value = raw + field.number.add;
      else field.input.value = raw;
    }
  }
}

function readInput(field) {            // valor de pantalla -> valor crudo del archivo
  if (field.check) return field.input.checked ? 1 : 0;
  if (field.options) return Number(field.input.value);
  const { min, max, add } = field.number;
  const shown = Math.min(max, Math.max(min, parseInt(field.input.value, 10) || min));
  return shown - add;
}

function onFieldChange(field) {
  writeStat(currentPlayer, field.stat, readInput(field));
  writeStat(currentPlayer, ABILITY_EDITED, 1);
  // La posición registrada siempre tiene que estar marcada como posición del jugador.
  const registered = ROLES.find(r => r[1] === readStat(currentPlayer, REG_POS.stat));
  if (registered) writeStat(currentPlayer, stat(registered[2], registered[3], 1), 1);
  loadPlayer(currentPlayer);
  renderSquad();
  setStatus("Hay cambios sin descargar");
}

function selectPlayer(id) {
  currentPlayer = id;
  loadPlayer(id);
  renderSquad();
  logPlayer(id);
}

/* ----- abrir y descargar ----- */
$("fileInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    optionFile = parseOptionFile(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (error) {
    setStatus("Error: " + error.message);
    return;
  }
  data = optionFile.data;
  teams = buildTeamList();
  fillTeamSelect();
  buildEditor();
  currentPlayer = null;
  currentTeam = teams[$("teamSelect").value];
  renderSquad();
  $("app").hidden = false;
  $("saveBtn").disabled = false;
  $("csvBtn").disabled = false;
  setStatus(`${file.name} cargado`);
});

$("teamSelect").addEventListener("change", () => {
  currentTeam = teams[$("teamSelect").value];
  renderSquad();
});

function downloadOptionFile() {
  const blob = new Blob([buildOptionFile(optionFile)], { type: "application/octet-stream" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: optionFile.name });
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus("Descargado " + optionFile.name);
}
$("saveBtn").addEventListener("click", downloadOptionFile);

/* =====================================================================
 * 5. HERRAMIENTA DE INVESTIGACIÓN
 * Uso desde la consola del navegador (F12):  logPlayer(1033)
 * Sin argumentos usa el jugador seleccionado:  logPlayer()
 * Muestra los campos que ya conocemos y los 124 bytes crudos del jugador,
 * marcando qué bits todavía no sabemos para qué sirven.
 * ===================================================================== */

function logPlayer(id = currentPlayer) {
  if (id === null) return console.log("Elegí un jugador o usá logPlayer(<id>)");
  const base = playerAddress(id);
  const record = data.subarray(base, base + PLAYER_SIZE);
  const knownBits = new Uint8Array(PLAYER_SIZE).fill(0);
  knownBits.fill(0xFF, 0, 48);                       // bytes 0-31 nombre, 32-47 nombre de camiseta

  const markKnown = s => {                           // marca en knownBits los bits que usa este stat
    const bits = (s.mask << s.shift) & 0xFFFF;
    knownBits[47 + s.offset] |= bits & 0xFF;
    knownBits[48 + s.offset] |= bits >> 8;
  };

  const fields = {};
  for (const [, group] of FIELD_GROUPS) {
    for (const field of group) {
      const raw = readStat(id, field.stat);
      const shown = field.number ? raw + field.number.add
        : field.options ? (field.options.find(o => o.value === raw)?.label ?? "?")
        : raw === 1;
      fields[field.label] = { raw, shown };
      markKnown(field.stat);
    }
  }
  for (const [label, s] of Object.entries(EXTRA_STATS)) {
    fields[label] = { raw: readStat(id, s), shown: "" };
    markKnown(s);
  }

  const bin = n => n.toString(2).padStart(8, "0");
  const bytes = Array.from(record, (value, i) => ({
    byte: i,
    hex: value.toString(16).padStart(2, "0"),
    binary: bin(value),
    unknownBits: bin(value & ~knownBits[i] & 0xFF),   // bits encendidos que no sabemos qué son
  }));

  console.group(`Jugador ${id} - ${playerName(id)} (dirección ${base})`);
  console.log("Camiseta:", new TextDecoder().decode(record.subarray(32, 48)).replace(/\0/g, ""));
  console.log("Campos conocidos:"); console.table(fields);
  console.log("Bytes crudos (unknownBits = bits sin identificar):"); console.table(bytes);
  console.log("Hex completo:", Array.from(record, b => b.toString(16).padStart(2, "0")).join(" "));
  console.groupEnd();
}

$("csvBtn").addEventListener("click", () => $("csvInput").click());
$("csvInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";                      // permite elegir el mismo CSV otra vez
  if (!file) return;
  try {
    const { updated, warnings } = importCsv(await file.text());
    if (currentPlayer !== null) loadPlayer(currentPlayer);
    renderSquad();
    downloadOptionFile();
    warnings.forEach(w => console.warn(w));
    setStatus(`CSV aplicado a ${updated} jugadores` + (warnings.length ? `, ${warnings.length} avisos (ver consola)` : ""));
  } catch (error) {
    setStatus("Error: " + error.message);
  }
});