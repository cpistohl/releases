import { posterUrl, type Movie } from "../lib/tmdb";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function marcusUrl(title: string) {
  return `https://www.marcustheatres.com/movies/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// top 5 movies by popularity
export function renderFeatured(movies: Movie[]) {
  const top = [...movies].sort((a, b) => b.popularity - a.popularity).slice(0, 5);
  if (!top.length) return "";

  let html = '<div class="mb-9 featured">';
  html += '<h2 class="text-xs font-bold uppercase tracking-widest text-accent mb-4 featured-heading">Top Releases</h2>';
  html += '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">';

  for (const m of top) {
    const date = new Date(m.release_date + "T00:00:00");
    const fmt = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const esc = escapeHtml(m.title);
    html += `<a class="no-underline text-inherit featured-card" data-movie-id="${m.id}"
      data-title="${esc}" data-overview="${escapeHtml(m.overview.slice(0, 200))}"
      data-rating="${m.vote_average}" data-poster="${posterUrl(m.poster_path, "w500")}"
      data-date="${m.release_date}" data-cast="${escapeHtml(m.cast.join(", "))}"
      data-director="${escapeHtml(m.director)}" data-tickets="${marcusUrl(m.title)}">
      <img class="w-full rounded-xl featured-poster" src="${posterUrl(m.poster_path, "w300")}" alt="${esc}" loading="lazy" />
      <div class="pt-2.5 px-0.5">
        <span class="block text-sm font-semibold text-text truncate">${esc}</span>
        <span class="text-xs text-text-muted mt-0.5">${fmt}</span>
      </div></a>`;
  }
  html += '</div></div>';
  return html;
}

// 7-column calendar grid
export function renderCalendarGrid(year: number, month: number, moviesByDate: Map<string, Movie[]>) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = isCurrentMonth ? today.getDate() : -1;

  let html = '<div class="calendar-grid">';
  for (const d of DAYS) html += `<div class="day-header">${d}</div>`;
  for (let i = 0; i < firstDay; i++) html += '<div class="day-cell empty"></div>';

  for (let d = 1; d <= lastDate; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const movies = moviesByDate.get(key) || [];
    const isToday = d === todayDate;

    const cls = ["day-cell", movies.length ? "has-movies" : "", isToday ? "today" : ""].filter(Boolean).join(" ");
    const delay = (firstDay + d - 1) * 0.02;

    html += `<div class="${cls}" style="animation-delay:${delay}s">`;
    html += `<span class="day-number${isToday ? " today-number" : ""}">${d}</span>`;

    if (movies.length) {
      html += '<div class="day-movies">';
      for (const m of movies.slice(0, 3)) {
        const esc = escapeHtml(m.title);
        html += `<img class="mini-poster" src="${posterUrl(m.poster_path, "w200")}" alt="${esc}" loading="lazy"
          data-movie-id="${m.id}" data-title="${esc}"
          data-overview="${escapeHtml(m.overview.slice(0, 200))}" data-rating="${m.vote_average}"
          data-poster="${posterUrl(m.poster_path, "w300")}" data-date="${m.release_date}"
          data-cast="${escapeHtml(m.cast.join(", "))}" data-director="${escapeHtml(m.director)}"
          data-tickets="${marcusUrl(m.title)}" />`;
      }
      if (movies.length > 3) html += `<span class="more-badge">+${movies.length - 3}</span>`;
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// list view grouped by date
export function renderTimeline(moviesByDate: Map<string, Movie[]>) {
  if (!moviesByDate.size) {
    return `<div class="text-center py-20 empty-state">
      <svg class="empty-icon mx-auto mb-6" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="3" opacity="0.2"/>
        <circle cx="60" cy="60" r="30" stroke="currentColor" stroke-width="3" opacity="0.2"/>
        <circle cx="60" cy="60" r="20" stroke="currentColor" stroke-width="3" opacity="0.2"/>
        <circle cx="60" cy="35" r="4" fill="currentColor" opacity="0.3"/>
        <circle cx="60" cy="85" r="4" fill="currentColor" opacity="0.3"/>
        <circle cx="35" cy="60" r="4" fill="currentColor" opacity="0.3"/>
        <circle cx="85" cy="60" r="4" fill="currentColor" opacity="0.3"/>
        <path d="M45 50 L45 70 L65 60 Z" fill="currentColor" opacity="0.25"/>
      </svg>
      <p class="text-lg text-text-muted">No movie releases this month.</p>
      <p class="text-sm text-text-dim mt-2">Check another month to see upcoming films.</p>
    </div>`;
  }

  let html = '<div class="flex flex-col gap-9">';
  for (const dateStr of [...moviesByDate.keys()].sort()) {
    const movies = moviesByDate.get(dateStr)!;
    const label = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    html += '<div class="timeline-group">';
    html += `<h3 class="text-xs font-bold uppercase tracking-widest text-accent pb-2 mb-4 border-b border-surface-border">${label}</h3>`;
    html += '<div class="flex flex-col gap-3">';

    for (const m of movies) {
      const esc = escapeHtml(m.title);
      html += '<div class="bg-surface rounded-2xl border border-surface-border movie-card">';
      html += '<div class="flex gap-4 p-4 movie-card-body">';
      html += `<img class="rounded-xl shrink-0 card-poster" src="${posterUrl(m.poster_path, "w300")}" alt="${esc}" loading="lazy" />`;
      html += '<div class="flex flex-col gap-1.5 py-1">';
      html += `<h4 class="text-[17px] font-bold tracking-tight">${esc}</h4>`;
      if (m.director) html += `<span class="text-sm text-text-muted leading-snug">Directed by ${escapeHtml(m.director)}</span>`;
      if (m.cast.length) html += `<span class="text-sm text-text-muted leading-snug">${escapeHtml(m.cast.join(", "))}</span>`;
      if (m.vote_average > 0) html += `<span class="text-sm font-semibold text-accent">★ ${m.vote_average.toFixed(1)}</span>`;
      html += `<p class="text-sm leading-relaxed text-text-dim">${escapeHtml(m.overview.slice(0, 180))}${m.overview.length > 180 ? "..." : ""}</p>`;
      html += `<a class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-bg text-sm font-bold no-underline self-start mt-1 hover:bg-accent-hover transition-colors" href="${marcusUrl(m.title)}" target="_blank" rel="noopener">Get Tickets</a>`;
      html += '</div></div></div>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}
