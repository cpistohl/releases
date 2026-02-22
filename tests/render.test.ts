import { test, expect } from "bun:test";
import type { Movie } from "../src/client/render";
import { escapeHtml, marcusUrl, renderFeatured, renderCalendarGrid, renderTimeline } from "../src/client/render";

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1, title: "Test Movie", release_date: "2026-03-15",
    poster_path: "/test.jpg", overview: "A great test movie.",
    vote_average: 7.5, popularity: 50, cast: ["Actor A"], director: "Director X",
    genres: ["Action", "Drama"],
    ...overrides,
  };
}

// escapeHtml
test("escapes &", () => expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry"));
test("escapes < >", () => expect(escapeHtml("<b>hi</b>")).toBe("&lt;b&gt;hi&lt;/b&gt;"));
test("escapes quotes", () => expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;'));
test("escapes everything together", () => {
  expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});
test("leaves plain text alone", () => expect(escapeHtml("Hello World")).toBe("Hello World"));

// marcusUrl
test("slugifies movie titles", () => {
  expect(marcusUrl("The Dark Knight")).toBe("https://www.marcustheatres.com/movies/the-dark-knight");
});
test("handles special chars in titles", () => {
  expect(marcusUrl("Spider-Man: No Way Home")).toBe("https://www.marcustheatres.com/movies/spider-man-no-way-home");
});
test("trims leading/trailing hyphens", () => {
  expect(marcusUrl("...Hello World!")).toBe("https://www.marcustheatres.com/movies/hello-world");
});

// renderFeatured
test("empty list returns empty string", () => expect(renderFeatured([])).toBe(""));

test("caps at 5 featured cards", () => {
  const movies = Array.from({ length: 8 }, (_, i) =>
    movie({ id: i, title: `Movie ${i}`, popularity: 100 - i })
  );
  const html = renderFeatured(movies);
  expect(html.match(/featured-card/g)?.length).toBe(5);
});

test("escapes titles in featured html", () => {
  const html = renderFeatured([movie({ title: 'Film "Special" <Edition>' })]);
  expect(html).toContain("Film &quot;Special&quot; &lt;Edition&gt;");
});

// renderCalendarGrid (uses Record<string, Movie[]> instead of Map)
test("renders 7 day headers", () => {
  expect(renderCalendarGrid(2026, 3, {}).match(/day-header/g)?.length).toBe(7);
});

test("renders 31 day cells for March", () => {
  expect(renderCalendarGrid(2026, 3, {}).match(/day-number/g)?.length).toBe(31);
});

test("marks days with movies", () => {
  const byDate = { "2026-03-10": [movie({ id: 1, release_date: "2026-03-10" })] };
  const html = renderCalendarGrid(2026, 3, byDate);
  expect(html).toContain("has-movies");
  expect(html).toContain("mini-poster");
});

test("shows +N for overflow", () => {
  const five = Array.from({ length: 5 }, (_, i) => movie({ id: i, release_date: "2026-03-10" }));
  const html = renderCalendarGrid(2026, 3, { "2026-03-10": five });
  expect(html).toContain("+2");
});

// renderTimeline (uses Record<string, Movie[]> instead of Map)
test("shows empty state when no movies", () => {
  const html = renderTimeline({});
  expect(html).toContain("No movie releases this month.");
});

test("groups by date", () => {
  const byDate: Record<string, Movie[]> = {
    "2026-03-10": [movie({ id: 1, release_date: "2026-03-10" })],
    "2026-03-20": [movie({ id: 2, release_date: "2026-03-20" })],
  };
  expect(renderTimeline(byDate).match(/timeline-group/g)?.length).toBe(2);
});

test("includes genres and cast", () => {
  const byDate = { "2026-03-10": [movie({ genres: ["Action", "Thriller"], cast: ["Bale", "Ledger"] })] };
  const html = renderTimeline(byDate);
  expect(html).toContain("Action / Thriller");
  expect(html).toContain("Bale, Ledger");
});
