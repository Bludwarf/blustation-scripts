/**
 * cut-m2ts.ts
 * -----------
 * Coupe un fichier M2TS (enregistrements Freebox) en retirant des portions
 * à partir d'un export "Horodatage (CSV)" de LosslessCut.
 *
 * Stratégie :
 *  - Vidéo    : copiée sans réencodage (-c:v copy)
 *  - Audio    : réencodé en AAC-LC 128k (le HE-AAC Freebox n'a pas d'extradata
 *               valide et ne peut pas être copié tel quel)
 *  - Conteneur: MKV en sortie (le muxer M2TS de ffmpeg assigne un mauvais tag
 *               à l'AAC réencodé, rendant l'audio illisible)
 *  - Sous-titres DVB Teletext : exclus (incompatibles)
 *
 * Installation (une seule fois dans le dossier du script) :
 *   npm install
 *
 * Usage :
 *   ./node_modules/.bin/ts-node cut-m2ts.ts <fichier.m2ts> [horodatage.csv] [sortie.mkv] [--ffmpeg-path /chemin/vers/ffmpeg]
 *
 * Exemples :
 *   ./node_modules/.bin/ts-node cut-m2ts.ts "TMC - Madame est servie.m2ts"
 *   ./node_modules/.bin/ts-node cut-m2ts.ts "TMC - Madame est servie.m2ts" --ffmpeg-path /var/packages/ffmpeg7/target/bin/ffmpeg
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ─── Parsing des arguments ────────────────────────────────────────────────────

const args = process.argv.slice(2);

function extractFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  args.splice(idx, 2);
  return value;
}

const ffmpegPath = extractFlag("--ffmpeg-path") ?? "ffmpeg";
const [inputFile, csvArg, outputArg] = args;

if (!inputFile) {
  console.error(
      "Usage: ts-node cut-m2ts.ts <fichier.m2ts> [horodatage.csv] [sortie.mkv] [--ffmpeg-path /chemin/vers/ffmpeg]"
  );
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Fichier vidéo introuvable : ${inputFile}`);
  process.exit(1);
}

// CSV : argument explicite, ou automatique (même nom que la vidéo, extension .csv)
const csvFile = csvArg?.endsWith(".csv")
    ? csvArg
    : inputFile.replace(/\.[^.]+$/, ".csv");

if (!fs.existsSync(csvFile)) {
  console.error(`❌ Fichier CSV introuvable : ${csvFile}`);
  process.exit(1);
}

// Sortie en MKV (le muxer M2TS ffmpeg ne gère pas correctement l'AAC réencodé)
const outputFile = (outputArg && !outputArg.startsWith("--"))
    ? outputArg
    : deriveOutputName(inputFile, ".mkv");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Segment {
  start: string; // HH:MM:SS.mmm
  end: string;
  name: string;
}

// ─── Parsing du CSV ───────────────────────────────────────────────────────────

function parseCsv(filePath: string): Segment[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split(/\r?\n/);
  const segments: Segment[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(/^([^,]+),([^,]+),(.*)$/);
    if (!match) {
      console.warn(`⚠️  Ligne ignorée (format invalide) : ${line}`);
      continue;
    }

    const [, start, end, name] = match;
    const timeRegex = /^\d{2}:\d{2}:\d{2}\.\d{3}$/;
    if (!timeRegex.test(start.trim()) || !timeRegex.test(end.trim())) {
      console.warn(`⚠️  Ligne ignorée (format de temps invalide) : ${line}`);
      continue;
    }

    segments.push({
      start: start.trim(),
      end: end.trim(),
      name: name.replace(/^"|"$/g, "").trim(),
    });
  }

  return segments;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function deriveOutputName(input: string, ext: string): string {
  const base = path.basename(input, path.extname(input));
  const dir = path.dirname(input);
  return path.join(dir, `${base}_cut${ext}`);
}

function run(cmd: string): void {
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit" });
}

function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(":");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
}

// ─── Détecter si libfdk_aac est disponible ───────────────────────────────────

function detectAudioEncoder(): string {
  try {
    const out = execSync(`"${ffmpegPath}" -encoders 2>/dev/null`, { encoding: "utf-8" });
    if (out.includes("libfdk_aac")) {
      console.log("🎵 Encodeur audio : libfdk_aac (haute qualité)");
      return "libfdk_aac";
    }
  } catch { /* ignore */ }
  console.log("🎵 Encodeur audio : aac natif");
  return "aac";
}

