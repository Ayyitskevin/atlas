.PHONY: dev docker-up docker-down install migrate seed test typecheck

install:
	corepack pnpm install

dev:
	corepack pnpm dev

docker-up:
	docker compose up --build

docker-down:
	docker compose down --remove-orphans

migrate:
	DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas corepack pnpm --filter @atlas/db migrate

seed:
	DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas corepack pnpm --filter @atlas/db seed

typecheck:
	corepack pnpm typecheck

test:
	corepack pnpm test
