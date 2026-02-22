import { test, expect } from "bun:test";
import { posterUrl, groupByDate, type Movie } from "../src/lib/tmdb";

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1, title: "Test", release_date: "2026-03-15",
    poster_path: null, overview: "A test movie",
    vote_average: 7, popularity: 50, cast: [], director: "",
    genres: [],
    ...overrides,
  };
}

test("posterUrl builds full url", () => {
  expect(posterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w200/abc.jpg");
});

test("posterUrl respects size param", () => {
  expect(posterUrl("/abc.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
});

test("posterUrl returns svg placeholder for null", () => {
  const url = posterUrl(null);
  expect(url).toStartWith("data:image/svg+xml,");
  expect(url).toContain("No%20Poster");
});

test("groupByDate groups correctly", () => {
  const grouped = groupByDate([
    movie({ id: 1, release_date: "2026-03-01" }),
    movie({ id: 2, release_date: "2026-03-01" }),
    movie({ id: 3, release_date: "2026-03-15" }),
  ]);
  expect(grouped.size).toBe(2);
  expect(grouped.get("2026-03-01")!.length).toBe(2);
  expect(grouped.get("2026-03-15")!.length).toBe(1);
});

test("groupByDate sorts by popularity within each day", () => {
  const grouped = groupByDate([
    movie({ id: 1, release_date: "2026-03-01", popularity: 10 }),
    movie({ id: 2, release_date: "2026-03-01", popularity: 99 }),
    movie({ id: 3, release_date: "2026-03-01", popularity: 50 }),
  ]);
  const ids = grouped.get("2026-03-01")!.map(m => m.id);
  expect(ids).toEqual([2, 3, 1]);
});

test("groupByDate handles empty input", () => {
  expect(groupByDate([]).size).toBe(0);
});

test("groupByDate handles single movie", () => {
  const grouped = groupByDate([movie({ release_date: "2026-06-20" })]);
  expect(grouped.get("2026-06-20")!.length).toBe(1);
});
