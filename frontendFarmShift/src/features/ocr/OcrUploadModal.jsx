// src/features/ocr/OcrUploadModal.jsx
// AI OCR Scanner Modal (Feature 8 & 9)
import React, { useState } from 'react';
import { UploadCloud, Scan, X, Save, FileText, CheckCircle } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import styles from './Ocr.module.css';

// Kiểu hóa đơn: 'sale' (Phiếu cân A4) hoặc 'purchase' (Hóa đơn mua cám)
export const OcrUploadModal = ({ type = 'sale', onClose, onConfirm }) => {
  const [step, setStep] = useState(1); // 1: upload, 2: scanning, 3: review
  const [formData, setFormData] = useState({});

  const handleUpload = () => {
    // Simulate choosing file and immediately start scanning
    setStep(2);
    
    // Simulate AI processing
    setTimeout(() => {
      // Mock extracted data based on type
      if (type === 'sale') {
        setFormData({
          ngay: new Date().toLocaleDateString('vi-VN'),
          khachHang: 'Thương lái OCR Demo',
          soLong: 30,
          soCon: 300,
          tongKg: 750.5,
          donGia: 65000,
        });
      } else {
        setFormData({
          ngay: new Date().toLocaleDateString('vi-VN'),
          nhaCungCap: 'Đại lý Cám OCR Demo',
          matHang: 'Cám CP 512',
          soLuong: 100,
          donGia: 320000,
        });
      }
      setStep(3);
    }, 2500); // 2.5s laser scanning
  };

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    onConfirm(formData);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <Scan size={20} color="#3b82f6" />
            AI Scanner — {type === 'sale' ? 'Phiếu cân bán gà' : 'Hóa đơn nhập hàng'}
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>

        <div className={styles.body}>
          {step === 1 && (
            <div className={styles.uploadArea} onClick={handleUpload}>
              <UploadCloud size={48} className={styles.uploadIcon} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 8 }}>
                Tải lên hoặc chụp ảnh hóa đơn
              </h3>
              <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                Hỗ trợ định dạng JPG, PNG, PDF. AI sẽ tự động đọc dữ liệu.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className={styles.scanContainer}>
                <FileText size={80} className={styles.scanImage} />
                <div className={styles.scanLine} />
                <div className={styles.scanOverlay} />
              </div>
              <div style={{ textAlign: 'center', fontWeight: 600, color: '#3b82f6' }}>
                Đang trích xuất dữ liệu bằng AI...
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-farm-green)', fontWeight: 600, marginBottom: 16 }}>
                <CheckCircle size={18} /> Đã trích xuất thành công! Vui lòng kiểm tra lại.
              </div>

              {type === 'sale' ? (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Khách hàng / Thương lái</label>
                    <input className={styles.formInput} value={formData.khachHang} onChange={handleChange('khachHang')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Ngày cân</label>
                    <input className={styles.formInput} value={formData.ngay} onChange={handleChange('ngay')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Số lồng</label>
                    <input type="number" className={styles.formInput} value={formData.soLong} onChange={handleChange('soLong')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tổng số con</label>
                    <input type="number" className={styles.formInput} value={formData.soCon} onChange={handleChange('soCon')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tổng khối lượng (kg)</label>
                    <input type="number" className={styles.formInput} value={formData.tongKg} onChange={handleChange('tongKg')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Đơn giá (đ/kg)</label>
                    <input type="number" className={styles.formInput} value={formData.donGia} onChange={handleChange('donGia')} />
                  </div>
                </div>
              ) : (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nhà cung cấp</label>
                    <input className={styles.formInput} value={formData.nhaCungCap} onChange={handleChange('nhaCungCap')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Ngày lập</label>
                    <input className={styles.formInput} value={formData.ngay} onChange={handleChange('ngay')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Mặt hàng</label>
                    <input className={styles.formInput} value={formData.matHang} onChange={handleChange('matHang')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Số lượng</label>
                    <input type="number" className={styles.formInput} value={formData.soLuong} onChange={handleChange('soLuong')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Đơn giá</label>
                    <input type="number" className={styles.formInput} value={formData.donGia} onChange={handleChange('donGia')} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}><X size={14}/> Hủy</Button>
          {step === 3 && (
            <Button variant="green" onClick={handleSave}><Save size={14}/> Xác nhận & Lưu</Button>
          )}
        </div>
      </div>
    </div>
  );
};
