import { fetchMoviesForMonth, prefetchMonth, groupByDate } from "../lib/tmdb";
import { MONTH_NAMES, renderFeatured, renderCalendarGrid, renderTimeline } from "./render";
import index from "../client/index.html";

Bun.serve({
  port: parseInt(Bun.env.PORT || "3000"),
  routes: {
    "/": index,

    "/api/calendar": async (req) => {
      const url = new URL(req.url);
      const now = new Date();
      const year = +(url.searchParams.get("year") || now.getFullYear());
      const month = +(url.searchParams.get("month") || now.getMonth() + 1);

      const movies = await fetchMoviesForMonth(year, month);
      const byDate = groupByDate(movies);

      // kick off adjacent months in the background
      const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
      const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
      prefetchMonth(prev.y, prev.m);
      prefetchMonth(next.y, next.m);

      return Response.json({
        title: `${MONTH_NAMES[month - 1]} ${year}`,
        featuredHtml: renderFeatured(movies),
        calendarHtml: renderCalendarGrid(year, month, byDate),
        timelineHtml: renderTimeline(byDate),
        error: !Bun.env.TMDB_API_KEY || Bun.env.TMDB_API_KEY === "your_api_key_here"
          ? 'TMDB API key not configured. Set <strong>TMDB_API_KEY</strong> in the <code>.env</code> file. Get a free key at <a href="https://www.themoviedb.org/settings/api" target="_blank">themoviedb.org</a>.'
          : "",
      });
    },
  },
  development: { hmr: true, console: true },
});

console.log(`Running at http://localhost:${Bun.env.PORT || "3000"}`);
