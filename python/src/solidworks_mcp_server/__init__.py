"""
SolidWorks MCP Server - Python Implementation
Paralel versiyon: Node.js ile birlikte çalışabilir
"""

__version__ = "1.0.0"
__author__ = "SolidWorks MCP Contributors"

from .mcp.server import SolidWorksMCPServer
from .solidworks.api import SolidWorksAPI
from .vba.generator import VBAGenerator

__all__ = [
    "SolidWorksMCPServer",
    "SolidWorksAPI",
    "VBAGenerator",
]


def main():
    """MCP server'ı başlat"""
    import asyncio
    from .mcp.server import create_server
    
    server = create_server()
    asyncio.run(server.run())


if __name__ == "__main__":
    main()
