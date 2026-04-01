# SolidWorks MCP Server - Python Paralel Kurulumu

Bu doküman, mevcut Node.js projesine paralel olarak Python versiyonunun nasıl kurulacağını ve kullanılacağını açıklar.

## 📋 Genel Bakış

Proje artık iki paralel implementasyon içeriyor:

1. **Node.js** (Orijinal) - `/workspace/`
2. **Python** (Yeni) - `/workspace/python/`

Her ikisi de aynı işlevselliği sağlar, farklı teknolojiler kullanır.

## 🚀 Python Kurulumu

### 1. uv Kurulumu

```bash
# Linux/macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows PowerShell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 2. Python Projesini Kur

```bash
cd /workspace/python

# Tüm bağımlılıkları yükle
uv pip install -e ".[dev]"

# Sadece runtime bağımlılıkları
uv pip install -e .
```

### 3. Doğrulama

```bash
# Testleri çalıştır
uv run pytest tests/ -v

# VBA makro oluşturmayı test et
uv run python -c "from solidworks_mcp_server.vba import VBAGenerator; print(VBAGenerator().generate('part_create'))"
```

## 🔧 Kullanım

### MCP Server Olarak Çalıştırma

```bash
cd /workspace/python
uv run python -m solidworks_mcp_server
```

### VBA Makro Oluşturma

```python
from solidworks_mcp_server.vba import VBAGenerator

gen = VBAGenerator()

# Şablonları listele
print(gen.list_templates())
# ['part_create', 'assembly_create', 'drawing_create', 'batch_export']

# Makro oluştur
code = gen.generate('part_create', {
    'function_name': 'my_macro',
    'features': [{'name': 'Extrude', 'type': 'boss'}]
})

# Dosyaya kaydet
gen.save_to_file('part_create', 'C:/Macros/test.swp')
```

### SolidWorks Bağlantısı (Windows)

```python
from solidworks_mcp_server.solidworks import get_sw_api

sw = get_sw_api()
if sw.connect():
    print(f"Bağlı: {sw.get_version()}")
else:
    print("Bağlantı başarısız")
```

## 📊 Teknoloji Karşılaştırması

| Özellik | Node.js | Python |
|---------|---------|--------|
| Runtime | Node.js 20+ | Python 3.10+ |
| COM | winax | pywin32/comtypes |
| Template | Handlebars | Jinja2 |
| MCP SDK | @modelcontextprotocol/sdk | mcp |
| Validasyon | Zod | Pydantic |
| Loglama | winston | loguru |
| Paket | npm/pnpm | uv/uvx |

## 🎯 Hangi Versiyonu Kullanmalı?

### Node.js Kullanın Eğer:
- Mevcut projeniz JavaScript/TypeScript tabanlı
- Winax ile daha iyi uyumluluk gerekli
- Daha geniş araç seti gerekli (87+ araç)

### Python Kullanın Eğer:
- Python ekosistemini tercih ediyorsunuz
- uvx ile hızlı dağıtım istiyorsunuz
- Jinja2 template sistemi daha tanıdık
- Data science/ML pipeline'larına entegre edeceksiniz

## 🔄 Paralel Kullanım

İki versiyonu aynı anda kullanabilirsiniz:

```bash
# Terminal 1 - Node.js
cd /workspace
npm run dev

# Terminal 2 - Python
cd /workspace/python
uv run python -m solidworks_mcp_server
```

## 📁 Dizin Yapısı

```
/workspace/
├── package.json              # Node.js projesi
├── src/                      # Node.js kaynak kodu
│   ├── tools/
│   ├── solidworks/
│   └── ...
├── python/                   # Python projesi
│   ├── pyproject.toml       # Python yapılandırması
│   ├── src/solidworks_mcp_server/
│   │   ├── mcp/
│   │   ├── solidworks/
│   │   ├── vba/
│   │   └── ...
│   └── tests/
└── PYTHON_SETUP.md          # Bu dosya
```

## 🛠️ Geliştirme

### Python Testleri

```bash
cd /workspace/python
uv run pytest tests/ -v
uv run pytest tests/ --cov=solidworks_mcp_server
```

### Kod Kalitesi

```bash
# Format
uv run black src/ tests/
uv run ruff check --fix src/ tests/

# Type checking
uv run mypy src/
```

### Build & Publish

```bash
# Paket oluştur
uv build

# PyPI'ye yükle
uv publish
```

## ⚠️ Platform Notları

### Windows
- Tam özellik desteği
- SolidWorks COM bağlantısı çalışır
- Makro çalıştırma desteklenir

### macOS/Linux
- VBA oluşturma çalışır
- COM bağlantısı mock modda
- Makro çalıştırma desteklenmez

## 🤝 Katkıda Bulunma

Python versiyonuna katkıda bulunmak için:

1. Node.js'deki bir özelliği Python'a taşıyın
2. Yeni Jinja2 template'leri ekleyin
3. Test coverage'ı artırın
4. Dokümantasyonu iyileştirin

## 📞 Sorun Giderme

### "MCP SDK bulunamadı"
```bash
uv pip install mcp
```

### "pywin32 bulunamadı" (Windows)
```bash
uv pip install pywin32
python -m win32com.client.makepy
```

### "comtypes bulunamadı"
```bash
uv pip install comtypes
```

## 🔗 Bağlantılar

- [Node.js Projesi](./README.md)
- [Python README](./python/README_PARALLEL.md)
- [UV Dokümantasyonu](https://docs.astral.sh/uv/)
- [MCP SDK](https://github.com/modelcontextprotocol)

