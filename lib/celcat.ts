/**
 * Client Celcat Calendar (TypeScript, côté serveur).
 *
 * Reprend le fonctionnement de l'API interne de Celcat utilisée par l'interface web
 * (cf. ReverseURCACelcatAPI) :
 *   - POST {base}/Home/GetCalendarData            → événements d'une ressource sur une période
 *   - GET  {base}/Home/ReadResourceListItems      → recherche de groupes / ressources
 *   - POST {base}/Home/GetSideBarEvent            → détail d'un événement (salle, enseignant…)
 *
 * Ce module ne dépend pas de la base : il ne fait que requêter et parser.
 */
import type { SessionType } from "./db/schema";
import { slugify, stripAccents } from "./utils";

export const RESOURCE_TYPES = {
  101: "Enseignant",
  102: "Salle",
  103: "Groupe",
  104: "Étudiant",
  105: "Module",
} as const;

export interface CelcatConfig {
  baseUrl: string;
  resourceId: string;
  resourceType: number;
  /** Cookie collé depuis le navigateur : valeur seule de `.Calendar.Cookies` ou en-tête complet `nom=valeur; …` */
  cookie?: string;
  /** Connexion automatique via le formulaire /LdapLogin (recommandé : la session est renouvelée seule) */
  username?: string;
  password?: string;
}

/** Forme brute renvoyée par GetCalendarData */
export interface CelcatRawEvent {
  id: string;
  start: string;
  end: string | null;
  allDay: boolean;
  description: string;
  backgroundColor?: string | null;
  textColor?: string | null;
  department?: string | null;
  faculty?: string | null;
  eventCategory?: string | null;
  sites?: string[] | null;
  modules?: string[] | null;
  registerStatus?: number;
  studentMark?: number;
  custom1?: string | null;
  custom2?: string | null;
  custom3?: string | null;
}

export interface CelcatResource {
  id: string;
  text: string;
  dept?: string | null;
}

