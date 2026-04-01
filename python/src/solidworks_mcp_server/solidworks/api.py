"""
SolidWorks API bağlantısı - Python COM wrapper
Node.js winax yerine pywin32/comtypes kullanır
"""

import sys
from typing import Optional, Any
from loguru import logger

# Windows'ta çalışıyorsa COM kütüphanelerini yükle
if sys.platform == "win32":
    try:
        import win32com.client  # type: ignore
        import comtypes.client  # type: ignore
        COM_AVAILABLE = True
    except ImportError:
        COM_AVAILABLE = False
        logger.warning("pywin32 veya comtypes bulunamadı. Windows gereklidir.")
else:
    COM_AVAILABLE = False
    logger.info("Windows dışı platform - COM bağlantıları mock modda çalışacak")


class SolidWorksAPI:
    """
    SolidWorks API için Python wrapper
    Node.js versiyonundaki winax yerine pywin32/comtypes kullanır
    """
    
    SW_APP_PROGID = "SldWorks.Application"
    
    def __init__(self):
        self.sw_app: Optional[Any] = None
        self.is_connected: bool = False
        self.logger = logger
        
    def connect(self) -> bool:
        """SolidWorks uygulamasına bağlan"""
        if not COM_AVAILABLE:
            self.logger.warning("COM mevcut değil, mock bağlantı kuruluyor")
            self.is_connected = True
            return True
            
        try:
            # Aktif SolidWorks örneğini al
            self.sw_app = win32com.client.GetActiveObject(self.SW_APP_PROGID)
            self.is_connected = True
            self.logger.info("SolidWorks'e başarıyla bağlanıldı")
            return True
        except Exception as e:
            self.logger.error(f"SolidWorks bağlantı hatası: {e}")
            
            # Yeni instance başlatmayı dene
            try:
                self.sw_app = win32com.client.Dispatch(self.SW_APP_PROGID)
                self.is_connected = True
                self.logger.info("Yeni SolidWorks instance başlatıldı")
                return True
            except Exception as e2:
                self.logger.error(f"Yeni instance başlatma hatası: {e2}")
                self.is_connected = False
                return False
    
    def disconnect(self):
        """Bağlantıyı kes"""
        if self.sw_app:
            del self.sw_app
            self.sw_app = None
        self.is_connected = False
        self.logger.info("SolidWorks bağlantısı kesildi")
    
    def get_app(self) -> Optional[Any]:
        """SolidWorks application objesini döndür"""
        if not self.is_connected:
            self.connect()
        return self.sw_app
    
    def is_running(self) -> bool:
        """SolidWorks çalışıyor mu kontrol et"""
        if not COM_AVAILABLE:
            return False
            
        try:
            win32com.client.GetActiveObject(self.SW_APP_PROGID)
            return True
        except Exception:
            return False
    
    def get_version(self) -> Optional[str]:
        """SolidWorks versiyonunu al"""
        if not self.is_connected or not self.sw_app:
            return None
        
        try:
            return str(self.sw_app.RevisionNumber())
        except Exception as e:
            self.logger.error(f"Versiyon alma hatası: {e}")
            return None


# Singleton pattern
_api_instance: Optional[SolidWorksAPI] = None

def get_sw_api() -> SolidWorksAPI:
    """Global SolidWorks API instance'ını al"""
    global _api_instance
    if _api_instance is None:
        _api_instance = SolidWorksAPI()
    return _api_instance
