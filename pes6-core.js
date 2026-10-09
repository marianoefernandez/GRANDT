/* PES 6: lectura/escritura del option file (sin interfaz). Lo usan el editor y granDT. */
"use strict";

/* Tablas de datos (sacadas del código Java original) */
// Clave de desencriptado: cada valor es MAGIC + este número (446 palabras).
const KEY_OFFSETS = [
  54, 82, 113, 83, 88, 119, 77, 109, 72, 105, 99, 49, 104, 115, 100, 72, 105, 121, 119, 75, 68, 49, 82, 89,
  66, 120, 113, 49, 119, 80, 53, 97, 70, 55, 86, 118, 49, 97, 56, 116, 77, 67, 104, 106, 107, 57, 89, 82,
  81, 119, 80, 90, 120, 115, 87, 113, 76, 51, 85, 53, 78, 52, 90, 114, 102, 106, 109, 54, 50, 90, 99, 87,
  69, 66, 51, 120, 113, 104, 72, 104, 113, 108, 83, 88, 88, 87, 88, 102, 100, 74, 72, 114, 98, 49, 118, 86,
  120, 72, 118, 101, 89, 119, 76, 72, 51, 103, 80, 105, 90, 121, 56, 113, 74, 54, 122, 50, 113, 102, 103, 68,
  52, 107, 73, 79, 72, 89, 114, 115, 118, 114, 85, 88, 81, 77, 88, 104, 108, 67, 87, 53, 69, 113, 109, 103,
  109, 66, 73, 74, 69, 70, 51, 104, 111, 81, 66, 54, 117, 84, 69, 87, 99, 115, 100, 48, 120, 57, 88, 81,
  122, 104, 76, 48, 77, 108, 121, 78, 73, 114, 54, 49, 49, 51, 51, 110, 68, 103, 99, 67, 71, 72, 53, 112,
  102, 119, 103, 101, 110, 101, 120, 120, 114, 122, 103, 115, 110, 113, 105, 97, 81, 57, 65, 102, 54, 90, 108, 102,
  117, 106, 69, 81, 86, 48, 54, 89, 121, 49, 121, 117, 86, 55, 114, 107, 100, 73, 56, 118, 50, 48, 51, 112,
  87, 79, 81, 73, 54, 105, 67, 86, 56, 112, 110, 113, 116, 66, 75, 55, 51, 101, 66, 104, 52, 84, 84, 81,
  51, 52, 100, 104, 122, 109, 100, 76, 89, 88, 65, 118, 48, 53, 57, 97, 68, 53, 87, 73, 77, 108, 84, 102,
  107, 97, 53, 48, 103, 98, 74, 107, 74, 66, 82, 106, 108, 113, 72, 71, 112, 112, 80, 90, 57, 108, 97, 74,
  109, 114, 98, 116, 90, 53, 105, 90, 112, 75, 99, 83, 101, 120, 115, 50, 107, 75, 71, 67, 100, 52, 83, 107,
  72, 118, 83, 76, 106, 119, 57, 51, 88, 50, 114, 48, 112, 105, 82, 77, 90, 53, 111, 73, 81, 90, 83, 114,
  52, 120, 105, 112, 85, 97, 117, 69, 49, 84, 113, 79, 101, 75, 53, 57, 82, 54, 79, 71, 87, 65, 120, 120,
  79, 97, 120, 104, 97, 56, 89, 51, 99, 85, 49, 48, 105, 101, 114, 119, 100, 73, 57, 54, 116, 89, 108, 86,
  77, 103, 85, 49, 83, 75, 84, 51, 117, 80, 86, 121, 90, 50, 103, 72, 78, 112, 68, 81, 119, 70, 78, 108,
  86, 119, 121, 86, 121, 52, 57, 111, 83, 120, 85, 90, 68, 0
];
// Clave XOR de 256 bytes de los archivos PC.
const PC_XOR_KEY = [
  115, 96, 225, 198, 31, 60, 173, 66, 11, 88, 185, 254, 55, 180, 5, 250, 163, 80, 145, 54, 79, 44, 93, 178,
  59, 72, 105, 110, 103, 164, 181, 106, 211, 64, 65, 166, 127, 28, 13, 34, 107, 56, 25, 222, 151, 148, 101, 218,
  3, 48, 241, 22, 175, 12, 189, 146, 155, 40, 201, 78, 199, 132, 21, 74, 51, 32, 161, 134, 223, 252, 109, 2,
  203, 24, 121, 190, 247, 116, 197, 186, 99, 16, 81, 246, 15, 236, 29, 114, 251, 8, 41, 46, 39, 100, 117, 42,
  147, 0, 1, 102, 63, 220, 205, 226, 43, 248, 217, 158, 87, 84, 37, 154, 195, 240, 177, 214, 111, 204, 125, 82,
  91, 232, 137, 14, 135, 68, 213, 10, 243, 224, 97, 70, 159, 188, 45, 194, 139, 216, 57, 126, 183, 52, 133, 122,
  35, 208, 17, 182, 207, 172, 221, 50, 187, 200, 233, 238, 231, 36, 53, 234, 83, 192, 193, 38, 255, 156, 141, 162,
  235, 184, 153, 94, 23, 20, 229, 90, 131, 176, 113, 150, 47, 140, 61, 18, 27, 168, 73, 206, 71, 4, 149, 202,
  179, 160, 33, 6, 95, 124, 237, 130, 75, 152, 249, 62, 119, 244, 69, 58, 227, 144, 209, 118, 143, 108, 157, 242,
  123, 136, 169, 174, 167, 228, 245, 170, 19, 128, 129, 230, 191, 92, 77, 98, 171, 120, 89, 30, 215, 212, 165, 26,
  67, 112, 49, 86, 239, 76, 253, 210, 219, 104, 9, 142, 7, 196, 85, 138
];
const NATIONS = ["Austria", "Belgium", "Bulgaria", "Croatia", "Czech Republic", "Denmark", "England", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Netherlands", "Northern Ireland", "Norway", "Poland", "Portugal", "Romania", "Russia", "Scotland", "Serbia and Montenegro", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine", "Wales", "Angola", "Cameroon", "Cote d'Ivoire", "Ghana", "Nigeria", "South Africa", "Togo", "Tunisia", "Costa Rica", "Mexico", "Trinidad and Tobago", "United States", "Argentina", "Brazil", "Chile", "Colombia", "Ecuador", "Paraguay", "Peru", "Uruguay", "Iran", "Japan", "Saudi Arabia", "South Korea", "Australia", "Bosnia and Herzegovina", "Estonia", "Israel", "Honduras", "Jamaica", "Panama", "Bolivia", "Venezuela", "China", "Uzbekistan", "Albania", "Cyprus", "Iceland", "Macedonia", "Armenia", "Belarus", "Georgia", "Liechtenstein", "Lithuania", "Algeria", "Benin", "Burkina Faso", "Cape Verde", "Congo", "DR Congo", "Egypt", "Equatorial Guinea", "Gabon", "Gambia", "Guinea", "Guinea-Bissau", "Kenya", "Liberia", "Libya", "Mali", "Morocco", "Mozambique", "Senegal", "Sierra Leone", "Zambia", "Zimbabwe", "Canada", "Grenada", "Guadeloupe", "Martinique", "Netherlands Antilles", "Oman", "New Zealand", "Free Nationality"];

