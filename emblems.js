/* =====================================================================
 * ESCUDOS (emblemas) DE LOS EQUIPOS
 *
 * 1. De cualquier imagen a un escudo del PES: 64x64, con paleta (colores indexados) y transparencia.
 * 2. Guardarlo en el option file (port de Emblems.java y Clubs.java de PES Editor).
 *
 * El PES Editor pide un PNG de 64x64 ya indexado. Acá se hace todo solo:
 *   - se achica la imagen para que entre en 64x64 (sin deformarla; lo que sobra queda transparente),
 *   - se reducen los colores a 127 + 1 transparente,
 *   - el índice 0 de la paleta es siempre el transparente (como exige PES Editor).
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * 1. IMAGEN -> ESCUDO   { palette: [[r, g, b], ...], pixels: Uint8Array(4096) }
 *    pixels[i] = 0 es transparente; pixels[i] = n usa palette[n - 1].
 * --------------------------------------------------------------------- */
const EMBLEM_SIZE = 64;
const EMBLEM_MAX_COLORS = 127;          // + el transparente = 128 colores, lo máximo del formato grande
const ALPHA_LIMIT = 128;                // menos opaco que esto = transparente (el PES no mezcla por píxel)

async function imageToEmblem(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(EMBLEM_SIZE / bitmap.width, EMBLEM_SIZE / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  // Si la imagen es mucho más grande se achica a la mitad varias veces: sale más nítido que de un solo salto.
  let source = bitmap, sourceWidth = bitmap.width, sourceHeight = bitmap.height;
  while (sourceWidth >= width * 2 && sourceHeight >= height * 2) {
    sourceWidth = Math.floor(sourceWidth / 2);
    sourceHeight = Math.floor(sourceHeight / 2);
    const half = Object.assign(document.createElement("canvas"), { width: sourceWidth, height: sourceHeight });
    half.getContext("2d").drawImage(source, 0, 0, sourceWidth, sourceHeight);
    source = half;
  }

  const canvas = Object.assign(document.createElement("canvas"), { width: EMBLEM_SIZE, height: EMBLEM_SIZE });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingQuality = "high";
  context.drawImage(source, Math.floor((EMBLEM_SIZE - width) / 2), Math.floor((EMBLEM_SIZE - height) / 2), width, height);
  return quantizeEmblem(context.getImageData(0, 0, EMBLEM_SIZE, EMBLEM_SIZE).data);
}

// rgba: 64*64*4 bytes -> escudo con paleta. Si la imagen ya tiene pocos colores se respetan exactos.
function quantizeEmblem(rgba) {
  const counts = new Map();                                     // color 0xRRGGBB -> cuántos píxeles
  for (let i = 0; i < EMBLEM_SIZE * EMBLEM_SIZE; i++) {
    if (rgba[i * 4 + 3] < ALPHA_LIMIT) continue;
    const color = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  const colors = counts.size <= EMBLEM_MAX_COLORS ? [...counts.keys()] : medianCut([...counts], EMBLEM_MAX_COLORS);

  const nearest = new Map();                                    // color de la imagen -> índice de paleta (desde 1)
  const indexOf = color => {
    if (!nearest.has(color)) {
      let best = 0, bestDistance = Infinity;
      colors.forEach((candidate, i) => {
        const distance = [16, 8, 0].reduce((sum, shift) => sum + (((color >> shift) & 255) - ((candidate >> shift) & 255)) ** 2, 0);
        if (distance < bestDistance) { best = i; bestDistance = distance; }
      });
      nearest.set(color, best + 1);
    }
    return nearest.get(color);
  };

  const pixels = new Uint8Array(EMBLEM_SIZE * EMBLEM_SIZE);     // todo en 0 = transparente
  for (let i = 0; i < pixels.length; i++) {
    if (rgba[i * 4 + 3] >= ALPHA_LIMIT) pixels[i] = indexOf((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]);
  }
  return { palette: colors.map(c => [c >> 16, (c >> 8) & 255, c & 255]), pixels };
}

// Corte por mediana: se parte la caja de colores más "ancha" por la mitad de sus píxeles hasta tener maxColors cajas.
function medianCut(entries, maxColors) {                        // entries: [[color, cantidad], ...]
  const channel = (color, c) => (color >> (16 - 8 * c)) & 255;
  const boxes = [entries];
  while (boxes.length < maxColors) {
    let best = -1, bestRange = 0, bestChannel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        const values = box.map(([color]) => channel(color, c));
        const range = Math.max(...values) - Math.min(...values);
        if (range > bestRange) { best = i; bestRange = range; bestChannel = c; }
      }
    });
    if (best < 0) break;
    const box = boxes[best].sort((a, b) => channel(a[0], bestChannel) - channel(b[0], bestChannel));
    const total = box.reduce((sum, [, count]) => sum + count, 0);
    let seen = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++) {
      seen += box[i][1];
      cut = i + 1;
      if (seen >= total / 2) break;
    }
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map(box => {                                     // el color de cada caja es el promedio de sus píxeles
    const total = box.reduce((sum, [, count]) => sum + count, 0);
    const average = shift => Math.round(box.reduce((sum, [color, count]) => sum + ((color >> shift) & 255) * count, 0) / total);
    return (average(16) << 16) | (average(8) << 8) | average(0);
  });
}

