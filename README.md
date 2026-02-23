# Movie Releases

A movie release calendar that pulls from TMDB and displays upcoming theatrical releases by month.

**Live at [releases.pistohl.com](https://releases.pistohl.com)**

## What it does

Browse upcoming movie releases in three views:

- **Featured** — top 5 most popular releases for the month
- **Calendar** — month grid with posters on release dates
- **Timeline** — chronological cards with cast, director, genres, and overview

Click any movie for details. Link out to TMDB or grab ticket links.

## Tech

- **Bun** — server, bundler, and runtime
- **TMDB API** — movie data source
- **Bootstrap 5** — dark theme UI
- **Sentry** — error tracking
- **Azure Container Apps** — hosting (Terraform IaC)
- **GitHub Actions** — CI/CD (build → GHCR → Azure)

## Run locally

```bash
bun install
```

Create a `.env` file:

```
TMDB_API_KEY=your_key_here
```

Get a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

```bash
bun run dev
```

Open `http://localhost:3000`.

## Deploy

Pushes to `main` trigger the GitHub Actions pipeline which builds a Docker image, pushes to GHCR, and deploys to Azure Container Apps.

Infrastructure is defined in `infra/main.tf`. To apply changes:

```bash
cd infra && terraform apply
```