// ─── Vérifier que ffmpeg est disponible ──────────────────────────────────────

try {
  execSync(`"${ffmpegPath}" -version`, { stdio: "ignore" });
} catch {
  console.error(`❌ ffmpeg introuvable : ${ffmpegPath}`);
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n📂 Vidéo  : ${inputFile}`);
console.log(`📋 CSV    : ${csvFile}`);
console.log(`💾 Sortie : ${outputFile}`);
console.log(`🔧 FFmpeg : ${ffmpegPath}`);

const segments = parseCsv(csvFile);

if (segments.length === 0) {
  console.error("❌ Aucun segment valide trouvé dans le CSV.");
  process.exit(1);
}

console.log(`\n📋 ${segments.length} segment(s) à garder :`);
segments.forEach((s, i) =>
    console.log(`   ${i + 1}. "${s.name}" : ${s.start} → ${s.end}`)
);

const audioEncoder = detectAudioEncoder();

const tmpDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "cut-m2ts-tmp-")
);
const tmpFiles: string[] = [];

try {
  console.log("\n⏳ Extraction des segments...");
  console.log("   (vidéo : copie directe | audio : réencodage AAC → MKV)\n");

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Segments temporaires aussi en MKV
    const tmpOut = path.join(tmpDir, `segment_${i}.mkv`);
    tmpFiles.push(tmpOut);

    // Durée du segment en secondes (nécessaire pour -t avec seek après -i)
    const duration = (timeToSeconds(seg.end) - timeToSeconds(seg.start)).toFixed(3);

    run(
        `"${ffmpegPath}" -y` +
        ` -analyzeduration 100M -probesize 100M` +
        // genpts EN INPUT FLAG : régénère les timestamps manquants
        // dans les paquets vidéo issus du flux MPEG-TS Freebox
        ` -fflags +genpts` +
        ` -i "${inputFile}"` +
        ` -ss ${seg.start}` +
        ` -t ${duration}` +
        // Vidéo + toutes pistes audio, sans sous-titres DVB
        ` -map 0:v -map 0:a` +
        // Vidéo : copie sans réencodage
        ` -c:v copy` +
        // Audio : réencodage AAC propre (nécessaire à cause du HE-AAC Freebox sans extradata)
        ` -c:a ${audioEncoder} -b:a 128k -ar 48000` +
        ` -avoid_negative_ts make_zero` +
        // MKV : conteneur universel, gère correctement l'AAC réencodé
        ` "${tmpOut}"`
    );
  }

  if (segments.length === 1) {
    fs.renameSync(tmpFiles[0], outputFile);
  } else {
    console.log("\n⏳ Concaténation des segments...");

    const concatList = path.join(tmpDir, "concat.txt");
    const listContent = tmpFiles
        .map(f => `file '${f.replace(/\\/g, "/")}'`)
        .join("\n");
    fs.writeFileSync(concatList, listContent, "utf-8");

    run(
        `"${ffmpegPath}" -y` +
        ` -f concat -safe 0` +
        ` -i "${concatList}"` +
        ` -c copy` +
        ` "${outputFile}"`
    );
  }

  console.log(`\n✅ Terminé ! Fichier final : ${outputFile}`);

} catch (err) {
  console.error("\n❌ Erreur pendant le traitement :", err);
  process.exit(1);

} finally {
  for (const f of tmpFiles) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
}
