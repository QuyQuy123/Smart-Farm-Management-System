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
        template = next((Path(__file__).resolve().parents[2] / "frontendFarmShift" / "public").rglob("Phiếu Cân Bán Gà.pdf"))
        response = MagicMock()
        response.json.return_value = {"choices": [{"message": {"content": json.dumps({"isWeightSlip": True})}}]}
        client = AsyncMock(); client.post.return_value = response
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"), patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory:
            factory.return_value.__aenter__.return_value = client
            result = await extract_weight_slip(template.read_bytes(), "application/pdf")
            self.assertIsNone(result["quantity"])
            content = client.post.call_args.kwargs["json"]["messages"][0]["content"]
            self.assertEqual(2, sum(part["type"] == "image_url" for part in content))

    async def test_quota_error_has_an_actionable_message(self):
        import httpx
        response = MagicMock()
        response.raise_for_status.side_effect = httpx.HTTPStatusError("quota", request=httpx.Request("POST", "https://example.test"), response=httpx.Response(429))
        client = AsyncMock(); client.post.return_value = response
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"), patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory:
            factory.return_value.__aenter__.return_value = client
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(self.image(), "image/png")
            self.assertIn("hạn mức", error.exception.detail)

    async def test_provider_failure_does_not_fabricate_invoice(self):
        with patch("app.services.weight_slip_ocr.settings.OPENAI_API_KEY", "test-only"), patch("app.services.weight_slip_ocr.httpx.AsyncClient") as factory:
            client = AsyncMock(); client.post.side_effect = RuntimeError("unavailable")
            factory.return_value.__aenter__.return_value = client
            with self.assertRaises(HTTPException) as error:
                await extract_weight_slip(self.image(), "image/png")
            self.assertEqual(502, error.exception.status_code)

    async def test_internal_ai_token_guard_enforced_when_configured(self):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        with patch("app.api.router.settings.AI_INTERNAL_TOKEN", "farmshift-secret-token"):
            # /health stays open for container healthcheck
            health_res = client.get("/health")
            self.assertEqual(200, health_res.status_code)

            # Missing token returns 403 Forbidden
            missing_res = client.post("/api/voice/chat", json={"message": "hello", "systemPrompt": "test", "history": []})
            self.assertEqual(403, missing_res.status_code)

            # Wrong token returns 403 Forbidden
            wrong_res = client.post(
                "/api/voice/chat",
                json={"message": "hello", "systemPrompt": "test", "history": []},
                headers={"X-Internal-AI-Token": "wrong-token"}
            )
            self.assertEqual(403, wrong_res.status_code)

            # Valid token clears the dependency guard (endpoint handles empty keys gracefully offline)
            with patch("app.core.config.settings.GROQ_API_KEY", ""), patch("app.core.config.settings.OPENAI_API_KEY", ""):
                ok_res = client.post(
                    "/api/voice/chat",
                    json={"message": "hello", "systemPrompt": "test", "history": []},
                    headers={"X-Internal-AI-Token": "farmshift-secret-token"}
                )
                self.assertEqual(200, ok_res.status_code)

if __name__ == "__main__": unittest.main()
