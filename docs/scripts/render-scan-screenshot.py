#!/usr/bin/env python3
"""Render the scan output screenshot for docs.

Usage:
  python3 docs/scripts/render-scan-screenshot.py
"""

import os
import struct
import zlib

lines = [
    "MARKDOWNTOWN SCAN --REPO /PATH/TO/REPO --REPO-ONLY --COMPACT",
    "OUTPUT: JSON",
    "SCHEMA: 1.0.0",
    "TOOLS: 12",
    "WARNINGS: 0",
]

font = {
    " ": ["     "] * 7,
    "A": [
        " ### ",
        "#   #",
        "#   #",
        "#####",
        "#   #",
        "#   #",
        "#   #",
    ],
    "B": [
        "#### ",
        "#   #",
        "#   #",
        "#### ",
        "#   #",
        "#   #",
        "#### ",
    ],
    "C": [
        " ### ",
        "#   #",
        "#    ",
        "#    ",
        "#    ",
        "#   #",
        " ### ",
    ],
    "D": [
        "#### ",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#### ",
    ],
    "E": [
        "#####",
        "#    ",
        "#    ",
        "#### ",
        "#    ",
        "#    ",
        "#####",
    ],
    "F": [
        "#####",
        "#    ",
        "#    ",
        "#### ",
        "#    ",
        "#    ",
        "#    ",
    ],
    "G": [
        " ### ",
        "#   #",
        "#    ",
        "#  ##",
        "#   #",
        "#   #",
        " ### ",
    ],
    "H": [
        "#   #",
        "#   #",
        "#   #",
        "#####",
        "#   #",
        "#   #",
        "#   #",
    ],
    "I": [
        "#####",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "#####",
    ],
    "J": [
        "  ###",
        "   # ",
        "   # ",
        "   # ",
        "   # ",
        "#  # ",
        " ##  ",
    ],
    "K": [
        "#   #",
        "#  # ",
        "# #  ",
        "##   ",
        "# #  ",
        "#  # ",
        "#   #",
    ],
    "L": [
        "#    ",
        "#    ",
        "#    ",
        "#    ",
        "#    ",
        "#    ",
        "#####",
    ],
    "M": [
        "#   #",
        "## ##",
        "# # #",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
    ],
    "N": [
        "#   #",
        "##  #",
        "# # #",
        "#  ##",
        "#   #",
        "#   #",
        "#   #",
    ],
    "O": [
        " ### ",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        " ### ",
    ],
    "P": [
        "#### ",
        "#   #",
        "#   #",
        "#### ",
        "#    ",
        "#    ",
        "#    ",
    ],
    "Q": [
        " ### ",
        "#   #",
        "#   #",
        "#   #",
        "# # #",
        "#  # ",
        " ## #",
    ],
    "R": [
        "#### ",
        "#   #",
        "#   #",
        "#### ",
        "# #  ",
        "#  # ",
        "#   #",
    ],
    "S": [
        " ####",
        "#    ",
        "#    ",
        " ### ",
        "    #",
        "    #",
        "#### ",
    ],
    "T": [
        "#####",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
    ],
    "U": [
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        " ### ",
    ],
    "V": [
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        " # # ",
        "  #  ",
    ],
    "W": [
        "#   #",
        "#   #",
        "#   #",
        "# # #",
        "# # #",
        "## ##",
        "#   #",
    ],
    "X": [
        "#   #",
        "#   #",
        " # # ",
        "  #  ",
        " # # ",
        "#   #",
        "#   #",
    ],
    "Y": [
        "#   #",
        "#   #",
        " # # ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
    ],
    "Z": [
        "#####",
        "    #",
        "   # ",
        "  #  ",
        " #   ",
        "#    ",
        "#####",
    ],
    "0": [
        " ### ",
        "#   #",
        "#  ##",
        "# # #",
        "##  #",
        "#   #",
        " ### ",
    ],
    "1": [
        "  #  ",
        " ##  ",
        "# #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "#####",
    ],
    "2": [
        " ### ",
        "#   #",
        "    #",
        "   # ",
        "  #  ",
        " #   ",
        "#####",
    ],
    "3": [
        " ### ",
        "#   #",
        "    #",
        " ### ",
        "    #",
        "#   #",
        " ### ",
    ],
    "4": [
        "   # ",
        "  ## ",
        " # # ",
        "#  # ",
        "#####",
        "   # ",
        "   # ",
    ],
    "5": [
        "#####",
        "#    ",
        "#    ",
        "#### ",
        "    #",
        "#   #",
        " ### ",
    ],
    "6": [
        " ### ",
        "#   #",
        "#    ",
        "#### ",
        "#   #",
        "#   #",
        " ### ",
    ],
    "7": [
        "#####",
        "    #",
        "   # ",
        "  #  ",
        " #   ",
        " #   ",
        " #   ",
    ],
    "8": [
        " ### ",
        "#   #",
        "#   #",
        " ### ",
        "#   #",
        "#   #",
        " ### ",
    ],
    "9": [
        " ### ",
        "#   #",
        "#   #",
        " ####",
        "    #",
        "#   #",
        " ### ",
    ],
    ":": [
        "     ",
        "  ## ",
        "  ## ",
        "     ",
        "  ## ",
        "  ## ",
        "     ",
    ],
    ".": [
        "     ",
        "     ",
        "     ",
        "     ",
        "     ",
        "  ## ",
        "  ## ",
    ],
    "-": [
        "     ",
        "     ",
        "     ",
        "#####",
        "     ",
        "     ",
        "     ",
    ],
    "/": [
        "    #",
        "   # ",
        "   # ",
        "  #  ",
        " #   ",
        " #   ",
        "#    ",
    ],
}

char_w = 6
char_h = 8
pad = 16
max_len = max(len(line) for line in lines)
width = pad * 2 + max_len * char_w
height = pad * 2 + len(lines) * char_h

bg = (17, 17, 17)
fg = (240, 240, 240)

rows = [bytearray([bg[0], bg[1], bg[2]] * width) for _ in range(height)]


def draw_char(ch, x, y):
    glyph = font.get(ch)
    if glyph is None:
        glyph = font.get(ch.upper(), font[" "])
    for row_index, row in enumerate(glyph):
        for col_index, cell in enumerate(row):
            if cell != " ":
                px = x + col_index
                py = y + row_index
                if 0 <= px < width and 0 <= py < height:
                    offset = px * 3
                    rows[py][offset:offset + 3] = bytes(fg)


for line_index, line in enumerate(lines):
    y = pad + line_index * char_h
    for char_index, ch in enumerate(line):
        x = pad + char_index * char_w
        draw_char(ch, x, y)

raw = bytearray()
for row in rows:
    raw.append(0)
    raw.extend(row)

compressed = zlib.compress(bytes(raw), level=9)


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


png = bytearray()
png.extend(b"\x89PNG\r\n\x1a\n")
png.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)))
png.extend(chunk(b"IDAT", compressed))
png.extend(chunk(b"IEND", b""))

out_dir = os.path.join("docs", "screenshots", "scan-cli")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "scan-output.png")
with open(out_path, "wb") as f:
    f.write(png)

print(f"wrote {out_path} ({width}x{height})")
