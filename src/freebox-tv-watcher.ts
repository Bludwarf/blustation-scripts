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

import {readFile, writeFile} from "node:fs/promises";
import {exists, existsSync} from "node:fs";
import {createHmac} from "node:crypto";
import {toDate} from "./date-utils";
import {pad} from "./string-utils";
import path from "node:path";
import {fileExists, mkdirs} from "./file-utils";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Hôte de la Freebox en local. Utilise le api_domain fourni par
 *  /api_version à la place si tu veux du HTTPS depuis l'extérieur. */
const FREEBOX_HOST = "http://mafreebox.freebox.fr";

/** Base URL de l'API, résolue dynamiquement au démarrage (voir resolveApiBase).
 *  Certains endpoints (ex. l'EPG) ne sont disponibles qu'à partir d'une
 *  version d'API récente ; utiliser un v4 codé en dur casse ces appels
 *  selon le firmware (constaté : /tv/epg/... nécessite v16 sur ce Freebox
 *  Server alors que /tv/channels/ répondait déjà en v4). */
let FREEBOX_API_BASE = "";

async function resolveApiBase(): Promise<string> {
    // NOTE : /api_version ne suit pas l'enveloppe {success, result} des autres
    // endpoints, d'où un fetch brut plutôt que fetchJson() ici.
    const res = await fetch(`${FREEBOX_HOST}/api_version`);
    const info = (await res.json()) as { api_version: string };
    const major = info.api_version.split(".")[0];
    return `${FREEBOX_HOST}/api/v${major}`;
}

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
    // "uuid-webtv-202": "France 3",
    // "uuid-webtv-611": "TF1",
    // "uuid-webtv-612": "M6",
    "uuid-webtv-497": "TMC",
};

/** Titres recherchés dans l'EPG. Comparaison insensible à la casse,
 *  simple "includes" par défaut — remplace par une regex si besoin. */
const WATCHLIST: string[] = [
    // TODO: "Le Nom De La Série Ou Du Film"
    "Columbo",
];

/** Fenêtre de temps scannée à chaque passage (en secondes). */
const EPG_LOOKAHEAD_SECONDS = 24 * 3600;

/** Intervalle entre deux passages de surveillance (en ms). */
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1h

/** Marges avant/après l'enregistrement (en secondes), sinon utilise la
 *  config PVR par défaut de la Freebox (voir GET /pvr/config/). */
const MARGIN_BEFORE = 60;
const MARGIN_AFTER = 5 * 60;

/** Délai minimum entre deux appels à l'API en général (ms). */
const MIN_REQUEST_INTERVAL_MS = 0;

/** Délai minimum entre deux appels spécifiquement à /tv/epg/... (ms).
 *  Cet endpoint a un quota nettement plus strict que le reste de l'API
 *  (error_code "rate_limit" constaté même avec un throttle générique de
 *  1.5s — voir https://dev.freebox.fr/bugs/task/28260 pour un souci similaire). */
const EPG_MIN_REQUEST_INTERVAL_MS = 0;

/** Nombre max de tentatives en cas de 429 avant d'abandonner l'appel
 *  (endpoints hors EPG — login, pvr — jamais vus rate-limités jusqu'ici). */
const MAX_429_RETRIES = 6;

/** Sur l'EPG, on n'insiste PAS automatiquement : si les tentatives ratées
 *  comptent elles-mêmes dans le quota (comportement courant, non confirmé
 *  côté Freebox), un backoff qui s'acharne pendant plusieurs minutes ne
 *  ferait que prolonger le blocage. On échoue vite et on laisse la
 *  décision de retester à l'utilisateur, avec un vrai temps de pause. */
const EPG_MAX_429_RETRIES = 0;

/** Base du backoff exponentiel si la réponse 429 ne fournit pas de header
 *  Retry-After (tentative n → DEFAULT_429_BACKOFF_MS * 2^n). */
const DEFAULT_429_BACKOFF_MS = 10_000;

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

    const {app_token, track_id} = authorizeRes.result;

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
        JSON.stringify({app_token, track_id} satisfies StoredToken, null, 2)
    );

    return app_token;
}

