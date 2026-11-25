"""Core 10 OpenAI/Groq JSON Schema tools and System Prompt for FarmShift LLM-First Agent.

Aligns 1:1 with backendFarmShift Tool Calling executors and RBAC boundaries:
- Read tools (Group A): auto-executed against PostgreSQL (RBAC filtered), results synthesized by LLM.
- Write tools (Group B): always produce HMAC-SHA256 2-step HITL confirmation cards on Backend.
"""
from __future__ import annotations

from typing import Any

DEFAULT_LLM_FIRST_SYSTEM_PROMPT = (
    "Bạn là Trợ lý AI điều hành trang trại FarmShift. Trả lời bằng tiếng Việt tự nhiên, "
    "ngắn gọn, đi thẳng vào trọng tâm như một kỹ sư chăn nuôi kiêm quản lý trại.\n"
    "1. KHÔNG ĐOÁN MÒ SỐ LIỆU: Mọi câu hỏi về số liệu thực tế của trang trại (số con, FCR, "
    "tồn kho, công nợ, việc hôm nay, tình hình chung) BẮT BUỘC phải gọi Tool tương ứng. "
    "Tuyệt đối không tự bịa số.\n"
    "2. LINH HOẠT NGÔN NGỮ TỰ NHIÊN & LỖI GÕ: Hiểu được tiếng lóng, viết tắt, câu hỏi mở "
    "('hôm nay có gì mới', 'có biến gì không', 'chuồng nào đang toang FCR', 'chuồng nào đang yếu') "
    "và lỗi chính tả nhẹ ('holo', 'helo', 'alo em ơi', 'nhà a một'). Với lời chào xã giao, đáp lại "
    "ngắn gọn, thân thiện trong 1–2 câu theo ngữ cảnh màn hình đang mở — KHÔNG dùng câu từ chối cứng nhắc.\n"
    "3. SUY LUẬN CHUYÊN MÔN THÚ Y: Với câu hỏi về bệnh gà, triệu chứng (khò khè, vẩy mỏ, phân sáp...), "
    "dinh dưỡng, lịch vắc-xin, kỹ thuật úm, hãy gọi search_vet_knowledge (gộp triệu chứng vào 1 truy vấn) "
    "kết hợp kiến thức thú y để tư vấn rõ ràng (nguyên nhân có thể -> hướng xử lý ngay -> lưu ý phòng ngừa). "
    "Tuyệt đối không tư vấn bệnh hay thuốc cho người.\n"
    "4. GHI DỮ LIỆU AN TOÀN: Chỉ gọi Write Tool khi đủ tham số bắt buộc (1 bao cám = 25 kg). "
    "Với log_feed_consumption, chỉ cần barn_name + quantity + unit là gọi tool NGAY — KHÔNG hỏi lại tên loại cám "
    "(feed_name là tùy chọn, hệ thống tự lấy theo chương trình nuôi/tồn kho). "
    "Chỉ hỏi lại đúng 1 câu ngắn gọn khi thiếu tham số BẮT BUỘC (VD: 'ghi cám giúp anh' thiếu chuồng và số lượng).\n"
    "5. TÔN TRỌNG PHÂN QUYỀN: ROLE_FARM_OWNER và ROLE_ACCOUNTANT có ĐẦY ĐỦ quyền gọi get_financial_and_debts "
    "để tra cứu công nợ, doanh thu, lãi lỗ. Chỉ khi user_role là ROLE_FARM_WORKER hỏi về lãi lỗ, doanh thu, "
    "giá bán, công nợ hay chuồng không được phân công mới lịch sự từ chối theo chính sách phân quyền."
)


