import io
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from PIL import Image
from fastapi import HTTPException
from app.services.weight_slip_ocr import extract_weight_slip

class WeightSlipOcrTests(unittest.IsolatedAsyncioTestCase):
    def image(self):
        output = io.BytesIO(); Image.new("RGB", (20, 20), "white").save(output, "PNG"); return output.getvalue()

    async def test_missing_key_fails_without_sample_data(self):
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", ""):
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(503, error.exception.status_code)

    async def test_blank_template_keeps_unknown_fields_null(self):
        response = MagicMock()
        response.json.return_value = {"choices": [{"message": {"content": json.dumps({"isWeightSlip": True, "quantity": None, "totalWeight": None, "unitPrice": None})}}]}
        client = AsyncMock(); client.post.return_value = response
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"), patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory:
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(self.image(), "image/png")
            self.assertIsNone(result["totalWeight"])
            payload = client.post.call_args.kwargs["json"]
            self.assertIn("TRỪ BÌ", payload["messages"][0]["content"][0]["text"])

    async def test_inconsistent_totals_raise_review_warnings(self):
        response = MagicMock()
        response.json.return_value = {"choices": [{"message": {"content": json.dumps({
            "isWeightSlip": True, "quantity": 100, "totalWeight": 250, "unitPrice": 60000, "totalAmount": 1,
            "weighings": [{"code": 1, "quantity": 90, "netWeight": 230}]
        })}}]}
        client = AsyncMock(); client.post.return_value = response
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"), patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory:
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(3, len(result["warnings"]))
            self.assertEqual(250, result["totalWeight"])

    async def test_fixed_pdf_template_is_rendered_for_the_model(self):
        from pathlib import Path
        template = next((Path(__file__).resolve().parents[2] / "frontendFarmShift" / "public").glob("*.pdf"))
        response = MagicMock()
        response.json.return_value = {"choices": [{"message": {"content": json.dumps({"isWeightSlip": True})}}]}
        client = AsyncMock(); client.post.return_value = response
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"), patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory:
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(template.read_bytes(), "application/pdf")
            self.assertIsNone(result["quantity"])
            content = client.post.call_args.kwargs["json"]["messages"][0]["content"]
            self.assertEqual(2, sum(part["type"] == "image_url" for part in content))

    async def test_provider_failure_does_not_fabricate_invoice(self):
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"), patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory:
            client = AsyncMock(); client.post.side_effect = RuntimeError("unavailable")
            factory.return_value.__aenter__.return_value = client
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(502, error.exception.status_code)

if __name__ == "__main__": unittest.main()