async function openSession(appToken: string): Promise<Session> {
    // 1. Récupère le challenge courant
    const loginRes = await fetchJson<{ result: { challenge: string } }>(
        `${FREEBOX_API_BASE}/login/`
    );
    const {challenge} = loginRes.result;

    // 2. Signe le challenge avec l'app_token (HMAC-SHA1, résultat en hex)
    const password = createHmac("sha1", appToken).update(challenge).digest("hex");

    // 3. Ouvre la session
    const sessionRes = await fetchJson<{ result: { session_token: string } }>(
        `${FREEBOX_API_BASE}/login/session/`,
        {
            method: "POST",
            body: JSON.stringify({app_id: APP_INFO.app_id, password}),
        }
    );

    return {sessionToken: sessionRes.result.session_token};
}

// ---------------------------------------------------------------------------
// EPG
// ---------------------------------------------------------------------------

/**
 * @example {
 *   id: 'pluri_1730513584',
 *   title: 'Rendez-vous en terre inconnue',
 *   sub_title: 'Avec Kendji Girac chez les Turkana',
 *   start: 1785265800,
 *   duration: 11760
 * }
 */
interface EpgProgram {
    id: string;
    title: string;
    sub_title?: string;
    start: number; // timestamp unix (en secondes)
    duration: number; // secondes
}

/**
 * On utilise le même format que les fichiers générés par la Freebox
 * @example "France 2 - Rendez-vous en terre inconnue (Avec Kendji Girac chez les Turkana) - 28-07-2026 21h09 03h22 (202).m2ts"
 * @param epgProgram
 */
function epgProgramToString(epgProgram: EpgProgram): string {
    const startDate = toDate(epgProgram.start);

    const formatter = new Intl.DateTimeFormat('fr-FR', {
        dateStyle: "short",
        timeStyle: "short",
    });
    const parts = formatter.formatToParts(startDate);
    const day = parts[0].value;
    const month = parts[2].value;
    const year = parts[4].value;
    const hours = parts[6].value;
    const minutes = parts[8].value;
    const dateTime = `${day}-${month}-${year} ${hours}h${minutes}`;

    const durationHours = Math.floor(epgProgram.duration / 3600);
    const durationMinutes = Math.round((epgProgram.duration % 3600) / 60); // TODO round fait par Freebox ?
    const durationString = pad(durationHours, 2) + "h" + pad(durationMinutes, 2);

    return `${epgProgram.title} - ${dateTime} ${durationString}`; // TODO nombre entre parenthèses ?
}

/**
 * Forme brute d'une entrée EPG telle que renvoyée par
 *  GET /tv/epg/by_time/{timestamp} (API non documentée officiellement,
 *  structure déduite d'une réponse réelle).
 *  @example {
 *   sub_title: 'Avec Kendji Girac chez les Turkana',
 *   next: '1785277560_c2e091b2',
 *   id: 'pluri_1730513584',
 *   duration: 11760,
 *   picture: '/api/latest/tv/img/epg/programs/100x77/EMI_52365577_AG.jpg',
 *   desc: `A l'occasion des 20 ans de "Rendez-vous en terre inconnue", Frédéric Lopez a pris la route une dernière fois, aux côtés de Kendji Girac, en direction des plaines désertiques du nord-ouest du Kenya, terre du peuple Turkana. Sur les rives du plus grand lac salé d'Afrique, ils découvrent des familles animées d'un courage et d'une résilience hors norme. Les Turkana sont des éleveurs qui peuplent l'une des régions les plus arides du Kenya. Mais six années successives d'une sécheresse sans précédent ont mis à mal les troupeaux, tuant la grande partie des animaux. Les éleveurs se sont rapprochés du lac Turkana. Là, certaines familles ont fait un choix radical mais indispensable à leur survie : elles se sont tournées vers la pêche. Kendji Girac et Frédéric Lopez ont partagé le quotidien de l'une de ces communautés, à la rencontre de ses membres.`,
 *   picture_big: '/api/latest/tv/img/epg/programs/168x130/EMI_52365577_AG.jpg',
 *   category_name: 'Documentaire',
 *   title: 'Rendez-vous en terre inconnue',
 *   prev: '1785265200_59d7ecca',
 *   category: 5,
 *   date: 1785265800
 * }
 */