export interface ParsedCelcatEvent {
  id: string;
  subject: string;
  slug: string;
  /** code module Celcat (ex: DIDB1OPL(DI01C1-260)) */
  code: string;
  cancelled: boolean;
  isCourse: boolean;
  rawSubject: string;
  sessionType: SessionType;
  category: string;
  start: Date;
  end: Date;
  allDay: boolean;
  room: string;
  teacher: string;
  groups: string;
  rawDescription: string;
  color: string | null;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const AUTH_COOKIE = ".Calendar.Cookies";

export class CelcatAuthError extends Error {}

/** Accepte la valeur seule du cookie d'auth, "nom=valeur", ou un en-tête Cookie complet. */
export function normalizeCookie(raw?: string | null) {
  const v = (raw ?? "").trim().replace(/^cookie:\s*/i, "");
  if (!v) return "";
  return v.includes("=") && !/^CfDJ8/.test(v) ? v : `${AUTH_COOKIE}=${v}`;
}

/** Extrait origine + type + identifiant d'une URL Celcat copiée depuis le navigateur. */
export function parseCelcatUrl(input: string) {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  const path = u.pathname.replace(/\/+$/, "").replace(/\/(cal|Home.*|LdapLogin.*|Login.*)$/i, "");
  const et = u.searchParams.get("et");
  const types: Record<string, number> = { student: 104, group: 103, staff: 101, room: 102, module: 105 };
  return {
    baseUrl: `${u.origin}${path}`,
    resourceType: et && types[et] ? types[et] : undefined,
    resourceId: u.searchParams.get("fid0") ?? undefined,
  };
}

/* ------------------------------- Session (cookie jar) ------------------------------- */

type Jar = Map<string, string>;
const g = globalThis as unknown as { __celcatSessions?: Map<string, { jar: Jar; at: number }> };
const sessions = (g.__celcatSessions ??= new Map());
const sessionKey = (cfg: CelcatConfig) => `${cfg.baseUrl}|${cfg.username ?? ""}`;

function storeCookies(jar: Jar, res: Response) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const jarHeader = (jar: Jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

/** Connexion via le formulaire LDAP de Celcat (GET token anti-CSRF puis POST /LdapLogin/Logon). */
export async function celcatLogin(cfg: CelcatConfig): Promise<Jar> {
  if (!cfg.username || !cfg.password) throw new CelcatAuthError("Identifiant ou mot de passe Celcat manquant");
  const jar: Jar = new Map();
  const page = await fetch(`${cfg.baseUrl}/LdapLogin`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  storeCookies(jar, page);
  const html = await page.text();
  const token = /name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/.exec(html)?.[1]
    ?? /value="([^"]+)"[^>]*name="__RequestVerificationToken"/.exec(html)?.[1];
  if (!token) throw new CelcatAuthError(`Page de connexion introuvable sur ${cfg.baseUrl}/LdapLogin (HTTP ${page.status})`);

  const body = new URLSearchParams({ Name: cfg.username, Password: cfg.password, __RequestVerificationToken: token });
  const res = await fetch(`${cfg.baseUrl}/LdapLogin/Logon`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jarHeader(jar),
      Origin: new URL(cfg.baseUrl).origin,
      Referer: `${cfg.baseUrl}/LdapLogin`,
    },
    body,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  storeCookies(jar, res);
  if (!jar.has(AUTH_COOKIE)) {
    const text = res.status === 200 ? await res.text() : "";
    const captcha = /field-validation-error"[^>]*BadCaptcha/.test(text);
    const msg = /field-validation-error"[^>]*>([^<]+)</.exec(text)?.[1]?.trim();
    throw new CelcatAuthError(
      captcha
        ? "Celcat demande un captcha (trop de tentatives) : connecte-toi une fois dans le navigateur puis réessaie plus tard."
        : `Connexion Celcat refusée${msg ? ` : ${msg}` : ""}`,
    );
  }
  sessions.set(sessionKey(cfg), { jar, at: Date.now() });
  return jar;
}

async function cookieHeader(cfg: CelcatConfig, forceLogin = false) {
  if (cfg.username && cfg.password) {
    const cached = sessions.get(sessionKey(cfg));
    const jar = !forceLogin && cached && Date.now() - cached.at < 6 * 3600_000 ? cached.jar : await celcatLogin(cfg);
    return jarHeader(jar);
  }
  return normalizeCookie(cfg.cookie);
}

/**
 * Requête Celcat authentifiée. Sans session valide, Celcat renvoie un corps vide, une page HTML
 * ou une redirection vers /Login : dans ce cas on se reconnecte une fois (mode identifiants).
 */
async function celcatRequest<T>(cfg: CelcatConfig, path: string, init: RequestInit, what: string): Promise<T> {
  let csrf: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const cookie = await cookieHeader(cfg, attempt > 0 && !csrf);
    let body = init.body;
    if (csrf && body instanceof URLSearchParams) {
      body = new URLSearchParams(body);
      body.set("__RequestVerificationToken", csrf);
    }
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      body,
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${cfg.baseUrl}/cal`,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { RequestVerificationToken: csrf } : {}),
        ...(init.headers as Record<string, string>),
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    // Certaines versions exigent le jeton anti-CSRF de la page calendrier sur les POST
    if (res.status === 400 && !csrf && init.method === "POST") {
      const page = await fetch(`${cfg.baseUrl}/cal`, { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store", redirect: "manual" });
      csrf = /name="__RequestVerificationToken"[^>]*value="([^"]+)"/.exec(await page.text())?.[1] ?? null;
      if (csrf) continue;
    }
    const text = res.status >= 300 && res.status < 400 ? "" : await res.text();
    const unauth =
      (res.status >= 300 && res.status < 400) || res.status === 401 || res.status === 403 || !text.trim() || /^\s*</.test(text);
    if (!unauth && res.ok) {
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`Celcat ${what} : réponse JSON invalide`);
      }
    }
    if (res.status >= 500) throw new Error(`Celcat ${what} : erreur serveur HTTP ${res.status}`);
    if (res.status === 404 && text.trim()) throw new Error(`Celcat ${what} : URL introuvable (vérifie l'URL de base)`);
    if (res.status === 400) throw new Error(`Celcat ${what} : requête refusée (HTTP 400)`);
    if (!(cfg.username && cfg.password) || attempt > 0) {
      throw new CelcatAuthError(
        cfg.username && cfg.password
          ? `Celcat ${what} : session refusée même après reconnexion`
          : cfg.cookie
            ? `Celcat ${what} : non authentifié (cookie expiré ou incomplet). Préfère la connexion par identifiant.`
            : `Celcat ${what} : cette instance exige une connexion (renseigne ton identifiant Celcat)`,
      );
    }
  }
  throw new Error("unreachable");
}

/** Récupère les événements d'une ressource entre deux dates (découpé par tranches de 4 semaines). */
export async function fetchCalendarData(
  cfg: CelcatConfig,
  start: Date,
  end: Date,
): Promise<CelcatRawEvent[]> {
  const out: CelcatRawEvent[] = [];
  const seen = new Set<string>();
  let cursor = new Date(start);
  while (cursor < end) {
    const chunkEnd = new Date(Math.min(end.getTime(), cursor.getTime() + 28 * 86400_000));
    const body = new URLSearchParams();
    body.set("start", ymd(cursor));
    body.set("end", ymd(chunkEnd));
    body.set("resType", String(cfg.resourceType));
    body.set("calView", "agendaWeek");
    body.append("federationIds[]", cfg.resourceId);
    body.set("colourScheme", "3");
    const events = await celcatRequest<CelcatRawEvent[]>(
      cfg,
      "/Home/GetCalendarData",
      { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } },
      "GetCalendarData",
    );
    for (const e of events ?? []) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        out.push(e);
      }
    }
    cursor = chunkEnd;
  }
  return out;
}

