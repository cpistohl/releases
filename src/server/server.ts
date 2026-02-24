import { fetchMoviesForMonth, prefetchMonth, groupByDate, type Movie } from "../lib/tmdb";
import { MONTH_NAMES, escapeHtml } from "../lib/constants";
import index from "../client/index.html";
import * as Sentry from "@sentry/bun";

const isDev = Bun.env.NODE_ENV !== "production";

Sentry.init({
  dsn: "https://f03444ecdc4ca77dd5397ee7ef869aaa@o4510930254954496.ingest.us.sentry.io/4510930258755584",
  enableLogs: true,
  tracesSampleRate: isDev ? 1.0 : 0.2,
});

function errorPage(status: number, title: string, message: string) {
  const emoji = status === 404 ? "🔍" : status >= 500 ? "🎬" : "⚠️";
  return new Response(
    `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${status} — ${title}</title>
  <meta name="theme-color" content="#0a0a0f"/>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0f;color:#e8e8ed;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}
    .error-container{max-width:480px}
    .error-emoji{font-size:4rem;margin-bottom:1.5rem;display:block;animation:float 3s ease-in-out infinite}
    .error-code{font-size:6rem;font-weight:800;letter-spacing:-0.04em;background:linear-gradient(135deg,#e4a048,#f0b45c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
    .error-title{font-size:1.5rem;font-weight:600;margin:0.75rem 0}
    .error-message{color:#8b8b9e;font-size:1rem;line-height:1.6;margin-bottom:2rem}
    .error-home{display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.75rem;background:#e4a048;color:#0a0a0f;font-weight:700;font-size:0.95rem;border-radius:999px;text-decoration:none;transition:all 0.2s}
    .error-home:hover{background:#f0b45c;transform:translateY(-1px);box-shadow:0 4px 20px rgba(228,160,72,0.3)}
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
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Bun.serve({
  port: parseInt(Bun.env.PORT || "3000"),
  routes: {
    "/": index,

    "/api/calendar": async (req) => {
      const url = new URL(req.url);
      const now = new Date();
      const yearParam = url.searchParams.get("year");
      const monthParam = url.searchParams.get("month");
      const year = yearParam ? +yearParam : now.getFullYear();
      const month = monthParam ? +monthParam : now.getMonth() + 1;

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 1900 || year > 2100) {
        return errorPage(400, "Invalid Parameters", "Year must be 1900-2100 and month must be 1-12.");
      }

      Sentry.addBreadcrumb({
        category: "api",
        message: `Calendar request for ${year}-${month}`,
        level: "info"
      });

      try {
        const movies = await fetchMoviesForMonth(year, month);
        const moviesByDate: Record<string, Movie[]> = {};

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
          movies,
          moviesByDate,
          error: !Bun.env.TMDB_API_KEY || Bun.env.TMDB_API_KEY === "your_api_key_here"
            ? "TMDB API key not configured. Set TMDB_API_KEY in the .env file."
            : ""
        });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { endpoint: "calendar", year: String(year), month: String(month) },
        });
        return errorPage(500, "Something Went Wrong", "We couldn't load the calendar right now. Please try again in a moment.");
      }
    }
  },

  fetch(req) {
    const path = new URL(req.url).pathname;
    return errorPage(404, "Page Not Found", `There's nothing at <code style="color:#e4a048">${escapeHtml(path)}</code>. It might have been moved or doesn't exist.`);
  },

  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`Running at http://localhost:${Bun.env.PORT || "3000"}`);
