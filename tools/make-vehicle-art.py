"""Rebuilds src/modes/race/race-vehicle-art.js from the shared car and bike pictures.

Needs Python 3 with pillow, numpy, scipy and opencv-python. Run from the project folder:

    python tools/make-vehicle-art.py "C:/Users/krish/Downloads/Car Designs" "C:/Users/krish/Downloads/Bike Designs"

The first folder holds the six cars, the second the four bikes (sorted by file name, cars first: the numbers below
refer to that order). Steps:
  1. cut the background (flood fill from the border) and crop to the vehicle,
  2. drop watermarks, scale (cars 560 px wide, bikes 300 px tall), face right (mirrored decals patched back),
  3. find the wheels (Hough circles),
  4. clear the background seen through the bike wheels and write the pictures as WebP data into the module.
Work files go to assets/vehicles/work/ (left out of git); the finished pictures are also saved as
assets/vehicles/out_<id>.png for reference.
"""
import base64
import glob
import io
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
WORK = os.path.join(ROOT, "assets", "vehicles", "work")
PICTURES = os.path.join(ROOT, "assets", "vehicles")
MODULE = os.path.join(ROOT, "src", "modes", "race", "race-vehicle-art.js")

# The roster ids, in picture order (cars 0 to 5, bikes 6 to 9).
IDS = ["lime", "ninety6", "fang", "ice", "stealth", "ruby", "shadow", "corsa", "snow", "blaze"]
FIRST_BIKE = 6

# Step 1, per picture: (crop box or None, background tolerance).
CUT = {
    0: (None, 22), 1: (None, 18), 2: (None, 18), 3: (None, 18), 4: ((20, 140, 980, 1120), 16),
    5: (None, 18), 6: (None, 70), 7: (None, 18), 8: (None, 45), 9: (None, 18),
}
# Step 2: watermark boxes to erase, decal boxes to copy back unmirrored, which pictures to flip, the final size.
ERASE = {
    2: [(0, 0, 850, 64), (850, 0, 2000, 50), (0, 0, 480, 130)],
    7: [(250, 555, 440, 620), (0, 585, 2000, 700)],
    9: [(0, 416, 190, 470)],
}
PATCH = {1: [(308, 60, 386, 120)], 5: [(310, 117, 374, 134)]}
FLIP = {0, 1, 2, 3, 4, 5, 7}
WIDTH = {0: 560, 1: 560, 2: 560, 3: 560, 4: 560, 5: 560}
HEIGHT = {6: 300, 7: 300, 8: 300, 9: 300}
# Step 4: the background color seen through each bike's wheels (and how close a pixel must be to count).
WHEEL_BACKGROUND = {
    6: ((255, 255, 255), 14),
    7: ((255, 255, 255), 14),
    8: ((250, 211, 228), 34),
    9: ((255, 255, 255), 14),
}


def work(name):
    return os.path.join(WORK, name)


