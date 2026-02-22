import { Modal } from "bootstrap";
import { MONTH_NAMES, DAY_NAMES, longDate } from "../lib/constants";
import { renderFeatured, renderCalendarGrid, renderTimeline, type Movie } from "./render";

const now = new Date();
let year = +(new URLSearchParams(location.search).get("year") ?? now.getFullYear());
let month = +(new URLSearchParams(location.search).get("month") ?? now.getMonth() + 1);

// track whether current load was triggered by popstate (back/forward)
let isPopstate = false;

// abort controller for cancelling stale fetch requests
let fetchController: AbortController | null = null;

const $ = (id: string) => document.getElementById(id)!;
const monthTitle = $("month-title");
const featured = $("featured-view");
const calendar = $("calendar-view");
const timeline = $("timeline-view");
const errorEl = $("error-banner");

// view toggle — default to timeline (list view)
let currentView = localStorage.getItem("calendarView") || "timeline";
setView(currentView);

// Controls (single nav)
$("view-toggle-btn").addEventListener("click", () => toggleView());
$("prev-btn").addEventListener("click", () => go(-1));
$("next-btn").addEventListener("click", () => go(1));
$("today-btn").addEventListener("click", goToday);
$("title-btn").addEventListener("click", goToday);

function toggleView() {
  setView(currentView === "calendar" ? "timeline" : "calendar");
}

function setView(v: string) {
  currentView = v;
  document.body.classList.toggle("view-timeline", v === "timeline");
  localStorage.setItem("calendarView", v);
  $("view-toggle-btn").classList.toggle("active", v === "timeline");
}

// today button: show today's date number and highlight when on current month
function updateTodayHighlight() {
  const todayNow = new Date();
  $("today-date-num").textContent = String(todayNow.getDate());

  const isCurrentMonth = year === todayNow.getFullYear() && month === todayNow.getMonth() + 1;
  $("today-btn").classList.toggle("active", isCurrentMonth);
}

updateTodayHighlight();

// navigation
function goToday() {
  const todayNow = new Date();
  year = todayNow.getFullYear();
  month = todayNow.getMonth() + 1;
  closeMonthPicker();
  load();
}

function go(dir: number) {
  month += dir;
  if (month > 12) { month = 1; year++; }
  if (month < 1) { month = 12; year--; }
  load();
}

// month picker (unified — overlay/bottom-sheet on mobile, positioned near pill on desktop)
const monthOverlay = $("month-overlay");
const monthOverlayGrid = $("month-overlay-grid");

$("month-title").addEventListener("click", (e) => {
  e.stopPropagation();
  if (monthOverlay.classList.contains("open")) {
    closeMonthPicker();
    return;
  }
  openMonthPicker();
});

$("month-overlay-backdrop").addEventListener("click", () => closeMonthPicker());

// Year navigation within the picker
let pickerYear = year;

$("year-prev-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  pickerYear--;
  renderPickerGrid();
});

$("year-next-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  pickerYear++;
  renderPickerGrid();
});

function openMonthPicker() {
  pickerYear = year;
  renderPickerGrid();
  monthOverlay.classList.add("open");
}

function renderPickerGrid() {
  const todayMonth = new Date().getMonth() + 1;
  const todayYear = new Date().getFullYear();

  $("overlay-year-label").textContent = String(pickerYear);

  monthOverlayGrid.textContent = "";
  MONTH_NAMES.forEach((name, i) => {
    const m = i + 1;
    const btn = document.createElement("button");
    btn.dataset.month = String(m);
    btn.textContent = name.slice(0, 3);
    if (m === month && pickerYear === year) btn.classList.add("active");
    else if (m === todayMonth && pickerYear === todayYear) btn.classList.add("current");
    monthOverlayGrid.appendChild(btn);
  });
}

function closeMonthPicker() {
  monthOverlay.classList.remove("open");
}

monthOverlayGrid.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;
  const m = +(btn.dataset.month || "");
  if (m) {
    month = m;
    year = pickerYear;
    closeMonthPicker();
    load();
  }
});

// update month title text
function updateMonthTitle(text: string) {
  monthTitle.textContent = text;
}

