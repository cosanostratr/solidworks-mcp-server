# SolidWorks MCP Server - Python

Python versiyonu, Node.js implementasyonu ile paralel çalışacak şekilde tasarlanmıştır.

## Kurulum

```bash
# uvx ile hızlı kurulum
uvx solidworks-mcp-python

# veya manuel kurulum
uv pip install -e .
```

## Kullanım

```bash
# MCP server olarak çalıştırma
uv run solidworks-mcp-python

# VBA makro oluşturma
python -m solidworks_mcp_server.vba_generator --template part_create --output macro.swp
```

## Node.js vs Python Karşılaştırması

| Özellik | Node.js | Python |
|---------|---------|--------|
| COM Bağlantısı | winax | pywin32/comtypes |
| Template Engine | Handlebars | Jinja2 |
| MCP SDK | @modelcontextprotocol/sdk | mcp |
| Loglama | winston | loguru |
| Validasyon | Zod | Pydantic |

## Geliştirme

```bash
# Testleri çalıştırma
uv run pytest

# Lint ve format
uv run ruff check .
uv run black .
```
