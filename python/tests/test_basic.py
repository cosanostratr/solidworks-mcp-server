"""
Test dosyası - Python versiyonu için temel testler
"""

import pytest
from pathlib import Path


class TestVBAGenerator:
    """VBA Generator testleri"""
    
    def test_generate_part_create(self):
        """Part oluşturma şablonu testi"""
        from solidworks_mcp_server.vba import VBAGenerator
        
        generator = VBAGenerator()
        vba_code = generator.generate("part_create", {
            "function_name": "test_part"
        })
        
        assert "Sub test_part()" in vba_code
        assert "SldWorks.SldWorks" in vba_code
        assert "Attribute VB_Name" in vba_code
    
    def test_generate_assembly_create(self):
        """Assembly oluşturma şablonu testi"""
        from solidworks_mcp_server.vba import VBAGenerator
        
        generator = VBAGenerator()
        vba_code = generator.generate("assembly_create")
        
        assert "AssemblyDoc" in vba_code
        assert "Sub main()" in vba_code
    
    def test_generate_drawing_create(self):
        """Drawing oluşturma şablonu testi"""
        from solidworks_mcp_server.vba import VBAGenerator
        
        generator = VBAGenerator()
        vba_code = generator.generate("drawing_create")
        
        assert "DrawingDoc" in vba_code
    
    def test_list_templates(self):
        """Şablon listesi testi"""
        from solidworks_mcp_server.vba import VBAGenerator
        
        generator = VBAGenerator()
        templates = generator.list_templates()
        
        assert "part_create" in templates
        assert "assembly_create" in templates
        assert "drawing_create" in templates
        assert "batch_export" in templates
    
    def test_save_to_file(self, tmp_path):
        """Dosyaya kaydetme testi"""
        from solidworks_mcp_server.vba import VBAGenerator
        
        generator = VBAGenerator()
        output_file = tmp_path / "test_macro.swp"
        
        result = generator.save_to_file(
            "part_create",
            str(output_file),
            {"function_name": "saved_macro"}
        )
        
        assert result is True
        assert output_file.exists()
        
        content = output_file.read_text()
        assert "Sub saved_macro()" in content


class TestSolidWorksAPI:
    """SolidWorks API testleri"""
    
    def test_api_initialization(self):
        """API başlatma testi"""
        from solidworks_mcp_server.solidworks import SolidWorksAPI
        
        api = SolidWorksAPI()
        assert api.is_connected is False
        assert api.sw_app is None
    
    def test_get_sw_api_singleton(self):
        """Singleton pattern testi"""
        from solidworks_mcp_server.solidworks import get_sw_api
        
        api1 = get_sw_api()
        api2 = get_sw_api()
        
        assert api1 is api2


class TestMCPServer:
    """MCP Server testleri"""
    
    def test_server_config(self):
        """Server yapılandırma testi"""
        from solidworks_mcp_server.mcp import MCPServerConfig
        
        config = MCPServerConfig()
        assert config.name == "solidworks-mcp-python"
        assert config.version == "1.0.0"
    
    def test_server_creation(self):
        """Server oluşturma testi"""
        from solidworks_mcp_server.mcp import create_server
        
        server = create_server()
        assert server is not None
        assert server.config.name == "solidworks-mcp-python"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
