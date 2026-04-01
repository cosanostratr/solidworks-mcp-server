# SolidWorks MCP Server - Python Makefile

.PHONY: install dev test lint format clean build publish

# uvx ile kurulum
install:
uv pip install -e ".[dev]"

# Geliştirme modu
dev:
uv run python -m solidworks_mcp_server

# Testleri çalıştır
test:
uv run pytest tests/ -v

# Test coverage
coverage:
uv run pytest tests/ --cov=solidworks_mcp_server --cov-report=html

# Lint
lint:
uv run ruff check src/ tests/
uv run mypy src/

# Format
format:
uv run black src/ tests/
uv run ruff check --fix src/ tests/

# Build
build:
uv build

# Temizlik
clean:
rm -rf dist/ build/ *.egg-info .pytest_cache/ .mypy_cache/ htmlcov/
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type f -name "*.pyc" -delete

# PyPI'ye yayınlama
publish:
uv publish

# Yardım
help:
@echo "SolidWorks MCP Server - Python"
@echo ""
@echo "Kullanım:"
@echo "  make install    - Bağımlılıkları yükle"
@echo "  make dev        - Geliştirme modunda çalıştır"
@echo "  make test       - Testleri çalıştır"
@echo "  make lint       - Kod kontrolü"
@echo "  make format     - Kod formatlama"
@echo "  make build      - Paket oluştur"
@echo "  make clean      - Temizlik"
@echo "  make publish    - PyPI'ye yükle"
