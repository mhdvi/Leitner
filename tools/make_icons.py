"""Renders the app icons (PNG) without third-party libraries.

Usage:  python tools/make_icons.py
"""
import math, os, struct, zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
TOP, BOTTOM = (0x3A, 0x8A, 0xE8), (0x16, 0x4E, 0x9A)
BARS = [0.40, 0.55, 0.70, 0.85, 1.0]        # bar heights (fraction of the tallest)
ALPHA = [0.55, 0.66, 0.77, 0.88, 1.0]       # bar opacity


def rounded_rect_sdf(px, py, x0, y0, x1, y1, r):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    dx, dy = abs(px - cx) - hx, abs(py - cy) - hy
    outside = math.hypot(max(dx, 0), max(dy, 0))
    return outside + min(max(dx, dy), 0) - r


def coverage(d):
    return max(0.0, min(1.0, 0.5 - d))


def render(size, maskable=False, corner=0.225):
    pixels = bytearray()
    content = 0.62 if maskable else 0.56           # glyph box as a fraction of the icon
    gw = size * content
    gx0 = (size - gw) / 2
    gy1 = size / 2 + gw * 0.42
    gap = gw * 0.055
    bw = (gw - gap * 4) / 5
    bars = []
    for i, hfrac in enumerate(BARS):
        x0 = gx0 + i * (bw + gap)
        h = gw * 0.84 * hfrac
        bars.append((x0, gy1 - h, x0 + bw, gy1, ALPHA[i]))
    radius = size * corner
    for y in range(size):
        pixels.append(0)
        t = y / (size - 1)
        bg = [TOP[k] + (BOTTOM[k] - TOP[k]) * t for k in range(3)]
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            a = 1.0 if maskable else coverage(rounded_rect_sdf(px, py, 0, 0, size, size, radius))
            col = bg[:]
            for (x0, y0, x1, y1, alpha) in bars:
                c = coverage(rounded_rect_sdf(px, py, x0, y0, x1, y1, bw * 0.22)) * alpha
                if c:
                    col = [col[k] + (255 - col[k]) * c for k in range(3)]
            pixels += bytes([round(col[0]), round(col[1]), round(col[2]), round(a * 255)])
    return png(size, size, bytes(pixels))


def png(w, h, raw):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [('icon-192.png', 192, False), ('icon-512.png', 512, False),
            ('maskable-512.png', 512, True), ('apple-touch-icon.png', 180, True)]
    for name, size, mask in jobs:
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(render(size, mask))
        print('wrote', name)


if __name__ == '__main__':
    main()
