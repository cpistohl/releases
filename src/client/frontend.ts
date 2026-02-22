import { Modal } from "bootstrap";
import { MONTH_NAMES, DAY_NAMES, longDate } from "../lib/constants";

let now = new Date();
let year = +(new URLSearchParams(location.search).get("year") ?? now.getFullYear());
let month = +(new URLSearchParams(location.search).get("month") ?? now.getMonth() + 1);

const $ = (id: string) => document.getElementById(id)!;
const monthTitle = $("month-title");
const mobileMonthTitle = $("mobile-month-title");
const featured = $("featured-view");
const calendar = $("calendar-view");
const timeline = $("timeline-view");
const errorEl = $("error-banner");

// view toggle — default to timeline (list view)
let currentView = localStorage.getItem("calendarView") || "timeline";
setView(currentView);

// Desktop controls
$("view-toggle-btn").addEventListener("click", () => toggleView());
$("prev-btn").addEventListener("click", () => go(-1));
$("next-btn").addEventListener("click", () => go(1));
$("today-btn").addEventListener("click", goToday);
$("title-btn").addEventListener("click", goToday);

// Mobile controls
$("mobile-view-toggle-btn").addEventListener("click", () => toggleView());
$("mobile-prev-btn").addEventListener("click", () => go(-1));
$("mobile-next-btn").addEventListener("click", () => go(1));
$("mobile-today-btn").addEventListener("click", goToday);

function toggleView() {
  setView(currentView === "calendar" ? "timeline" : "calendar");
}

function setView(v: string) {
  currentView = v;
  document.body.classList.toggle("view-timeline", v === "timeline");
  localStorage.setItem("calendarView", v);

  // highlight view toggle buttons when in list/timeline mode (it's a list icon)
  const isTimeline = v === "timeline";
  $("view-toggle-btn").classList.toggle("active", isTimeline);
  $("mobile-view-toggle-btn").classList.toggle("active", isTimeline);
}

// today button: show today's date number and highlight when on current month
function updateTodayHighlight() {
  const todayNow = new Date();
  const dayNum = String(todayNow.getDate());
  $("today-date-num").textContent = dayNum;
  $("mobile-today-date-num").textContent = dayNum;

  const isCurrentMonth = year === todayNow.getFullYear() && month === todayNow.getMonth() + 1;
  $("today-btn").classList.toggle("active", isCurrentMonth);
  $("mobile-today-btn").classList.toggle("active", isCurrentMonth);
}

// set initial today date number
updateTodayHighlight();

// navigation
function goToday() {
  now = new Date();
  year = now.getFullYear();
  month = now.getMonth() + 1;
  closeMonthDropdown();
  closeMonthOverlay();
  load();
}

function go(dir: number) {
  month += dir;
  if (month > 12) { month = 1; year++; }
  if (month < 1)  { month = 12; year--; }
  load();
}

// month dropdown (desktop)
const monthDropdown = $("month-dropdown");

$("month-title").addEventListener("click", (e) => {
  e.stopPropagation();
  if (monthDropdown.classList.contains("open")) {
    closeMonthDropdown();
    return;
  }
  openMonthDropdown();
});

function openMonthDropdown() {
  const todayMonth = new Date().getMonth() + 1;
  const todayYear = new Date().getFullYear();

  // Build dropdown buttons safely using DOM methods
  monthDropdown.textContent = "";
  MONTH_NAMES.forEach((name, i) => {
    const m = i + 1;
    const btn = document.createElement("button");
    btn.dataset.month = String(m);
    btn.textContent = name.slice(0, 3);
    if (m === month) btn.classList.add("active");
    else if (m === todayMonth && year === todayYear) btn.classList.add("current");
    monthDropdown.appendChild(btn);
  });
  monthDropdown.classList.add("open");
}

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

// month overlay (mobile fullscreen picker)
const monthOverlay = $("month-overlay");
const monthOverlayGrid = $("month-overlay-grid");

