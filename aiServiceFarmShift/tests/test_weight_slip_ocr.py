import io
import json
import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
import httpx  # noqa: E402
import pymupdf  # noqa: E402
from PIL import Image  # noqa: E402

from main import app  # noqa: E402
from app.services.weight_slip_ocr import WeightSlipDraft, extract_weight_slip  # noqa: E402


class WeightSlipOcrTests(unittest.IsolatedAsyncioTestCase):
    def image(self):
        output = io.BytesIO()
        Image.new("RGB", (20, 20), "white").save(output, "PNG")
        return output.getvalue()

    def pdf(self, pages: int = 2) -> bytes:
        doc = pymupdf.open()
        for idx in range(pages):
            page = doc.new_page(width=400, height=600)
            page.insert_text((40, 60), f"Phieu can trang {idx + 1}")
        data = doc.tobytes()
        doc.close()
        return data

    async def test_missing_key_fails_without_sample_data(self):
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", ""):
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(503, error.exception.status_code)

    async def test_blank_template_keeps_unknown_fields_null(self):
        response = MagicMock()
        response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "isWeightSlip": True,
                                "quantity": None,
                                "totalWeight": None,
                                "unitPrice": None,
                            }
                        )
                    }
                }
            ]
        }
        client = AsyncMock()
        client.post.return_value = response
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(self.image(), "image/png")
            self.assertIsNone(result["totalWeight"])
            payload = client.post.call_args.kwargs["json"]
            self.assertIn("TRỪ BÌ", payload["messages"][0]["content"][0]["text"])
            self.assertEqual(0.0, payload["temperature"])

    async def test_inconsistent_totals_and_row_tare_raise_review_warnings(self):
        response = MagicMock()
        response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "isWeightSlip": True,
                                "quantity": 100,
                                "totalWeight": 250,
                                "unitPrice": 60000,
                                "totalAmount": 1,
                                "weighings": [
                                    {
                                        "code": 1,
                                        "quantity": 90,
                                        "grossWeight": 260,
                                        "tareWeight": 20,
                                        "netWeight": 230,
                                    }
                                ],
                            }
                        )
                    }
                }
            ]
        }
        client = AsyncMock()
        client.post.return_value = response
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(4, len(result["warnings"]))
            self.assertTrue(any("Lượt cân 1" in w for w in result["warnings"]))
            self.assertEqual(250, result["totalWeight"])

    async def test_fixed_pdf_template_is_rendered_for_the_model(self):
        pdf_bytes = self.pdf(2)
        response = MagicMock()
        response.json.return_value = {
            "choices": [{"message": {"content": json.dumps({"isWeightSlip": True})}}]
        }
        client = AsyncMock()
        client.post.return_value = response
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(pdf_bytes, "application/pdf")
            self.assertIsNone(result["quantity"])
            content = client.post.call_args.kwargs["json"]["messages"][0]["content"]
            image_parts = [part for part in content if part["type"] == "image_url"]
            self.assertEqual(2, len(image_parts))
            self.assertTrue(
                all(p["image_url"]["url"].startswith("data:image/jpeg;base64,") for p in image_parts)
            )

    async def test_zero_page_pdf_rejected_with_400(self):
        fake_empty_doc = MagicMock()
        fake_empty_doc.__len__.return_value = 0
        fake_empty_doc.__enter__.return_value = fake_empty_doc
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("pymupdf.open", return_value=fake_empty_doc),
        ):
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(b"%PDF-1.4\n", "application/pdf")
            self.assertEqual(400, error.exception.status_code)

    async def test_vietnamese_dd_mm_yyyy_date_and_accented_endpoint_errors(self):
        draft = WeightSlipDraft.model_validate({"isWeightSlip": True, "date": "19/11/2026"})
        self.assertEqual("2026-11-19", draft.date.isoformat())

        client = TestClient(app)
        with patch("app.api.router.settings.AI_INTERNAL_TOKEN", "slip-token"):
            res = client.post(
                "/api/ocr/extract-weight-slip",
                files={"file": ("bad.txt", b"plain text", "text/plain")},
                headers={"X-Internal-AI-Token": "slip-token"},
            )
            self.assertEqual(400, res.status_code)
            self.assertIn("Chỉ hỗ trợ", res.json()["detail"])

    async def test_quota_error_has_an_actionable_message(self):
        response = MagicMock()
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "quota",
            request=httpx.Request("POST", "https://example.test"),
            response=httpx.Response(429),
        )
        client = AsyncMock()
        client.post.return_value = response
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(self.image(), "image/png")
            self.assertIn("hạn mức", error.exception.detail)

    async def test_provider_failure_does_not_fabricate_invoice(self):
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            client = AsyncMock()
            client.post.side_effect = RuntimeError("unavailable")
            factory.return_value.__aenter__.return_value = client
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(502, error.exception.status_code)

    async def test_internal_ai_token_guard_enforced_when_configured_and_fail_closed_in_prod(self):
        client = TestClient(app)

        # Fail-closed when DEBUG=False and AI_INTERNAL_TOKEN=""
        with (
            patch("app.api.router.settings.DEBUG", False),
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", ""),
        ):
            closed_res = client.post(
                "/api/voice/chat",
                json={"message": "hello", "systemPrompt": "test", "history": []},
            )
            self.assertEqual(403, closed_res.status_code)

        with patch("app.api.router.settings.AI_INTERNAL_TOKEN", "farmshift-secret-token"):
            health_res = client.get("/health")
            self.assertEqual(200, health_res.status_code)

            missing_res = client.post(
                "/api/voice/chat",
                json={"message": "hello", "systemPrompt": "test", "history": []},
            )
            self.assertEqual(403, missing_res.status_code)

            wrong_res = client.post(
                "/api/voice/chat",
                json={"message": "hello", "systemPrompt": "test", "history": []},
                headers={"X-Internal-AI-Token": "wrong-token"},
            )
            self.assertEqual(403, wrong_res.status_code)

            with (
                patch("app.core.config.settings.GROQ_API_KEY", ""),
                patch("app.core.config.settings.OPENAI_API_KEY", ""),
            ):
                ok_res = client.post(
                    "/api/voice/chat",
                    json={"message": "hello", "systemPrompt": "test", "history": []},
                    headers={"X-Internal-AI-Token": "farmshift-secret-token"},
                )
                self.assertEqual(200, ok_res.status_code)

    async def test_sales_invoice_with_vietnamese_date_and_formatted_numbers(self):
        response = MagicMock()
        response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": (
                            "```json\n"
                            + json.dumps(
                                {
                                    "isWeightSlip": True,
                                    "documentKind": "SALES_INVOICE",
                                    "customer": "Bình Miền",
                                    "address": "Thanh Sơn - Sông Công",
                                    "referenceCode": "HD103172",
                                    "date": "Ngày 21 tháng 08 năm 2026",
                                    "quantity": None,
                                    "totalWeight": "1.500",
                                    "unitPrice": "1,150,000",
                                    "totalAmount": "1.725.000",
                                    "paidAmount": "0",
                                    "status": None,
                                    "weighings": [],
                                }
                            )
                            + "\n```"
                        )
                    }
                }
            ]
        }
        client = AsyncMock()
        client.post.return_value = response
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(self.image(), "image/png")
            self.assertTrue(result["isWeightSlip"])
            self.assertEqual("Bình Miền", result["customer"])
            self.assertEqual("2026-08-21", result["date"])
            self.assertEqual(1.5, result["totalWeight"])
            self.assertEqual(1150000.0, result["unitPrice"])
            self.assertEqual(1725000.0, result["totalAmount"])
            self.assertEqual("DEBT", result["status"])

        partial_resp = MagicMock()
        partial_resp.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "isSalesDocument": True,
                                "documentKind": "SALES_INVOICE",
                                "customer": "Anh Tuấn",
                                "totalWeight": 2150,
                                "unitPrice": 78000,
                                "totalAmount": 167700000,
                                "paidAmount": "100.000.000",
                                "status": "PAID",
                            }
                        )
                    }
                }
            ]
        }
        client.post.return_value = partial_resp
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            result_partial = await extract_weight_slip(self.image(), "image/png")
            self.assertTrue(result_partial["isWeightSlip"])
            self.assertEqual(100000000.0, result_partial["paidAmount"])
            self.assertEqual("PARTIAL", result_partial["status"])

    async def test_rejects_purchase_document_and_parses_vn_number_formats(self):
        draft = WeightSlipDraft.model_validate(
            {
                "isWeightSlip": True,
                "quantity": "100 con",
                "totalWeight": "2.150,5",
                "unitPrice": "78.000",
                "status": "Đã thanh toán",
            }
        )
        self.assertEqual(100, draft.quantity)
        self.assertEqual(2150.5, draft.totalWeight)
        self.assertEqual(78000.0, draft.unitPrice)
        self.assertEqual("PAID", draft.status)

        purchase_resp = MagicMock()
        purchase_resp.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "isWeightSlip": False,
                                "documentKind": "PURCHASE_DOCUMENT",
                            }
                        )
                    }
                }
            ]
        }
        client = AsyncMock()
        client.post.return_value = purchase_resp
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            with self.assertRaises(HTTPException) as err:
                await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(400, err.exception.status_code)
            self.assertIn("Hóa đơn nhập hàng", err.exception.detail)

    async def test_scales_truncated_unit_price_when_weight_times_scaled_price_matches_total(self):
        response = MagicMock()
        response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "isSalesDocument": True,
                                "documentKind": "SALES_INVOICE",
                                "customer": "Anh Bình Miền",
                                "totalWeight": 2150,
                                "unitPrice": 78.0,
                                "totalAmount": 167700000,
                                "paidAmount": 100000000,
                                "status": "PARTIAL",
                            }
                        )
                    }
                }
            ]
        }
        client = AsyncMock()
        client.post.return_value = response
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(78000.0, result["unitPrice"])
            self.assertEqual([], result["warnings"])
            self.assertEqual("PARTIAL", result["status"])

    async def test_clears_duplicated_kg_quantity_on_sales_invoice_and_debt_paid_amount(self):
        client = AsyncMock()
        inv_resp = MagicMock()
        inv_resp.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "isSalesDocument": True,
                                "documentKind": "SALES_INVOICE",
                                "customer": "Anh Bình Miền",
                                "quantity": 2150,
                                "totalWeight": 2150.0,
                                "unitPrice": 78000.0,
                                "totalAmount": 167700000.0,
                                "paidAmount": 100000000.0,
                                "status": "PARTIAL",
                                "weighings": [],
                            }
                        )
                    }
                }
            ]
        }
        debt_slip_resp = MagicMock()
        debt_slip_resp.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "isSalesDocument": True,
                                "documentKind": "WEIGHT_SLIP",
                                "customer": "Anh Tuấn",
                                "quantity": 100,
                                "totalWeight": 250.0,
                                "unitPrice": 80000.0,
                                "totalAmount": 20000000.0,
                                "paidAmount": 20000000.0,
                                "status": "DEBT",
                            }
                        )
                    }
                }
            ]
        }
        with (
            patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"),
            patch("app.services.weight_slip_ocr.get_shared_http_client", return_value=None),
            patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory,
        ):
            factory.return_value.__aenter__.return_value = client

            client.post.return_value = inv_resp
            res_inv = await extract_weight_slip(self.image(), "image/png")
            self.assertIsNone(res_inv["quantity"])
            self.assertEqual(2150.0, res_inv["totalWeight"])

            client.post.return_value = debt_slip_resp
            res_debt = await extract_weight_slip(self.image(), "image/png")
            self.assertEqual("DEBT", res_debt["status"])
            self.assertIsNone(res_debt["paidAmount"])


if __name__ == "__main__":
    unittest.main()
