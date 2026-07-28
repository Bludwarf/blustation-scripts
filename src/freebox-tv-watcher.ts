/**
 * freebox-tv-watcher.ts
 *
 * Squelette : surveille l'EPG de la Freebox et programme automatiquement
 * l'enregistrement d'un film/série dont le titre matche une watchlist.
 *
 * Ne gère PAS le déplacement des fichiers enregistrés (déjà couvert par
 * ton script existant qui vide la clé USB chaque matin).
 *
 * Requiert Node 18+ (fetch natif) et TypeScript (`ts-node` ou compilation).
 *   npm install --save-dev typescript ts-node @types/node
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Base URL de l'API Freebox. Utilise mafreebox.freebox.fr en local,
 *  ou le api_domain fourni par /api_version si tu veux du HTTPS distant. */
const FREEBOX_API_BASE = "http://mafreebox.freebox.fr/api/v4";

/** Identité de l'application, déclarée une fois lors du premier appairage. */
const APP_INFO = {
  app_id: "fr.bludwarf.tvwatcher",
  app_name: "TV Watcher",
  app_version: "1.0.0",
  device_name: "NAS",
};

/** Fichier local où l'app_token (secret, obtenu une seule fois) est stocké. */
const TOKEN_FILE = "./freebox-app-token.json";

/** Chaînes à surveiller (uuid Freebox) → nom pour les logs.
 *  TODO : remplir avec tes chaînes réelles (voir fetchChannels() ci-dessous
 *  pour lister les uuid disponibles, ex "uuid-webtv-201" pour France 2). */
const WATCHED_CHANNELS: Record<string, string> = {
  "uuid-webtv-201": "France 2",
  "uuid-webtv-202": "France 3",
  "uuid-webtv-611": "TF1",
  "uuid-webtv-612": "M6",
};

/** Titres recherchés dans l'EPG. Comparaison insensible à la casse,
 *  simple "includes" par défaut — remplace par une regex si besoin. */
const WATCHLIST: string[] = [
  // TODO: "Le Nom De La Série Ou Du Film"
];

/** Fenêtre de temps scannée à chaque passage (en secondes). */
const EPG_LOOKAHEAD_SECONDS = 24 * 3600;

/** Intervalle entre deux passages de surveillance (en ms). */
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1h

/** Marges avant/après l'enregistrement (en secondes), sinon utilise la
 *  config PVR par défaut de la Freebox (voir GET /pvr/config/). */
const MARGIN_BEFORE = 60;
const MARGIN_AFTER = 5 * 60;

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

interface StoredToken {
  app_token: string;
  track_id: number;
}

interface Session {
  sessionToken: string;
}

async function loadOrCreateAppToken(): Promise<string> {
  if (existsSync(TOKEN_FILE)) {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    return (JSON.parse(raw) as StoredToken).app_token;
  }

  // 1. Demande d'autorisation : à valider physiquement sur l'écran tactile
  //    du Freebox Server (ou l'appli Freebox Connect selon le modèle).
  const authorizeRes = await fetchJson<{
    result: { app_token: string; track_id: number };
  }>(`${FREEBOX_API_BASE}/login/authorize/`, {
    method: "POST",
    body: JSON.stringify(APP_INFO),
  });

  const { app_token, track_id } = authorizeRes.result;

  console.log("Valide la demande d'appairage sur l'écran de la Freebox...");

  // 2. Poll du statut jusqu'à validation (ou timeout/refus)
  let status = "pending";
  while (status === "pending") {
    await sleep(2000);
    const trackRes = await fetchJson<{ result: { status: string } }>(
        `${FREEBOX_API_BASE}/login/authorize/${track_id}`
    );
    status = trackRes.result.status; // pending | granted | denied | timeout
  }

  if (status !== "granted") {
    throw new Error(`Appairage non accordé (status=${status})`);
  }

  await writeFile(
      TOKEN_FILE,
      JSON.stringify({ app_token, track_id } satisfies StoredToken, null, 2)
  );

  return app_token;
}