/* =====================================================================
 * 1. DESENCRIPTADO DEL OPTION FILE
 *
 * El archivo "real" (los datos del juego) mide siempre DATA_LENGTH bytes.
 * Según la consola/formato puede venir envuelto así:
 *   PC  : solo los datos, pero con un XOR de 256 bytes encima.
 *   XPS : [cabecera sharkport][datos][4 bytes en cero]
 *   PSU : [cabecera][datos]
 * Guardamos cabecera y cola tal cual para poder rearmar el archivo igual.
 *
 * Dentro de los datos, 9 bloques (BLOCKS[1..9]) están encriptados palabra
 * por palabra (enteros de 32 bits, little-endian). Cada palabra usa la
 * clave KEY[k], donde k es la posición de la palabra dentro del bloque
 * (la clave se repite cada 446 palabras). El bloque 0 no está encriptado.
 * Además cada bloque lleva un checksum 8 bytes antes de su inicio.
 * ===================================================================== */
const DATA_LENGTH = 1191936;
const MAGIC = 0x7ab3684c;
const KEY = KEY_OFFSETS.map(offset => MAGIC + offset);   // las claves son MAGIC + un número chico
const PC_SIGNATURE = [0x9f, 0x72, 0xe1, 0xc6];            // primeros bytes de un archivo PC
const BLOCKS = [                                          // [inicio, largo en bytes]
  [12, 4844], [5144, 1268], [9544, 4730], [14288, 22816], [37116, 620000],
  [657956, 93501], [751472, 12320], [763804, 147328], [911144, 259364], [1170520, 21032],
];

