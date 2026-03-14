"""Generate simple PNG icons for ATAK KML overlay styles.

Run from the icons directory:
    python generate_icons.py
"""

from PIL import Image, ImageDraw
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))


def make_circle(color: tuple, size: int = 32) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = 2
    d.ellipse([margin, margin, size - margin, size - margin], fill=color)
    return img


def make_diamond(color: tuple, size: int = 32) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2
    d.polygon([(cx, 2), (size - 2, cy), (cx, size - 2), (2, cy)], fill=color)
    return img


make_circle((0, 204, 0, 255)).save("mesh_node.png")
make_diamond((255, 136, 0, 255)).save("repeater.png")
make_circle((255, 0, 0, 255)).save("gateway.png")

print("Icons generated: mesh_node.png, repeater.png, gateway.png")
