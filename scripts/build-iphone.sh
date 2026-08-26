#!/usr/bin/env bash
#
# Build assinada para o iPhone físico, instalada no fim.
#
# Existe porque isto são quatro passos e um deles é fácil de esquecer com
# consequências: o ficheiro de entitlements tem de ficar VAZIO para assinar com
# Apple ID grátis (Personal Team não suporta HealthKit, push remoto nem Sign in
# with Apple) e tem de voltar ao estado de simulador a seguir, senão o HealthKit
# deixa de funcionar lá. O `trap` garante a reposição mesmo se o build falhar a
# meio ou se carregares em Ctrl-C.
#
# A build expira ao fim de 7 dias — limite do free provisioning. Isto corre-se
# outra vez e o relógio reinicia.
#
#   npm run ios:device
#
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS="$RAIZ/ios"
ENT="$IOS/CadenceClub/CadenceClub.entitlements"
UDID="00008120-001A60640244A01E"   # iPhone 15
DERIVED="$HOME/Library/Developer/Xcode/DerivedData/CadenceClub-manual"
APP="$DERIVED/Build/Products/Release-iphoneos/CadenceClub.app"

cd "$RAIZ"

# ── 0. O bundle antes de tudo ────────────────────────────────────────────────
# Dez segundos aqui poupam vinte e cinco minutos: a fase do Metro é a última do
# xcodebuild, portanto um erro de JavaScript só aparece no fim. Foi assim que um
# ficheiro de teste dentro de `src/app/` partiu uma build inteira a 24 de agosto.
echo "▸ 1/4  A confirmar que o JavaScript empacota…"
npx expo export --platform ios --output-dir "$(mktemp -d)/export" >/dev/null 2>&1 \
  || { echo "✗ o Metro não consegue empacotar. Corre 'npx expo export --platform ios' para ver o erro."; exit 1; }
echo "       ✓ empacota"

# ── 1. Entitlements ─────────────────────────────────────────────────────────
echo "▸ 2/4  A esvaziar os entitlements (Personal Team não assina nenhum deles)…"
GUARDADO="$(mktemp)"
cp "$ENT" "$GUARDADO"
repor() {
  cp "$GUARDADO" "$ENT"
  rm -f "$GUARDADO"
  echo "       ✓ entitlements repostos para simulador"
}
trap repor EXIT

python3 - "$ENT" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()
# Deixa os comentários, apaga as chaves. O plist tem de continuar válido.
s = re.sub(r'(?s)(<dict>)(.*?)(</dict>)',
           lambda m: m.group(1) + re.sub(r'(?s)(-->).*$', r'\1\n  ', m.group(2)) + m.group(3), s)
open(p, 'w').write(s)
PY
n=$(plutil -convert json -o - "$ENT" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
[ "$n" = "0" ] || { echo "✗ os entitlements não ficaram vazios ($n chaves) — a assinatura ia falhar"; exit 1; }

# ── 2. Compilar ─────────────────────────────────────────────────────────────
echo "▸ 3/4  A compilar (20–30 min na primeira vez)…"
cd "$IOS"
xcodebuild \
  -workspace CadenceClub.xcworkspace \
  -scheme CadenceClub \
  -configuration Release \
  -destination "id=$UDID" \
  -allowProvisioningUpdates \
  -derivedDataPath "$DERIVED" \
  build > "$RAIZ/.build-iphone.log" 2>&1 \
  || { echo "✗ o build falhou. Últimas linhas:"; tail -20 "$RAIZ/.build-iphone.log"; exit 1; }
echo "       ✓ BUILD SUCCEEDED"

# ── 3. Instalar ─────────────────────────────────────────────────────────────
echo "▸ 4/4  A instalar no iPhone…"
xcrun devicectl device install app --device "$UDID" "$APP" >/dev/null \
  || { echo "✗ falhou a instalar. O iPhone está ligado e desbloqueado?"; exit 1; }

echo
echo "✓ Instalada. Expira a $(date -v+7d '+%d de %B')."
echo "  Sem HealthKit, push remoto nem Sign in with Apple — saíram para assinar."