// Cuenta de una palabra: encriptada (cipher) -> original (plain), y al revés.
const decryptWord = (cipher, key) => (((cipher - key) + MAGIC) | 0) ^ MAGIC;
const encryptWord = (plain, key) => (key + ((plain ^ MAGIC) - MAGIC)) | 0;

// Recorre las palabras de los bloques 1..9 y reemplaza cada una por transform(palabra, clave).
function transformEncryptedBlocks(data, transform) {
  const view = new DataView(data.buffer);
  for (const [start, length] of BLOCKS.slice(1)) {
    let keyIndex = 0;
    for (let address = start; address + 4 <= start + length; address += 4) {
      const word = view.getInt32(address, true);
      view.setInt32(address, transform(word, KEY[keyIndex]), true);
      keyIndex = (keyIndex + 1) % KEY.length;
    }
  }
}
const decryptData = data => transformEncryptedBlocks(data, decryptWord);
const encryptData = data => transformEncryptedBlocks(data, encryptWord);

// Checksum de cada bloque: suma de sus palabras (32 bits), calculada con los datos YA encriptados.
function writeChecksums(data) {
  const view = new DataView(data.buffer);
  for (const [start, length] of BLOCKS) {
    let sum = 0;
    for (let address = start; address + 4 <= start + length; address += 4) {
      sum = (sum + view.getInt32(address, true)) | 0;
    }
    view.setInt32(start - 8, sum, true);
  }
}

// Solo en archivos PC: XOR de todo el archivo con una clave de 256 bytes que se repite.
function xorPC(data) {
  for (let i = 0; i < data.length; i++) data[i] ^= PC_XOR_KEY[i % 256];
}

/* ===== Leer y armar el archivo completo ===== */
function parseOptionFile(bytes, fileName) {
  const extension = fileName.split(".").pop().toLowerCase();
  let dataStart, isPC = false;
  if (extension === "xps") dataStart = bytes.length - DATA_LENGTH - 4;
  else if (extension === "psu") dataStart = bytes.length - DATA_LENGTH;
  else if (extension === "max") throw new Error("El formato .max todavía no está soportado.");
  else if (bytes.length === DATA_LENGTH && PC_SIGNATURE.every((b, i) => bytes[i] === b)) {
    dataStart = 0; isPC = true;
  } else throw new Error("No parece un option file de PES 6.");
  if (dataStart < 0) throw new Error("Archivo demasiado corto.");

  const data = bytes.slice(dataStart, dataStart + DATA_LENGTH);
  if (isPC) xorPC(data);
  decryptData(data);
  fixSquads(data);                 // igual que PES Editor al abrir un archivo (ver "Normalizar planteles")
  return {
    name: fileName, isPC, data,
    header: bytes.slice(0, dataStart),
    trailer: bytes.slice(dataStart + DATA_LENGTH),
  };
}

