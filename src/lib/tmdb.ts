import { cacheGet, cacheSet } from "./cache";

const API_KEY = Bun.env.TMDB_API_KEY;
if (!API_KEY) console.error("TMDB_API_KEY not set — add it to .env");

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

// cache TTLs
const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// how many pages of results to fetch from TMDB (20 results per page)
const MAX_PAGES = 5;

// only fetch credits for the top N movies (keeps API calls reasonable)
const CREDITS_LIMIT = 15;

// number of cast members to include per movie
const CAST_LIMIT = 3;

// concurrent credit fetches
const CREDITS_CONCURRENCY = 8;

// minimum popularity thresholds — movies below these are filtered out.
// past/current months have tons of results, so we filter aggressively.
// future months have fewer listings, so we're more lenient.
const MIN_POPULARITY_PAST = 15;
const MIN_POPULARITY_NEAR_FUTURE = 3;   // 1-2 months ahead
const MIN_POPULARITY_FAR_FUTURE = 0.5;  // 3+ months ahead

export interface Movie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  popularity: number;
  cast: string[];
  director: string;
}

const NO_POSTER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
    <rect width="200" height="300" fill="#e8e8ed" rx="8"/>
    <text x="100" y="140" text-anchor="middle" fill="#8e8e93" font-family="system-ui" font-size="14">No Poster</text>
    <text x="100" y="165" text-anchor="middle" fill="#8e8e93" font-family="system-ui" font-size="24">🎬</text>
  </svg>`
)}`;

export function posterUrl(path: string | null, size = "w200") {
  return path ? `${IMG}/${size}${path}` : NO_POSTER;
}

async function fetchCredits(id: number) {
  const key = `credits:${id}`;
  const hit = cacheGet<{ cast: string[]; director: string }>(key);
  if (hit) return hit;

  try {
    const res = await fetch(`${BASE}/movie/${id}/credits?api_key=${API_KEY}`);
    if (!res.ok) return { cast: [] as string[], director: "" };
    const data: any = await res.json();

    const cast = (data.cast || []).slice(0, CAST_LIMIT).map((c: any) => c.name as string);
    const director = (data.crew || []).find((c: any) => c.job === "Director")?.name || "";
    const result = { cast, director };
    cacheSet(key, result, ONE_DAY);
    return result;
  } catch {
    return { cast: [] as string[], director: "" };
  }
}

// fetch credits in parallel with a concurrency cap
async function loadAllCredits(movies: Movie[], limit = CREDITS_CONCURRENCY) {
  let idx = 0;
  async function worker() {
    while (idx < movies.length) {
      const m = movies[idx++]!;
      const { cast, director } = await fetchCredits(m.id);
      m.cast = cast;
      m.director = director;
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, movies.length) }, worker));
}

// dedupe in-flight requests for the same month
const pending = new Map<string, Promise<Movie[]>>();

export async function fetchMoviesForMonth(year: number, month: number) {
  const key = `movies:${year}-${String(month).padStart(2, "0")}`;
  const hit = cacheGet<Movie[]>(key);
  if (hit) return hit;

  if (pending.has(key)) return pending.get(key)!;

  const p = _fetch(year, month, key);
  pending.set(key, p);
  try { return await p; }
  finally { pending.delete(key); }
}

function getMinPopularity(year: number, month: number) {
  const now = new Date();
  const monthsAhead = (year - now.getFullYear()) * 12 + (month - now.getMonth() - 1);

  if (monthsAhead <= 0) return MIN_POPULARITY_PAST;
  if (monthsAhead <= 2) return MIN_POPULARITY_NEAR_FUTURE;
  return MIN_POPULARITY_FAR_FUTURE;
}

async function _fetch(year: number, month: number, cacheKey: string) {
  if (!API_KEY) return [];

  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  const to = `${year}-${mm}-${String(last).padStart(2, "0")}`;

  const params = new URLSearchParams({
    api_key: API_KEY,
    language: "en-US",
    region: "US",
    sort_by: "popularity.desc",
    "primary_release_date.gte": from,
    "primary_release_date.lte": to,
    with_release_type: "2|3",
    with_original_language: "en",
  });

  const minPop = getMinPopularity(year, month);
  const movies: Movie[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    params.set("page", String(page));
    try {
      const res = await fetch(`${BASE}/discover/movie?${params}`);
      if (!res.ok) { console.error(`TMDB ${res.status}`); break; }
      const data: any = await res.json();

      for (const m of data.results) {
        if (m.popularity < minPop) continue;
        movies.push({
          id: m.id, title: m.title, release_date: m.release_date,
          poster_path: m.poster_path, overview: m.overview,
          vote_average: m.vote_average, popularity: m.popularity,
          cast: [], director: "",
        });
      }
      if (page >= data.total_pages) break;
      if (data.results.at(-1)?.popularity < minPop) break;
    } catch (err) {
      console.error("TMDB fetch failed:", err);
      break;
    }
  }

  // only grab credits for the movies we'll actually show
  await loadAllCredits(movies.slice(0, CREDITS_LIMIT));
  cacheSet(cacheKey, movies, ONE_HOUR);
  return movies;
}

export function prefetchMonth(year: number, month: number) {
  fetchMoviesForMonth(year, month).catch(() => {});
}

export function groupByDate(movies: Movie[]) {
  const map = new Map<string, Movie[]>();
  for (const m of movies) {
    const list = map.get(m.release_date);
    if (list) list.push(m);
    else map.set(m.release_date, [m]);
  }
  for (const [, list] of map) list.sort((a, b) => b.popularity - a.popularity);
  return map;
}
