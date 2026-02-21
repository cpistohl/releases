import { Modal } from "bootstrap";
import { MONTH_NAMES, DAY_NAMES, longDate } from "../lib/constants";

let now = new Date();
let year = +(new URLSearchParams(location.search).get("year") ?? now.getFullYear());
let month = +(new URLSearchParams(location.search).get("month") ?? now.getMonth() + 1);

const $ = (id: string) => document.getElementById(id)!;
const monthTitle = $("month-title");
const featured = $("featured-view");
const calendar = $("calendar-view");
const timeline = $("timeline-view");
const errorEl = $("error-banner");

// view toggle
const viewBtns = document.querySelectorAll<HTMLButtonElement>(".view-btn");
setView(localStorage.getItem("calendarView") || "calendar");

for (const btn of viewBtns) {
  btn.addEventListener("click", () => setView(btn.dataset.view!));
}

function setView(v: string) {
  document.body.classList.toggle("view-timeline", v === "timeline");
  viewBtns.forEach(b => b.classList.toggle("active", b.dataset.view === v));
  $("view-indicator")?.classList.toggle("timeline", v === "timeline");
  localStorage.setItem("calendarView", v);
}

// navigation
$("prev-btn").addEventListener("click", () => go(-1));
$("next-btn").addEventListener("click", () => go(1));
$("today-btn").addEventListener("click", goToday);
$("title-btn").addEventListener("click", goToday);

function goToday() {
  now = new Date();
  year = now.getFullYear();
  month = now.getMonth() + 1;
  closeMonthDropdown();
  load();
}

function go(dir: number) {
  month += dir;
  if (month > 12) { month = 1; year++; }
  if (month < 1)  { month = 12; year--; }
  load();
}

// month dropdown
const monthDropdown = $("month-dropdown");

$("month-title").addEventListener("click", (e) => {
  e.stopPropagation();

  if (monthDropdown.classList.contains("open")) {
    closeMonthDropdown();
    return;
  }

  const todayMonth = new Date().getMonth() + 1;
  const todayYear = new Date().getFullYear();
  monthDropdown.innerHTML = MONTH_NAMES.map((name, i) => {
    const m = i + 1;
    const isActive = m === month;
    const isCurrent = m === todayMonth && year === todayYear;
    const cls = isActive ? "active" : isCurrent ? "current" : "";
    return `<button data-month="${m}" class="${cls}">${name.slice(0, 3)}</button>`;
  }).join("");
  monthDropdown.classList.add("open");
});

monthDropdown.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;

  const m = +(btn.dataset.month || "");
  if (m) {
    month = m;
    closeMonthDropdown();
    load();
  }
});

function closeMonthDropdown() {
  monthDropdown.classList.remove("open");
}

// skeletons shown while fetching
function skeletons() {
  featured.innerHTML =
    '<div class="featured">' +
    '<div class="skeleton-text-sm skel-w32" style="margin-bottom:16px"></div>' +
    '<div class="skel-featured-grid">' +
    '<div class="skeleton-featured"></div>'.repeat(5) +
    '</div></div>';

  const headers = DAY_NAMES.map(d => `<div class="day-header">${d}</div>`).join('');
  calendar.innerHTML =
    '<div class="calendar-grid">' + headers +
    '<div class="day-cell" style="animation:none"><div class="skeleton-text-sm skel-w16" style="margin-top:8px"></div></div>'.repeat(35) +
    '</div>';

  const card =
    '<div class="skel-card">' +
    '<div class="skeleton-poster"></div>' +
    '<div class="skel-card-text">' +
    '<div class="skeleton-text skel-w75"></div>' +
    '<div class="skeleton-text-sm skel-w50"></div>' +
    '<div class="skeleton-text-sm skel-w66"></div>' +
    '<div class="skeleton-text skel-wfull skel-mt"></div>' +
    '<div class="skeleton-text skel-wfull"></div>' +
    '</div></div>';
  timeline.innerHTML = '<div class="skel-timeline">' + card.repeat(4) + '</div>';
}

async function load() {
  // fade out then swap to skeletons
  for (const el of [featured, calendar, timeline]) el.classList.add("fade-out");
  await new Promise(r => setTimeout(r, 200));

  skeletons();
  for (const el of [featured, calendar, timeline]) el.classList.remove("fade-out");

  try {
    const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
    const data = await res.json();

    monthTitle.textContent = data.title;
    featured.innerHTML = data.featuredHtml;
    calendar.innerHTML = data.calendarHtml;
    timeline.innerHTML = data.timelineHtml;

    for (const el of [featured, calendar, timeline]) el.classList.add("fade-in-content");
    setTimeout(() => {
      for (const el of [featured, calendar, timeline]) el.classList.remove("fade-in-content");
    }, 400);

    if (data.error) {
      errorEl.innerHTML = data.error;
      errorEl.className = "error-banner alert alert-warning";
    } else {
      errorEl.innerHTML = "";
      errorEl.className = "";
    }
    history.pushState(null, "", `/?year=${year}&month=${month}`);
  } catch (err) {
    console.error("load failed:", err);
  }
}

load();

// movie modal (Bootstrap)
let movieModal: Modal | null = null;

function getMovieModal() {
  if (!movieModal) {
    movieModal = new Modal(document.getElementById("movieModal")!);
  }
  return movieModal;
}

document.addEventListener("click", e => {
  const t = e.target as HTMLElement;

  // close month dropdown on outside click
  if (!t.closest("#month-dropdown") && !t.closest("#month-title")) {
    closeMonthDropdown();
  }

  const poster = t.closest(".mini-poster") || t.closest(".featured-card");
  if (poster) {
    e.stopPropagation();
    openPopover(poster as HTMLElement);
    return;
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeMonthDropdown(); }
});

function openPopover(el: HTMLElement) {
  const d = el.dataset;
  const title = d.title || "";
  const date = d.date ? longDate(d.date) : "";
  const ratingVal = d.rating ? parseFloat(d.rating) : 0;
  const rating = ratingVal > 0
    ? `<div class="fw-semibold text-warning mb-1">★ ${ratingVal.toFixed(1)}</div>` : "";
  const tickets = d.tickets
    ? `<a class="tickets-btn btn btn-warning rounded-pill fw-bold mt-2" href="${d.tickets}" target="_blank" rel="noopener">Get Tickets</a>` : "";

  document.getElementById("movie-modal-body")!.innerHTML = `
    <div class="d-flex gap-3 popover-inner">
      <img class="popover-poster rounded-3" src="${d.poster}" alt="${title}" />
      <div class="d-flex flex-column gap-2">
        <div class="popover-title">${title}</div>
        <div class="text-secondary small">${date}</div>
        ${d.director ? `<div class="text-secondary small">Directed by ${d.director}</div>` : ""}
        ${d.cast ? `<div class="text-secondary small">${d.cast}</div>` : ""}
        ${rating}
        <p class="popover-overview mb-0">${d.overview || ""}</p>
        ${tickets}
      </div>
    </div>`;

  getMovieModal().show();
}

// back/forward
window.addEventListener("popstate", () => {
  const p = new URLSearchParams(location.search);
  const y = +(p.get("year") || ""), m = +(p.get("month") || "");
  if (y && m) { year = y; month = m; load(); }
});

// navbar shadow on scroll
const nav = document.querySelector(".navbar-header");
let scrollTick = false;
window.addEventListener("scroll", () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => {
    nav?.classList.toggle("scrolled", scrollY > 20);
    scrollTick = false;
  });
});