function buildOptionFile(file) {
  const data = file.data.slice();                 // copia: el original queda editable
  for (const address of [45, 46, 5938, 5939]) data[address] = 1;   // banderas "editado" del archivo
  encryptData(data);
  writeChecksums(data);
  if (file.isPC) xorPC(data);
  const result = new Uint8Array(file.header.length + data.length + file.trailer.length);
  result.set(file.header, 0);
  result.set(data, file.header.length);
  result.set(file.trailer, file.header.length + data.length);
  return result;
}

/* =====================================================================
 * 2. LEER Y ESCRIBIR DATOS DEL JUEGO (sobre `data`, ya desencriptado)
 * ===================================================================== */
let data = null;
const u16 = address => data[address] | (data[address + 1] << 8);

// Cada jugador ocupa 124 bytes. Los jugadores "creados" (id >= 32768) están en otra zona.
const PLAYER_SIZE = 124, FIRST_CREATED_ID = 32768;
const playerAddress = id => id >= FIRST_CREATED_ID
  ? 14288 + (id - FIRST_CREATED_ID) * PLAYER_SIZE
  : 37116 + id * PLAYER_SIZE;

// Un "stat" es un grupo de bits dentro de una palabra de 16 bits del jugador:
//   offset = dónde está la palabra, shift = desde qué bit, mask = cuántos bits (máscara).
const stat = (offset, shift, mask) => ({ offset, shift, mask });
const statAddress = (id, s) => playerAddress(id) + 47 + s.offset;

function readStat(id, s) {
  const address = statAddress(id, s);
  return (u16(address) >>> s.shift) & s.mask;
}
function writeStat(id, s, value) {
  const address = statAddress(id, s);
  const otherBits = u16(address) & ~(s.mask << s.shift) & 0xFFFF;   // conserva los bits vecinos
  const word = otherBits | ((value & s.mask) << s.shift);
  data[address] = word & 0xFF;
  data[address + 1] = word >> 8;
}

function playerName(id) {           // 32 bytes en UTF-16, termina en cero
  if (id === 0) return "<empty>";
  const base = playerAddress(id);
  let text = "";
  for (let i = 0; i < 32 && u16(base + i) !== 0; i += 2) text += String.fromCharCode(u16(base + i));
  return text || `<Jugador ${id}>`;
}

/* ===== Equipos y planteles ===== */
const FORMATIONS_ADDRESS = 677202, FORMATION_SIZE = 364;   // guarda el orden de los slots del plantel

function clubName(club) {
  const start = 751472 + club * 88;
  let end = start;
  while (end < start + 48 && data[end] !== 0) end++;
  return new TextDecoder().decode(data.subarray(start, end)) || `<Club ${club}>`;
}

// Selecciones nacionales (0..56) y clubes (0..139) con dónde está su plantel.
function buildTeamList() {
  const teams = [];
  for (let n = 0; n < 57; n++) {
    teams.push({ name: NATIONS[n], group: "Selecciones", size: 23, formation: n,
                 slots: 664372 + n * 46, numbers: 657956 + n * 23 });
  }
  for (let c = 0; c < 140; c++) {
    teams.push({ name: clubName(c), group: "Clubes", size: 32, formation: 64 + c,
                 slots: 667730 + c * 64, numbers: 659635 + c * 32 });
  }
  return teams;
}

function getSquad(team) {
  const squad = [];
  for (let position = 0; position < team.size; position++) {
    let slot = data[FORMATIONS_ADDRESS + 6 + FORMATION_SIZE * team.formation + position];
    if (slot >= team.size) slot = position;
    squad.push({
      id: u16(team.slots + slot * 2),
      number: data[team.numbers + slot] + 1,
    });
  }
  return squad;
}

/* ===== Normalizar planteles (port de Squads.fixAll de PES Editor) =====
 * Cada plantel tiene una lista de jugadores y un "mapa de formación" que dice qué lugar de la lista
 * juega en cada posición. En un archivo original el mapa puede ser cualquier permutación.
 * PES Editor, al abrir un archivo, reordena la lista según el mapa y deja el mapa en 0,1,2...31
 * (lo mismo hace con los números de camiseta y con los "jobs": capitán, tiros libres, etc.).
 * El plantel visible no cambia, pero el archivo queda tal cual lo guarda PES Editor. */
