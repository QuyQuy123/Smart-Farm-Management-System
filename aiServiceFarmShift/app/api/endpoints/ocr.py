import asyncio
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.ocr_schema import InvoiceOcrResponse, PreprocessResponse
from app.services.document_loader import MAX_DOCUMENT_BYTES, detect_document_mime
from app.services.ocr_service import ocr_service
from app.services.weight_slip_ocr import (
    WeightSlipDraft,
    extract_weight_slip as extract_weight_slip_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["AI OCR & Vision"])


@router.post(
    "/extract-invoice",
    response_model=InvoiceOcrResponse,
    summary="Bóc tách hóa đơn & phiếu nhập hàng",
)
async def extract_invoice(file: UploadFile = File(...)):
    """
    Nhận tệp hóa đơn chứng từ (ảnh JPG, PNG, WEBP hoặc PDF tối đa 10MB, 4 trang),
    tiền xử lý ảnh (OpenCV deskew, CLAHE contrast) và trích xuất dữ liệu bảng biểu có cấu trúc.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên một tệp chứng từ.")

    try:
        file_bytes = await file.read(MAX_DOCUMENT_BYTES + 1)
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Tệp chứng từ rỗng.")
        if len(file_bytes) > MAX_DOCUMENT_BYTES:
            raise HTTPException(
                status_code=400, detail="Dung lượng tệp vượt quá 10MB cho phép."
            )

        detected_mime = detect_document_mime(
            file_bytes, file.content_type, allow_pdf=True
        )
        return await ocr_service.extract_invoice(
            file_bytes,
            filename=file.filename or "invoice.png",
            mime=detected_mime,
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Error extracting invoice: %s", type(error).__name__, exc_info=True)
        raise HTTPException(
            status_code=500, detail="Lỗi hệ thống khi bóc tách hóa đơn."
        )
    finally:
        await file.close()


@router.post(
    "/preprocess",
    response_model=PreprocessResponse,
    summary="Kiểm tra tiền xử lý ảnh & phát hiện góc nghiêng",
)
async def preprocess_invoice(file: UploadFile = File(...)):
    """Kiểm tra góc nghiêng của ảnh hóa đơn trước khi bóc tách."""
    if not file:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên một tệp ảnh.")

    try:
        file_bytes = await file.read(MAX_DOCUMENT_BYTES + 1)
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Tệp ảnh rỗng.")
        if len(file_bytes) > MAX_DOCUMENT_BYTES:
            raise HTTPException(
                status_code=400, detail="Dung lượng ảnh vượt quá 10MB cho phép."
            )

        orig_size, enhanced, angle = await asyncio.to_thread(
            ocr_service.preprocess_image_with_meta, file_bytes
        )
        proc_h, proc_w = enhanced.shape[:2]
        return PreprocessResponse(
            original_size=[orig_size[0], orig_size[1]],
            processed_size=[proc_w, proc_h],
            deskew_angle=round(angle, 2),
            message=f"Đã tiền xử lý thành công. Góc nghiêng tự động điều chỉnh: {round(angle, 2)} độ",
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.warning("Preprocess image failed: %s", type(error).__name__)
        raise HTTPException(status_code=400, detail="Không thể tiền xử lý tệp ảnh đã tải lên.")
    finally:
        await file.close()


@router.get(
    "/sample",
    response_model=InvoiceOcrResponse,
    summary="Lấy dữ liệu hóa đơn mẫu thử nghiệm",
)
def get_sample_invoice():
    """Trả về dữ liệu hóa đơn mẫu của Công ty CP Chăn nuôi C.P. Việt Nam để test nhanh."""
    return ocr_service.get_sample_invoice("hoa_don_mau_cp.png")


@router.post(
    "/extract-weight-slip",
    response_model=WeightSlipDraft,
    summary="Bóc tách phiếu cân bán gà bằng OpenAI",
)
async def extract_weight_slip(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên tệp phiếu cân.")

    try:
        content = await file.read(MAX_DOCUMENT_BYTES + 1)
        if not content or len(content) > MAX_DOCUMENT_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Phiếu cân phải có dung lượng từ 1 byte đến 10MB.",
            )
        mime = detect_document_mime(content, file.content_type, allow_pdf=True)
        return await extract_weight_slip_service(content, mime)
    finally:
        await file.close()