// skeletons shown while fetching
function skeletons() {
  const featuredSkel =
    '<div class="featured">' +
    '<div class="skeleton-text-sm skel-w32" style="margin-bottom:16px"></div>' +
    '<div class="skel-featured-grid">' +
    '<div class="skeleton-featured"></div>'.repeat(5) +
    '</div></div>';
  // Using our own skeleton HTML (trusted content, not user input)
  featured.innerHTML = featuredSkel;

  const headers = DAY_NAMES.map(d => `<div class="day-header">${d}</div>`).join('');
  const calendarSkel =
    '<div class="calendar-grid">' + headers +
    '<div class="day-cell" style="animation:none"><div class="skeleton-text-sm skel-w16" style="margin-top:8px"></div></div>'.repeat(35) +
    '</div>';
  calendar.innerHTML = calendarSkel;

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
  // cancel any in-flight request
  if (fetchController) fetchController.abort();
  fetchController = new AbortController();
  const signal = fetchController.signal;

  // fade out then swap to skeletons
  for (const el of [featured, calendar, timeline]) el.classList.add("fade-out");
  await new Promise(r => setTimeout(r, 200));

  skeletons();
  for (const el of [featured, calendar, timeline]) el.classList.remove("fade-out");

  try {
    const res = await fetch(`/api/calendar?year=${year}&month=${month}`, { signal });
    const data: {
      title: string;
      year: number;
      month: number;
      movies: Movie[];
      moviesByDate: Record<string, Movie[]>;
      error: string;
    } = await res.json();

    updateMonthTitle(data.title);
    updateTodayHighlight();

    // Render HTML from our own trusted API data via client-side render functions
    featured.innerHTML = renderFeatured(data.movies);
    calendar.innerHTML = renderCalendarGrid(data.year, data.month, data.moviesByDate);
    timeline.innerHTML = renderTimeline(data.moviesByDate);

    for (const el of [featured, calendar, timeline]) el.classList.add("fade-in-content");
    setTimeout(() => {
      for (const el of [featured, calendar, timeline]) el.classList.remove("fade-in-content");
    }, 400);

    if (data.error) {
      errorEl.textContent = data.error;
      errorEl.className = "error-banner alert alert-warning";
    } else {
      errorEl.textContent = "";
      errorEl.className = "";
    }

    // avoid duplicate history entries when navigating back/forward
    if (isPopstate) {
      isPopstate = false;
    } else {
      history.pushState(null, "", `/?year=${year}&month=${month}`);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error("load failed:", err);
    errorEl.textContent = "Failed to load movie data. Please try again.";
    errorEl.className = "error-banner alert alert-danger";
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

  // close month picker on outside click
  if (!t.closest("#month-overlay") && !t.closest("#month-title")) {
    closeMonthPicker();
  }

  const poster = t.closest(".mini-poster") || t.closest(".featured-card");
  if (poster) {
    e.stopPropagation();
    openPopover(poster as HTMLElement);
    return;
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeMonthPicker();
  }
});

function openPopover(el: HTMLElement) {
  const d = el.dataset;
  const title = d.title || "";
  const date = d.date ? longDate(d.date) : "";
  const ratingVal = d.rating ? parseFloat(d.rating) : 0;

  const modalBody = document.getElementById("movie-modal-body")!;
  modalBody.textContent = "";

  const wrapper = document.createElement("div");
  wrapper.className = "popover-inner";

  // Left column: poster
  const leftCol = document.createElement("div");
  leftCol.className = "popover-left";

  const img = document.createElement("img");
  img.className = "popover-poster rounded-3";
  img.src = d.poster || "";
  img.alt = title;
  leftCol.appendChild(img);

  wrapper.appendChild(leftCol);

  // Right column: title, date, genre + rating, description, actions
  const rightCol = document.createElement("div");
  rightCol.className = "popover-right";

  const titleEl = document.createElement("div");
  titleEl.className = "popover-title";
  titleEl.textContent = title;
  rightCol.appendChild(titleEl);

  const dateEl = document.createElement("div");
  dateEl.className = "popover-meta";
  dateEl.textContent = date;
  rightCol.appendChild(dateEl);

  if (d.genres) {
    const genreEl = document.createElement("div");
    genreEl.className = "card-genres";
    genreEl.textContent = d.genres;
    rightCol.appendChild(genreEl);
  }

  if (d.overview) {
    const overview = document.createElement("p");
    overview.className = "popover-overview";
    overview.textContent = d.overview;
    rightCol.appendChild(overview);
  }

  const actionsEl = document.createElement("div");
  actionsEl.className = "card-actions";

  if (d.tickets) {
    const ticketLink = document.createElement("a");
    ticketLink.className = "tickets-btn btn btn-warning btn-sm rounded-pill fw-bold";
    ticketLink.href = d.tickets;
    ticketLink.target = "_blank";
    ticketLink.rel = "noopener";
    ticketLink.textContent = "Tickets";
    actionsEl.appendChild(ticketLink);
  }

  if (d.tmdb) {
    const tmdbLink = document.createElement("a");
    tmdbLink.className = "tmdb-link";
    tmdbLink.href = d.tmdb;
    tmdbLink.target = "_blank";
    tmdbLink.rel = "noopener";
    tmdbLink.innerHTML = "Details &rsaquo;";
    actionsEl.appendChild(tmdbLink);
  }

  rightCol.appendChild(actionsEl);
  wrapper.appendChild(rightCol);
  modalBody.appendChild(wrapper);

  getMovieModal().show();
}

// back/forward
window.addEventListener("popstate", () => {
  const p = new URLSearchParams(location.search);
  const y = +(p.get("year") || ""), m = +(p.get("month") || "");
  if (y && m) {
    year = y;
    month = m;
    isPopstate = true;
    load();
  }
});

// navbar shadow on scroll (only on desktop where nav is at top)
const navEl = document.querySelector(".navbar-header");
let scrollTick = false;
window.addEventListener("scroll", () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => {
    navEl?.classList.toggle("scrolled", scrollY > 20);
    scrollTick = false;
  });
});
