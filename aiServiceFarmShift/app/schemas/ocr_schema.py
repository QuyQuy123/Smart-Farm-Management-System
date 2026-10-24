from pydantic import BaseModel, Field
from typing import List, Optional

class InvoiceItemSchema(BaseModel):
    name: str = Field(..., description="Tên sản phẩm, cám, thuốc thú y hoặc vắc-xin")
    qty: float = Field(..., description="Số lượng")
    unit: Optional[str] = Field(None, description="Đơn vị tính (Bao, Kg, Chai, Lọ, Can,...)")
    unitPrice: Optional[float] = Field(None, description="Đơn giá (VNĐ)")
    amount: Optional[float] = Field(None, description="Thành tiền (VNĐ)")
    vatRate: Optional[float] = Field(0.0, description="Thuế suất VAT (%)")

class InvoiceOcrResponse(BaseModel):
    isInvoice: bool = Field(True, description="Xác định tệp có phải hóa đơn/phiếu nhập/xuất kho hay không")
    supplierName: Optional[str] = Field(None, description="Tên nhà cung cấp / đối tác xuất hóa đơn")
    supplierTaxCode: Optional[str] = Field(None, description="Mã số thuế bên bán")
    invoiceDate: Optional[str] = Field(None, description="Ngày lập hóa đơn (định dạng YYYY-MM-DD)")
    referenceCode: Optional[str] = Field(None, description="Số hóa đơn / Số phiếu chứng từ")
    items: List[InvoiceItemSchema] = Field(default_factory=list, description="Danh mục chi tiết hàng hóa bóc tách")
    discountAmount: Optional[float] = Field(0.0, description="Chiết khấu thương mại")
    vatAmount: Optional[float] = Field(0.0, description="Tiền thuế GTGT")
    otherCost: Optional[float] = Field(0.0, description="Chi phí khác (vận chuyển, bốc xếp)")
    totalAmount: Optional[float] = Field(0.0, description="Tổng số tiền thanh toán")
    paidAmount: Optional[float] = Field(0.0, description="Số tiền đã thanh toán trước (nếu có)")
    paymentStatus: Optional[str] = Field("Trả sau", description="Trạng thái thanh toán (Trả sau | Thanh toán một phần | Thanh toán hoàn tất)")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Độ tin cậy bóc tách (0 - 100%)")
    engine: str = Field("FastAPI-Vision-Engine", description="Tên engine AI thực hiện bóc tách")
    warnings: List[str] = Field(default_factory=list, description="Các cảnh báo lệch số liệu hoặc nghi ngờ")

class PreprocessResponse(BaseModel):
    original_size: List[int]
    processed_size: List[int]
    deskew_angle: float
    message: str
