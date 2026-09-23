// src/features/batch/DailyLogForm.jsx
// Form ghi nhật ký hàng ngày — dành cho Worker & Owner
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Button } from '../../components/Button/Button';
import { ArrowLeft, Save, Mic } from 'lucide-react';
import styles from './Batch.module.css';

export const DailyLogForm = () => {
  const { batchId } = useParams();
  const navigate    = useNavigate();

  const today = new Date().toLocaleDateString('vi-VN');

  const [isListening, setIsListening] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);

  const [form, setForm] = useState({
    ngay:         today,
    soConChet:    '',
    kgCam:        '',
    loaiCam:      'CP 512 (Giai đoạn 3)',
    vaccine:      '',
    thuoc:        '',
    nhietDo:      '',
    ghiChu:       '',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleVoiceEntry = () => {
    setIsListening(true);
    // Giả lập ghi âm 3 giây
    setTimeout(() => {
      setIsListening(false);
      setProcessingVoice(true);
      // Giả lập AI xử lý và điền form
      setTimeout(() => {
        setProcessingVoice(false);
        setForm(prev => ({
          ...prev,
          soConChet: '2',
          kgCam: '75',
          loaiCam: 'CP 512 (Giai đoạn 3)',
          ghiChu: 'Gà khỏe, ăn tốt (Nhập liệu bằng AI)',
        }));
      }, 1500);
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // TODO: nối API POST /batches/:batchId/daily-logs
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setSaved(true);
  };

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Lứa gà', path: '/owner-dashboard/batches' },
    { label: batchId, path: `/owner-dashboard/batches/${batchId}` },
    { label: 'Ghi nhật ký' },
  ];

  if (saved) {
    return (
      <DashboardLayout breadcrumbs={BREADCRUMBS}>
        <div style={{ textAlign: 'center', padding: 'var(--sp-xxl)', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: 56, marginBottom: 'var(--sp-md)' }}>✅</div>
          <h2 style={{ fontSize: 'var(--fs-title-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-ink)', marginBottom: 8 }}>
            Đã ghi nhật ký thành công!
          </h2>
          <p style={{ marginBottom: 'var(--sp-lg)' }}>Nhật ký ngày {form.ngay} cho lứa {batchId} đã được lưu.</p>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center' }}>
            <Button variant="ghost" onClick={() => navigate(`/owner-dashboard/batches/${batchId}`)}>
              <ArrowLeft size={14} /> Về chi tiết lứa
            </Button>
            <Button variant="green" onClick={() => { setSaved(false); setForm({ ...form, soConChet: '', kgCam: '', vaccine: '', thuoc: '', nhietDo: '', ghiChu: '' }); }}>
              Ghi thêm
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/owner-dashboard/batches/${batchId}`)}>
            <ArrowLeft size={14} /> Quay lại
          </Button>
          <div>
            <h1 style={{ fontSize: 'var(--fs-title-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-ink)' }}>
              Ghi nhật ký hàng ngày
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Lứa {batchId} · {today}</p>
          </div>
        </div>
        {/* Voice entry simulate */}
        <Button 
          variant={isListening ? 'danger' : 'secondary'} 
          size="sm" 
          onClick={handleVoiceEntry}
          disabled={isListening || processingVoice}
          title="Nhập bằng giọng nói (AI Whisper)"
          style={isListening ? { animation: 'pulse 1.5s infinite' } : {}}
        >
          {isListening ? (
            <><Mic size={14} /> Đang nghe... (Nói: "Hôm nay chết 2 con, ăn 3 bao cám")</>
          ) : processingVoice ? (
            <><Mic size={14} /> AI đang xử lý...</>
          ) : (
            <><Mic size={14} /> Nhập bằng giọng nói</>
          )}
        </Button>
      </div>

      {/* Form */}
      <form className={styles.logForm} onSubmit={handleSubmit}>
        <div className={styles.logFormTitle}>📋 Nhật ký ngày {form.ngay}</div>

        {/* Ngày & Số con chết */}
        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ngày ghi nhận *</label>
            <input
              type="date"
              className={styles.formInput}
              value={form.ngay.split('/').reverse().join('-')}
              onChange={e => {
                const d = e.target.value.split('-').reverse().join('/');
                setForm(prev => ({ ...prev, ngay: d }));
              }}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Số con chết hôm nay *</label>
            <input
              type="number"
              min="0"
              className={styles.formInput}
              placeholder="0"
              value={form.soConChet}
              onChange={handleChange('soConChet')}
              required
            />
          </div>
        </div>

        {/* Cám */}
        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Lượng cám tiêu thụ (kg) *</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className={styles.formInput}
              placeholder="0"
              value={form.kgCam}
              onChange={handleChange('kgCam')}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Loại cám</label>
            <select className={styles.formSelect} value={form.loaiCam} onChange={handleChange('loaiCam')}>
              <option value="CP 510 (Giai đoạn 1)">CP 510 (Giai đoạn 1, 0–14 ngày)</option>
              <option value="CP 511 (Giai đoạn 2)">CP 511 (Giai đoạn 2, 15–35 ngày)</option>
              <option value="CP 512 (Giai đoạn 3)">CP 512 (Giai đoạn 3, 36+ ngày)</option>
            </select>
          </div>
        </div>

        {/* Vaccine & Thuốc */}
        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Vaccine đã dùng (nếu có)</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder="VD: Vaccine ND-IB, Gumboro..."
              value={form.vaccine}
              onChange={handleChange('vaccine')}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Thuốc điều trị (nếu có)</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder="VD: Amoxicillin 5g/lít..."
              value={form.thuoc}
              onChange={handleChange('thuoc')}
            />
          </div>
        </div>

        {/* Nhiệt độ */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Nhiệt độ chuồng cao nhất trong ngày (°C)</label>
          <input
            type="number"
            min="0"
            max="50"
            step="0.1"
            className={styles.formInput}
            placeholder="VD: 30.5"
            value={form.nhietDo}
            onChange={handleChange('nhietDo')}
            style={{ maxWidth: 200 }}
          />
        </div>

        {/* Ghi chú */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú sức khỏe đàn</label>
          <textarea
            className={styles.formTextarea}
            placeholder="VD: Đàn khỏe mạnh, ăn đều. Phát hiện 2 con ho, đã cách ly..."
            value={form.ghiChu}
            onChange={handleChange('ghiChu')}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className={styles.formActions}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/owner-dashboard/batches/${batchId}`)}
          >
            Hủy
          </Button>
          <Button type="submit" variant="green" loading={loading}>
            <Save size={14} /> Lưu nhật ký
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
};