// Cómo se ve el escudo: lo usan la vista previa y la verificación.
function emblemToRgba({ palette, pixels }) {
  const rgba = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((index, i) => {
    if (index) rgba.set([...palette[index - 1], 255], i * 4);
  });
  return rgba;
}

/* ---------------------------------------------------------------------
 * 2. ESCUDOS EN EL OPTION FILE (usa la variable global `data`, igual que pes6-core.js)
 *
 * Hay 150 escudos posibles (ids 292 a 441) en dos formatos que comparten el mismo espacio de 100 unidades:
 *   grande: 128 colores, ocupa 2 unidades, hasta 50  -> ids 292-341
 *   chico:   16 colores, ocupa 1 unidad,  hasta 100 -> ids 342-441
 * Antes de los escudos hay dos contadores (cuántos grandes y chicos hay) y una tabla que dice,
 * para cada id, en qué lugar físico está (0x99 = id libre).
 * Cada lugar: [0] usado, [4-5] id, [64...] paleta (r, g, b, alpha), luego los píxeles.
 * --------------------------------------------------------------------- */
const EMBLEM_AREA = 911308;
const BIG_SIZE = 5184, SMALL_SIZE = 2176;                        // bytes por escudo grande / chico
const BIG_COUNT = EMBLEM_AREA - 160, SMALL_COUNT = EMBLEM_AREA - 159;
const BIG_TABLE = EMBLEM_AREA - 158, SMALL_TABLE = EMBLEM_AREA - 108;
const FIRST_EMBLEM_ID = 292, SMALL_FIRST_INDEX = 50, FIRST_DEFAULT_EMBLEM_ID = 115;   // los escudos de fábrica son id 115 + club
const FREE_ID = 0x99;
const CLUB_RECORD = 751472, CLUB_RECORD_BYTES = 88;              // el id del escudo está en +60 y +64; +68 y +69 = "editado"

const bigAddress = slot => EMBLEM_AREA + slot * BIG_SIZE;
const smallAddress = slot => EMBLEM_AREA + 49 * BIG_SIZE - (slot >> 1) * BIG_SIZE + (slot & 1) * SMALL_SIZE;   // los chicos se llenan desde el final
const freeSmall = () => 100 - data[BIG_COUNT] * 2 - data[SMALL_COUNT];
const freeBig = () => freeSmall() >> 1;

// Agrega el escudo en el primer lugar libre. Devuelve su id. Con 15 colores o menos usa el formato chico.
function addEmblem({ palette, pixels }) {
  const small = palette.length < 16;                             // 16 lugares de paleta, uno es el transparente
  if (small ? freeSmall() < 1 : freeBig() < 1) throw new Error("no hay lugar para el escudo en el option file (borrá escudos en PES Editor)");
  const slot = data[small ? SMALL_COUNT : BIG_COUNT];
  const address = small ? smallAddress(slot) : bigAddress(slot);

  for (let c = 0; c < (small ? 16 : 128); c++) {                 // paleta: 0 = transparente, después los colores, el resto vacío
    data.set(c >= 1 && c <= palette.length ? [...palette[c - 1], 255] : [0, 0, 0, 0], address + 64 + c * 4);
  }
  if (small) {                                                   // 4 bits por píxel: el primero va en la parte alta del byte
    for (let p = 0; p < pixels.length; p += 2) data[address + 128 + p / 2] = (pixels[p] << 4) | pixels[p + 1];
  } else {
    data.set(pixels, address + 1088);
  }
  data[address] = 1;

  data[small ? SMALL_COUNT : BIG_COUNT]++;
  const table = small ? SMALL_TABLE : BIG_TABLE;
  const index = [...data.subarray(table, table + (small ? 100 : 50))].indexOf(FREE_ID);   // primer id libre
  if (index < 0) throw new Error("la tabla de escudos del option file está llena");
  const id = FIRST_EMBLEM_ID + (small ? SMALL_FIRST_INDEX : 0) + index;
  data[table + index] = small ? SMALL_FIRST_INDEX + slot : slot;
  data.set([id & 255, id >> 8], address + 4);
  return id;
}

