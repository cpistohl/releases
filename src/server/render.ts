import { posterUrl, type Movie } from "../lib/tmdb";
import { MONTH_NAMES, DAY_NAMES, shortDate, longDate } from "../lib/constants";

export { MONTH_NAMES };

const MARCUS_BASE = "https://www.marcustheatres.com/movies";

export function marcusUrl(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${MARCUS_BASE}/${slug}`;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MAX_FEATURED = 5;
const MAX_POSTERS_PER_DAY = 3;
const OVERVIEW_LIMIT_FEATURED = 200;
const OVERVIEW_LIMIT_TIMELINE = 180;

/** Shared data attributes for a movie element (poster, card, etc.) */
function movieDataAttrs(m: Movie) {
  const esc = escapeHtml(m.title);
  return [
    `data-movie-id="${m.id}"`,
    `data-title="${esc}"`,
    `data-overview="${escapeHtml(m.overview.slice(0, OVERVIEW_LIMIT_FEATURED))}"`,
    `data-rating="${m.vote_average}"`,
    `data-poster="${posterUrl(m.poster_path, "w500")}"`,
    `data-date="${m.release_date}"`,
    `data-cast="${escapeHtml(m.cast.join(", "))}"`,
    `data-director="${escapeHtml(m.director)}"`,
    `data-tickets="${marcusUrl(m.title)}"`,
  ].join(" ");
}

// top 5 movies by popularity
export function renderFeatured(movies: Movie[]) {
  const top = [...movies].sort((a, b) => b.popularity - a.popularity).slice(0, MAX_FEATURED);
  if (!top.length) return "";

  const cards = top.map((m, i) => {
    const esc = escapeHtml(m.title);
    const hideClass = i === 4 ? " hide-md" : "";
    return `<a class="featured-card${hideClass}" ${movieDataAttrs(m)}>
      <img class="featured-poster" src="${posterUrl(m.poster_path, "w300")}" alt="${esc}" loading="lazy" />
      <div class="featured-info">
        <span class="featured-title">${esc}</span>
        <span class="featured-date">${shortDate(m.release_date)}</span>
      </div></a>`;
  });

  return [
    '<div class="featured">',
    '<h2 class="featured-heading">Top Releases</h2>',
    '<div class="featured-grid">',
    ...cards,
    '</div></div>',
  ].join("");
}

// 7-column calendar grid
export function renderCalendarGrid(year: number, month: number, moviesByDate: Map<string, Movie[]>) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayDate = (today.getFullYear() === year && today.getMonth() + 1 === month)
    ? today.getDate()
    : -1;

  const parts: string[] = ['<div class="calendar-grid">'];

  // day-of-week headers
  for (const d of DAY_NAMES) {
    parts.push(`<div class="day-header">${d}</div>`);
  }

  // leading empty cells
  for (let i = 0; i < firstDay; i++) {
    parts.push('<div class="day-cell empty"></div>');
  }

  // day cells
  for (let d = 1; d <= lastDate; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const movies = moviesByDate.get(key) || [];
    const isToday = d === todayDate;

    const cls = ["day-cell", movies.length ? "has-movies" : "", isToday ? "today" : ""]
      .filter(Boolean).join(" ");
    const delay = (firstDay + d - 1) * 0.02;

    parts.push(`<div class="${cls}" style="animation-delay:${delay}s">`);
    parts.push(`<span class="day-number${isToday ? " today-number" : ""}">${d}</span>`);

    if (movies.length) {
      parts.push('<div class="day-movies">');
      for (const m of movies.slice(0, MAX_POSTERS_PER_DAY)) {
        const esc = escapeHtml(m.title);
        parts.push(`<img class="mini-poster" src="${posterUrl(m.poster_path, "w200")}" alt="${esc}" loading="lazy" ${movieDataAttrs(m)} />`);
      }
      if (movies.length > MAX_POSTERS_PER_DAY) {
        parts.push(`<span class="more-badge">+${movies.length - MAX_POSTERS_PER_DAY}</span>`);
      }
      parts.push('</div>');
    }
    parts.push('</div>');
  }

  parts.push('</div>');
  return parts.join("");
}

const EMPTY_STATE_SVG = `<svg class="empty-icon" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="3" opacity="0.2"/>
  <circle cx="60" cy="60" r="30" stroke="currentColor" stroke-width="3" opacity="0.2"/>
  <circle cx="60" cy="60" r="20" stroke="currentColor" stroke-width="3" opacity="0.2"/>
  <circle cx="60" cy="35" r="4" fill="currentColor" opacity="0.3"/>
  <circle cx="60" cy="85" r="4" fill="currentColor" opacity="0.3"/>
  <circle cx="35" cy="60" r="4" fill="currentColor" opacity="0.3"/>
  <circle cx="85" cy="60" r="4" fill="currentColor" opacity="0.3"/>
  <path d="M45 50 L45 70 L65 60 Z" fill="currentColor" opacity="0.25"/>
</svg>`;

// list view grouped by date
export function renderTimeline(moviesByDate: Map<string, Movie[]>) {
  if (!moviesByDate.size) {
    return `<div class="empty-state">
      ${EMPTY_STATE_SVG}
      <p class="empty-title">No movie releases this month.</p>
      <p class="empty-subtitle">Check another month to see upcoming films.</p>
    </div>`;
  }

  const parts: string[] = ['<div class="timeline-wrap">'];

  for (const dateStr of [...moviesByDate.keys()].sort()) {
    const movies = moviesByDate.get(dateStr)!;

    parts.push('<div>');
    parts.push(`<h3 class="timeline-group-header">${longDate(dateStr)}</h3>`);
    parts.push('<div class="timeline-cards">');

    for (const m of movies) {
      const esc = escapeHtml(m.title);
      const overview = m.overview.length > OVERVIEW_LIMIT_TIMELINE
        ? escapeHtml(m.overview.slice(0, OVERVIEW_LIMIT_TIMELINE)) + "..."
        : escapeHtml(m.overview);

      parts.push('<div class="movie-card">');
      parts.push('<div class="movie-card-body">');
      parts.push(`<img class="card-poster" src="${posterUrl(m.poster_path, "w300")}" alt="${esc}" loading="lazy" />`);
      parts.push('<div class="card-details">');
      parts.push(`<h4 class="card-title">${esc}</h4>`);
      if (m.director) parts.push(`<span class="card-meta">Directed by ${escapeHtml(m.director)}</span>`);
      if (m.cast.length) parts.push(`<span class="card-meta">${escapeHtml(m.cast.join(", "))}</span>`);
      if (m.vote_average > 0) parts.push(`<span class="card-rating">★ ${m.vote_average.toFixed(1)}</span>`);
      parts.push(`<p class="card-overview">${overview}</p>`);
      parts.push(`<a class="tickets-btn" href="${marcusUrl(m.title)}" target="_blank" rel="noopener">Get Tickets</a>`);
      parts.push('</div></div></div>');
    }
    parts.push('</div></div>');
  }

  parts.push('</div>');
  return parts.join("");
}