/** Recherche de groupes / ressources (pour choisir son groupe dans les paramètres). */
export async function searchResources(cfg: CelcatConfig, term: string, resType = 103): Promise<CelcatResource[]> {
  const qs = new URLSearchParams({
    myResources: "false", searchTerm: term, pageSize: "50", pageNumber: "1", resType: String(resType), secondaryFilterValue: "",
  });
  const json = await celcatRequest<{ results?: CelcatResource[] }>(cfg, `/Home/ReadResourceListItems?${qs}`, { method: "GET" }, "ReadResourceListItems");
  return json.results ?? [];
}

/** Détail d'un événement (utile pour les instances qui n'exposent pas tout dans `description`). */
export async function getSideBarEvent(cfg: CelcatConfig, eventId: string) {
  return celcatRequest<{
    federationId: string;
    entityType: number;
    elements: { label: string; content: string | null; federationId: string | null; entityType: number }[];
  }>(
    cfg,
    "/Home/GetSideBarEvent",
    { method: "POST", body: new URLSearchParams({ eventid: eventId }), headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } },
    "GetSideBarEvent",
  );
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ------------------------------------------------------------------------------------------------
 * Parsing
 * ---------------------------------------------------------------------------------------------- */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç",
  ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï", euml: "ë",
  Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç",
};

export function decodeHtml(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
}

/** Découpe la description HTML de Celcat en lignes propres. */
export function descriptionLines(description: string): string[] {
  const lines = description
    .split(/<br\s*\/?>/i)
    .map((l) => decodeHtml(l.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(lines)];
}

const TYPE_PATTERNS: [SessionType, RegExp][] = [
  ["CM", /\b(CM|C\.M\.|cours magistra(?:l|ux)|magistral|amphi)\b/i],
  ["TD", /\b(TD|T\.D\.|travaux dirig[ée]s?)\b/i],
  ["TP", /\b(TP|T\.P\.|travaux pratiques?)\b/i],
];

/** Détecte le type de séance strict (CM / TD / TP / AUTRE) : le premier motif rencontré l'emporte. */
export function detectSessionType(...texts: (string | null | undefined)[]): SessionType {
  for (const t of texts) {
    if (!t) continue;
    let best: { type: SessionType; idx: number } | null = null;
    for (const [type, re] of TYPE_PATTERNS) {
      const m = re.exec(t);
      if (m && (best === null || m.index < best.idx)) best = { type, idx: m.index };
    }
    if (best) return best.type;
  }
  return "AUTRE";
}

const TYPE_TOKENS =
  /(?:^|[\s\-–—:(\[/,])(?:CM|TD|TP|TDs|TPs|C\.M\.|T\.D\.|T\.P\.|cours magistra(?:l|ux)|travaux dirig[ée]s?|travaux pratiques?)(?:\s*n?°?\s*\d+)?(?=$|[\s\-–—:)\]/,])[)\]]?/gi;
