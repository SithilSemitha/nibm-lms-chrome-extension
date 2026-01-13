# Icon Generation Instructions

The extension requires icons in the following sizes:

- 16x16 (icon16.png)
- 32x32 (icon32.png)
- 48x48 (icon48.png)
- 128x128 (icon128.png)

## Quick Generation

You can use the provided SVG (icon128.svg) to generate PNG files:

### Option 1: Using ImageMagick (Command Line)

```bash
# Install ImageMagick if not already installed
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick

cd extension/icons/

# Generate all sizes from SVG
convert icon128.svg -resize 16x16 icon16.png
convert icon128.svg -resize 32x32 icon32.png
convert icon128.svg -resize 48x48 icon48.png
convert icon128.svg -resize 128x128 icon128.png

```
