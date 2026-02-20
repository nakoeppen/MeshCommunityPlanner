"""Tests for the pure-Python PNG encoder."""

import struct

import pytest

from backend.app.services.png_writer import encode_rgba_png


class TestEncodeRGBAPNG:
    """Tests for encode_rgba_png()."""

    def test_valid_png_signature(self):
        """Output starts with the standard PNG signature."""
        pixels = bytes([255, 0, 0, 255] * 4)  # 2x2 red
        result = encode_rgba_png(2, 2, pixels)
        assert result[:8] == b"\x89PNG\r\n\x1a\n"

    def test_ihdr_dimensions(self):
        """IHDR chunk encodes correct width and height."""
        pixels = bytes([0, 0, 0, 255] * 6)  # 3x2
        result = encode_rgba_png(3, 2, pixels)
        # IHDR starts after signature (8) + length (4) + type (4) = offset 16
        ihdr_data = result[16:16 + 8]
        width, height = struct.unpack(">II", ihdr_data)
        assert width == 3
        assert height == 2

    def test_wrong_pixel_count_raises(self):
        """Raises ValueError when pixel count doesn't match dimensions."""
        with pytest.raises(ValueError, match="Expected 16 bytes, got 8"):
            encode_rgba_png(2, 2, bytes(8))

    def test_single_pixel(self):
        """1x1 image produces valid PNG with correct signature and IEND."""
        pixels = bytes([128, 64, 32, 255])
        result = encode_rgba_png(1, 1, pixels)
        assert result[:8] == b"\x89PNG\r\n\x1a\n"
        # Ends with IEND chunk
        assert result[-12:] == (
            struct.pack(">I", 0) +  # length = 0
            b"IEND" +
            struct.pack(">I", 0xAE426082)  # CRC32 of "IEND"
        )

    def test_transparent_pixels(self):
        """Fully transparent pixels (alpha=0) are encoded without error."""
        pixels = bytes([0, 0, 0, 0] * 4)  # 2x2 fully transparent
        result = encode_rgba_png(2, 2, pixels)
        assert result[:8] == b"\x89PNG\r\n\x1a\n"
        assert len(result) > 8