const GROUP_TOKENS = /\b(?:gr(?:ou)?pe?s?\s*[A-Z]?\d+[A-Z]?|gr\d+|g\d{1,2})\b/gi;
const CODE_PREFIX = /^(?:\[[^\]]+\]\s*|[A-Z]{2,}[A-Z0-9_.]*\d[A-Z0-9_.]*\s*[-–:]\s*)/;
const SMALL_WORDS = new Set(["et", "de", "des", "du", "la", "le", "les", "en", "a", "au", "aux", "pour", "avec", "sur", "d", "l", "un", "une", "par"]);

/** "INFO2104 - ALGORITHMIQUE AVANCEE (TD) GR2" → "Algorithmique avancee" */
export function normalizeSubject(raw: string): string {
  let s = decodeHtml(raw).replace(/\s+/g, " ").trim();
  s = s.replace(CODE_PREFIX, "");
  s = s.replace(TYPE_TOKENS, " ");
  s = s.replace(GROUP_TOKENS, " ");
  s = s.replace(/\(\s*\)|\[\s*\]/g, " ");
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s\-–—:,./]+|[\s\-–—:,./]+$/g, "").trim();

  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "");
  if (letters.length > 4 && upper.length / letters.length > 0.8) {
    // Tout en majuscules → casse "phrase" en gardant les acronymes courts
    s = s
      .split(" ")
      .map((w, i) => {
        const lw = w.toLowerCase();
        if (w.length <= 4 && !SMALL_WORDS.has(stripAccents(lw)) && /^[A-Z0-9+#]+$/.test(w)) return w;
        return i === 0 ? lw.charAt(0).toUpperCase() + lw.slice(1) : lw;
      })
      .join(" ");
  }
  return s || raw.trim();
}

const ROOM_RE =
  /\b(salle|amphi\S*|b[aâ]t(?:iment|\.)?|room|labo|visio|distanciel|teams|zoom|fablab)\b|^[A-Z]{1,4}\s?-?\s?[A-Z]?\d{2,4}[A-Z]?\b|\b[A-Z]{2,5}\s?-\s?[A-Z]?\d{2,4}\b|\b\d{2,3}p$/i;
const GROUP_RE =
  /^(ING\s?\d|ING[A-Z]*\b|CPI\s?\d?|PR[EÉ]PA|M[12]\b|L[123]\b|MSc|BUT|BTS)|\b(GR(?:OUPE)?\s?\d+|groupe\s+\w+|promo(tion)?)\b|\(\d+\s+(more|autres?)\.\.\.\)/i;
const TEACHER_RE =
  /^(?:M\.|Mme|Dr\.?)?\s*[A-ZÀ-Ý][A-ZÀ-Ý'’-]+(?:\s+[A-ZÀ-Ý][A-ZÀ-Ý'’-]+)*\s+[A-ZÀ-Ý][A-Za-zà-ÿÀ-Ý'’-]+(?:[ -][A-ZÀ-Ý][A-Za-zà-ÿ'’-]+)*$/;
const CANCELLED_RE = /^(annul[ée]e?s?|cancel(?:l)?ed|supprim[ée]e?)$/i;

/** "DIDB1OPL(DI01C1-260)", "INFO2104" : un code, pas un nom lisible */
export function isCodeLike(s: string) {
  const t = s.trim();
  // un seul "mot" (hors parenthèses) contenant chiffres ou parenthèses : INFO2104, DIDB1OPL(DI01C1-260), LV1
  return !!t && !/\s/.test(t) && /[\d()]/.test(t);
}

const LANGS: Record<string, string> = {
  ANG: "Anglais", ESP: "Espagnol", ALL: "Allemand", ITA: "Italien", CHI: "Chinois", JAP: "Japonais", POR: "Portugais", FLE: "Français (FLE)",
};

const NON_TEACHING = /indisponibilit|r[ée]union|f[ée]ri[ée]|vacances|cong[ée]|fermeture|forum|conf[ée]rence|pr[ée]sentation/i;

