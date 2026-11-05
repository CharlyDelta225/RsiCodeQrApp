// Archive ZIP minimale, sans compression (méthode « stored »).
// Suffit pour des PNG, déjà compressés : aucune dépendance à ajouter.

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dateDos(d) {
  const heure = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const jour = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { heure, jour };
}

/**
 * @param {{ nom: string, octets: Uint8Array }[]} fichiers
 * @returns {Blob} archive application/zip
 */
export function creerZip(fichiers) {
  const encodeur = new TextEncoder();
  const { heure, jour } = dateDos(new Date());
  const morceaux = [];
  const central = [];
  let position = 0;

  for (const { nom, octets } of fichiers) {
    const nomOctets = encodeur.encode(nom);
    const crc = crc32(octets);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, heure, true);
    local.setUint16(12, jour, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, octets.length, true);
    local.setUint32(22, octets.length, true);
    local.setUint16(26, nomOctets.length, true);
    local.setUint16(28, 0, true);
    morceaux.push(local, nomOctets, octets);

    const entree = new DataView(new ArrayBuffer(46));
    entree.setUint32(0, 0x02014b50, true);
    entree.setUint16(4, 20, true);
    entree.setUint16(6, 20, true);
    entree.setUint16(8, 0x0800, true);
    entree.setUint16(10, 0, true);
    entree.setUint16(12, heure, true);
    entree.setUint16(14, jour, true);
    entree.setUint32(16, crc, true);
    entree.setUint32(20, octets.length, true);
    entree.setUint32(24, octets.length, true);
    entree.setUint16(28, nomOctets.length, true);
    entree.setUint32(42, position, true);
    central.push(entree, nomOctets);

    position += 30 + nomOctets.length + octets.length;
  }

  const tailleCentral = central.reduce((n, m) => n + m.byteLength, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true);
  fin.setUint32(16, position, true);
  return new Blob([...morceaux, ...central, fin], { type: "application/zip" });
}