def cut_background(path, index):
    """Step 1: flood fills the background from the border and keeps the vehicle (and the parts inside it)."""
    image = Image.open(path).convert("RGB")
    box, tolerance = CUT[index]
    if box:
        image = image.crop(box)
    pixels = np.array(image).astype(int)
    border = np.concatenate([pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]])
    reference = np.median(border, axis=0)
    distance = np.abs(pixels - reference).max(axis=2)
    labels, _ = ndimage.label(distance <= tolerance)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    foreground = ndimage.binary_opening(~np.isin(labels, list(edge)), iterations=1)

    parts, count = ndimage.label(foreground)
    sizes = ndimage.sum(foreground, parts, range(1, count + 1))
    main = int(np.argmax(sizes)) + 1
    ys, xs = np.where(parts == main)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    keep = np.zeros_like(foreground)
    for k, found in enumerate(ndimage.find_objects(parts)):
        if found is None:
            continue
        top, bottom, left, right = found[0].start, found[0].stop, found[1].start, found[1].stop
        inside = left >= x0 - 5 and right <= x1 + 5 and top >= y0 - 5 and bottom <= y1 + 5
        if k + 1 == main or (inside and sizes[k] > 30):
            keep |= parts == k + 1

    # Soften the edge, then crop to what is left.
    alpha = np.clip(ndimage.gaussian_filter(keep.astype(float), 0.7) * 1.6 - 0.3, 0, 1)
    cut = np.dstack([np.array(image), (alpha * 255).astype(np.uint8)])
    ys, xs = np.where(alpha > 0.05)
    cut = cut[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    Image.fromarray(cut, "RGBA").save(work(f"vh/cut{index}.png"))
    return cut.shape


def finish(index):
    """Step 2: erases watermarks, crops, scales and turns the vehicle to face right."""
    pixels = np.array(Image.open(work(f"vh/cut{index}.png")))
    for x0, y0, x1, y1 in ERASE.get(index, []):
        pixels[y0:y1, x0:x1, 3] = 0
    if index == 2:  # a grey watermark along the top
        top = pixels[:80, :, :3].astype(int)
        grey = (np.abs(top - 205).max(axis=2) < 45) & (top.min(axis=2) > 150)
        pixels[:80, :, 3][grey] = 0
    ys, xs = np.where(pixels[:, :, 3] > 12)
    image = Image.fromarray(pixels[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], "RGBA")
    if index in WIDTH:
        image = image.resize((WIDTH[index], round(image.height * WIDTH[index] / image.width)), Image.LANCZOS)
    else:
        image = image.resize((round(image.width * HEIGHT[index] / image.height), HEIGHT[index]), Image.LANCZOS)
    if index in FLIP:
        unflipped = np.array(image)
        flipped = unflipped[:, ::-1].copy()
        width = unflipped.shape[1]
        for x0, y0, x1, y1 in PATCH.get(index, []):
            flipped[y0:y1, x0:x1] = unflipped[y0:y1, width - x1 : width - x0]
        image = Image.fromarray(flipped, "RGBA")
    image.save(work(f"vh/fin{index}.png"))
    return image.size


def find_wheels(index):
    """Step 3: finds the back and the front wheel with Hough circles: [x, y, radius] each."""
    image = Image.open(work(f"vh/fin{index}.png"))
    pixels = np.array(image)
    white = np.full(pixels.shape[:2] + (3,), 255, np.uint8)
    alpha = pixels[:, :, 3:4] / 255
    rgb = (pixels[:, :, :3] * alpha + white * (1 - alpha)).astype(np.uint8)
    grey = cv2.medianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), 3)
    height, width = grey.shape
    car = index < FIRST_BIKE
    rmin, rmax = (int(height * 0.2), int(height * 0.29)) if car else (int(height * 0.15), int(height * 0.205))
    wheels = []
    for half in (0, 1):
        best = None
        for threshold in (40, 32, 26, 20, 15):
            circles = cv2.HoughCircles(
                grey, cv2.HOUGH_GRADIENT, dp=1, minDist=8, param1=110, param2=threshold, minRadius=rmin, maxRadius=rmax
            )
            if circles is None:
                continue
            circles = [
                c for c in circles[0] if (c[0] < width / 2) == (half == 0) and c[1] > height * 0.55 and c[1] + c[2] < height + 4
            ]
            if circles:
                best = circles[0]
                break
        wheels.append([round(float(v), 1) for v in best] if best is not None else None)

    # A picture of what was found, to check by eye.
    check = Image.new("RGB", image.size, (255, 0, 255))
    check.paste(image, (0, 0), image)
    draw = ImageDraw.Draw(check)
    for wheel in wheels:
        if wheel:
            x, y, r = wheel
            draw.ellipse([x - r, y - r, x + r, y + r], outline=(0, 255, 0), width=2)
    check.save(work(f"wh{index}.png"))
    return wheels