async function openSession(appToken: string): Promise<Session> {
  // 1. Récupère le challenge courant
  const loginRes = await fetchJson<{ result: { challenge: string } }>(
      `${FREEBOX_API_BASE}/login/`
  );
  const { challenge } = loginRes.result;

  // 2. Signe le challenge avec l'app_token (HMAC-SHA1, résultat en hex)
  const password = createHmac("sha1", appToken).update(challenge).digest("hex");

  // 3. Ouvre la session
  const sessionRes = await fetchJson<{ result: { session_token: string } }>(
      `${FREEBOX_API_BASE}/login/session/`,
      {
        method: "POST",
        body: JSON.stringify({ app_id: APP_INFO.app_id, password }),
      }
  );

  return { sessionToken: sessionRes.result.session_token };
}

// ---------------------------------------------------------------------------
// EPG
// ---------------------------------------------------------------------------

interface EpgProgram {
  id: string;
  title: string;
  sub_title?: string;
  start: number; // timestamp unix
  duration: number; // secondes
}

async function fetchEpgForChannel(
    session: Session,
    channelUuid: string,
    fromTs: number
): Promise<EpgProgram[]> {
  // TODO : appeler l'API TV/EPG (v3 ou v4 selon firmware) pour la chaîne et
  // la plage horaire souhaitées, avec le header X-Fbx-App-Auth: session.sessionToken
  // Endpoint indicatif : /api/v4/tv/epg/by_time/{channelUuid}/{fromTs}
  throw new Error("fetchEpgForChannel: à implémenter");
}

function matchesWatchlist(program: EpgProgram): boolean {
  const haystack = `${program.title} ${program.sub_title ?? ""}`.toLowerCase();
  return WATCHLIST.some((title) => haystack.includes(title.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Programmation des enregistrements (PVR)
// ---------------------------------------------------------------------------

interface PrecordSummary {
  channel_uuid: string;
  start: number;
  end: number;
}

async function fetchExistingPrecords(session: Session): Promise<PrecordSummary[]> {
  const res = await fetchJson<{ result: PrecordSummary[] }>(
      `${FREEBOX_API_BASE}/pvr/programmed/`,
      { headers: authHeaders(session) }
  );
  return res.result;
}

function alreadyProgrammed(
    existing: PrecordSummary[],
    channelUuid: string,
    start: number
): boolean {
  return existing.some(
      (p) => p.channel_uuid === channelUuid && p.start === start
  );
}

async function scheduleRecording(
    session: Session,
    channelUuid: string,
    program: EpgProgram
): Promise<void> {
  const start = program.start - MARGIN_BEFORE;
  const end = program.start + program.duration + MARGIN_AFTER;

  await fetchJson(`${FREEBOX_API_BASE}/pvr/programmed/`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({
      channel_uuid: channelUuid,
      start,
      end,
      name: program.title,
      subname: program.sub_title ?? "",
      broadcast_type: "tv",
      // media / path omis -> utilise le support de stockage par défaut
      // (la clé USB déjà branchée, si c'est le seul support connu)
    }),
  });

  console.log(`Programmé : "${program.title}" sur ${WATCHED_CHANNELS[channelUuid]}`);
}

// ---------------------------------------------------------------------------
// Boucle principale
// ---------------------------------------------------------------------------

async function watchOnce(session: Session): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await fetchExistingPrecords(session);

  for (const channelUuid of Object.keys(WATCHED_CHANNELS)) {
    const programs = await fetchEpgForChannel(session, channelUuid, now);

    for (const program of programs) {
      if (program.start > now + EPG_LOOKAHEAD_SECONDS) continue;
      if (!matchesWatchlist(program)) continue;
      if (alreadyProgrammed(existing, channelUuid, program.start - MARGIN_BEFORE)) continue;

      await scheduleRecording(session, channelUuid, program);
    }
  }
}

async function main(): Promise<void> {
  const appToken = await loadOrCreateAppToken();
  const session = await openSession(appToken);

  // Premier passage immédiat, puis boucle périodique
  await watchOnce(session);
  setInterval(() => {
    watchOnce(session).catch((err) => console.error("Erreur watchOnce:", err));
  }, POLL_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function authHeaders(session: Session): Record<string, string> {
  return { "X-Fbx-App-Auth": session.sessionToken };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`Freebox API ${res.status} ${res.statusText} (${url})`);
  }
  const json = (await res.json()) as { success: boolean; result: unknown };
  if (!json.success) {
    throw new Error(`Freebox API a renvoyé success=false (${url})`);
  }
  return json as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
