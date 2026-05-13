# Production Deployment

FreshSync production runs behind system `nginx` with Let's Encrypt certificates from `certbot`.

## Topology
- `nginx` terminates TLS on `freshsync.umtoj.edu.vn`
- `web` runs in Docker on `127.0.0.1:3100`
- `api` runs in Docker on `127.0.0.1:4100`
- `postgres` runs in Docker on `127.0.0.1:5432`
- `redis` runs in Docker on `127.0.0.1:6379`

## Repo Assets
- HTTP bootstrap config: `deploy/nginx/freshsync.umtoj.edu.vn.http.conf`
- Full TLS config: `deploy/nginx/freshsync.umtoj.edu.vn.ssl.conf`
- Container deployment: `scripts/prod-deploy.sh`
- Demo reseed: `pnpm demo:reset`
- Production smoke test: `API_URL=https://freshsync.umtoj.edu.vn/api pnpm demo:smoke`

## First-Time Server Setup
1. Deploy app containers:
   `bash ./scripts/prod-deploy.sh`
2. Install HTTP bootstrap vhost into nginx.
3. Issue certificate with:
   `sudo certbot certonly --webroot -w /var/www/certbot -d freshsync.umtoj.edu.vn --agree-tos --register-unsafely-without-email --non-interactive`
4. Replace bootstrap vhost with `deploy/nginx/freshsync.umtoj.edu.vn.ssl.conf`
5. Reload nginx:
   `sudo nginx -t && sudo systemctl reload nginx`

## Routine Updates
1. Pull latest code.
2. Rebuild containers:
   `bash ./scripts/prod-deploy.sh`
3. If demo data must be reset:
   `pnpm demo:reset`
4. Verify:
   `API_URL=https://freshsync.umtoj.edu.vn/api pnpm demo:smoke`
