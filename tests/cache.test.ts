import { test, expect, beforeEach } from "bun:test";
import { cacheGet, cacheSet, cachePrune, cacheClear } from "../src/lib/cache";

beforeEach(() => cacheClear());

test("returns null for missing keys", () => {
  expect(cacheGet("nope")).toBeNull();
});

test("stores and retrieves strings", () => {
  cacheSet("greeting", "hello", 60_000);
  expect(cacheGet<string>("greeting")).toBe("hello");
});

test("stores and retrieves objects", () => {
  const data = { cast: ["Alice", "Bob"], director: "Carol" };
  cacheSet("credits:1", data, 60_000);
  expect(cacheGet<typeof data>("credits:1")).toEqual(data);
});

test("stores and retrieves arrays", () => {
  const movies = [{ id: 1, title: "A" }, { id: 2, title: "B" }];
  cacheSet("movies:2026-02", movies, 60_000);
  expect(cacheGet<typeof movies>("movies:2026-02")).toEqual(movies);
});

test("expired entries come back null", () => {
  cacheSet("old", "stale", 0);
  expect(cacheGet("old")).toBeNull();
});

test("overwrites on duplicate key", () => {
  cacheSet("k", "first", 60_000);
  cacheSet("k", "second", 60_000);
  expect(cacheGet<string>("k")).toBe("second");
});

test("prune cleans up expired entries", () => {
  cacheSet("fresh", "keep", 60_000);
  cacheSet("stale1", "x", 0);
  cacheSet("stale2", "x", 0);
  expect(cachePrune()).toBe(2);
  expect(cacheGet<string>("fresh")).toBe("keep");
});

test("clear wipes everything", () => {
  cacheSet("a", 1, 60_000);
  cacheSet("b", 2, 60_000);
  cacheClear();
  expect(cacheGet("a")).toBeNull();
  expect(cacheGet("b")).toBeNull();
});
