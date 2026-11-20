#!/bin/bash
# Abre Paso a Paso con Chrome o Edge (no hay que instalar nada mas)
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
for app in "Google Chrome" "Microsoft Edge" "Chromium"; do
  if [ -d "/Applications/$app.app" ]; then
    open -n -a "$app" --args --allow-file-access-from-files --user-data-dir="${TMPDIR:-/tmp}/PasoAPaso-perfil" --no-first-run --no-default-browser-check "file://$DIR/index.html"
    exit 0
  fi
done
echo "No se encontro Google Chrome ni Microsoft Edge. Instala uno de los dos y vuelve a abrir este archivo."
read -r -p "Presiona Enter para cerrar"
