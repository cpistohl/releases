# Mac Mini Home Server Setup

Complete guide to hosting this app (and future apps) on a Mac Mini using Docker, Caddy, and Cloudflare Tunnel.

## Architecture

```
Internet → Cloudflare Tunnel → Caddy (reverse proxy)
                                  ├── releases.pistohl.com → releases:3000
                                  └── future-app.pistohl.com → future-app:XXXX
```

- **Cloudflare Tunnel**: Exposes your Mac Mini to the internet without opening router ports
- **Caddy**: Reverse proxy that routes subdomains to the correct container
- **App containers**: Each app runs in its own Docker container

---

## Part 1: One-Time Server Infrastructure Setup

### 1.1 Create the shared Docker network

All containers (Caddy, cloudflared, and your apps) communicate over this network:

```sh
docker network create caddy
```

### 1.2 Create the Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks → Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** as the connector
5. Name it something like `mac-mini`
6. Copy the **tunnel token** — you'll need it in the next step
7. In the tunnel's **Public Hostname** tab, add:
   - Subdomain: `releases`, Domain: `pistohl.com`, Service: `http://caddy:80`
   - (Add more subdomains here later for future apps)

### 1.3 Create the infrastructure stack

```sh
mkdir -p ~/server-infra
cd ~/server-infra
```

Create `~/server-infra/Caddyfile`:

```
releases.pistohl.com {
    reverse_proxy releases:3000
}

# Add future apps here:
# app2.pistohl.com {
#     reverse_proxy app2:3000
# }
```

Create `~/server-infra/docker-compose.yml`:

```yaml
services:
  caddy:
    image: caddy:2
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - caddy

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=YOUR_TUNNEL_TOKEN_HERE
    networks:
      - caddy

volumes:
  caddy_data:
  caddy_config:

networks:
  caddy:
    external: true
```

Replace `YOUR_TUNNEL_TOKEN_HERE` with the token from step 1.2.

### 1.4 Start the infrastructure

```sh
cd ~/server-infra
docker compose up -d
```

Verify both containers are running:

```sh
docker ps
```

You should see `caddy` and `cloudflared` containers running.

---

## Part 2: Deploy the Releases App

### 2.1 Clone and configure

```sh
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/YOUR_USER/releases.git
cd releases
```

Create the `.env` file:

```sh
echo "TMDB_API_KEY=your_api_key_here" > .env
```

### 2.2 Build and start

```sh
docker compose up -d --build
```

### 2.3 Verify

```sh
# Check the container is running
docker ps

# Check the logs
docker logs releases

# Test locally on the Mac Mini
curl http://localhost:3000
```

Then visit `https://releases.pistohl.com` — your app should be live.

---

## Part 3: Redeploying After Code Changes

When you push changes to GitHub and want to update the server:

```sh
cd ~/apps/releases
git pull
docker compose up -d --build
```

That's it — Docker rebuilds the image and restarts the container. The `--build` flag ensures it picks up code changes.

---

## Part 4: Adding Future Apps

For each new app:

1. **Dockerize it** — add a `Dockerfile` and `docker-compose.yml` (use the releases app as a template). Make sure the compose file uses the `caddy` external network.

2. **Add a route in Caddy** — edit `~/server-infra/Caddyfile`:
   ```
   newapp.pistohl.com {
       reverse_proxy newapp:3000
   }
   ```
   Then reload Caddy:
   ```sh
   docker exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

3. **Add the hostname in Cloudflare Tunnel** — go to the tunnel config in the Cloudflare dashboard and add:
   - Subdomain: `newapp`, Domain: `pistohl.com`, Service: `http://caddy:80`

4. **Deploy the app**:
   ```sh
   cd ~/apps
   git clone https://github.com/YOUR_USER/newapp.git
   cd newapp
   docker compose up -d --build
   ```

---

## Troubleshooting

**App not accessible:**
```sh
# Check all containers are on the caddy network
docker network inspect caddy

# Check Caddy logs
docker logs caddy

# Check cloudflared logs
docker logs cloudflared

# Check app logs
docker logs releases
```

**Rebuild from scratch:**
```sh
cd ~/apps/releases
docker compose down
docker compose up -d --build
```

**Restart infrastructure:**
```sh
cd ~/server-infra
docker compose restart
```
