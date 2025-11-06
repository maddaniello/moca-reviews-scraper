"""
Launcher per Moca Reviews Scraper macOS
Gestisce apertura browser e auto-update
"""
import sys
import os
import time
import webbrowser
import threading
from app import app, updater, __version__

def open_browser():
    """Apre il browser dopo 1.5 secondi"""
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

def check_and_notify_update():
    """Controlla aggiornamenti in background"""
    time.sleep(3)  # Aspetta che l'app sia pronta
    
    update_info = updater.check_update()
    
    if update_info.get('available'):
        print(f"""
╔══════════════════════════════════════════════════════════╗
║  🔔 AGGIORNAMENTO DISPONIBILE                            ║
╠══════════════════════════════════════════════════════════╣
║  Versione Corrente:  {__version__}                             ║
║  Nuova Versione:     {update_info['version']}                             ║
║                                                          ║
║  Apri http://127.0.0.1:5000 e clicca sul banner         ║
║  per scaricare l'aggiornamento                          ║
╚══════════════════════════════════════════════════════════╝
        """)

if __name__ == '__main__':
    print(f"""
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║       🔴  MOCA REVIEWS SCRAPER  🔴                       ║
║                                                          ║
║       Versione: {__version__}                                  ║
║                                                          ║
║  L'applicazione si aprirà nel browser tra poco...       ║
║                                                          ║
║  URL: http://127.0.0.1:5000                             ║
║                                                          ║
║  ⚠️  NON CHIUDERE QUESTA FINESTRA                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    # Avvia check aggiornamenti in background
    update_thread = threading.Thread(target=check_and_notify_update, daemon=True)
    update_thread.start()
    
    # Apri browser in background
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    # Avvia Flask
    try:
        app.run(host='127.0.0.1', port=5000, debug=False)
    except KeyboardInterrupt:
        print("\n\n👋 Applicazione chiusa. Arrivederci!\n")
        sys.exit(0)