$("mobile-month-title").addEventListener("click", (e) => {
  e.stopPropagation();
  openMonthOverlay();
});

$("month-overlay-backdrop").addEventListener("click", () => {
  closeMonthOverlay();
});

function openMonthOverlay() {
  const todayMonth = new Date().getMonth() + 1;
  const todayYear = new Date().getFullYear();

  // Build overlay buttons safely using DOM methods
  monthOverlayGrid.textContent = "";
  MONTH_NAMES.forEach((name, i) => {
    const m = i + 1;
    const btn = document.createElement("button");
    btn.dataset.month = String(m);
    btn.textContent = name;
    if (m === month) btn.classList.add("active");
    else if (m === todayMonth && year === todayYear) btn.classList.add("current");
    monthOverlayGrid.appendChild(btn);
  });
  monthOverlay.classList.add("open");
}

function closeMonthOverlay() {
  monthOverlay.classList.remove("open");
}

monthOverlayGrid.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;
  const m = +(btn.dataset.month || "");
  if (m) {
    month = m;
    closeMonthOverlay();
    load();
  }
});

// sync month title text across desktop + mobile
function updateMonthTitles(text: string) {
  monthTitle.textContent = text;
  mobileMonthTitle.textContent = text;
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

    updateMonthTitles(data.title);
    updateTodayHighlight();
    // Server-rendered HTML from our own API (trusted content)
    featured.innerHTML = data.featuredHtml;
    calendar.innerHTML = data.calendarHtml;
    timeline.innerHTML = data.timelineHtml;

    for (const el of [featured, calendar, timeline]) el.classList.add("fade-in-content");
    setTimeout(() => {
      for (const el of [featured, calendar, timeline]) el.classList.remove("fade-in-content");
    }, 400);

    if (data.error) {
      errorEl.textContent = "";
      const link = document.createElement("span");
      link.textContent = data.error;
      errorEl.appendChild(link);
      errorEl.className = "error-banner alert alert-warning";
    } else {
      errorEl.textContent = "";
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
  if (e.key === "Escape") {
    closeMonthDropdown();
    closeMonthOverlay();
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
  wrapper.className = "d-flex gap-3 popover-inner";

  const img = document.createElement("img");
  img.className = "popover-poster rounded-3";
  img.src = d.poster || "";
  img.alt = title;
  wrapper.appendChild(img);

  const details = document.createElement("div");
  details.className = "d-flex flex-column gap-2";

  const titleEl = document.createElement("div");
  titleEl.className = "popover-title";
  titleEl.textContent = title;
  details.appendChild(titleEl);

  const dateEl = document.createElement("div");
  dateEl.className = "text-secondary small";
  dateEl.textContent = date;
  details.appendChild(dateEl);

  if (d.director) {
    const dirEl = document.createElement("div");
    dirEl.className = "text-secondary small";
    dirEl.textContent = `Directed by ${d.director}`;
    details.appendChild(dirEl);
  }

  if (d.cast) {
    const castEl = document.createElement("div");
    castEl.className = "text-secondary small";
    castEl.textContent = d.cast;
    details.appendChild(castEl);
  }

  if (ratingVal > 0) {
    const ratingEl = document.createElement("div");
    ratingEl.className = "fw-semibold text-warning mb-1";
    ratingEl.textContent = `★ ${ratingVal.toFixed(1)}`;
    details.appendChild(ratingEl);
  }

  const overview = document.createElement("p");
  overview.className = "popover-overview mb-0";
  overview.textContent = d.overview || "";
  details.appendChild(overview);

  if (d.tickets) {
    const ticketLink = document.createElement("a");
    ticketLink.className = "tickets-btn btn btn-warning rounded-pill fw-bold mt-2";
    ticketLink.href = d.tickets;
    ticketLink.target = "_blank";
    ticketLink.rel = "noopener";
    ticketLink.textContent = "Get Tickets";
    details.appendChild(ticketLink);
  }

  wrapper.appendChild(details);
  modalBody.appendChild(wrapper);

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
