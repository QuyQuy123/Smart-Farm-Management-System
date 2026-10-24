from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import logging

from app.schemas.ocr_schema import InvoiceOcrResponse, PreprocessResponse
from app.services.ocr_service import ocr_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["AI OCR & Vision"])

@router.post("/extract-invoice", response_model=InvoiceOcrResponse, summary="Bóc tách hóa đơn & phiếu cân xuất bán A4")
async def extract_invoice(file: UploadFile = File(...)):
    """
    Nhận tệp hóa đơn chứng từ (ảnh JPG, PNG, WEBP hoặc PDF),
    tiền xử lý ảnh (OpenCV deskew, CLAHE contrast) và trích xuất dữ liệu bảng biểu có cấu trúc.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên một tệp chứng từ.")

    content_type = file.content_type or ""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]
    if not any(t in content_type for t in ["image", "pdf"]):
        raise HTTPException(status_code=400, detail="Định dạng tệp không được hỗ trợ. Vui lòng tải lên ảnh hoặc PDF.")

    try:
        file_bytes = await file.read()
        if len(file_bytes) > 15 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dung lượng tệp vượt quá 15MB cho phép.")

        result = await ocr_service.extract_invoice(file_bytes, filename=file.filename or "invoice.png")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting invoice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý bóc tách hóa đơn: {str(e)}")

@router.post("/preprocess", response_model=PreprocessResponse, summary="Kiểm tra tiền xử lý ảnh & phát hiện góc nghiêng")
async def preprocess_invoice(file: UploadFile = File(...)):
    """Kiểm tra góc nghiêng của ảnh hóa đơn trước khi bóc tách."""
    try:
        file_bytes = await file.read()
        enhanced, angle = ocr_service.preprocess_image(file_bytes)
        (h, w) = enhanced.shape[:2]
        return PreprocessResponse(
            original_size=[w, h],
            processed_size=[w, h],
            deskew_angle=round(angle, 2),
            message=f"Đã tiền xử lý thành công. Góc nghiêng tự động điều chỉnh: {round(angle, 2)} độ"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không thể tiền xử lý ảnh: {str(e)}")

@router.get("/sample", response_model=InvoiceOcrResponse, summary="Lấy dữ liệu hóa đơn mẫu thử nghiệm")
def get_sample_invoice():
    """Trả về dữ liệu hóa đơn mẫu của Công ty CP Chăn nuôi C.P. Việt Nam để test nhanh."""
    return ocr_service._rule_based_fallback(b"", "hoa_don_mau_cp.png")
