"""
MCP Server implementation for SolidWorks
Python MCP SDK kullanır
"""

import asyncio
from typing import Any, Dict, List
from loguru import logger
from pydantic import BaseModel

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    logger.warning("MCP SDK bulunamadı. 'pip install mcp' ile yükleyin.")


class MCPServerConfig(BaseModel):
    """MCP Server yapılandırması"""
    name: str = "solidworks-mcp-python"
    version: str = "1.0.0"
    description: str = "SolidWorks automation via Python"


class SolidWorksMCPServer:
    """
    SolidWorks MCP Server
    Node.js versiyonu ile paralel çalışabilir
    """
    
    def __init__(self, config: MCPServerConfig | None = None):
        self.config = config or MCPServerConfig()
        self.server: Server | None = None
        self.tools: List[Dict[str, Any]] = []
        self.logger = logger
        
        if not MCP_AVAILABLE:
            self.logger.error("MCP SDK mevcut değil")
            return
        
        # MCP server instance oluştur
        self.server = Server(self.config.name)
        self._register_tools()
    
    def _register_tools(self):
        """MCP araçlarını kaydet"""
        if not self.server:
            return
        
        # VBA makro oluşturma aracı
        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            return [
                Tool(
                    name="generate_vba_macro",
                    description="VBA makro kodu oluştur",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "template": {"type": "string", "description": "VBA şablon adı"},
                            "parameters": {"type": "object", "description": "Şablon parametreleri"}
                        },
                        "required": ["template"]
                    }
                ),
                Tool(
                    name="execute_macro",
                    description="VBA makroyu çalıştır",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "macro_path": {"type": "string", "description": "Makro dosya yolu"},
                            "function_name": {"type": "string", "description": "Çalıştırılacak fonksiyon"}
                        },
                        "required": ["macro_path"]
                    }
                ),
                Tool(
                    name="get_solidworks_info",
                    description="SolidWorks bilgilerini al",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict) -> list[TextContent]:
            """Araç çağrılarını işle"""
            self.logger.info(f"Araç çağrısı: {name}, argümanlar: {arguments}")
            
            if name == "generate_vba_macro":
                from .vba.generator import VBAGenerator
                generator = VBAGenerator()
                vba_code = generator.generate(
                    arguments.get("template", "default"),
                    arguments.get("parameters", {})
                )
                return [TextContent(type="text", text=vba_code)]
            
            elif name == "execute_macro":
                # Windows'ta makro çalıştırma
                if asyncio.get_event_loop().run_in_executor(None, self._run_macro, arguments):
                    return [TextContent(type="text", text="Makro başarıyla çalıştırıldı")]
                else:
                    return [TextContent(type="text", text="Makro çalıştırma başarısız")]
            
            elif name == "get_solidworks_info":
                from .solidworks.api import get_sw_api
                sw_api = get_sw_api()
                if sw_api.connect():
                    version = sw_api.get_version()
                    return [TextContent(
                        type="text",
                        text=f"SolidWorks bağlantısı aktif. Versiyon: {version}"
                    )]
                else:
                    return [TextContent(type="text", text="SolidWorks bağlantısı kurulamadı")]
            
            return [TextContent(type="text", text=f"Bilinmeyen araç: {name}")]
    
    def _run_macro(self, arguments: dict) -> bool:
        """Makroyu çalıştır (senkron)"""
        import sys
        if sys.platform != "win32":
            self.logger.warning("Makro çalıştırma sadece Windows'ta desteklenir")
            return False
        
        try:
            import win32com.client
            sw_app = win32com.client.GetActiveObject("SldWorks.Application")
            macro_path = arguments.get("macro_path", "")
            function_name = arguments.get("function_name", "main")
            
            sw_app.RunMacro2(macro_path, "", function_name, 0)
            return True
        except Exception as e:
            self.logger.error(f"Makro çalıştırma hatası: {e}")
            return False
    
    async def run(self):
        """MCP server'ı başlat"""
        if not self.server or not MCP_AVAILABLE:
            self.logger.error("MCP server başlatılamadı")
            return
        
        self.logger.info(f"MCP Server başlatılıyor: {self.config.name} v{self.config.version}")
        
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )


def create_server(config: MCPServerConfig | None = None) -> SolidWorksMCPServer:
    """MCP server factory"""
    return SolidWorksMCPServer(config)