/** Transforme un événement brut Celcat en événement normalisé. */
export function parseCelcatEvent(raw: CelcatRawEvent): ParsedCelcatEvent | null {
  if (!raw?.id || !raw.start) return null;
  const lines = descriptionLines(raw.description ?? "");
  const category = decodeHtml(raw.eventCategory ?? "").trim();
  const sites = (raw.sites ?? []).filter(Boolean);

  // 1. Statut annulé + catégorie (lignes à retirer)
  const cancelled = lines.some((l) => CANCELLED_RE.test(l)) || CANCELLED_RE.test(category);
  const isCategoryLine = (l: string, i: number) =>
    CANCELLED_RE.test(l) ||
    (category && l.toLowerCase() === category.toLowerCase()) ||
    (!category && i <= 1 && l.length <= 30 && detectSessionType(l) !== "AUTRE" && /^(CM|TD|TP|C\.M\.|T\.D\.|T\.P\.|cours|travaux)/i.test(l));

  // 2. Classification des lignes en conservant leur ordre (CY : catégorie, groupes, matière, salles, enseignants)
  type Kind = "room" | "group" | "other";
  const items: { l: string; kind: Kind }[] = lines
    .filter((l, i) => !isCategoryLine(l, i))
    .map((l) => ({
      l,
      kind: ROOM_RE.test(l) || sites.some((st) => st.length > 3 && l.includes(st)) ? "room" : GROUP_RE.test(l) && l.length < 80 ? "group" : "other",
    }));

  // 3. Matière : `modules` s'il est lisible, sinon 1re ligne "libre" (avant les salles de préférence)
  const moduleRaw = raw.modules?.find(Boolean)?.trim() ?? "";
  const code = moduleRaw && isCodeLike(moduleRaw) ? moduleRaw.toUpperCase() : "";
  let rawSubject = moduleRaw && !code ? moduleRaw : "";
  const others = items.filter((x) => x.kind === "other");
  if (rawSubject) {
    const mod = normalizeSubject(rawSubject).toLowerCase();
    const dup = others.findIndex((x) => x.l === rawSubject || normalizeSubject(x.l).toLowerCase() === mod);
    if (dup !== -1) others.splice(dup, 1);
  } else {
    const firstRoom = items.findIndex((x) => x.kind === "room");
    const before = others.filter((x) => firstRoom === -1 || items.indexOf(x) < firstRoom);
    const pick = before.find((x) => !TEACHER_RE.test(x.l)) ?? before[0] ?? others.find((x) => !TEACHER_RE.test(x.l)) ?? others[0];
    if (pick) {
      rawSubject = pick.l;
      others.splice(others.indexOf(pick), 1);
    } else {
      rawSubject = code || category || "Cours";
    }
  }

  // 4. Enseignants = lignes libres restantes situées après la matière
  const teachers = others.filter((x) => TEACHER_RE.test(x.l) || items.indexOf(x) > items.findIndex((y) => y.kind === "room")).map((x) => x.l);

  const sessionType = detectSessionType(category, lines.find((l) => !CANCELLED_RE.test(l)), rawSubject);
  let subject = normalizeSubject(rawSubject);
  // "LV1" + code DIDANG… → "Anglais (LV1)"
  const lang = /^LV\s?\d$/i.test(subject) ? Object.entries(LANGS).find(([k]) => code.includes(k))?.[1] : undefined;
  if (lang) subject = `${lang} (${subject.toUpperCase()})`;
  const start = new Date(raw.start);
  const end = raw.end ? new Date(raw.end) : new Date(start.getTime() + (raw.allDay ? 86400_000 : 3600_000));
  const teaching = !!code || sessionType !== "AUTRE" || /exam|partiel|projet|soutenance|contr[oô]le|ds\b/i.test(category);

  return {
    id: String(raw.id),
    subject,
    slug: slugify(subject),
    code,
    rawSubject,
    sessionType,
    category: category || (sessionType !== "AUTRE" ? sessionType : ""),
    start,
    end,
    allDay: !!raw.allDay,
    room: items.filter((x) => x.kind === "room").map((x) => x.l).join(", "),
    teacher: teachers.join(", "),
    groups: items.filter((x) => x.kind === "group").map((x) => x.l).join(", "),
    rawDescription: raw.description ?? "",
    color: raw.backgroundColor ?? null,
    cancelled,
    /** false pour les indisponibilités / réunions : pas d'espace matière créé */
    isCourse: teaching && !(NON_TEACHING.test(category) && !code),
  };
}
