# SolidWorks MCP Server - Python Paralel Versiyonu

Bu dizin, mevcut Node.js SolidWorks MCP Server'ının **Python versiyonunu** içerir. `uvx` ile hızlı kurulum ve dağıtım için tasarlanmıştır.

## 📦 Yapı

```
python/
├── pyproject.toml          # uv/uvx yapılandırması
├── README.md               # Bu dosya
├── Makefile                # Komut satırı komutları
├── .env.example            # Ortam değişkenleri örneği
├── src/
│   └── solidworks_mcp_server/
│       ├── __init__.py
│       ├── mcp/            # MCP server implementasyonu
│       ├── solidworks/     # SolidWorks COM wrapper
│       ├── vba/            # VBA makro oluşturucu (Jinja2)
│       ├── tools/          # Araç tanımları
│       └── utils/          # Yardımcı fonksiyonlar
└── tests/
    └── test_basic.py       # Temel testler
```

## 🔧 Teknoloji Karşılaştırması

| Bileşen | Node.js | Python |
|---------|---------|--------|
| **COM Bağlantısı** | winax | pywin32 / comtypes |
| **Template Engine** | Handlebars | Jinja2 |
| **MCP SDK** | @modelcontextprotocol/sdk | mcp |
| **Loglama** | winston | loguru |
| **Validasyon** | Zod | Pydantic |
| **Paket Yönetimi** | npm/pnpm | uv/uvx |

## 🚀 Hızlı Başlangıç

### 1. uv Kurulumu (Gerekliyse)

```bash
# Windows/macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Bağımlılıkları Yükle

```bash
cd python
uv pip install -e ".[dev]"
```

### 3. Çalıştır

```bash
# MCP server olarak
uv run python -m solidworks_mcp_server

# VBA makro oluştur
uv run python -c "from solidworks_mcp_server.vba import VBAGenerator; g = VBAGenerator(); print(g.generate('part_create'))"
```

### 4. Test Et

```bash
uv run pytest tests/ -v
```

## 🛠️ Kullanım Örnekleri

### VBA Makro Oluşturma

```python
from solidworks_mcp_server.vba import VBAGenerator

generator = VBAGenerator()

# Part oluşturma makrosu
vba_code = generator.generate("part_create", {
    "function_name": "create_my_part",
    "features": [
        {"name": "Boss-Extrude", "type": "extrusion"},
        {"name": "Cut-Extrude", "type": "cut"}
    ]
})

# Dosyaya kaydet
generator.save_to_file("part_create", "C:/Macros/my_part.swp")
```

### SolidWorks Bağlantısı

```python
from solidworks_mcp_server.solidworks import get_sw_api

sw = get_sw_api()
if sw.connect():
    print(f"SolidWorks versiyonu: {sw.get_version()}")
```

### MCP Server Araçları

Python versiyonu şu araçları sağlar:

- `generate_vba_macro`: VBA kodu oluştur
- `execute_macro`: Makro çalıştır (Windows)
- `get_solidworks_info`: SW bilgilerini al

## 📋 Make Komutları

```bash
make install      # Bağımlılıkları yükle
make dev          # Geliştirme modu
make test         # Testleri çalıştır
make lint         # Kod kontrolü
make format       # Formatlama
make build        # Paket oluştur
make clean        # Temizlik
```

## 🔗 Node.js ile Birlikte Kullanım

Her iki versiyonu da paralel kullanabilirsiniz:

```bash
# Node.js versiyonu
cd ..
npm run dev

# Terminal 2 - Python versiyonu
cd python
uv run python -m solidworks_mcp_server
```

## ⚠️ Platform Gereksinimleri

- **Windows**: SolidWorks + pywin32 gerekli (tam özellik)
- **macOS/Linux**: Mock mod (VBA oluşturma çalışır, COM bağlantısı yok)

## 📝 Notlar

1. Python versiyonu, Node.js'in tüm özelliklerini henüz içermemektedir
2. Öncelik VBA makro oluşturma ve temel COM işlemleridir
3. Katkıda bulunmak için `src/tools/` dizinine yeni araçlar ekleyebilirsiniz

## 🤝 Katkıda Bulunma

1. Node.js versiyonundaki bir özelliği Python'a taşıyın
2. Jinja2 template'lerini genişletin
3. Test coverage'ı artırın

---

**Node.js Projesi**: `/workspace/package.json`  
**Python Projesi**: `/workspace/python/pyproject.toml`
