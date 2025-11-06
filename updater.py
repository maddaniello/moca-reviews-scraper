"""
Auto-updater per Moca Reviews Scraper
"""
import requests
import webbrowser
from version import __version__, __update_url__
from packaging import version as pkg_version

class AppUpdater:
    """Gestisce controllo e download aggiornamenti"""
    
    def __init__(self):
        self.current_version = __version__
        self.update_url = __update_url__
    
    def check_update(self):
        """Controlla se c'è una nuova versione disponibile"""
        try:
            response = requests.get(self.update_url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                latest_version = data['tag_name'].replace('v', '')
                
                if pkg_version.parse(latest_version) > pkg_version.parse(self.current_version):
                    return {
                        'available': True,
                        'version': latest_version,
                        'download_url': data['assets'][0]['browser_download_url'] if data['assets'] else data['html_url'],
                        'release_notes': data['body']
                    }
            
            return {'available': False}
        
        except Exception as e:
            print(f"Errore controllo aggiornamenti: {e}")
            return {'available': False, 'error': str(e)}
    
    def open_download_page(self, url):
        """Apre la pagina di download nel browser"""
        webbrowser.open(url)