const clubEmblemId = club => u16(CLUB_RECORD + club * CLUB_RECORD_BYTES + 60);

// id = null -> vuelve al escudo de fábrica. Si no, el club usa ese escudo y queda marcado como "editado".
function setClubEmblemId(club, id) {
  const start = CLUB_RECORD + club * CLUB_RECORD_BYTES;
  const value = id ?? FIRST_DEFAULT_EMBLEM_ID + club;
  for (const offset of [60, 64]) data.set([value & 255, value >> 8], start + offset);
  data[start + 68] = data[start + 69] = id === null ? 0 : 1;
}

// Borra un escudo (index = id - 292). El último lugar ocupado pasa a tapar el hueco, como en PES Editor.
function deleteEmblem(index) {
  for (let club = 0; club < 140; club++) {                       // los clubes que lo usaban vuelven al de fábrica
    if (clubEmblemId(club) - FIRST_EMBLEM_ID === index) setClubEmblemId(club, null);
  }
  const small = index >= SMALL_FIRST_INDEX;
  const table = small ? SMALL_TABLE : BIG_TABLE, countAt = small ? SMALL_COUNT : BIG_COUNT;
  const addressOf = small ? smallAddress : bigAddress, size = small ? SMALL_SIZE : BIG_SIZE;
  const tableIndex = small ? index - SMALL_FIRST_INDEX : index;
  const slot = data[table + tableIndex] - (small ? SMALL_FIRST_INDEX : 0);

  data[table + tableIndex] = FREE_ID;
  const last = data[countAt] - 1, source = addressOf(last);
  if (slot !== last) {
    data.copyWithin(addressOf(slot), source, source + size);
    const movedIndex = u16(addressOf(slot) + 4) - FIRST_EMBLEM_ID - (small ? SMALL_FIRST_INDEX : 0);
    data[table + movedIndex] = slot + (small ? SMALL_FIRST_INDEX : 0);
  }
  data.fill(0, source, source + size);
  data[countAt] = last;
}

// Le pone el escudo a un club. Si ya tenía uno propio lo reemplaza (no se acumulan escudos viejos).
function setClubEmblem(club, emblem) {
  const current = clubEmblemId(club) - FIRST_EMBLEM_ID;
  if (current >= 0 && current < 150) deleteEmblem(current);
  setClubEmblemId(club, addEmblem(emblem));
}

// Lee el escudo del club como RGBA 64x64 (para verificar lo guardado). null si usa el de fábrica.
function readClubEmblemRgba(club) {
  const index = clubEmblemId(club) - FIRST_EMBLEM_ID;
  if (index < 0 || index >= 150) return null;
  const small = index >= SMALL_FIRST_INDEX;
  const entry = data[(small ? SMALL_TABLE : BIG_TABLE) + (small ? index - SMALL_FIRST_INDEX : index)];
  const address = small ? smallAddress(entry - SMALL_FIRST_INDEX) : bigAddress(entry);
  const rgba = new Uint8ClampedArray(EMBLEM_SIZE * EMBLEM_SIZE * 4);
  for (let p = 0; p < EMBLEM_SIZE * EMBLEM_SIZE; p++) {
    const color = small ? (data[address + 128 + (p >> 1)] >> ((p & 1) ? 0 : 4)) & 15 : data[address + 1088 + p];
    rgba.set(data.subarray(address + 64 + color * 4, address + 68 + color * 4), p * 4);
  }
  return rgba;
}