// Génère les tonalités du terminal dans frontend/terminal/audio/
// Pure PCM 16-bit mono 44.1 kHz — aucun fichier binaire en repo (source reproductible).
import fs from "node:fs";
import path from "node:path";

const SR = 44100;
const AMP = 0.85;

function ecrireWav(chemin, echantillons) {
  const nb = echantillons.length;
  const buf = Buffer.alloc(44 + nb * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + nb * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(nb * 2, 40);
  for (let i = 0; i < nb; i++) {
    let v = echantillons[i];
    v = Math.max(-1, Math.min(1, v));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(chemin, buf);
  console.log("OK", chemin, (buf.length / 1024).toFixed(0) + " Ko");
}

function enveloppe(i, total, attaque = 0.005, relache = 0.02) {
  const t = i / SR;
  if (t < attaque) return t / attaque;
  if (t > total - relache) return Math.max(0, (total - t) / relache);
  return 1;
}

function ton(frequence, duree) {
  const n = Math.round(SR * duree);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const forme = Math.sin(2 * Math.PI * frequence * t);
    const harmonique = 0.35 * Math.sin(2 * Math.PI * frequence * 2 * t);
    const env = enveloppe(i, n);
    out[i] = (forme + harmonique) * env * AMP;
  }
  return out;
}

function concat(...listes) {
  const tot = listes.reduce((s, l) => s + l.length, 0);
  const out = new Float64Array(tot);
  let pos = 0;
  for (const l of listes) {
    out.set(l, pos);
    pos += l.length;
  }
  return out;
}

const silence = (d) => new Float64Array(Math.round(SR * d));

const outDir = path.resolve("frontend/terminal/audio");
fs.mkdirSync(outDir, { recursive: true });

// succès : petit arpège ascendant C5-E5-G5 (clair, positif)
const succes = concat(ton(523.25, 0.12), ton(659.25, 0.12), ton(783.99, 0.18));
ecrireWav(path.join(outDir, "succes.wav"), succes);

// déjà badgé : deux bips courts et égaux (neutre, non alarmiste)
const deja = concat(ton(660, 0.13), silence(0.09), ton(660, 0.13));
ecrireWav(path.join(outDir, "deja.wav"), deja);

// erreur : bourdon grave (attention)
ecrireWav(path.join(outDir, "erreur.wav"), ton(180, 0.42));