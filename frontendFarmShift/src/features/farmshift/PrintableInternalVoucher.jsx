// src/features/farmshift/PrintableInternalVoucher.jsx
// Mẫu in A4 chuẩn chứng từ xuất nhập kho nội bộ FarmShift
import React from 'react';
import { createPortal } from 'react-dom';
import { readMoneyToVietnameseWords } from '../../utils/vietnameseWords';

export const PrintableInternalVoucher = ({ voucher, farmInfo = null, onScreenPreview = false }) => {
  if (!voucher) return null;

  const farm = farmInfo || {
    name: 'TRANG TRẠI MIỀN BÍNH',
    address: 'Xã Yên Lãng, tỉnh Phú Thọ',
    phone: '0988.111.222'
  };

  const voucherDateStr = voucher.movementDate || voucher.date || new Date().toISOString().split('T')[0];
  const dateObj = new Date(voucherDateStr);
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();

  const isImport = voucher.movementType === 'IMPORT';
  const isExport = voucher.movementType === 'EXPORT';
  const isTransfer = voucher.movementType === 'TRANSFER';

  const title = isImport
    ? 'PHIẾU NHẬP KHO NỘI BỘ'
    : isExport
    ? 'PHIẾU XUẤT KHO NỘI BỘ'
    : 'PHIẾU CHUYỂN KHO NỘI BỘ';

  const formCode = isImport ? 'Mẫu số 01 - VT' : isExport ? 'Mẫu số 02 - VT' : 'Mẫu số 03 - VT';

  const items = voucher.items || [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const hasFinance = voucher.totalAmount !== null && voucher.totalAmount !== undefined;
  const totalAmount = hasFinance ? Number(voucher.totalAmount || 0) : null;

  const screenContainerStyle = {
    backgroundColor: '#ffffff',
    color: '#111111',
    padding: '24px 28px',
    borderRadius: 'var(--rounded-md, 8px)',
    border: '1px solid #dcdcdc',
    fontFamily: '"Times New Roman", Times, serif',
    maxWidth: '720px',
    margin: '0 auto',
    boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
  };

  const printContainerStyle = {
    fontFamily: '"Times New Roman", Times, serif',
    color: '#000000',
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: '100%',
    padding: 0,
    margin: 0
  };

  const voucherBody = (
    <>
      {/* ── 1. Đơn vị & Ký hiệu mẫu chứng từ ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', borderBottom: '1px solid #111', paddingBottom: '10px' }}>
        <div style={{ fontSize: '13px', lineHeight: 1.45 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{farm.name}</div>
          <div>Địa chỉ: {farm.address}</div>
          <div>Điện thoại: {farm.phone}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px', lineHeight: 1.4 }}>
          <div style={{ fontWeight: 700 }}>{formCode}</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#444' }}>(Ban hành theo TT số 200/2014/TT-BTC)</div>
          <div style={{ marginTop: '4px' }}>Số phiếu: <strong style={{ fontSize: '13px' }}>{voucher.code}</strong></div>
          {voucher.status === 'CANCELLED' && (
            <div style={{ color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>[PHIẾU ĐÃ HỦY]</div>
          )}
        </div>
      </div>

      {/* ── 2. Tiêu đề chính ── */}
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
          {title}
        </h1>
        <div style={{ fontStyle: 'italic', fontSize: '13px', color: '#333' }}>
          Ngày {day < 10 ? `0${day}` : day} tháng {month < 10 ? `0${month}` : month} năm {year}
        </div>
      </div>

      {/* ── 3. Thông tin chung ── */}
      <div style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
          <div>- Danh mục: <strong>{voucher.categoryName || '—'}</strong></div>
          <div>- Người lập phiếu: <strong>{voucher.createdBy || 'Hệ thống'}</strong></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
          {voucher.sourceWarehouseName ? (
            <div>- Kho xuất: <strong>{voucher.sourceWarehouseName}</strong></div>
          ) : (
            <div>- Nguồn nhập: <strong>Nhập đầu kì / Kiểm kê</strong></div>
          )}
          {voucher.targetWarehouseName ? (
            <div>- Kho nhập: <strong>{voucher.targetWarehouseName}</strong></div>
          ) : (
            <div>- Điểm đến: <strong>Xuất hủy / Tiêu hao nội bộ</strong></div>
          )}
        </div>
        {(voucher.cycleCode || voucher.cycleName) && (
          <div>- Lứa nuôi hạch toán: <strong>{voucher.cycleCode || voucher.cycleName}</strong></div>
        )}
        <div>
          - Diễn giải / Lý do: <em>{voucher.note || voucher.description || 'Xuất nhập kho nội bộ phục vụ sản xuất trang trại.'}</em>
        </div>
      </div>

      {/* ── 4. Bảng kê chi tiết hàng hóa ── */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12.5px',
          marginBottom: '14px',
          border: '1px solid #111'
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2', textAlign: 'center' }}>
            <th style={{ border: '1px solid #111', padding: '6px 4px', width: '38px' }}>STT</th>
            <th style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'left' }}>Tên hàng hóa, vật tư</th>
            <th style={{ border: '1px solid #111', padding: '6px 6px', width: '80px' }}>ĐVT</th>
            <th style={{ border: '1px solid #111', padding: '6px 6px', width: '90px' }}>Số lượng</th>
            {hasFinance && (
              <>
                <th style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', width: '100px' }}>Đơn giá (đ)</th>
                <th style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', width: '120px' }}>Thành tiền (đ)</th>
              </>
            )}
            <th style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'left', width: '130px' }}>Ghi chú</th>
          </tr>
          <tr style={{ fontSize: '11px', fontStyle: 'italic', textAlign: 'center', backgroundColor: '#fafafa' }}>
            <td style={{ border: '1px solid #111', padding: '2px' }}>A</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>B</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>C</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>1</td>
            {hasFinance && (
              <>
                <td style={{ border: '1px solid #111', padding: '2px' }}>2</td>
                <td style={{ border: '1px solid #111', padding: '2px' }}>3 = 1 x 2</td>
              </>
            )}
            <td style={{ border: '1px solid #111', padding: '2px' }}>D</td>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const qty = Number(it.quantity || 0);
            const price = hasFinance && it.unitPrice !== null ? Number(it.unitPrice) : null;
            const lineAmt = hasFinance && it.amount !== null ? Number(it.amount) : null;
            return (
              <tr key={it.id || idx}>
                <td style={{ border: '1px solid #111', padding: '6px 4px', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #111', padding: '6px 8px' }}>
                  <strong>{it.productName || 'Hàng hóa'}</strong>
                </td>
                <td style={{ border: '1px solid #111', padding: '6px 6px', textAlign: 'center' }}>{it.unitName || '—'}</td>
                <td style={{ border: '1px solid #111', padding: '6px 6px', textAlign: 'center', fontWeight: 600 }}>
                  {qty.toLocaleString('vi-VN')}
                </td>
                {hasFinance && (
                  <>
                    <td style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right' }}>
                      {price !== null ? price.toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {lineAmt !== null ? lineAmt.toLocaleString('vi-VN') : '—'}
                    </td>
                  </>
                )}
                <td style={{ border: '1px solid #111', padding: '6px 8px', fontSize: '11.5px', color: '#444' }}>
                  {it.note || '—'}
                </td>
              </tr>
            );
          })}

          {/* Dòng tổng cộng */}
          <tr>
            <td colSpan={3} style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
              Tổng cộng:
            </td>
            <td style={{ border: '1px solid #111', padding: '6px 6px', textAlign: 'center', fontWeight: 700 }}>
              {totalQty.toLocaleString('vi-VN')}
            </td>
            {hasFinance && (
              <>
                <td style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right' }}>—</td>
                <td style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                  {totalAmount !== null ? totalAmount.toLocaleString('vi-VN') : '—'}
                </td>
              </>
            )}
            <td style={{ border: '1px solid #111', padding: '6px 8px' }}></td>
          </tr>
        </tbody>
      </table>

      {/* Số tiền viết bằng chữ nếu có tài chính */}
      {hasFinance && totalAmount !== null && (
        <div style={{ fontSize: '13px', fontStyle: 'italic', marginBottom: '18px' }}>
          Tổng số tiền (viết bằng chữ): <strong>{readMoneyToVietnameseWords(totalAmount)}</strong>
        </div>
      )}

      {/* ── 5. Chữ ký xác nhận ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isTransfer ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '8px', marginTop: '24px', textAlign: 'center', fontSize: '12.5px' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Người lập phiếu</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, họ tên)</div>
          <div style={{ marginTop: '54px', fontWeight: 600 }}>{voucher.createdBy || farm.name}</div>
        </div>

        {isImport && (
          <div>
            <div style={{ fontWeight: 700 }}>Người giao hàng</div>
            <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, họ tên)</div>
            <div style={{ marginTop: '54px', color: '#777' }}>........................</div>
          </div>
        )}

        {isExport && (
          <div>
            <div style={{ fontWeight: 700 }}>Người nhận hàng</div>
            <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, họ tên)</div>
            <div style={{ marginTop: '54px', color: '#777' }}>........................</div>
          </div>
        )}

        {isTransfer ? (
          <>
            <div>
              <div style={{ fontWeight: 700 }}>Thủ kho xuất</div>
              <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, họ tên)</div>
              <div style={{ marginTop: '54px', color: '#777' }}>........................</div>
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Thủ kho nhập</div>
              <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, họ tên)</div>
              <div style={{ marginTop: '54px', color: '#777' }}>........................</div>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontWeight: 700 }}>Thủ kho</div>
            <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, họ tên)</div>
            <div style={{ marginTop: '54px', color: '#777' }}>........................</div>
          </div>
        )}

        <div>
          <div style={{ fontWeight: 700 }}>Kế toán trưởng / Chủ trại</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, đóng dấu)</div>
          <div style={{ marginTop: '54px', color: '#777' }}>........................</div>
        </div>
      </div>
    </>
  );

  if (onScreenPreview) {
    return <div style={screenContainerStyle}>{voucherBody}</div>;
  }

  // Chế độ in trình duyệt A4 (sử dụng container farmshift-printable-voucher)
  return createPortal(
    <div
      className="farmshift-printable-voucher"
      id="farmshift-printable-voucher"
      style={printContainerStyle}
    >
      {voucherBody}
    </div>,
    document.body
  );
};