const JOBS_OFFSET = 111, JOB_COUNT = 6;      // dentro de cada formación: 6 bytes con lugares de la lista

function fixSquads(data) {
  for (let s = 0; s < 213; s++) {
    if (s >= 64 && s < 73) continue;            // 0-63 selecciones, 73-212 clubes
    const isNation = s < 64;
    const size = isNation ? 23 : 32;
    const slotsAddress = isNation ? 664372 + s * size * 2 : 667730 + (s - 73) * size * 2;
    const numbersAddress = isNation ? 657956 + s * size : 659635 + (s - 73) * size;
    const formation = FORMATIONS_ADDRESS + FORMATION_SIZE * (isNation ? s : s - 9);
    const mapAt = i => formation + 6 + i;       // mapa: posición i juega el lugar data[mapAt(i)] de la lista

    const oldSlots = new Uint8Array(64); oldSlots.set(data.subarray(slotsAddress, slotsAddress + size * 2));
    const oldNumbers = new Uint8Array(32); oldNumbers.set(data.subarray(numbersAddress, numbersAddress + size));
    for (let p = 0; p < size; p++) {
      const slot = data[mapAt(p)] < 32 ? data[mapAt(p)] : p;
      data[slotsAddress + p * 2] = oldSlots[slot * 2];
      data[slotsAddress + p * 2 + 1] = oldSlots[slot * 2 + 1];
      data[numbersAddress + p] = oldNumbers[slot];
    }
    for (let j = 0; j < JOB_COUNT; j++) {       // los jobs apuntan a un lugar de la lista: pasan a la posición nueva
      const job = formation + JOBS_OFFSET + j;
      for (let i = 0; i < 32; i++) {
        if (data[mapAt(i)] === data[job]) { data[job] = i; break; }
      }
    }
    for (let i = 0; i < 32; i++) data[mapAt(i)] = i;   // mapa identidad
  }
}

/* =====================================================================
 * 3. CAMPOS EDITABLES
 *   number  -> input numérico (se muestra raw + add)
 *   options -> select (el value es el número crudo guardado en el archivo)
 *   check   -> casilla (1 bit)
 * ===================================================================== */
const options = (labels, firstValue = 0) => labels.map((label, i) => ({ value: firstValue + i, label }));
const oneTo = n => options(Array.from({ length: n }, (_, i) => i + 1));

const REG_POS = { label: "Registered Position", stat: stat(6, 4, 0xF),
  options: null };   // se completa abajo, junto con ROLES
const ABILITY_EDITED = stat(40, 4, 1);   // si no está en 1, el juego ignora las stats editadas

// [nombre, valor de posición registrada, offset, bit]
const ROLES = [["GK",0,7,7], ["CWP",2,7,15], ["CBT",3,9,7], ["SB",4,9,15], ["DM",5,11,7], ["WB",6,11,15],
               ["CM",7,13,7], ["SM",8,13,15], ["AM",9,15,7], ["WG",10,15,15], ["SS",11,17,7], ["CF",12,17,15]];
REG_POS.options = ROLES.map(r => ({ value: r[1], label: r[0] }));

const GENERAL_FIELDS = [
  { label: "Nationality", stat: stat(65, 0, 0x7F), options: NATIONS.map((n, i) => ({ value: i, label: n })) },
  { label: "Age", stat: stat(65, 9, 0x1F), number: { min: 15, max: 46, add: 15 } },
  { label: "Height", stat: stat(41, 0, 0x3F), number: { min: 148, max: 211, add: 148 } },
  { label: "Weight", stat: stat(41, 8, 0x7F), number: { min: 1, max: 127, add: 0 } },
  { label: "Foot", stat: stat(5, 0, 1), options: options(["Right", "Left"]) },
  { label: "Side", stat: stat(33, 14, 3), options: options(["Same as foot", "Opposite", "Both"]) },
  { label: "Weak Foot Accuracy", stat: stat(33, 11, 7), options: oneTo(8) },
  { label: "Weak Foot Frequency", stat: stat(33, 3, 7), options: oneTo(8) },
  { label: "Consistency", stat: stat(33, 0, 7), options: oneTo(8) },
  { label: "Condition", stat: stat(33, 8, 7), options: oneTo(8) },
  { label: "Injury Tolerance", stat: stat(33, 6, 3), options: options(["C", "B", "A"]) },
  { label: "Dribble Style", stat: stat(6, 0, 3), options: oneTo(4) },
  { label: "Free Kick Style", stat: stat(5, 1, 0xF), options: oneTo(10) },
  { label: "Penalty Style", stat: stat(5, 5, 7), options: oneTo(5) },
  { label: "Drop Kick Style", stat: stat(6, 2, 3), options: oneTo(4) },
];

