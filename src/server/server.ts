import { fetchMoviesForMonth, prefetchMonth, groupByDate } from "../lib/tmdb";
import { MONTH_NAMES, escapeHtml } from "../lib/constants";
import { cachePrune } from "../lib/cache";
import index from "../client/index.html";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// simple per-IP rate limiter: 30 requests per minute
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = hits.get(ip) || [];
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

// clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of hits) {
    const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) hits.delete(ip);
    else hits.set(ip, recent);
  }
}, 5 * 60 * 1000);

function errorPage(status: number, title: string, message: string) {
  const emoji = status === 404 ? "🔍" : status >= 500 ? "🎬" : "⚠️";
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${status} — ${title}</title>
  <meta name="theme-color" content="#14181c"/>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#14181c;color:#e1e3e5;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}
    .error-container{max-width:480px}
    .error-emoji{font-size:4rem;margin-bottom:1.5rem;display:block;animation:float 3s ease-in-out infinite}
    .error-code{font-size:6rem;font-weight:800;letter-spacing:-0.04em;color:#00a878;line-height:1}
    .error-title{font-size:1.5rem;font-weight:600;margin:0.75rem 0}
    .error-message{color:#9ab;font-size:1rem;line-height:1.6;margin-bottom:2rem}
    .error-home{display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.75rem;background:#00a878;color:#14181c;font-weight:700;font-size:0.95rem;border-radius:4px;text-decoration:none;transition:all 0.2s}
    .error-home:hover{background:#00c08a;transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,168,120,0.2)}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
  </style>
</head>
<body>
  <div class="error-container">
    <span class="error-emoji">${emoji}</span>
    <div class="error-code">${status}</div>
    <h1 class="error-title">${title}</h1>
    <p class="error-message">${message}</p>
    <a href="/" class="error-home">Back to Releases</a>
  </div>
</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS } }
  );
}

Bun.serve({
  port: parseInt(Bun.env.PORT || "3000"),
  routes: {
    "/": index,

    "/api/calendar": async (req) => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (isRateLimited(ip)) {
        return new Response("Too many requests", {
          status: 429,
          headers: { "Retry-After": "60", ...SECURITY_HEADERS }
        });
      }

      const url = new URL(req.url);
      const now = new Date();
      const yearParam = url.searchParams.get("year");
      const monthParam = url.searchParams.get("month");
      const year = yearParam ? +yearParam : now.getFullYear();
      const month = monthParam ? +monthParam : now.getMonth() + 1;

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 1900 || year > 2100) {
        return errorPage(400, "Invalid Parameters", "Year must be 1900-2100 and month must be 1-12.");
      }

      try {
        const movies = await fetchMoviesForMonth(year, month);
        const moviesByDate: Record<string, object[]> = {};

        for (const [date, list] of groupByDate(movies)) {
          moviesByDate[date] = list;
        }

        // kick off adjacent months in the background
        const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
        const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
        prefetchMonth(prev.y, prev.m);
        prefetchMonth(next.y, next.m);

        return Response.json({
          title: `${MONTH_NAMES[month - 1]} ${year}`,
          year,
          month,
          moviesByDate,
          error: !Bun.env.TMDB_API_KEY || Bun.env.TMDB_API_KEY === "your_api_key_here"
            ? "TMDB API key not configured. Set TMDB_API_KEY in the .env file."
            : ""
        }, {
          headers: { "Cache-Control": "public, max-age=300", ...SECURITY_HEADERS }
        });
      } catch (err) {
        console.error(`Calendar error for ${year}-${month}:`, err);
        return errorPage(500, "Something Went Wrong", "We couldn't load the calendar right now. Please try again in a moment.");
      }
    }
  },

  fetch(req) {
    const path = new URL(req.url).pathname;
    return errorPage(404, "Page Not Found", `There's nothing at <code style="color:#00a878">${escapeHtml(path)}</code>. It might have been moved or doesn't exist.`);
  },

  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

// prune expired cache entries every 30 minutes
setInterval(() => cachePrune(), 30 * 60 * 1000);

console.log(`Running at http://localhost:${Bun.env.PORT || "3000"}`);
