"""Pure-Python PNG encoder using only stdlib (struct + zlib).

Encodes RGBA pixel data into a valid PNG file. No Pillow dependency.
"""

import struct
import zlib


def _make_chunk(chunk_type: bytes, data: bytes) -> bytes:
    """Create a PNG chunk: length + type + data + CRC32."""
    raw = chunk_type + data
    return struct.pack(">I", len(data)) + raw + struct.pack(">I", zlib.crc32(raw) & 0xFFFFFFFF)


def encode_rgba_png(width: int, height: int, pixels: bytes) -> bytes:
    """Encode raw RGBA pixel data into a PNG file.

    Args:
        width: Image width in pixels.
        height: Image height in pixels.
        pixels: Raw RGBA bytes, length must be width * height * 4.
                Pixels are in row-major order, top-to-bottom.

    Returns:
        Complete PNG file as bytes.
    """
    expected = width * height * 4
    if len(pixels) != expected:
        raise ValueError(f"Expected {expected} bytes, got {len(pixels)}")

    # PNG signature
    signature = b"\x89PNG\r\n\x1a\n"

    # IHDR: width, height, bit depth (8), color type (6 = RGBA), compression, filter, interlace
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr = _make_chunk(b"IHDR", ihdr_data)

    # IDAT: filtered scanlines compressed with zlib
    # Filter type 0 (None) prepended to each row
    row_bytes = width * 4
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type None
        offset = y * row_bytes
        raw_data.extend(pixels[offset:offset + row_bytes])

    compressed = zlib.compress(bytes(raw_data), 6)
    idat = _make_chunk(b"IDAT", compressed)

    # IEND
    iend = _make_chunk(b"IEND", b"")

    return signature + ihdr + idat + iend
