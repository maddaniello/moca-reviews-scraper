#!/bin/bash

echo "🔴 Moca Reviews Scraper - Build macOS App"
echo "=========================================="

# Variabili
APP_NAME="Moca Reviews Scraper"
VERSION=$(python3 -c "from version import __version__; print(__version__)")
BUNDLE_ID="com.mocainteractive.reviews-scraper"
ICON_FILE="icon.icns"

echo "Versione: $VERSION"
echo ""

# 1. Pulisci build precedenti
echo "🧹 Pulizia build precedenti..."
rm -rf build dist
rm -rf "$APP_NAME.app"
rm -rf "$APP_NAME.dmg"

# 2. Crea .app con PyInstaller
echo "📦 Creazione bundle .app..."
pyinstaller --noconfirm \
    --name="$APP_NAME" \
    --windowed \
    --icon="$ICON_FILE" \
    --osx-bundle-identifier="$BUNDLE_ID" \
    --add-data="templates:templates" \
    --add-data="static:static" \
    --add-data="version.py:." \
    --hidden-import="engineio.async_drivers.threading" \
    --collect-all="flask" \
    --collect-all="jinja2" \
    launcher.py

# 3. Copia .app nella root
echo "📂 Copia bundle..."
cp -R "dist/$APP_NAME.app" .

# 4. Crea DMG
echo "💿 Creazione DMG installer..."
create-dmg \
    --volname "$APP_NAME" \
    --volicon "$ICON_FILE" \
    --window-pos 200 120 \
    --window-size 600 400 \
    --icon-size 100 \
    --icon "$APP_NAME.app" 175 120 \
    --hide-extension "$APP_NAME.app" \
    --app-drop-link 425 120 \
    "$APP_NAME-$VERSION.dmg" \
    "$APP_NAME.app"

echo ""
echo "✅ Build completato!"
echo ""
echo "📦 File generati:"
echo "   - $APP_NAME.app"
echo "   - $APP_NAME-$VERSION.dmg"
echo ""
echo "🚀 Per distribuire:"
echo "   1. Testa l'app: open '$APP_NAME.app'"
echo "   2. Crea release su GitHub"
echo "   3. Carica il file: $APP_NAME-$VERSION.dmg"
echo ""