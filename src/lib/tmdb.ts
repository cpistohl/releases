import { cacheGet, cacheSet } from "./cache";

const API_KEY = Bun.env.TMDB_API_KEY;
if (!API_KEY) console.error("TMDB_API_KEY not set — add it to .env");

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

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

// ttls
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function fetchCredits(id: number) {
  const key = `credits:${id}`;
  const hit = cacheGet<{ cast: string[]; director: string }>(key);
  if (hit) return hit;

  try {
    const res = await fetch(`${BASE}/movie/${id}/credits?api_key=${API_KEY}`);
    if (!res.ok) return { cast: [] as string[], director: "" };
    const data: any = await res.json();

    const cast = (data.cast || []).slice(0, 3).map((c: any) => c.name as string);
    const director = (data.crew || []).find((c: any) => c.job === "Director")?.name || "";
    const result = { cast, director };
    cacheSet(key, result, DAY);
    return result;
  } catch {
    return { cast: [] as string[], director: "" };
  }
}

// fetch credits in parallel with a concurrency cap
async function loadAllCredits(movies: Movie[], limit = 8) {
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

  const now = new Date();
  const ahead = (year - now.getFullYear()) * 12 + (month - now.getMonth() - 1);
  const minPop = ahead <= 0 ? 15 : ahead <= 2 ? 3 : 0.5;

  const movies: Movie[] = [];
  for (let page = 1; page <= 5; page++) {
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
  await loadAllCredits(movies.slice(0, 15));
  cacheSet(cacheKey, movies, HOUR);
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
