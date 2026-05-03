#!/bin/bash
# Generate 10 mockup images for partner content types using gpt-image-1.
# Usage: bash scripts/gen-content-mockups.sh
# Requires: OPENAI_API_KEY in .env.local

set -e
cd "$(dirname "$0")/.."

OPENAI_API_KEY=$(awk -F= '/^OPENAI_API_KEY=/{print $2; exit}' .env.local | sed 's/\\n//g; s/\\r//g; s/^"//; s/"$//; s/[[:space:]]//g')
if [ -z "$OPENAI_API_KEY" ]; then echo "no OPENAI_API_KEY"; exit 1; fi

OUT_DIR="public/images/content-examples"
mkdir -p "$OUT_DIR"

# Common style prefix to keep mockups visually consistent
STYLE="Clean editorial mockup illustration, Squarespace minimalist style. Soft cream background #FAFAF8. Subtle shadow. SACS brand blue #4B7BE5 accents. White device frames. Friendly, professional, mexican retail context. NO TEXT, NO LOGOS, NO WORDS in image. Photorealistic but minimal. Modern, calm composition."

declare -a TIPOS=(
  "story-reel|Vertical phone screen showing a quick reel of a clothing boutique with a shopping cart icon and a single product in focus, captured by a stylized phone frame in landscape orientation"
  "tutorial|Laptop screen open showing a clean SaaS dashboard interface with a step-by-step tutorial highlight, clean lines, blue accent arrows pointing to UI elements"
  "caso-uso|Tablet on a marble counter at a small fashion boutique, soft natural light, showing a sales screen with shopping cart"
  "tour|Wide laptop screen mockup showing a multi-section dashboard interface with sidebars and charts, clean modern UI"
  "dia-vida|Lifestyle photo of a young woman in her own clothing boutique, holding a tablet, surrounded by hanging garments and racks, warm natural light from a window"
  "testimonial|Portrait of a confident mexican entrepreneur smiling, soft studio light, holding a phone showing a sales chart, clean minimal background"
  "serie-episodio|Cinematic frame thumbnail showing a host in a retail store environment with podcast/series visual style, soft lighting, professional setup"
  "webinar|Laptop screen showing a video conference grid with multiple participants in a webinar style, professional and clean composition"
  "mini-documental|Cinematic establishing shot of a beautiful boutique interior at golden hour, dramatic lighting, retail with character"
  "serie-completa|Stack of episode thumbnails arranged like a streaming service playlist, modern layout, gradient background"
)

declare -a PIDS=()

for entry in "${TIPOS[@]}"; do
  ID="${entry%%|*}"
  PROMPT_DESC="${entry##*|}"

  (
    echo "→ Generating $ID..."
    PROMPT="$STYLE Subject: $PROMPT_DESC."

    # Escape JSON properly
    JSON_PROMPT=$(echo "$PROMPT" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))")

    RESP=$(curl -s -X POST https://api.openai.com/v1/images/generations \
      -H "Authorization: Bearer $OPENAI_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"model\": \"gpt-image-1\",
        \"prompt\": $JSON_PROMPT,
        \"size\": \"1536x1024\",
        \"quality\": \"medium\",
        \"n\": 1
      }")

    # Extract base64 from response
    B64=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('b64_json','')) if 'data' in d else print('ERR:',d.get('error',{}).get('message','unknown'),file=sys.stderr)")

    if [ -z "$B64" ]; then
      echo "✗ $ID failed: $RESP" | head -c 500
      exit 1
    fi

    # Decode and save as PNG
    echo "$B64" | base64 -d > "$OUT_DIR/$ID.png"

    # Convert to WebP (smaller)
    if command -v cwebp &> /dev/null; then
      cwebp -q 85 "$OUT_DIR/$ID.png" -o "$OUT_DIR/$ID.webp" 2>/dev/null
      rm "$OUT_DIR/$ID.png"
      echo "✓ $ID.webp"
    else
      echo "✓ $ID.png (cwebp not installed, kept as png)"
    fi
  ) &
  PIDS+=($!)
done

# Wait for all to finish
for pid in "${PIDS[@]}"; do
  wait $pid || echo "warning: pid $pid failed"
done

echo ""
echo "Done. Images in $OUT_DIR/"
ls -lh "$OUT_DIR/" | head
