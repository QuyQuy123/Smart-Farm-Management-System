"""Shared binary validation, PDF rendering, and OpenCV preprocessing for OCR documents."""
from __future__ import annotations

import io
from typing import Tuple

import cv2
import numpy as np
from fastapi import HTTPException
from PIL import Image, ImageOps

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PDF_PAGES = 4
MAX_PIXELS = 25_000_000  # 25 megapixels decompression bomb guard
MAX_IMAGE_DIM = 2400


def detect_document_mime(
    content: bytes,
    declared_mime: str | None = None,
    *,
    allow_pdf: bool = True,
) -> str:
    """Detect JPG/PNG/WEBP (and optionally PDF) strictly from binary magic bytes."""
    if not content:
        raise HTTPException(status_code=400, detail="Tệp chứng từ rỗng.")

    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if allow_pdf and content.startswith(b"%PDF-"):
        return "application/pdf"

    if allow_pdf:
        raise HTTPException(
            status_code=400,
            detail="Chỉ hỗ trợ ảnh JPG, PNG, WEBP và tệp PDF hợp lệ.",
        )
    raise HTTPException(
        status_code=400,
        detail="Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP hợp lệ.",
    )


def opencv_deskew_and_clahe(rgb_image: Image.Image) -> Tuple[np.ndarray, float]:
    """Convert PIL RGB image to BGR, auto-deskew via Hough lines, and apply LAB CLAHE."""
    img = cv2.cvtColor(np.array(rgb_image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    angle = 0.0
    try:
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, 100, minLineLength=100, maxLineGap=10
        )
        angles: list[float] = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                if x2 != x1:
                    theta = float(np.arctan2(y2 - y1, x2 - x1) * 180.0 / np.pi)
                    if abs(theta) < 30.0:
                        angles.append(theta)
        if angles:
            angle = float(np.median(angles))
            if abs(angle) > 0.5:
                h, w = img.shape[:2]
                center = (w // 2, h // 2)
                matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                img = cv2.warpAffine(
                    img,
                    matrix,
                    (w, h),
                    flags=cv2.INTER_CUBIC,
                    borderMode=cv2.BORDER_REPLICATE,
                )
    except Exception:
        angle = 0.0

    try:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l_chan)
        merged = cv2.merge((cl, a_chan, b_chan))
        enhanced = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
        return enhanced, angle
    except Exception:
        return img, angle


def _encode_pil_to_jpeg(
    pil_rgb: Image.Image, *, apply_opencv_enhance: bool
) -> Tuple[bytes, float]:
    angle = 0.0
    if apply_opencv_enhance:
        enhanced_bgr, angle = opencv_deskew_and_clahe(pil_rgb)
        ok, buf = cv2.imencode(
            ".jpg", enhanced_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90]
        )
        if ok:
            return buf.tobytes(), angle
    out = io.BytesIO()
    pil_rgb.save(out, format="JPEG", quality=92)
    return out.getvalue(), angle


def render_document_to_jpeg_images(
    content: bytes,
    mime: str,
    *,
    apply_opencv_enhance: bool = False,
) -> Tuple[list[Tuple[bytes, str]], float]:
    """Decode an image or PDF (max 4 pages) into bounded JPEG bytes ready for Vision LLM."""
    images: list[Tuple[bytes, str]] = []
    first_page_angle = 0.0

    try:
        if mime == "application/pdf":
            import pymupdf

            with pymupdf.open(stream=content, filetype="pdf") as doc:
                if len(doc) == 0:
                    raise HTTPException(
                        status_code=400, detail="Tệp PDF không có trang nào."
                    )
                if len(doc) > MAX_PDF_PAGES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Chứng từ PDF tối đa {MAX_PDF_PAGES} trang.",
                    )
                for idx, page in enumerate(doc):
                    if page.rect.width * page.rect.height * 2.25 > MAX_PIXELS:
                        raise HTTPException(
                            status_code=400, detail="Kích thước trang PDF quá lớn."
                        )
                    pix = page.get_pixmap(
                        matrix=pymupdf.Matrix(1.5, 1.5), alpha=False
                    )
                    pil_img = Image.frombytes(
                        "RGB", (pix.width, pix.height), pix.samples
                    )
                    pil_img.thumbnail((MAX_IMAGE_DIM, MAX_IMAGE_DIM))
                    jpg_bytes, page_angle = _encode_pil_to_jpeg(
                        pil_img, apply_opencv_enhance=apply_opencv_enhance
                    )
                    if idx == 0:
                        first_page_angle = page_angle
                    images.append((jpg_bytes, "image/jpeg"))
        else:
            with Image.open(io.BytesIO(content)) as image:
                if image.width * image.height > MAX_PIXELS:
                    raise HTTPException(
                        status_code=400,
                        detail="Ảnh quá lớn, tối đa 25 megapixel.",
                    )
                image.load()
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail((MAX_IMAGE_DIM, MAX_IMAGE_DIM))
                jpg_bytes, first_page_angle = _encode_pil_to_jpeg(
                    image, apply_opencv_enhance=apply_opencv_enhance
                )
                images.append((jpg_bytes, "image/jpeg"))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400, detail="Không đọc được tệp ảnh/PDF chứng từ."
        )

    return images, first_page_angle
