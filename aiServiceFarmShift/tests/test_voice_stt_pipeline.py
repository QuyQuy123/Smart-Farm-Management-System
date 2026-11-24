import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from app.schemas.voice_schema import AssistantChatRequest  # noqa: E402
from app.services.phonetic_postprocess import postprocess_vietnamese_phonetic  # noqa: E402
from app.services.voice_hallucination_guard import (  # noqa: E402
    filter_whisper_verbose_json,
    validate_audio_magic_bytes,
)
from app.services.voice_service import voice_service  # noqa: E402


class VoiceSttPipelineTests(unittest.TestCase):
    def test_hallucination_guard_drops_high_no_speech_and_compression_segments(self):
        verbose_payload = {
            "text": "tiếng quạt ồn cho Nhà A1 ăn 50 kg ăn lặp lặp lặp",
            "duration": 3.5,
            "segments": [
                {
                    "text": "tiếng quạt ồn",
                    "no_speech_prob": 0.88,
                    "avg_logprob": -0.45,
                    "compression_ratio": 1.1,
                },
                {
                    "text": "tạp âm không rõ",
                    "no_speech_prob": 0.2,
                    "avg_logprob": -1.45,
                    "compression_ratio": 1.2,
                },
                {
                    "text": "cho Nhà A1 ăn 50 kg",
                    "no_speech_prob": 0.08,
                    "avg_logprob": -0.22,
                    "compression_ratio": 1.15,
                },
                {
                    "text": "ăn lặp ăn lặp ăn lặp ăn lặp",
                    "no_speech_prob": 0.1,
                    "avg_logprob": -0.35,
                    "compression_ratio": 2.95,
                },
            ],
        }

        result = filter_whisper_verbose_json(verbose_payload)
        self.assertIsNone(result.rejected_reason)
        self.assertEqual("cho Nhà A1 ăn 50 kg", result.filtered_text)
        self.assertEqual(3, result.segments_filtered)
        self.assertGreater(result.confidence, 0.7)

    def test_hallucination_guard_preserves_zero_avg_logprob_and_zero_no_speech(self):
        payload = {
            "text": "cho Nhà A1 ăn 50 kg",
            "duration": 2.0,
            "segments": [
                {
                    "text": "cho Nhà A1 ăn 50 kg",
                    "no_speech_prob": 0.0,
                    "avg_logprob": 0.0,
                    "compression_ratio": 1.0,
                }
            ],
        }
        result = filter_whisper_verbose_json(payload)
        self.assertIsNone(result.rejected_reason)
        self.assertEqual(1.0, result.confidence)

    def test_hallucination_guard_blocks_vietnamese_youtube_artifacts(self):
        for artifact in (
            "Hãy đăng ký kênh để ủng hộ...",
            "Cảm ơn các bạn đã xem video!",
            "Ghiền Mì Gõ - hẹn gặp lại các bạn ở video tiếp theo",
            "Sub by amara.org",
        ):
            payload = {
                "text": artifact,
                "duration": 2.1,
                "segments": [
                    {
                        "text": artifact,
                        "no_speech_prob": 0.25,
                        "avg_logprob": -0.3,
                        "compression_ratio": 1.2,
                    }
                ],
            }
            res = filter_whisper_verbose_json(payload)
            self.assertEqual("NO_SPEECH_OR_HALLUCINATION", res.rejected_reason, msg=artifact)
            self.assertEqual("", res.filtered_text)
            self.assertEqual(0.0, res.confidence)

    def test_hallucination_guard_collapses_pathological_repetition(self):
        payload = {
            "text": "cho ăn đi, cho ăn đi, cho ăn đi, cho ăn đi",
            "duration": 2.0,
            "segments": [
                {
                    "text": "cho ăn đi, cho ăn đi, cho ăn đi, cho ăn đi",
                    "no_speech_prob": 0.1,
                    "avg_logprob": -0.25,
                    "compression_ratio": 1.9,
                }
            ],
        }
        res = filter_whisper_verbose_json(payload)
        self.assertIsNone(res.rejected_reason)
        self.assertEqual("cho ăn đi", res.filtered_text)
        self.assertLess(res.confidence, 0.65)

    def test_magic_bytes_validator_accepts_webm_mp4_and_rejects_spoofed_text(self):
        webm_bytes = b"\x1a\x45\xdf\xa3" + b"\x00" * 32
        mp4_bytes = b"\x00\x00\x00\x20ftypisom" + b"\x00" * 20
        spoofed_text = b"<script>alert(1)</script>"

        ok_webm, mime_webm = validate_audio_magic_bytes(webm_bytes, "voice.webm")
        ok_mp4, mime_mp4 = validate_audio_magic_bytes(mp4_bytes, "voice.m4a")
        ok_bad, _ = validate_audio_magic_bytes(spoofed_text, "voice.webm")

        self.assertTrue(ok_webm)
        self.assertEqual("audio/webm", mime_webm)
        self.assertTrue(ok_mp4)
        self.assertEqual("audio/mp4", mime_mp4)
        self.assertFalse(ok_bad)

        client = TestClient(app)
        with (
            patch("app.api.router.settings.DEBUG", True),
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", ""),
        ):
            res = client.post(
                "/api/voice/transcribe",
                files={"file": ("voice.webm", spoofed_text, "audio/webm")},
            )
            self.assertEqual(400, res.status_code)

    def test_internal_token_guard_rejects_invalid_header_and_fail_closed_when_not_debug(self):
        client = TestClient(app)
        valid_webm = b"\x1a\x45\xdf\xa3" + b"\x00" * 32

        with (
            patch("app.api.router.settings.DEBUG", False),
            patch("app.api.router.settings.AI_INTERNAL_TOKEN", ""),
        ):
            prod_res = client.post(
                "/api/voice/transcribe",
                files={"file": ("voice.webm", valid_webm, "audio/webm")},
            )
            self.assertEqual(403, prod_res.status_code)

        with patch("app.api.router.settings.AI_INTERNAL_TOKEN", "super-secret-voice-token"):
            missing_res = client.post(
                "/api/voice/transcribe",
                files={"file": ("voice.webm", valid_webm, "audio/webm")},
            )
            self.assertEqual(403, missing_res.status_code)

            wrong_res = client.post(
                "/api/voice/transcribe",
                files={"file": ("voice.webm", valid_webm, "audio/webm")},
                headers={"X-Internal-AI-Token": "wrong-token"},
            )
            self.assertEqual(403, wrong_res.status_code)

            # Duplicate /api/ai/transcribe alias was removed
            alias_res = client.post(
                "/api/ai/transcribe",
                files={"file": ("voice.webm", valid_webm, "audio/webm")},
                headers={"X-Internal-AI-Token": "super-secret-voice-token"},
            )
            self.assertEqual(404, alias_res.status_code)

            with patch("app.core.config.settings.GROQ_API_KEY", ""):
                ok_res = client.post(
                    "/api/voice/transcribe",
                    files={"file": ("voice.webm", valid_webm, "audio/webm")},
                    headers={"X-Internal-AI-Token": "super-secret-voice-token"},
                )
                self.assertEqual(200, ok_res.status_code)
                self.assertTrue(ok_res.json().get("fallback"))

    def test_phonetic_postprocess_with_dynamic_entities_and_edge_cases(self):
        # 1. Exact spec example with spoken Barn code, half-bag, and multi-digit Higro product
        norm1, corr1 = postprocess_vietnamese_phonetic(
            "cho nhà a một ăn bốn bao rưỡi cám hi gờ rô năm mốt không",
            entities={
                "barns": ["Nhà A1", "Nhà B2"],
                "products": ["Higro 510", "Cám De Heus 215"],
            },
        )
        self.assertEqual("cho Nhà A1 ăn 4.5 bao cám Higro 510", norm1)
        self.assertTrue(any(c["to"] == "Nhà A1" for c in corr1))
        self.assertTrue(any(c["to"] == "Higro 510" for c in corr1))
        self.assertTrue(any(c["to"] == "4.5 bao" for c in corr1))

        # 2. Fuzzy Levenshtein alignment against dynamically injected entities_json + spoken digits
        norm2, corr2 = postprocess_vietnamese_phonetic(
            "cho chuong bê hai an hai bao cam de heu 215",
            entities={
                "barns": ["Nhà A1", "Chuồng B2"],
                "products": ["Cám De Heus 215", "Higro 510"],
            },
        )
        self.assertEqual("cho Chuồng B2 an 2 bao Cám De Heus 215", norm2)
        self.assertTrue(any(c["to"] == "Cám De Heus 215" for c in corr2))

        # 3. Higro 01, preserved "2 lô gà", and E-Z barn letters ("nhà e2" -> "Nhà E2")
        norm3, _ = postprocess_vietnamese_phonetic("chuyển 2 lô gà từ nhà e2 sang khu j1 cho ăn higro 1")
        self.assertEqual("chuyển 2 lô gà từ Nhà E2 sang Khu J1 cho ăn Higro 01", norm3)


class VoiceServiceAsyncTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        voice_service.reset_circuit_breakers()

    async def test_transcribe_audio_groq_success_hallucination_and_429_fallback(self):
        webm_bytes = b"\x1a\x45\xdf\xa3" + b"\x00" * 32
        with (
            patch("app.services.voice_service.settings.GROQ_API_KEY", "test-groq-key"),
            patch("app.services.voice_service.get_shared_http_client", return_value=None),
            patch("app.services.voice_service.httpx.AsyncClient") as factory,
        ):
            http_mock = AsyncMock()
            factory.return_value.__aenter__.return_value = http_mock

            # 1. Success verbose_json
            ok_resp = MagicMock()
            ok_resp.status_code = 200
            ok_resp.json.return_value = {
                "text": "cho nhà a một ăn bốn bao rưỡi",
                "duration": 2.4,
                "segments": [
                    {
                        "text": "cho nhà a một ăn bốn bao rưỡi",
                        "no_speech_prob": 0.05,
                        "avg_logprob": -0.15,
                        "compression_ratio": 1.1,
                    }
                ],
            }
            http_mock.post.return_value = ok_resp
            res_ok = await voice_service.transcribe_audio(webm_bytes, "voice.webm")
            self.assertFalse(res_ok.fallback)
            self.assertEqual("cho Nhà A1 ăn 4.5 bao", res_ok.text)
            self.assertIsNone(res_ok.rejected_reason)

            # 2. Hallucination rejection
            hal_resp = MagicMock()
            hal_resp.status_code = 200
            hal_resp.json.return_value = {
                "text": "Cảm ơn các bạn đã xem video",
                "duration": 1.8,
                "segments": [
                    {
                        "text": "Cảm ơn các bạn đã xem video",
                        "no_speech_prob": 0.1,
                        "avg_logprob": -0.2,
                        "compression_ratio": 1.1,
                    }
                ],
            }
            http_mock.post.return_value = hal_resp
            res_hal = await voice_service.transcribe_audio(webm_bytes, "voice.webm")
            self.assertEqual("NO_SPEECH_OR_HALLUCINATION", res_hal.rejected_reason)
            self.assertEqual("", res_hal.text)

            # 3. Groq 429 falls back cleanly to WEB_SPEECH_FALLBACK
            err_resp = MagicMock()
            err_resp.status_code = 429
            http_mock.post.return_value = err_resp
            res_fb = await voice_service.transcribe_audio(webm_bytes, "voice.webm")
            self.assertTrue(res_fb.fallback)
            self.assertEqual("WEB_SPEECH_FALLBACK", res_fb.provider)

    async def test_chat_completion_groq_openai_fallback_and_conditional_json_mode(self):
        with (
            patch("app.services.voice_service.settings.GROQ_API_KEY", "groq-key"),
            patch("app.services.voice_service.settings.OPENAI_API_KEY", "openai-key"),
            patch("app.services.voice_service.get_shared_http_client", return_value=None),
            patch("app.services.voice_service.httpx.AsyncClient") as factory,
        ):
            http_mock = AsyncMock()
            factory.return_value.__aenter__.return_value = http_mock

            # 1. Groq 200 with plain text prompt omits response_format json_object
            groq_ok = MagicMock()
            groq_ok.status_code = 200
            groq_ok.json.return_value = {"choices": [{"message": {"content": "Xin chào"}}]}
            http_mock.post.return_value = groq_ok
            res1 = await voice_service.chat_completion(
                AssistantChatRequest(message="Hỏi cách úm gà", systemPrompt="Bạn là bác sĩ thú y")
            )
            self.assertFalse(res1.fallback)
            self.assertEqual("Xin chào", res1.content)
            self.assertNotIn("response_format", http_mock.post.call_args.kwargs["json"])

            # 2. Groq empty choices -> OpenAI fallback with JSON mode
            groq_empty = MagicMock()
            groq_empty.status_code = 200
            groq_empty.json.return_value = {"choices": []}
            openai_ok = MagicMock()
            openai_ok.status_code = 200
            openai_ok.json.return_value = {"choices": [{"message": {"content": '{"intent":"GENERAL_QNA"}'}}]}
            http_mock.post.side_effect = [groq_empty, openai_ok]
            res2 = await voice_service.chat_completion(
                AssistantChatRequest(message="Trả lời JSON", systemPrompt="Return JSON")
            )
            self.assertFalse(res2.fallback)
            self.assertEqual('{"intent":"GENERAL_QNA"}', res2.content)
            self.assertEqual({"type": "json_object"}, http_mock.post.call_args.kwargs["json"]["response_format"])

            # 3. Both providers fail -> LOCAL_FALLBACK
            err = MagicMock()
            err.status_code = 500
            http_mock.post.side_effect = [err, err]
            res3 = await voice_service.chat_completion(AssistantChatRequest(message="Test"))
            self.assertTrue(res3.fallback)
            self.assertEqual("LOCAL_FALLBACK", res3.provider)

    async def test_chat_completion_history_window_cap_and_circuit_breaker_fail_fast(self):
        long_history = [
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"Turn {i}"}
            for i in range(10)
        ]
        with (
            patch("app.services.voice_service.settings.GROQ_API_KEY", "groq-key"),
            patch("app.services.voice_service.settings.OPENAI_API_KEY", "openai-key"),
            patch("app.services.voice_service.get_shared_http_client", return_value=None),
            patch("app.services.voice_service.httpx.AsyncClient") as factory,
        ):
            http_mock = AsyncMock()
            factory.return_value.__aenter__.return_value = http_mock

            # 1. History must be capped at 6 turns (+ system + user = 8 messages)
            ok_resp = MagicMock()
            ok_resp.status_code = 200
            ok_resp.json.return_value = {
                "usage": {"prompt_tokens": 50, "completion_tokens": 10, "total_tokens": 60},
                "choices": [{"message": {"content": '{"intent":"GENERAL_QNA"}'}}],
            }
            http_mock.post.return_value = ok_resp

            res_ok = await voice_service.chat_completion(
                AssistantChatRequest(
                    message="Hỏi tiếp",
                    systemPrompt="Return JSON",
                    history=long_history,
                )
            )
            self.assertFalse(res_ok.fallback)
            sent_messages = http_mock.post.call_args.kwargs["json"]["messages"]
            self.assertEqual(8, len(sent_messages))
            self.assertEqual("Turn 4", sent_messages[1]["content"])
            self.assertEqual("Turn 9", sent_messages[6]["content"])

            # 2. 3 consecutive 500 errors open Groq & OpenAI chat breakers -> 4th call fails fast without HTTP
            http_mock.post.reset_mock()
            err_500 = MagicMock()
            err_500.status_code = 500
            http_mock.post.return_value = err_500

            for _ in range(3):
                fb = await voice_service.chat_completion(AssistantChatRequest(message="Test fail"))
                self.assertTrue(fb.fallback)
            self.assertEqual(6, http_mock.post.call_count)

            fb_fast = await voice_service.chat_completion(AssistantChatRequest(message="Fast fail"))
            self.assertTrue(fb_fast.fallback)
            self.assertEqual("LOCAL_FALLBACK", fb_fast.provider)
            self.assertEqual(6, http_mock.post.call_count)

    def test_settings_debug_validator_handles_non_boolean_env_strings(self):
        from app.core.config import Settings

        self.assertFalse(Settings(DEBUG="release").DEBUG)
        self.assertFalse(Settings(DEBUG="false").DEBUG)
        self.assertTrue(Settings(DEBUG="true").DEBUG)
        self.assertTrue(Settings(DEBUG="1").DEBUG)

    def test_shared_phonetic_lexicon_parity_and_new_terms(self):
        import json
        from pathlib import Path

        repo_root = Path(__file__).resolve().parents[2]
        shared_path = repo_root / "shared" / "phonetic_lexicon.json"
        ai_res_path = repo_root / "aiServiceFarmShift" / "app" / "resources" / "phonetic_lexicon.json"
        be_res_path = repo_root / "backendFarmShift" / "src" / "main" / "resources" / "phonetic_lexicon.json"

        self.assertTrue(shared_path.is_file())
        shared_data = json.loads(shared_path.read_text(encoding="utf-8"))
        self.assertEqual(shared_data, json.loads(ai_res_path.read_text(encoding="utf-8")))
        self.assertEqual(shared_data, json.loads(be_res_path.read_text(encoding="utf-8")))

        norm, _ = postprocess_vietnamese_phonetic(
            "tiêm ma réc, pha gờ lu cô ka xê, trị hàn cốc và xịt bê ka xê 80% cho gà lạc thủy"
        )
        self.assertIn("Marek", norm)
        self.assertIn("Gluco-K-C", norm)
        self.assertIn("Toltrazuril", norm)
        self.assertIn("BKC 80%", norm)
        self.assertIn("Gà Lạc Thủy", norm)

    async def test_chat_completion_native_tool_calling_extracts_tool_calls_with_null_content(self):
        sample_tools = [
            {
                "type": "function",
                "function": {
                    "name": "log_feed",
                    "description": "Ghi cám",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "targetBarnName": {"type": "string"},
                            "quantity": {"type": "number"},
                            "unit": {"type": "string", "enum": ["kg", "bao"]},
                        },
                        "required": ["targetBarnName", "quantity", "unit"],
                    },
                },
            }
        ]
        with (
            patch("app.services.voice_service.settings.GROQ_API_KEY", "groq-key"),
            patch("app.services.voice_service.get_shared_http_client", return_value=None),
            patch("app.services.voice_service.httpx.AsyncClient") as factory,
        ):
            http_mock = AsyncMock()
            factory.return_value.__aenter__.return_value = http_mock

            groq_tool_resp = MagicMock()
            groq_tool_resp.status_code = 200
            groq_tool_resp.json.return_value = {
                "choices": [
                    {
                        "message": {
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "call_abc123",
                                    "type": "function",
                                    "function": {
                                        "name": "log_feed",
                                        "arguments": '{"targetBarnName":"Nhà A1","quantity":2,"unit":"bao"}',
                                    },
                                }
                            ],
                        }
                    }
                ]
            }
            http_mock.post.return_value = groq_tool_resp

            res = await voice_service.chat_completion(
                AssistantChatRequest(
                    message="Cho Nhà A1 ăn 2 bao cám",
                    systemPrompt="Return JSON or call tool",
                    tools=sample_tools,
                    toolChoice="auto",
                )
            )
            self.assertFalse(res.fallback)
            self.assertEqual("", res.content)
            self.assertIsNotNone(res.tool_calls)
            self.assertEqual(1, len(res.tool_calls))
            self.assertEqual("log_feed", res.tool_calls[0]["function"]["name"])

            sent_payload = http_mock.post.call_args.kwargs["json"]
            self.assertEqual(sample_tools, sent_payload["tools"])
            self.assertEqual("auto", sent_payload["tool_choice"])
            self.assertNotIn("response_format", sent_payload)


if __name__ == "__main__":
    unittest.main()