def _fn_tool(
    name: str,
    description: str,
    properties: dict[str, Any],
    required: list[str],
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


# Group A: Read-Only Tools
TOOL_GET_DASHBOARD_SUMMARY = _fn_tool(
    name="get_dashboard_summary",
    description=(
        "Lấy bản tin tổng quan trang trại hôm nay: tổng đàn, hao hụt, việc quá giờ, "
        "cảnh báo FCR, tồn kho thấp, công nợ (ẩn tiền & công nợ với Công nhân). "
        "Gọi khi người dùng hỏi 'hôm nay có gì mới', 'tình hình trại', 'có biến gì không', "
        "'báo cáo nhanh', 'cần xử lý gì trước', 'tổng quan hôm nay'."
    ),
    properties={
        "date": {
            "type": "string",
            "description": "Ngày cần xem định dạng YYYY-MM-DD (tùy chọn, mặc định hôm nay).",
        }
    },
    required=[],
)

TOOL_GET_BARN_STATUS = _fn_tool(
    name="get_barn_status",
    description=(
        "Xem chi tiết tình trạng 1 chuồng hoặc tất cả chuồng đang nuôi: số con, ngày tuổi, "
        "cân mẫu gần nhất, FCR, tỷ lệ hao hụt, nhiệt độ mục tiêu và cảm biến IoT nếu có. "
        "Gọi khi hỏi 'nhà B2 sao rồi', 'chuồng nào đang toang FCR nhất?', 'chuồng nào hao hụt cao nhất', "
        "'đàn gà nhà A1 bao nhiêu ngày tuổi'."
    ),
    properties={
        "barn_name": {
            "type": "string",
            "description": "Tên chuồng cần xem (VD: 'Nhà A1', 'Nhà B2'). Bỏ trống để xem tất cả chuồng.",
        },
        "sort_by": {
            "type": "string",
            "enum": ["fcr", "mortality", "age"],
            "description": "Sắp xếp danh sách chuồng giảm dần theo chỉ số: fcr, mortality hoặc age.",
        },
    },
    required=[],
)

TOOL_GET_TODAY_TASKS = _fn_tool(
    name="get_today_tasks",
    description=(
        "Lấy danh sách việc hôm nay (cữ cám, vắc-xin, thuốc, việc giao thêm), "
        "lọc theo trạng thái chưa làm / quá giờ / đã xong."
    ),
    properties={
        "barn_name": {
            "type": "string",
            "description": "Tên chuồng cần lọc (tùy chọn).",
        },
        "status": {
            "type": "string",
            "enum": ["pending", "overdue", "done", "all"],
            "description": "Trạng thái công việc cần lọc (mặc định 'all').",
        },
        "date": {
            "type": "string",
            "description": "Ngày YYYY-MM-DD (tùy chọn, mặc định hôm nay).",
        },
    },
    required=[],
)

TOOL_GET_INVENTORY_STOCK = _fn_tool(
    name="get_inventory_stock",
    description=(
        "Kiểm tra tồn kho cám, thuốc thú y, vắc-xin theo kho hoặc tên sản phẩm, "
        "hoặc lọc các mặt hàng sắp hết / tồn thấp (ẩn giá vốn với Công nhân)."
    ),
    properties={
        "product_name": {
            "type": "string",
            "description": "Tên sản phẩm / loại cám / thuốc cần kiểm tra (tùy chọn).",
        },
        "warehouse_name": {
            "type": "string",
            "description": "Tên kho cần lọc (tùy chọn).",
        },
        "low_stock_only": {
            "type": "boolean",
            "description": "True nếu chỉ lấy mặt hàng sắp cạn / tồn thấp.",
        },
    },
    required=[],
)

TOOL_GET_FINANCIAL_AND_DEBTS = _fn_tool(
    name="get_financial_and_debts",
    description=(
        "Tra cứu công nợ nhà cung cấp (nợ NCC nào nhiều nhất, hóa đơn chưa trả), "
        "công nợ khách hàng phải thu, doanh thu và lãi/lỗ P&L trang trại theo toàn kỳ hoặc khoảng ngày. "
        "Dành cho Chủ trại (ROLE_FARM_OWNER) và Kế toán (ROLE_ACCOUNTANT)."
    ),
    properties={
        "scope": {
            "type": "string",
            "enum": ["supplier_debt", "customer_debt", "pnl", "summary"],
            "description": (
                "Phạm vi tra cứu: 'supplier_debt' (nợ nhà cung cấp), 'customer_debt' (khách nợ), "
                "'pnl' (doanh thu, chi phí, lãi lỗ), hoặc 'summary' (tổng hợp tài chính & công nợ)."
            ),
        },
        "partner_name": {
            "type": "string",
            "description": "Tên nhà cung cấp hoặc khách hàng cụ thể nếu có (tùy chọn).",
        },
        "from_date": {
            "type": "string",
            "description": "Ngày bắt đầu lọc P&L định dạng YYYY-MM-DD (tùy chọn).",
        },
        "to_date": {
            "type": "string",
            "description": "Ngày kết thúc lọc P&L định dạng YYYY-MM-DD (tùy chọn).",
        },
    },
    required=["scope"],
)

TOOL_SEARCH_VET_KNOWLEDGE = _fn_tool(
    name="search_vet_knowledge",
    description=(
        "Tra cứu phác đồ thú y gia cầm, bệnh gà (khò khè, vẩy mỏ, CRD, ORT, Coryza, cầu trùng, "
        "Gumboro, Newcastle), lịch vắc-xin và kỹ thuật úm trong kho tài liệu RAG nội bộ của trại."
    ),
    properties={
        "query": {
            "type": "string",
            "description": "Triệu chứng, tên bệnh, độ tuổi gà hoặc kỹ thuật chăn nuôi cần tra cứu.",
        }
    },
    required=["query"],
)

# Group B: Write Tools (2-step HITL confirmation)
TOOL_LOG_FEED_CONSUMPTION = _fn_tool(
    name="log_feed_consumption",
    description=(
        "Ghi nhận cho chuồng ăn cám (tự quy đổi 1 bao = 25 kg). "
        "Chỉ cần barn_name, quantity và unit là gọi tool NGAY; feed_name là TÙY CHỌN (tuyệt đối KHÔNG hỏi lại loại cám nếu người dùng không nêu, hệ thống tự chọn theo chương trình nuôi). "
        "Chỉ hỏi lại khi thiếu tên chuồng hoặc số lượng."
    ),
    properties={
        "barn_name": {
            "type": "string",
            "description": "Tên chuồng nuôi (VD: 'Nhà A1', 'Nhà B2').",
        },
        "quantity": {
            "type": "number",
            "description": "Số lượng cám (> 0).",
        },
        "unit": {
            "type": "string",
            "enum": ["kg", "bao"],
            "description": "Đơn vị tính ('kg' hoặc 'bao').",
        },
        "feed_name": {
            "type": "string",
            "description": "Tên loại cám nếu người dùng nêu rõ (tùy chọn, bỏ trống để hệ thống tự lấy theo chương trình nuôi).",
        },
    },
    required=["barn_name", "quantity", "unit"],
)

TOOL_LOG_FLOCK_LOSS = _fn_tool(
    name="log_flock_loss",
    description=(
        "Báo cáo ghi nhận gà chết (DEATH) hoặc loại thải (CULL) tại một chuồng nuôi. "
        "Chỉ gọi khi đã có chuồng và số lượng con."
    ),
    properties={
        "barn_name": {
            "type": "string",
            "description": "Tên chuồng nuôi.",
        },
        "quantity": {
            "type": "integer",
            "description": "Số lượng con gà chết hoặc loại thải (> 0).",
        },
        "loss_type": {
            "type": "string",
            "enum": ["DEATH", "CULL"],
            "description": "DEATH (gà chết) hoặc CULL (loại thải).",
        },
        "reason": {
            "type": "string",
            "description": "Nguyên nhân hao hụt (VD: 'sốc nhiệt', 'còi cọc', 'bệnh hô hấp').",
        },
    },
    required=["barn_name", "quantity", "loss_type", "reason"],
)

TOOL_LOG_WEIGHT_SAMPLE = _fn_tool(
    name="log_weight_sample",
    description=(
        "Ghi nhận kết quả cân mẫu trọng lượng bình quân (kg/con) của một chuồng nuôi."
    ),
    properties={
        "barn_name": {
            "type": "string",
            "description": "Tên chuồng nuôi.",
        },
        "avg_weight_kg": {
            "type": "number",
            "description": "Trọng lượng trung bình mỗi con tính bằng kg (> 0).",
        },
        "sample_size": {
            "type": "integer",
            "description": "Số con lấy mẫu cân (tùy chọn, mặc định 50 nếu không nêu).",
        },
    },
    required=["barn_name", "avg_weight_kg"],
)

TOOL_COMPLETE_DAILY_TASK = _fn_tool(
    name="complete_daily_task",
    description=(
        "Xác nhận hoàn thành một phiếu việc hôm nay hoặc công việc được giao tại chuồng nuôi."
    ),
    properties={
        "barn_name": {
            "type": "string",
            "description": "Tên chuồng nuôi.",
        },
        "task_description": {
            "type": "string",
            "description": "Mô tả công việc cần hoàn thành (VD: 'cữ cám sáng', 'rửa máng uống', 'tất cả việc hôm nay').",
        },
    },
    required=["barn_name", "task_description"],
)

ALL_CORE_TOOLS: list[dict[str, Any]] = [
    TOOL_GET_DASHBOARD_SUMMARY,
    TOOL_GET_BARN_STATUS,
    TOOL_GET_TODAY_TASKS,
    TOOL_GET_INVENTORY_STOCK,
    TOOL_GET_FINANCIAL_AND_DEBTS,
    TOOL_SEARCH_VET_KNOWLEDGE,
    TOOL_LOG_FEED_CONSUMPTION,
    TOOL_LOG_FLOCK_LOSS,
    TOOL_LOG_WEIGHT_SAMPLE,
    TOOL_COMPLETE_DAILY_TASK,
]

READ_TOOL_NAMES = frozenset({
    "get_dashboard_summary",
    "get_barn_status",
    "get_today_tasks",
    "get_inventory_stock",
    "get_financial_and_debts",
    "search_vet_knowledge",
})

WRITE_TOOL_NAMES = frozenset({
    "log_feed_consumption",
    "log_flock_loss",
    "log_weight_sample",
    "complete_daily_task",
})


def get_core_tools_for_role(user_role: str | None) -> list[dict[str, Any]]:
    """Return RBAC-filtered core tools for ROLE_FARM_OWNER, ROLE_ACCOUNTANT, or ROLE_FARM_WORKER."""
    role = (user_role or "ROLE_FARM_OWNER").strip().upper()
    is_worker = role == "ROLE_FARM_WORKER"
    is_accountant = role == "ROLE_ACCOUNTANT"

    tools: list[dict[str, Any]] = [
        TOOL_GET_DASHBOARD_SUMMARY,
        TOOL_GET_BARN_STATUS,
        TOOL_GET_TODAY_TASKS,
        TOOL_GET_INVENTORY_STOCK,
    ]
    if not is_worker:
        tools.append(TOOL_GET_FINANCIAL_AND_DEBTS)
    tools.append(TOOL_SEARCH_VET_KNOWLEDGE)

    if not is_accountant:
        tools.extend([
            TOOL_LOG_FEED_CONSUMPTION,
            TOOL_LOG_FLOCK_LOSS,
            TOOL_LOG_WEIGHT_SAMPLE,
            TOOL_COMPLETE_DAILY_TASK,
        ])
    return tools
