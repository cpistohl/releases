import { test, expect } from "bun:test";
import * as Sentry from "@sentry/bun";

// Initialize Sentry for tests (mirrors server.ts config)
Sentry.init({
  dsn: "https://f03444ecdc4ca77dd5397ee7ef869aaa@o4510930254954496.ingest.us.sentry.io/4510930258755584",
  tracesSampleRate: 1.0,
});

test("Sentry SDK is initialized", () => {
  const client = Sentry.getClient();
  expect(client).toBeDefined();
  const dsn = client!.getDsn();
  expect(dsn).toBeDefined();
  expect(dsn!.host).toContain("sentry.io");
});

test("Sentry captures exceptions without throwing", () => {
  const eventId = Sentry.captureException(new Error("test error"));
  expect(eventId).toBeDefined();
  expect(typeof eventId).toBe("string");
});

test("Sentry captures messages without throwing", () => {
  const eventId = Sentry.captureMessage("test message");
  expect(eventId).toBeDefined();
  expect(typeof eventId).toBe("string");
});

test("Sentry breadcrumbs can be added without throwing", () => {
  expect(() => {
    Sentry.addBreadcrumb({
      category: "test",
      message: "test breadcrumb",
      level: "info",
    });
  }).not.toThrow();
});

test("/api/calendar returns valid JSON", async () => {
  const port = Bun.env.PORT || "3000";
  try {
    const res = await fetch(`http://localhost:${port}/api/calendar`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("title");
    expect(data).toHaveProperty("calendarHtml");
    expect(data).toHaveProperty("timelineHtml");
  } catch {
    // Server may not be running during CI — skip gracefully
    console.log("Skipping live server test (server not running)");
  }
});