interface RawEpgEntry {
    id: string;
    title: string;
    sub_title?: string;
    date: number; // timestamp unix de début
    duration: number; // secondes
    prev?: string;
    next?: string;
}

/**
 * Récupère les programmes d'une chaîne entre fromTs et toTs.
 *
 * L'endpoint /tv/epg/by_time/{timestamp} renvoie, pour TOUTES les chaînes,
 * un petit lot d'entrées autour du timestamp demandé (pas uniquement le
 * programme en cours). On avance donc le curseur de requête en requête
 * jusqu'à couvrir toute la fenêtre voulue, en dédupliquant par id.
 */
async function fetchEpgForChannel(
    appToken: string,
    channelUuid: string,
    fromTs: number,
    toTs: number
): Promise<EpgProgram[]> {
    const programs = new Map<string, EpgProgram>();
    let cursor = fromTs;
    let i = 0;
    let iMax = 1; // pour tester l'hypothèse "quota par session" avec 2 appels

    while (cursor < toTs && (!iMax || i < iMax)) {
        console.log(`fetchEpgForChannel i=${i}`)

        // Session neuve à chaque appel : test empirique montrant que le 429
        // sur l'EPG semble lié au nombre d'appels PAR SESSION plutôt qu'à une
        // fenêtre de temps (1 appel/session en rafale = jamais bloqué,
        // 2 appels sur la MÊME session = le 2e échoue systématiquement).
        const session = await openSession(appToken);

        const res = await fetchJson<{ result: Record<string, Record<string, RawEpgEntry>> }>(
            `${FREEBOX_API_BASE}/tv/epg/by_time/${cursor}`,
            {headers: authHeaders(session)}
        );

        const channelEntries = res.result[channelUuid];
        if (!channelEntries) break; // pas de données EPG pour cette chaîne

        const entries = Object.values(channelEntries);
        if (entries.length === 0) break;

        for (const entry of entries) {
            // console.log(entry);
            programs.set(entry.id, {
                id: entry.id,
                title: entry.title,
                sub_title: entry.sub_title,
                start: entry.date,
                duration: entry.duration,
            });
        }

        // Avance juste après la fin du programme le plus tardif obtenu, pour
        // éviter de re-scanner la même fenêtre à l'appel suivant.
        const maxEnd = Math.max(...entries.map((e) => e.date + e.duration));
        if (maxEnd <= cursor) break; // garde-fou anti boucle infinie
        cursor = maxEnd;
        ++i;
    }

    return Array.from(programs.values()).filter((p) => p.start < toTs);
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
        {headers: authHeaders(session)}
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

async function watchOnce(appToken: string, session: Session): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const horizon = now + EPG_LOOKAHEAD_SECONDS;
    const existing = await fetchExistingPrecords(session);

    for (const channelUuid of Object.keys(WATCHED_CHANNELS)) {
        const channelTitle = WATCHED_CHANNELS[channelUuid];
        const programs = await fetchEpgForChannel(appToken, channelUuid, now, horizon);

        for (const program of programs) {
            console.log(channelTitle + " - " + epgProgramToString(program));
            if (!matchesWatchlist(program)) continue;
            if (alreadyProgrammed(existing, channelUuid, program.start - MARGIN_BEFORE)) continue;

            await scheduleRecording(session, channelUuid, program);
        }
    }
}

async function main(): Promise<void> {
    FREEBOX_API_BASE = await resolveApiBase();

    const appToken = await loadOrCreateAppToken();
    const session = await openSession(appToken);

    // Premier passage immédiat, puis boucle périodique
    await watchOnce(appToken, session);
    // setInterval(() => {
    //   watchOnce(appToken, session).catch((err) => console.error("Erreur watchOnce:", err));
    // }, POLL_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function authHeaders(session: Session): Record<string, string> {
    return {"X-Fbx-App-Auth": session.sessionToken};
}

