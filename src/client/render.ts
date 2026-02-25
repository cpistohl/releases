import { MONTH_NAMES, DAY_NAMES, shortDate, longDate, escapeHtml, type Movie } from "../lib/constants";

export { MONTH_NAMES, type Movie };

const IMG = "https://image.tmdb.org/t/p";

const NO_POSTER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
    <rect width="200" height="300" fill="#2c3440" rx="4"/>
    <text x="100" y="140" text-anchor="middle" fill="#667" font-family="system-ui" font-size="14">No Poster</text>
    <text x="100" y="165" text-anchor="middle" fill="#667" font-family="system-ui" font-size="24">🎬</text>
  </svg>`
)}`;

const MARCUS_BASE = "https://www.marcustheatres.com/movies";
const TMDB_MOVIE_BASE = "https://www.themoviedb.org/movie";

export function posterUrl(path: string | null, size = "w200") {
  return path ? `${IMG}/${size}${path}` : NO_POSTER;
}

export function marcusUrl(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${MARCUS_BASE}/${slug}`;
}

export function tmdbUrl(id: number) {
  return `${TMDB_MOVIE_BASE}/${id}`;
}

const MAX_FEATURED = 5;
const MAX_POSTERS_PER_DAY = 3;
const OVERVIEW_LIMIT_DATA_ATTR = 500;

function movieDataAttrs(m: Movie) {
  const esc = escapeHtml(m.title);
  return [
    `data-movie-id="${m.id}"`,
    `data-title="${esc}"`,
    `data-overview="${escapeHtml(m.overview.slice(0, OVERVIEW_LIMIT_DATA_ATTR))}"`,
    `data-rating="${m.vote_average}"`,
    `data-poster="${posterUrl(m.poster_path, "w500")}"`,
    `data-date="${m.release_date}"`,
    `data-cast="${escapeHtml(m.cast.join(", "))}"`,
    `data-director="${escapeHtml(m.director)}"`,
    `data-genres="${escapeHtml(m.genres.join(", "))}"`,
    `data-tickets="${marcusUrl(m.title)}"`,
    `data-tmdb="${tmdbUrl(m.id)}"`
  ].join(" ");
}

export function renderFeatured(movies: Movie[]) {
  const top = [...movies].sort((a, b) => b.popularity - a.popularity).slice(0, MAX_FEATURED);
  if (!top.length) return "";

  const cards = top.map((m, i) => {
    const esc = escapeHtml(m.title);
    const hideClass = i === 4 ? " featured-hidden-mobile" : "";
    return `<div class="featured-col${hideClass}">
      <a class="featured-card" ${movieDataAttrs(m)}>
        <img class="featured-poster" src="${posterUrl(m.poster_path, "w300")}" alt="${esc}" loading="lazy" />
        <div class="featured-info">
          <span class="featured-title">${esc}</span>
          <span class="featured-date">${shortDate(m.release_date)}</span>
        </div>
      </a>
    </div>`;
  });

  return [
    '<div class="featured">',
    '<h2 class="featured-heading">Top Releases</h2>',
    '<div class="featured-grid">',
    ...cards,
    '</div></div>'
  ].join("");
}

export function renderCalendarGrid(year: number, month: number, moviesByDate: Record<string, Movie[]>) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayDate = (today.getFullYear() === year && today.getMonth() + 1 === month)
    ? today.getDate()
    : -1;

  const parts: string[] = ['<div class="calendar-grid">'];

  for (const d of DAY_NAMES) {
    parts.push(`<div class="day-header">${d}</div>`);
  }

  for (let i = 0; i < firstDay; i++) {
    parts.push('<div class="day-cell empty"></div>');
  }

  for (let d = 1; d <= lastDate; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const movies = moviesByDate[key] || [];
    const isToday = d === todayDate;

    const cls = ["day-cell", movies.length ? "has-movies" : "", isToday ? "today" : ""].filter(Boolean).join(" ");
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

export function renderTimeline(moviesByDate: Record<string, Movie[]>) {
  const dates = Object.keys(moviesByDate).sort();
  if (!dates.length) {
    return `<div class="empty-state">
      ${EMPTY_STATE_SVG}
      <p class="empty-title">No movie releases this month.</p>
      <p class="empty-subtitle">Check another month to see upcoming films.</p>
    </div>`;
  }

  const parts: string[] = ['<div class="timeline-wrap">'];

  for (const dateStr of dates) {
    const movies = moviesByDate[dateStr] || [];

    parts.push('<div>');
    parts.push(`<h3 class="timeline-group-header">${longDate(dateStr)}</h3>`);
    parts.push('<div class="timeline-cards">');

    for (const m of movies) {
      const esc = escapeHtml(m.title);
      const overview = escapeHtml(m.overview);

      // Check if tickets are likely available (within ~6 weeks of today)
      const releaseDate = new Date(m.release_date + "T00:00:00");
      const now = new Date();
      const daysUntil = (releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      const ticketsLikely = daysUntil <= 42 && daysUntil >= -14;

      parts.push('<div class="card movie-card">');
      parts.push('<div class="card-top">');
      parts.push(`<img class="card-poster" src="${posterUrl(m.poster_path, "w300")}" alt="${esc}" loading="lazy" />`);
      parts.push('<div class="card-details">');
      parts.push('<div class="card-title-row">');
      parts.push(`<h4 class="card-title">${esc}</h4>`);
      if (m.vote_average > 0) parts.push(`<span class="card-rating">★ ${m.vote_average.toFixed(1)}</span>`);
      parts.push('</div>');
      if (m.genres.length) parts.push(`<span class="card-genres">${escapeHtml(m.genres.join(" / "))}</span>`);
      if (m.cast.length) parts.push(`<span class="card-meta">${escapeHtml(m.cast.join(", "))}</span>`);
      if (overview) parts.push(`<p class="card-overview">${overview}</p>`);
      parts.push('<div class="card-actions">');
      if (ticketsLikely) {
        parts.push(`<a class="tickets-btn" href="${marcusUrl(m.title)}" target="_blank" rel="noopener">Tickets</a>`);
      }
      parts.push(`<a class="tmdb-link" href="${tmdbUrl(m.id)}" target="_blank" rel="noopener">Details &rsaquo;</a>`);
      parts.push('</div>');
      parts.push('</div></div>');
      parts.push('</div>');
    }
    parts.push('</div></div>');
  }

  parts.push('</div>');
  return parts.join("");
}
