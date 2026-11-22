import io
import json
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx  # noqa: E402
import pymupdf  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from main import app  # noqa: E402
from app.services.ocr_service import ocr_service  # noqa: E402


def _make_png(width: int = 80, height: int = 60) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buf, "PNG")
    return buf.getvalue()


def _make_pdf(pages: int = 2) -> bytes:
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page(width=400, height=600)
        page.insert_text((40, 60), f"Hoa don trang {i + 1}")
    data = doc.tobytes()
    doc.close()
    return data


class InvoiceOcrTests(unittest.TestCase):
    def test_preprocess_image_runs_deskew_and_clahe_and_blocks_decompression_bomb(self):
        enhanced, angle = ocr_service.preprocess_image(_make_png(120, 90))
        self.assertEqual((90, 120, 3), enhanced.shape)
        self.assertIsInstance(angle, float)

        fake_huge = MagicMock()
        fake_huge.__enter__.return_value = SimpleNamespace(width=6000, height=5000)
        with patch("app.services.ocr_service.Image.open", return_value=fake_huge):
            with self.assertRaises(HTTPException) as ctx:
                ocr_service.preprocess_image(_make_png())
            self.assertEqual(400, ctx.exception.status_code)
            self.assertIn("25 megapixel", ctx.exception.detail)

    def test_extract_invoice_png_and_pdf_with_mocked_openai_and_non_invoice(self):
        client = TestClient(app)
        headers = {"X-Internal-AI-Token": "test-ocr-token"}

        with (
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", "test-ocr-token"),
            patch("app.services.ocr_service.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.ocr_service.settings.OCR_ENGINE", "hybrid"),
            patch("app.services.ocr_service.get_shared_http_client", return_value=None),
            patch("app.services.ocr_service.httpx.AsyncClient") as factory,
        ):
            ok_resp = MagicMock()
            ok_resp.json.return_value = {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "isInvoice": True,
                                    "supplierName": "C.P. Việt Nam",
                                    "items": [
                                        {
                                            "name": "Cám Higro 01",
                                            "qty": 10,
                                            "unit": "Bao",
                                            "unitPrice": 345000,
                                            "amount": 3450000,
                                        }
                                    ],
                                    "totalAmount": 3450000,
                                    "confidence": 97.5,
                                }
                            )
                        }
                    }
                ]
            }
            http_mock = AsyncMock()
            http_mock.post.return_value = ok_resp
            factory.return_value.__aenter__.return_value = http_mock

            # 1. Multi-page PDF renders all pages as JPEG and sends 2 image_url parts
            res_pdf = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("invoice.pdf", _make_pdf(2), "application/pdf")},
                headers=headers,
            )
            self.assertEqual(200, res_pdf.status_code)
            body_pdf = res_pdf.json()
            self.assertTrue(body_pdf["isInvoice"])
            self.assertEqual("C.P. Việt Nam", body_pdf["supplierName"])
            sent_content = http_mock.post.call_args.kwargs["json"]["messages"][0]["content"]
            image_parts = [p for p in sent_content if p["type"] == "image_url"]
            self.assertEqual(2, len(image_parts))
            self.assertTrue(
                all(p["image_url"]["url"].startswith("data:image/jpeg;base64,") for p in image_parts)
            )

            # 2. Non-invoice with null confidence returns isInvoice=False (NEVER fake Dabaco)
            non_inv_resp = MagicMock()
            non_inv_resp.json.return_value = {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "isInvoice": False,
                                    "confidence": None,
                                    "items": [],
                                }
                            )
                        }
                    }
                ]
            }
            http_mock.post.return_value = non_inv_resp
            res_non = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("random.png", _make_png(), "image/png")},
                headers=headers,
            )
            self.assertEqual(200, res_non.status_code)
            body_non = res_non.json()
            self.assertFalse(body_non["isInvoice"])
            self.assertEqual([], body_non["items"])
            self.assertIsNone(body_non["supplierName"])

    def test_extract_invoice_errors_never_fabricate_fake_data(self):
        client = TestClient(app)
        headers = {"X-Internal-AI-Token": "test-ocr-token"}
        png = _make_png()

        with (
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", "test-ocr-token"),
            patch("app.services.ocr_service.settings.OPENAI_API_KEY", ""),
            patch("app.services.ocr_service.settings.OCR_ENGINE", "hybrid"),
        ):
            missing_key_res = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("invoice.png", png, "image/png")},
                headers=headers,
            )
            self.assertEqual(503, missing_key_res.status_code)

        with (
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", "test-ocr-token"),
            patch("app.services.ocr_service.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.ocr_service.settings.OCR_ENGINE", "hybrid"),
            patch("app.services.ocr_service.get_shared_http_client", return_value=None),
            patch("app.services.ocr_service.httpx.AsyncClient") as factory,
        ):
            http_mock = AsyncMock()
            resp_429 = MagicMock()
            resp_429.raise_for_status.side_effect = httpx.HTTPStatusError(
                "rate-limit",
                request=httpx.Request("POST", "https://example.test"),
                response=httpx.Response(429),
            )
            http_mock.post.return_value = resp_429
            factory.return_value.__aenter__.return_value = http_mock

            rate_res = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("invoice.png", png, "image/png")},
                headers=headers,
            )
            self.assertEqual(502, rate_res.status_code)

            http_mock.post.side_effect = httpx.ReadTimeout("timeout")
            timeout_res = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("invoice.png", png, "image/png")},
                headers=headers,
            )
            self.assertEqual(504, timeout_res.status_code)

    def test_spoofed_and_oversized_uploads_rejected_cleanly(self):
        client = TestClient(app)
        headers = {"X-Internal-AI-Token": "test-ocr-token"}
        spoofed = b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"
        oversized = b"\x89PNG\r\n\x1a\n" + b"\x00" * (10 * 1024 * 1024 + 8)

        with patch("app.api.router.settings.AI_INTERNAL_TOKEN", "test-ocr-token"):
            bad_extract = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("evil.svg", spoofed, "image/svg+xml")},
                headers=headers,
            )
            self.assertEqual(400, bad_extract.status_code)

            big_extract = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("huge.png", oversized, "image/png")},
                headers=headers,
            )
            self.assertEqual(400, big_extract.status_code)

            bad_prep = client.post(
                "/api/ocr/preprocess",
                files={"file": ("bad.txt", b"hello", "text/plain")},
                headers=headers,
            )
            self.assertEqual(400, bad_prep.status_code)

            big_prep = client.post(
                "/api/ocr/preprocess",
                files={"file": ("huge.png", oversized, "image/png")},
                headers=headers,
            )
            self.assertEqual(400, big_prep.status_code)

    def test_sample_endpoint_and_hanvet_vat_math(self):
        client = TestClient(app)
        with patch("app.api.router.settings.AI_INTERNAL_TOKEN", "test-ocr-token"):
            res = client.get(
                "/api/ocr/sample",
                headers={"X-Internal-AI-Token": "test-ocr-token"},
            )
            self.assertEqual(200, res.status_code)
            self.assertEqual("HD-CP-2026-9921", res.json()["referenceCode"])

        hanvet = ocr_service.get_sample_invoice("thuoc_hanvet.png")
        self.assertEqual(155000.0, hanvet.vatAmount)
        self.assertEqual(3255000.0, hanvet.totalAmount)

    def test_purchase_ocr_rejects_sales_weight_slip_and_parses_vn_numbers(self):
        from app.services.ocr_service import INVOICE_VISION_PROMPT, _safe_non_negative_float

        self.assertIn("Phiếu cân xuất bán gà thịt", INVOICE_VISION_PROMPT)
        self.assertEqual(1150000.0, _safe_non_negative_float("1,150,000"))
        self.assertEqual(345000.0, _safe_non_negative_float("345.000"))
        self.assertEqual(2150.5, _safe_non_negative_float("2.150,5"))

        client = TestClient(app)
        headers = {"X-Internal-AI-Token": "test-ocr-token"}
        with (
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", "test-ocr-token"),
            patch("app.services.ocr_service.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.ocr_service.settings.OCR_ENGINE", "hybrid"),
            patch("app.services.ocr_service.get_shared_http_client", return_value=None),
            patch("app.services.ocr_service.httpx.AsyncClient") as factory,
        ):
            slip_resp = MagicMock()
            slip_resp.json.return_value = {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "isInvoice": False,
                                    "items": [],
                                    "warnings": [
                                        "Chứng từ này là phiếu cân / chứng từ xuất bán gà, không phải hóa đơn nhập hàng. Vui lòng quét ở mục Quản lý bán hàng."
                                    ],
                                }
                            )
                        }
                    }
                ]
            }
            http_mock = AsyncMock()
            http_mock.post.return_value = slip_resp
            factory.return_value.__aenter__.return_value = http_mock

            res = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("weight-slip.png", _make_png(), "image/png")},
                headers=headers,
            )
            self.assertEqual(200, res.status_code)
            body = res.json()
            self.assertFalse(body["isInvoice"])
            self.assertEqual([], body["items"])
            self.assertTrue(any("Quản lý bán hàng" in w for w in body["warnings"]))

    def test_extract_invoice_math_verification_rescues_unit_price_and_flags_line_mismatch(self):
        client = TestClient(app)
        headers = {
            "X-Internal-AI-Token": "test-ocr-token",
            "X-Request-ID": "req-ocr-123",
        }
        with (
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", "test-ocr-token"),
            patch("app.services.ocr_service.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.ocr_service.settings.OCR_ENGINE", "hybrid"),
            patch("app.services.ocr_service.get_shared_http_client", return_value=None),
            patch("app.services.ocr_service.httpx.AsyncClient") as factory,
        ):
            math_resp = MagicMock()
            math_resp.json.return_value = {
                "usage": {"prompt_tokens": 120, "completion_tokens": 45, "total_tokens": 165},
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "isInvoice": True,
                                    "supplierName": "C.P. Việt Nam",
                                    "items": [
                                        {
                                            "name": "Cám Higro 01",
                                            "qty": 50,
                                            "unit": "Bao",
                                            "unitPrice": 345,
                                            "amount": 17250000,
                                        },
                                        {
                                            "name": "Thuốc thú y B",
                                            "qty": 10,
                                            "unit": "Chai",
                                            "unitPrice": 300000,
                                            "amount": 4500000,
                                        },
                                    ],
                                    "totalAmount": 21750000,
                                    "confidence": 93.0,
                                }
                            )
                        }
                    }
                ],
            }
            http_mock = AsyncMock()
            http_mock.post.return_value = math_resp
            factory.return_value.__aenter__.return_value = http_mock

            res = client.post(
                "/api/ocr/extract-invoice",
                files={"file": ("invoice.png", _make_png(), "image/png")},
                headers=headers,
            )
            self.assertEqual(200, res.status_code)
            self.assertEqual("req-ocr-123", res.headers.get("X-Request-ID"))
            body = res.json()
            self.assertEqual(345000.0, body["items"][0]["unitPrice"])
            self.assertTrue(
                any("Dòng hàng #2 (Thuốc thú y B)" in w for w in body["warnings"]),
                msg=f"Expected line-level mismatch warning, got: {body['warnings']}",
            )
            self.assertFalse(any("Dòng hàng #1" in w for w in body["warnings"]))


if __name__ == "__main__":
    unittest.main()
