"""
VBA Makro Oluşturucu
Node.js Handlebars yerine Jinja2 kullanır
"""

from pathlib import Path
from typing import Any, Dict, Optional
from jinja2 import Environment, FileSystemLoader, BaseLoader
from loguru import logger


# Varsayılan VBA şablonları
DEFAULT_TEMPLATES = {
    "part_create": """
Attribute VB_Name = "Module1"
Option Explicit

' Part oluşturma makrosu
' Otomatik olarak {{ template_name }} tarafından oluşturuldu

Sub {{ function_name|default('main') }}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swPart As SldWorks.PartDoc
    
    Set swApp = Application.SldWorks
    If swApp Is Nothing Then
        MsgBox "SolidWorks çalışmıyor!"
        Exit Sub
    End If
    
    ' Yeni part oluştur
    Set swModel = swApp.NewDocument("{{ template_path|default('C:\\\\ProgramData\\\\SolidWorks\\\\SolidWorks 2024\\\\templates\\\\Part.prtdot') }}", 0, 0#, 0#)
    If swModel Is Nothing Then
        MsgBox "Part oluşturulamadı!"
        Exit Sub
    End If
    
    Set swPart = swModel
    
    {% if features %}
    ' Özellikleri oluştur
    {% for feature in features %}
    ' {{ feature.name }}: {{ feature.type }}
    {% endfor %}
    {% endif %}
    
    MsgBox "Part başarıyla oluşturuldu!"
End Sub
""",

    "assembly_create": """
Attribute VB_Name = "AssemblyModule"
Option Explicit

' Assembly oluşturma makrosu

Sub {{ function_name|default('main') }}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swAssy As SldWorks.AssemblyDoc
    
    Set swApp = Application.SldWorks
    
    ' Yeni assembly oluştur
    Set swModel = swApp.NewDocument("{{ template_path|default('C:\\\\ProgramData\\\\SolidWorks\\\\SolidWorks 2024\\\\templates\\\\Assembly.asmdot') }}", 0, 0#, 0#)
    Set swAssy = swModel
    
    {% if components %}
    ' Bileşenleri ekle
    {% for component in components %}
    ' Component: {{ component.name }} - {{ component.path }}
    {% endfor %}
    {% endif %}
    
    MsgBox "Assembly oluşturuldu!"
End Sub
""",

    "drawing_create": """
Attribute VB_Name = "DrawingModule"
Option Explicit

' Drawing oluşturma makrosu

Sub {{ function_name|default('main') }}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swDraw As SldWorks.DrawingDoc
    
    Set swApp = Application.SldWorks
    
    ' Yeni drawing oluştur
    Set swModel = swApp.NewDocument("{{ template_path|default('C:\\\\ProgramData\\\\SolidWorks\\\\SolidWorks 2024\\\\templates\\\\Drawing.drwdot') }}", 0, 0#, 0#)
    Set swDraw = swModel
    
    {% if views %}
    ' Görünümleri ekle
    {% for view in views %}
    ' View: {{ view.name }} - {{ view.type }}
    {% endfor %}
    {% endif %}
    
    MsgBox "Drawing oluşturuldu!"
End Sub
""",

    "batch_export": """
Attribute VB_Name = "BatchExportModule"
Option Explicit

' Batch Export Makrosu

Sub {{ function_name|default('main') }}()
    Dim swApp As SldWorks.SldWorks
    Dim errors As Long
    Dim warnings As Long
    Dim files As Variant
    Dim i As Integer
    
    Set swApp = Application.SldWorks
    
    ' Dosyaları al
    files = Array({% if file_list %}{{ file_list|join(', ') }}{% else %}"C:\\Part1.sldprt"{% endif %})
    
    For i = LBound(files) To UBound(files)
        Dim model As SldWorks.ModelDoc2
        Set model = swApp.OpenDoc6(files(i), 1, 0, "", errors, warnings)
        
        If Not model Is Nothing Then
            ' Export işlemi
            model.SaveAs3 "{{ output_path|default('C:\\\\Export\\\\') }}" & model.GetTitle() & ".step", 0, 0
            model.CloseDoc
        End If
    Next i
    
    MsgBox "Batch export tamamlandı!"
End Sub
""",
}


class VBAGenerator:
    """
    VBA Makro Oluşturucu
    Node.js versiyonundaki Handlebars yerine Jinja2 kullanır
    """
    
    def __init__(self, template_dir: Optional[Path] = None):
        self.template_dir = template_dir
        self.logger = logger
        self.env: Environment
        
        # Jinja2 environment oluştur
        if template_dir and template_dir.exists():
            self.env = Environment(loader=FileSystemLoader(str(template_dir)))
        else:
            # String template'ler için
            self.env = Environment(loader=BaseLoader())
            # Default template'leri kaydet
            for name, template_str in DEFAULT_TEMPLATES.items():
                self.env.from_string(template_str)
        
        self.logger.info("VBA Generator başlatıldı")
    
    def generate(
        self,
        template_name: str,
        parameters: Dict[str, Any] | None = None
    ) -> str:
        """
        VBA kodu oluştur
        
        Args:
            template_name: Şablon adı (part_create, assembly_create, vb.)
            parameters: Şablona geçirilecek parametreler
            
        Returns:
            Oluşturulan VBA kodu
        """
        parameters = parameters or {}
        
        try:
            # Template'i yükle
            if template_name in DEFAULT_TEMPLATES:
                template = self.env.from_string(DEFAULT_TEMPLATES[template_name])
            elif self.template_dir:
                template = self.env.get_template(f"{template_name}.vba")
            else:
                self.logger.warning(f"Template bulunamadı: {template_name}, default kullanılıyor")
                template = self.env.from_string(DEFAULT_TEMPLATES["part_create"])
            
            # Parametreleri ekle
            if "template_name" not in parameters:
                parameters["template_name"] = template_name
            
            # Render et
            vba_code = template.render(**parameters)
            
            self.logger.info(f"VBA makro oluşturuldu: {template_name}")
            return vba_code
            
        except Exception as e:
            self.logger.error(f"VBA oluşturma hatası: {e}")
            return f"' Hata: {e}\n"
    
    def save_to_file(
        self,
        template_name: str,
        output_path: str,
        parameters: Dict[str, Any] | None = None
    ) -> bool:
        """
        VBA kodunu dosyaya kaydet
        
        Args:
            template_name: Şablon adı
            output_path: Çıktı dosya yolu
            parameters: Parametreler
            
        Returns:
            Başarı durumu
        """
        try:
            vba_code = self.generate(template_name, parameters)
            
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(path, "w", encoding="utf-8") as f:
                f.write(vba_code)
            
            self.logger.info(f"VBA makro kaydedildi: {output_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Dosya kaydetme hatası: {e}")
            return False
    
    def list_templates(self) -> list[str]:
        """Mevcut şablonları listele"""
        templates = list(DEFAULT_TEMPLATES.keys())
        
        if self.template_dir and self.template_dir.exists():
            for file in self.template_dir.glob("*.vba"):
                templates.append(file.stem)
        
        return templates


# Factory fonksiyonu
def create_vba_generator(template_dir: Optional[Path] = None) -> VBAGenerator:
    """VBA Generator factory"""
    return VBAGenerator(template_dir)