// Timestamp du dernier appel émis, par catégorie d'endpoint (l'EPG a son
// propre quota, plus strict que le reste de l'API — voir constantes ci-dessus).
const lastRequestAtByCategory: Record<string, number> = {};

function categoryFor(url: string): string {
    return url.includes("/tv/epg/") ? "epg" : "default";
}

async function throttle(url: string): Promise<void> {
    const category = categoryFor(url);
    const interval = category === "epg" ? EPG_MIN_REQUEST_INTERVAL_MS : MIN_REQUEST_INTERVAL_MS;
    const wait = interval - (Date.now() - (lastRequestAtByCategory[category] ?? 0));
    if (wait > 0) await sleep(wait);
    lastRequestAtByCategory[category] = Date.now();
}

async function fetchJson<T>(url: string, init?: RequestInit, attempt = 0): Promise<T> {
    const pathname = new URL(url).pathname;
    const cacheFilename = ".cache/mafreebox.freebox.fr/" + pathname + ".json";
    const category = categoryFor(url);

    // Le cache ne concerne que l'EPG : c'est le seul endpoint rate-limité, et
    // chaque URL (avec son timestamp de cursor) correspond à une réponse figée
    // dans le temps une fois obtenue — donc rejouable sans risque de fraîcheur.
    if (category === "epg" && (await fileExists(cacheFilename))) {
        console.log(`Cache hit : ${cacheFilename}`);
        const raw = await readFile(cacheFilename, "utf-8");
        return JSON.parse(raw) as T;
    }

    await throttle(url);

    const res = await fetch(url, {
        ...init,
        headers: {"Content-Type": "application/json", ...(init?.headers ?? {})},
    });

    if (res.status === 429) {
        const maxRetries = category === "epg" ? EPG_MAX_429_RETRIES : MAX_429_RETRIES;

        if (attempt >= maxRetries) {
            const bodyText = await res.text().catch(() => "<illisible>");
            throw new Error(
                `Freebox API 429 (rate_limit) sur ${url} — body: ${bodyText}. ` +
                (category === "epg"
                    ? "Pas de retry automatique sur l'EPG : attends nettement plus longtemps " +
                    "(quelques dizaines de minutes) avant de relancer un test, plutôt que d'enchaîner."
                    : `Abandon après ${attempt} tentative(s).`)
            );
        }
        const retryAfterHeader = res.headers.get("Retry-After");
        const bodyText = await res.text().catch(() => "<illisible>");
        const backoffMs = retryAfterHeader
            ? Number(retryAfterHeader) * 1000
            : DEFAULT_429_BACKOFF_MS * 2 ** attempt; // backoff exponentiel
        console.warn(
            `429 sur ${url} (Retry-After=${retryAfterHeader ?? "absent"}, body=${bodyText}), ` +
            `nouvelle tentative dans ${backoffMs}ms (tentative ${attempt + 1}/${maxRetries})`
        );
        await sleep(backoffMs);
        return fetchJson<T>(url, init, attempt + 1);
    }

    if (!res.ok) {
        // Journalise le corps (souvent { success: false, msg, error_code })
        // pour distinguer un vrai souci de quota d'une erreur applicative
        // (ex. conflit de précord) qui porterait un tout autre code HTTP.
        const bodyText = await res.text().catch(() => "<illisible>");
        throw new Error(`Freebox API ${res.status} ${res.statusText} (${url}) — body: ${bodyText}`);
    }
    const json = (await res.json()) as { success: boolean; result: unknown };
    if (!json.success) {
        throw new Error(`Freebox API a renvoyé success=false (${url})`);
    }

    if (category == "epg") {
        const dir = path.dirname(cacheFilename);
        await mkdirs(dir);
        await writeFile(cacheFilename, JSON.stringify(json, null, 2));
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
