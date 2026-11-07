# Four Pillars guide (PDF source)

`guide.html` is the source for `/four-pillars/guide.pdf` (8x10in pages). Edit the HTML, then rebuild:

```bash
cd scripts/four-pillars-guide
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
  --virtual-time-budget=9000 --print-to-pdf=../../four-pillars/guide.pdf "file://$PWD/guide.html"
```

Copy lives in the Claude doc "Four Pillars Guide: Copy Draft v1". The cover art is the original designer's sculpture, upscaled 3x from the old PDF; no higher-resolution source exists.
