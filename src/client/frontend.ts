const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  $("view-indicator-mobile")?.classList.toggle("timeline", v === "timeline");
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
  monthDropdown.innerHTML = MONTHS.map((name, i) => {
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
    '<div class="mb-9">' +
    '<div class="skeleton-text-sm w-32 mb-4"></div>' +
    '<div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">' +
    '<div class="skeleton-featured"></div>'.repeat(4) + '<div class="skeleton-featured hidden lg:block"></div>' +
    '</div></div>';

  const headers = DAYS.map(d => `<div class="day-header">${d}</div>`).join('');
  calendar.innerHTML =
    '<div class="calendar-grid">' + headers +
    '<div class="day-cell" style="animation:none"><div class="skeleton-text-sm w-16 mt-2"></div></div>'.repeat(35) +
    '</div>';

  const card =
    '<div class="bg-surface rounded-2xl border border-surface-border p-4 flex gap-4">' +
    '<div class="skeleton-poster"></div>' +
    '<div class="flex-1 flex flex-col gap-2">' +
    '<div class="skeleton-text w-3/4"></div>' +
    '<div class="skeleton-text-sm w-1/2"></div>' +
    '<div class="skeleton-text-sm w-2/3"></div>' +
    '<div class="skeleton-text w-full mt-1"></div>' +
    '<div class="skeleton-text w-full"></div>' +
    '</div></div>';
  timeline.innerHTML = '<div class="flex flex-col gap-4">' + card.repeat(4) + '</div>';
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
      errorEl.className = "error-banner";
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

// popover
function closePopover() {
  const el = document.querySelector(".popover-overlay");
  if (!el) return;
  el.classList.add("closing");
  setTimeout(() => el.remove(), 200);
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
  if (t.closest(".popover-overlay") && !t.closest(".popover-card")) {
    e.stopPropagation();
    closePopover();
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeMonthDropdown(); closePopover(); }
});

function openPopover(el: HTMLElement) {
  closePopover();
  const d = el.dataset;
  const title = d.title || "";
  const date = d.date
    ? new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : "";
  const rating = d.rating && parseFloat(d.rating) > 0
    ? `<div class="text-sm font-semibold text-accent">★ ${parseFloat(d.rating).toFixed(1)}</div>` : "";
  const tickets = d.tickets
    ? `<a class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-bg text-sm font-bold no-underline self-start hover:bg-accent-hover transition-colors" href="${d.tickets}" target="_blank" rel="noopener">Get Tickets</a>` : "";

  const overlay = document.createElement("div");
  overlay.className = "popover-overlay";
  overlay.innerHTML = `
    <div class="bg-surface rounded-3xl p-6 popover-card">
      <div class="flex gap-5 popover-inner">
        <img class="rounded-xl popover-poster" src="${d.poster}" alt="${title}" />
        <div class="flex flex-col gap-2">
          <div class="text-xl font-bold tracking-tight">${title}</div>
          <div class="text-sm text-text-muted">${date}</div>
          ${d.director ? `<div class="text-sm text-text-muted">Directed by ${d.director}</div>` : ""}
          ${d.cast ? `<div class="text-sm text-text-muted">${d.cast}</div>` : ""}
          ${rating}
          <p class="text-sm leading-relaxed text-text-dim">${d.overview || ""}</p>
          ${tickets}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
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