def export(index, wheels):
    """Step 4: clears the background inside the wheels (and under the bikes) and encodes the picture."""
    pixels = np.array(Image.open(work(f"vh/fin{index}.png"))).copy()
    height, width = pixels.shape[:2]
    yy, xx = np.mgrid[0:height, 0:width]
    bike = index >= FIRST_BIKE
    rows = []
    for cx, cy, r in wheels:
        rim = r * (0.86 if bike else 0.80)
        if index in WHEEL_BACKGROUND:
            reference, tolerance = WHEEL_BACKGROUND[index]
            inside = (xx - cx) ** 2 + (yy - cy) ** 2 < (r * 0.95) ** 2
            near = np.abs(pixels[:, :, :3].astype(int) - reference).max(axis=2) <= tolerance
            pixels[:, :, 3][inside & near] = 0
        rows.append([cx, cy, r, round(rim, 1)])
    ground = max(cy + r for cx, cy, r, _ in rows)
    if bike:
        # Ground strips and drop shadows under the bikes: drop everything under the tyres, and light or pink pixels
        # in a band just above the ground line outside the wheels.
        pixels[int(ground) + 2 :, :, 3] = 0
        outside = np.ones((height, width), bool)
        for cx, cy, r, _ in rows:
            outside &= (xx - cx) ** 2 + (yy - cy) ** 2 > (r * 1.02) ** 2
        band = (yy > ground - 16) & outside
        reference, tolerance = WHEEL_BACKGROUND[index]
        light = (np.abs(pixels[:, :, :3].astype(int) - reference).max(axis=2) <= max(tolerance, 40)) | (
            pixels[:, :, :3].min(axis=2) > 225
        )
        pixels[:, :, 3][band & light] = 0
        ys, xs = np.where(pixels[:, :, 3] > 12)
        pixels = pixels[: ys.max() + 1]
        height = pixels.shape[0]
    image = Image.fromarray(pixels, "RGBA")
    image.save(os.path.join(PICTURES, f"out_{IDS[index]}.png"))
    data = io.BytesIO()
    image.save(data, "WEBP", quality=86, method=6)
    source = "data:image/webp;base64," + base64.b64encode(data.getvalue()).decode()
    return {"w": width, "h": height, "ground": round(ground, 1), "wheels": rows, "src": source}


def number(value):
    """A number the way the module writes it (and Prettier keeps it): 39.2, 560, 281.0."""
    return repr(value) if isinstance(value, float) else str(value)


def module_text(art):
    """The JavaScript module, formatted the way Prettier formats the rest of the code."""
    lines = [
        "/**",
        " * Vehicle art for the Race: Krishna's shared car and bike designs (Downloads/Car Designs, Downloads/Bike Designs),",
        " * cut out, faced to the right and stored as WebP data so index.html still works by double click.",
        " * Made by tools/make-vehicle-art.py (do not edit by hand). Each entry: the picture size in pixels, the ground line",
        " * (lowest tyre point) and the wheels [x, y, tyre radius, rim radius] in picture pixels; the rims are cut out and",
        " * spun by race-vehicles.js. The source pictures belong to their artists: replace or license them before a public",
        " * launch.",
        " */",
        'CounterType.define("race-vehicle-art", [], () => {',
        '  "use strict";',
        "",
        "  return Object.freeze({",
    ]
    for vehicle_id, entry in art.items():
        lines += [
            f"    {vehicle_id}: {{",
            f"      w: {entry['w']},",
            f"      h: {entry['h']},",
            f"      ground: {number(entry['ground'])},",
            "      wheels: [",
        ]
        lines += ["        [" + ", ".join(number(v) for v in wheel) + "]," for wheel in entry["wheels"]]
        lines += ["      ],", f"      src: \"{entry['src']}\",", "    },"]
    lines += ["  });", "});", ""]
    return "\n".join(lines)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    cars, bikes = sys.argv[1], sys.argv[2]
    files = sorted(glob.glob(os.path.join(cars, "*"))) + sorted(glob.glob(os.path.join(bikes, "*")))
    if len(files) != len(IDS):
        sys.exit(f"Expected {len(IDS)} pictures (6 cars, then 4 bikes), found {len(files)}.")
    os.makedirs(work("vh"), exist_ok=True)

    for index, path in enumerate(files):
        print("cut", index, cut_background(path, index))
    for index in range(len(IDS)):
        print("finish", index, finish(index))
    wheels = {index: find_wheels(index) for index in range(len(IDS))}
    with open(work("wheels.json"), "w") as out:
        json.dump(wheels, out)
    missing = [IDS[index] for index, found in wheels.items() if None in found]
    if missing:
        sys.exit(f"No wheels found for {', '.join(missing)}: check {work('wh<n>.png')} and the radius limits.")

    art = {IDS[index]: export(index, wheels[index]) for index in range(len(IDS))}
    with open(MODULE, "w", encoding="utf-8", newline="\n") as out:
        out.write(module_text(art))
    print(f"Wrote {os.path.relpath(MODULE, ROOT)} ({os.path.getsize(MODULE) // 1024} KB)")


if __name__ == "__main__":
    main()