const POSITION_FIELDS = [
  REG_POS,
  ...ROLES.map(([name, , offset, shift]) => ({ label: name, stat: stat(offset, shift, 1), check: true })),
];

const ABILITY_FIELDS = [
  ["Attack",7], ["Defence",8], ["Balance",9], ["Stamina",10], ["Speed",11], ["Acceleration",12],
  ["Response",13], ["Agility",14], ["Dribble Accuracy",15], ["Dribble Speed",16],
  ["Short Pass Accuracy",17], ["Short Pass Speed",18], ["Long Pass Accuracy",19], ["Long Pass Speed",20],
  ["Shot Accuracy",21], ["Shot Power",22], ["Shot Technique",23], ["Free Kick Accuracy",24],
  ["Swerve",25], ["Heading",26], ["Jump",27], ["Technique",29], ["Aggression",30],
  ["Mentality",31], ["GK Skills",32], ["Team Work",28],
].map(([label, offset]) => ({ label, stat: stat(offset, 0, 0x7F), number: { min: 1, max: 99, add: 0 } }));

const SPECIAL_FIELDS = [
  ["Dribbling",21,7], ["Tactical dribble",21,15], ["Positioning",23,7], ["Reaction",23,15],
  ["Playmaking",25,7], ["Passing",25,15], ["Scoring",27,7], ["1-1 Scoring",27,15],
  ["Post player",29,7], ["Lines",29,15], ["Middle shooting",31,7], ["Side",31,15],
  ["Centre",19,15], ["Penalties",19,7], ["1-Touch pass",35,0], ["Outside",35,1],
  ["Marking",35,2], ["Sliding",35,3], ["Covering",35,4], ["D-Line control",35,5],
  ["Penalty stopper",35,6], ["1-On-1 stopper",35,7], ["Long throw",37,7],
].map(([label, offset, shift]) => ({ label, stat: stat(offset, shift, 1), check: true }));

const FIELD_GROUPS = [
  ["General", GENERAL_FIELDS], ["Position", POSITION_FIELDS],
  ["1-99 Ability", ABILITY_FIELDS], ["Special Ability", SPECIAL_FIELDS],
];

/* Campos del registro del jugador que se conocen pero el editor no muestra */
const EXTRA_STATS = {            // campos que se conocen del Java pero el editor no muestra
  "Hair": stat(45, 0, 0x7FF), "Face type": stat(55, 0, 3), "Skin": stat(41, 6, 3),
  "Face": stat(53, 5, 0x1FF), "Call name": stat(1, 0, 0xFFFF),
  "Name edited": stat(3, 0, 1), "Shirt edited": stat(3, 1, 1), "Call edited": stat(3, 2, 1),
  "Ability edited": ABILITY_EDITED,
};

/* =====================================================================
 * 6. IMPORTAR CSV (el que exporta PES Editor: Tools > Export stats to CSV)
 * Aplica los datos del CSV sobre `data` (el option file ya abierto).
 * Importa: nombre, camiseta, posiciones, stats, habilidades y aspecto.
 * NO toca planteles, clubes ni números de camiseta de los equipos.
 * ===================================================================== */
