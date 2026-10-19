import React from 'react';
import { createPortal } from 'react-dom';
import { readMoneyToVietnameseWords } from '../../utils/vietnameseWords';

export const PrintablePurchaseVoucher = ({ order, farmInfo = null, onScreenPreview = false }) => {
  if (!order) return null;

  const farm = farmInfo || {
    name: 'TRANG TRẠI MIẾN BÌNH',
    address: 'F9GP+G25 nhà Miền Bính, xã Yên Lãng, tỉnh Phú Thọ',
    phone: '0988.111.222'
  };

  const invoiceDateStr = order.invoiceDate || order.date || new Date().toISOString().split('T')[0];
  const dateObj = new Date(invoiceDateStr);
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();

  const items = order.items || [];
  const subtotal = items.reduce((sum, it) => sum + (Number(it.qty || it.quantity || 0) * Number(it.price || it.unitPrice || 0)), 0);
  const discount = Number(order.discountAmount || 0);
  const otherCost = Number(order.otherCost || 0);
  const totalAmount = Number(order.totalAmount || (subtotal - discount + otherCost));
  const paidAmount = Number(order.paidAmount || 0);
  const debtAmount = Number(order.debtAmount || Math.max(0, totalAmount - paidAmount));

  const screenContainerStyle = {
    backgroundColor: '#ffffff',
    color: '#111111',
    padding: '24px 28px',
    borderRadius: 'var(--rounded-md)',
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
          <div style={{ fontWeight: 700 }}>Mẫu số 01 - VT</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#444' }}>(Ban hành theo TT số 200/2014/TT-BTC)</div>
          <div style={{ marginTop: '4px' }}>Số: <strong style={{ fontSize: '13px' }}>{order.code}</strong></div>
          {order.referenceCode && (
            <div style={{ fontSize: '11.5px', color: '#333' }}>Kèm theo HĐ: <strong>{order.referenceCode}</strong></div>
          )}
        </div>
      </div>

      {/* ── 2. Tiêu đề chính ── */}
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
          PHIẾU NHẬP KHO
        </h1>
        <div style={{ fontStyle: 'italic', fontSize: '13px', color: '#333' }}>
          Ngày {day < 10 ? `0${day}` : day} tháng {month < 10 ? `0${month}` : month} năm {year}
        </div>
      </div>

      {/* ── 3. Thông tin chung ── */}
      <div style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
          <div>- Đơn vị cung cấp (Người bán): <strong>{order.supplier || '—'}</strong></div>
          <div>- Điện thoại NCC: <strong>{order.supplierPhone || '—'}</strong></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
          <div>- Nhập tại kho: <strong>Kho chính - {farm.name}</strong></div>
          <div>- Trạng thái lưu kho: <strong>{order.stockStatus || 'Đã nhập kho'}</strong></div>
        </div>
        <div>
          - Lý do nhập kho / Diễn giải: <em>{order.note || 'Nhập hàng hóa, vật tư thức ăn theo đơn mua hàng.'}</em>
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
            <th style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'left' }}>Tên, nhãn hiệu, quy cách hàng hóa</th>
            <th style={{ border: '1px solid #111', padding: '6px 6px', width: '90px' }}>ĐVT</th>
            <th style={{ border: '1px solid #111', padding: '6px 6px', width: '70px' }}>SL chứng từ</th>
            <th style={{ border: '1px solid #111', padding: '6px 6px', width: '70px' }}>SL thực nhập</th>
            <th style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', width: '100px' }}>Đơn giá (đ)</th>
            <th style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', width: '115px' }}>Thành tiền (đ)</th>
          </tr>
          <tr style={{ fontSize: '11px', fontStyle: 'italic', textAlign: 'center', backgroundColor: '#fafafa' }}>
            <td style={{ border: '1px solid #111', padding: '2px' }}>A</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>B</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>C</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>1</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>2</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>3</td>
            <td style={{ border: '1px solid #111', padding: '2px' }}>4 = 2 x 3</td>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const qty = Number(it.qty || it.quantity || 0);
            const price = Number(it.price || it.unitPrice || 0);
            const lineAmt = Number(it.amount || (qty * price));
            return (
              <tr key={idx}>
                <td style={{ border: '1px solid #111', padding: '6px 4px', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #111', padding: '6px 8px' }}>
                  <strong>{it.name}</strong>
                  {it.vatRate ? <span style={{ fontSize: '11px', color: '#555' }}> (VAT {it.vatRate}%)</span> : null}
                </td>
                <td style={{ border: '1px solid #111', padding: '6px 6px', textAlign: 'center' }}>{it.unit || 'Cái'}</td>
                <td style={{ border: '1px solid #111', padding: '6px 6px', textAlign: 'center' }}>{qty.toLocaleString('vi-VN')}</td>
                <td style={{ border: '1px solid #111', padding: '6px 6px', textAlign: 'center', fontWeight: 600 }}>{qty.toLocaleString('vi-VN')}</td>
                <td style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right' }}>{price.toLocaleString('vi-VN')}</td>
                <td style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{lineAmt.toLocaleString('vi-VN')}</td>
              </tr>
            );
          })}

          {/* Dòng cộng tiền hàng */}
          <tr>
            <td colSpan={6} style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
              Cộng tiền hàng:
            </td>
            <td style={{ border: '1px solid #111', padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
              {subtotal.toLocaleString('vi-VN')}
            </td>
          </tr>

          {discount > 0 && (
            <tr>
              <td colSpan={6} style={{ border: '1px solid #111', padding: '4px 8px', textAlign: 'right', fontStyle: 'italic' }}>
                Chiết khấu thương mại:
              </td>
              <td style={{ border: '1px solid #111', padding: '4px 8px', textAlign: 'right', color: '#c00' }}>
                -{discount.toLocaleString('vi-VN')}
              </td>
            </tr>
          )}

          {otherCost > 0 && (
            <tr>
              <td colSpan={6} style={{ border: '1px solid #111', padding: '4px 8px', textAlign: 'right', fontStyle: 'italic' }}>
                Chi phí khác / Vận chuyển / Thuế:
              </td>
              <td style={{ border: '1px solid #111', padding: '4px 8px', textAlign: 'right' }}>
                +{otherCost.toLocaleString('vi-VN')}
              </td>
            </tr>
          )}

          {/* Dòng tổng cộng thanh toán */}
          <tr style={{ backgroundColor: '#f9f9f9' }}>
            <td colSpan={6} style={{ border: '1px solid #111', padding: '8px', textAlign: 'right', fontWeight: 800, fontSize: '13px' }}>
              TỔNG CỘNG THANH TOÁN (VNĐ):
            </td>
            <td style={{ border: '1px solid #111', padding: '8px', textAlign: 'right', fontWeight: 800, fontSize: '13.5px' }}>
              {totalAmount.toLocaleString('vi-VN')}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 5. Bằng chữ & Thanh toán ── */}
      <div style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
        <div>
          - Số tiền viết bằng chữ: <strong style={{ fontStyle: 'italic' }}>{readMoneyToVietnameseWords(totalAmount)}</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px', marginTop: '4px', backgroundColor: '#f9f9f9', padding: '6px 10px', border: '1px dashed #ccc' }}>
          <div>Trạng thái: <strong>{order.paymentStatus || 'Trả sau'}</strong></div>
          <div>Đã trả: <strong style={{ color: '#008a7b' }}>{paidAmount.toLocaleString('vi-VN')} đ</strong></div>
          <div>Còn nợ lại: <strong style={{ color: debtAmount > 0 ? '#ef4565' : '#333' }}>{debtAmount.toLocaleString('vi-VN')} đ</strong></div>
        </div>
      </div>

      {/* ── 6. Chữ ký các bên ── */}
      <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '12.5px', marginBottom: '12px' }}>
        Ngày {day < 10 ? `0${day}` : day} tháng {month < 10 ? `0${month}` : month} năm {year}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          textAlign: 'center',
          fontSize: '12.5px',
          lineHeight: 1.4,
          pageBreakInside: 'avoid'
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>Người lập phiếu</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
          <div style={{ height: '65px' }} />
          <div style={{ fontWeight: 600 }}>Admin12356</div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Người giao hàng</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
          <div style={{ height: '65px' }} />
          <div style={{ fontStyle: 'italic', color: '#888' }}>{order.supplier ? 'Đại diện NCC' : '—'}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Thủ kho nhận hàng</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
          <div style={{ height: '65px' }} />
          <div style={{ fontWeight: 600 }}>Thủ kho Miến Bình</div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Kế toán trưởng / Chủ trại</div>
          <div style={{ fontStyle: 'italic', fontSize: '11px', color: '#555' }}>(Ký, đóng dấu)</div>
          <div style={{ height: '65px' }} />
          <div style={{ fontWeight: 600 }}>Chủ trang trại</div>
        </div>
      </div>
    </>
  );

  if (onScreenPreview) {
    return (
      <div className="farmshift-voucher-on-screen" style={screenContainerStyle}>
        {voucherBody}
      </div>
    );
  }

  if (typeof document === 'undefined') return null;

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
