# Coffee inventory management

Next.js frontend (`stock-frontend`) and NestJS/PostgreSQL API (`stock-api`).

- Frontend: https://coffee.efnanbusinessplc.com
- API: https://api.efnanbusinessplc.com/api
- Health: https://api.efnanbusinessplc.com/api/health

## Development

Use Node.js 22 and PostgreSQL 16. Copy `stock-api/.env.example` to
`stock-api/.env`, configure your local database and unique JWT secrets,
then install dependencies with `npm ci` in each application directory.
Start the backend with `npm run start:dev` and the frontend with `npm run dev`.
The frontend defaults to `http://localhost:3001/api`; override it with
`NEXT_PUBLIC_API_URL` in `stock-frontend/.env.local` when necessary.
The example seeder creates demo accounts; use it only for local/demo data.

## Deployment

See [the deployment guide](docs/VPS-DEPLOYMENT.md) for server setup, GitHub
secrets, container deployment, migrations, backups, logs, and rollback.

Pull requests build both Docker images and run integration smoke checks.
A successful push to `main` automatically deploys the tested images to the VPS.
The server loads images built in GitHub Actions; it does not clone, pull,
install npm packages, or compile the application during deployment.

The production database and uploads stay outside the application containers.
Never commit server environment files or private SSH keys.