const generalStat = label => GENERAL_FIELDS.find(f => f.label === label).stat;
const FREE_NATION = Math.max(0, NATIONS.findIndex(n => n.toLowerCase().startsWith("free ")));
const isValidPlayerId = id => (id >= 1 && id < 5000) || (id >= FIRST_CREATED_ID && id <= 32951);

// columna del CSV -> [stat, número que hay que restar al valor del CSV para obtener el guardado]
const CSV_NUMBER_COLUMNS = {
  "REGISTERED POSITION": [REG_POS.stat, 0],
  "HEIGHT": [generalStat("Height"), 148],
  "WEIGHT": [generalStat("Weight"), 0],
  "AGE": [generalStat("Age"), 15],
  "WEAK FOOT ACCURACY": [generalStat("Weak Foot Accuracy"), 1],
  "WEAK FOOT FREQUENCY": [generalStat("Weak Foot Frequency"), 1],
  "CONSISTENCY": [generalStat("Consistency"), 1],
  "CONDITION / FITNESS": [generalStat("Condition"), 1],
  "DRIBBLE STYLE": [generalStat("Dribble Style"), 1],
  "FREE KICK STYLE": [generalStat("Free Kick Style"), 1],
  "PK STYLE": [generalStat("Penalty Style"), 1],
  "DROP KICK STYLE": [generalStat("Drop Kick Style"), 1],
  "SKIN COLOR": [EXTRA_STATS["Skin"], 1],
  "FACE TYPE": [EXTRA_STATS["Face type"], 0],
  "PRESET FACE NUMBER": [EXTRA_STATS["Face"], 1],
};

// Medidas físicas: cada par comparte UN byte del registro (media byte cada una).
// Cada medida va de -7 a +7 y se guarda como (valor + 7), o sea 0..14.
// [byte dentro del registro, columna de la mitad baja, columna de la mitad alta]
const PHYSICAL_PAIRS = [
  [91, "HEAD WIDTH", "NECK WIDTH"],
  [105, "NECK LENGTH", "CHEST MEASUREMENT"],
  [106, "ARM CIRCUMFERENCE", "WAIST CIRCUMFERENCE"],
  [107, "LEG CIRCUMFERENCE", "CALF CIRCUMFERENCE"],
  [108, "LEG LENGTH", "SHOULDER HEIGHT"],
];
const SHOULDER_WIDTH_BYTE = 109;       // este byte guarda solo SHOULDER WIDTH (mitad baja)

// Muñequera (byte 98) = color * 32 + tipo * 8. Sin muñequera = 0.
const WRISTBAND_TYPES = ["N", "L", "R", "B"];
const WRISTBAND_COLORS = ["White", "Black", "Red", "Blue", "Yellow", "Green", "Purple", "Cyan"];
function wristbandByte(type, color) {
  const t = WRISTBAND_TYPES.indexOf(type), c = WRISTBAND_COLORS.indexOf(color);
  return t > 0 && c >= 0 ? (c * 32 + t * 8) & 0xFF : 0;
}

function writePlayerName(id, name) {          // 15 caracteres máximo (UTF-16, 32 bytes)
  if (name.length === 0 || name.length > 15) return;
  const base = playerAddress(id);
  data.fill(0, base, base + 32);
  for (let i = 0; i < name.length; i++) {
    data[base + i * 2] = name.charCodeAt(i) & 0xFF;
    data[base + i * 2 + 1] = name.charCodeAt(i) >> 8;
  }
  writeStat(id, EXTRA_STATS["Call name"], 0xCDCD);
  writeStat(id, EXTRA_STATS["Name edited"], 1);
  writeStat(id, EXTRA_STATS["Call edited"], 1);
}

function writeShirtName(id, name) {           // solo A-Z . _ y espacio, 15 caracteres máximo
  name = name.toUpperCase().replace(/[^A-Z. _]/g, " ");
  if (name.length > 15) return;
  const base = playerAddress(id) + 32;
  data.fill(0, base, base + 16);
  for (let i = 0; i < name.length; i++) data[base + i] = name.charCodeAt(i);
  writeStat(id, EXTRA_STATS["Shirt edited"], 1);
}

function parseEditorCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim() !== "");
  return { headers: lines[0].split(","), rows: lines.slice(1).map(line => line.split(",")) };
}

function importCsv(text) {
  const { headers, rows } = parseEditorCsv(text);
  if (headers.length !== 100 || headers[0] !== "ID") throw new Error("El CSV no tiene el formato de PES Editor.");
  const column = name => headers.indexOf(name);
  const abilityStart = column("ATTACK"), specialStart = column("DRIBBLING");
  // Columnas de posiciones: terminan en el número de la posición ("GK  0", "CWP  2"...)
  const roleColumns = headers.flatMap((header, index) => {
    const role = /\s\d+$/.test(header) && ROLES.find(r => r[1] === parseInt(header.match(/\d+$/)[0], 10));
    return role ? [{ index, stat: stat(role[2], role[3], 1) }] : [];
  });

  const warnings = [];
  let updated = 0;
  for (const cells of rows) {
    const id = parseInt(cells[0], 10);
    if (!isValidPlayerId(id)) { warnings.push(`ID inválido: ${cells[0]}`); continue; }
    const get = name => cells[column(name)];
    const put = (s, raw, what) => {            // escribe solo si el valor entra en los bits del stat
      if (Number.isInteger(raw) && raw >= 0 && raw <= s.mask) writeStat(id, s, raw);
      else warnings.push(`Jugador ${id}: valor inválido en ${what}`);
    };

    if (!get("NAME").startsWith("<")) writePlayerName(id, get("NAME"));   // "<L 24>" = sin nombre
    writeShirtName(id, get("SHIRT_NAME"));

    for (const { index, stat: s } of roleColumns) put(s, parseInt(cells[index], 10), headers[index]);
    ABILITY_FIELDS.forEach((f, i) => put(f.stat, parseInt(cells[abilityStart + i], 10), f.label));
    SPECIAL_FIELDS.forEach((f, i) => put(f.stat, parseInt(cells[specialStart + i], 10), f.label));
    for (const [name, [s, subtract]] of Object.entries(CSV_NUMBER_COLUMNS)) {
      put(s, parseInt(get(name), 10) - subtract, name);
    }

    const foot = get("STRONG FOOT"), side = get("FAVOURED SIDE");     // R/L y R/L/B
    put(generalStat("Foot"), foot === "L" ? 1 : 0, "STRONG FOOT");
    put(generalStat("Side"), side === "B" ? 2 : side === foot ? 0 : 1, "FAVOURED SIDE");
    put(generalStat("Injury Tolerance"), ["C", "B", "A"].indexOf(get("INJURY TOLERANCE")), "INJURY TOLERANCE");
    const nation = NATIONS.indexOf(get("NATIONALITY"));
    put(generalStat("Nationality"), nation >= 0 ? nation : FREE_NATION, "NATIONALITY");

    const base = playerAddress(id);
    for (const [byte, lowColumn, highColumn] of PHYSICAL_PAIRS) {
      const low = parseInt(get(lowColumn), 10) + 7, high = parseInt(get(highColumn), 10) + 7;
      if (low >= 0 && low <= 14 && high >= 0 && high <= 14) data[base + byte] = (high << 4) | low;
      else warnings.push(`Jugador ${id}: valor inválido en ${lowColumn} / ${highColumn}`);
    }
    const shoulderWidth = parseInt(get("SHOULDER WIDTH"), 10) + 7;
    if (shoulderWidth >= 0 && shoulderWidth <= 14) {
      data[base + SHOULDER_WIDTH_BYTE] = (data[base + SHOULDER_WIDTH_BYTE] & 0xF0) | shoulderWidth;
    } else warnings.push(`Jugador ${id}: valor inválido en SHOULDER WIDTH`);
    data[base + 98] = wristbandByte(get("WRISTBAND"), get("WRISTBAND COLOR"));

    writeStat(id, ABILITY_EDITED, 1);
    updated++;
  }
  return { updated, warnings };
}