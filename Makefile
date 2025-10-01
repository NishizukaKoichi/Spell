.PHONY: help install setup db-create db-migrate db-reset dev-backend dev-frontend dev test build deploy-backend deploy-frontend clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ======================
# Installation
# ======================

install: ## Install all required tools
	@echo "Installing Rust tools..."
	cargo install sqlx-cli --no-default-features --features postgres
	@echo "Installing Node dependencies..."
	pnpm install
	@echo "Done! All tools installed."

# ======================
# Setup
# ======================

setup: ## Initial setup (create .env from template)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
		echo "Please edit .env with your credentials"; \
	else \
		echo ".env already exists"; \
	fi

# ======================
# Database
# ======================

db-create: ## Create database
	createdb spell_platform || echo "Database already exists"

db-migrate: ## Run database migrations
	cd core && sqlx migrate run

db-reset: ## Reset database (drop and recreate)
	dropdb spell_platform --if-exists
	createdb spell_platform
	cd core && sqlx migrate run

# ======================
# Development
# ======================

dev-backend: ## Run backend in development mode
	cd core && cargo run

dev-frontend: ## Run frontend in development mode
	pnpm dev

dev: ## Run both backend and frontend (requires tmux or run in separate terminals)
	@echo "Start backend: make dev-backend"
	@echo "Start frontend: make dev-frontend"

# ======================
# Testing
# ======================

test: ## Run all tests
	cd core && cargo test
	pnpm test

# ======================
# Build
# ======================

build: ## Build for production
	cd core && cargo build --release
	pnpm build

# ======================
# Deployment
# ======================

deploy-backend: ## Deploy backend to Fly.io
	cd core && fly deploy

deploy-frontend: ## Deploy frontend to Vercel
	vercel deploy --prod

# ======================
# Cleanup
# ======================

clean: ## Clean build artifacts
	cd core && cargo clean
	rm -rf .next
	rm -rf node_modules/.cache
