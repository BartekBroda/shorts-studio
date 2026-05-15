.PHONY: icon frontend build dev install-cli

# ── icon ──────────────────────────────────────────────────────────────────────

assets/icon.png:
	mkdir -p assets
	uv run python assets/generate_icon.py

assets/icon.icns: assets/icon.png
	mkdir -p assets/AppIcon.iconset
	sips -z 16   16   assets/icon.png --out assets/AppIcon.iconset/icon_16x16.png
	sips -z 32   32   assets/icon.png --out assets/AppIcon.iconset/icon_16x16@2x.png
	sips -z 32   32   assets/icon.png --out assets/AppIcon.iconset/icon_32x32.png
	sips -z 64   64   assets/icon.png --out assets/AppIcon.iconset/icon_32x32@2x.png
	sips -z 128  128  assets/icon.png --out assets/AppIcon.iconset/icon_128x128.png
	sips -z 256  256  assets/icon.png --out assets/AppIcon.iconset/icon_128x128@2x.png
	sips -z 256  256  assets/icon.png --out assets/AppIcon.iconset/icon_256x256.png
	sips -z 512  512  assets/icon.png --out assets/AppIcon.iconset/icon_256x256@2x.png
	sips -z 512  512  assets/icon.png --out assets/AppIcon.iconset/icon_512x512.png
	sips -z 1024 1024 assets/icon.png --out assets/AppIcon.iconset/icon_512x512@2x.png
	iconutil -c icns assets/AppIcon.iconset -o assets/icon.icns
	rm -rf assets/AppIcon.iconset

icon: assets/icon.icns

# ── dev ───────────────────────────────────────────────────────────────────────

dev:
	bash scripts/dev

# ── app build ─────────────────────────────────────────────────────────────────

frontend:
	cd frontend && ~/.bun/bin/bun run build

build: assets/icon.icns frontend
	uv run pyinstaller \
		--windowed \
		--name "Shorts Studio" \
		--icon assets/icon.icns \
		--add-data "www:www" \
		--add-data "CHANGELOG.md:." \
		--add-data "pyproject.toml:." \
		--hidden-import backend.api \
		--hidden-import backend.config \
		--hidden-import backend.probe \
		--hidden-import backend.matcher \
		--hidden-import backend.processor \
		--hidden-import backend.composer \
		--hidden-import backend.subtitle_renderer \
		--hidden-import backend.helpers._paths \
		--hidden-import backend.helpers.audiogram \
		--hidden-import backend.helpers.transcribe_local \
		--hidden-import AppKit \
		--noconfirm \
		main.py

# ── install CLI ───────────────────────────────────────────────────────────────

install-cli:
	sudo cp scripts/shorts-studio /usr/local/bin/shorts-studio
	sudo chmod +x /usr/local/bin/shorts-studio
