#!/usr/bin/env python3
"""
enumerate-drive-folder.py — extract Drive file IDs + filenames from a public folder
via gdown's folder-listing output. Writes a TSV manifest (id\tfilename).

Usage:
    python3 enumerate-drive-folder.py <folder_url_or_id> <output.tsv>

Caveat: Drive folder API caps at 50 files. For larger folders, use Chrome DOM
enumeration (see the gallery README).
"""
import re
import subprocess
import sys
from pathlib import Path

def main():
    if len(sys.argv) != 3:
        print("Usage: enumerate-drive-folder.py <folder_url_or_id> <output.tsv>", file=sys.stderr)
        sys.exit(2)
    folder, out = sys.argv[1], sys.argv[2]
    # Use a throwaway target so gdown attempts download but we just want stdout
    tmpdir = Path("/tmp/drive-enum-throwaway")
    tmpdir.mkdir(exist_ok=True)
    # Run gdown --folder; capture stdout + stderr
    result = subprocess.run(
        ["python3", "-m", "gdown", folder, "--folder", "--output", str(tmpdir), "--remaining-ok"],
        capture_output=True, text=True
    )
    output = result.stdout + result.stderr
    # gdown prints lines like: "Processing file <ID> <filename>"
    rows = []
    seen = set()
    for line in output.splitlines():
        m = re.match(r'^Processing file (\S+) (.+)$', line)
        if m:
            fid, fname = m.group(1), m.group(2)
            if fid not in seen:
                seen.add(fid)
                rows.append(f"{fid}\t{fname}")
    if not rows:
        print("No files enumerated. gdown output:", file=sys.stderr)
        print(output[-2000:], file=sys.stderr)
        sys.exit(1)
    Path(out).write_text("\n".join(rows) + "\n")
    print(f"✓ Wrote {len(rows)} entries to {out}")
