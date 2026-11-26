import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { importProgramExcel } from '../../services/farmingProgramService';
import { Dialog } from './FarmAreaDialogs';
import { STEP_CATEGORIES, apiErrorMessage, describeStep } from './farmAreaOptions';
import styles from './FarmingPrograms.module.css';

const days = step => (step.dayFrom === step.dayTo ? `Ngày ${step.dayFrom}` : `Ngày ${step.dayFrom}–${step.dayTo}`);

/**
 * Modal nhập chương trình nuôi từ file Excel (.xlsx) theo quy trình 2 bước:
 * 1) Preview & validate 2 tầng (định dạng file + nội dung theo {sheet, row, column, message})
 * 2) Xác nhận lưu (commit) vào hệ thống.
 */
export function FarmingProgramExcelModal({ onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [cellErrors, setCellErrors] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = async event => {
    const picked = event.target.files?.[0] || null;
    event.target.value = '';
    setFile(picked);
    setPreview(null);
    setCellErrors([]);
    setErrorMessage('');
    if (!picked) return;

    if (!picked.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMessage('Chỉ chấp nhận file Excel định dạng .xlsx.');
      setCellErrors([{ sheet: 'File', row: null, column: 'file', message: 'Định dạng file không hợp lệ. Vui lòng chọn file .xlsx.' }]);
      return;
    }
    if (picked.size > 5 * 1024 * 1024) {
      setErrorMessage('Dung lượng file vượt quá giới hạn 5 MB.');
      setCellErrors([{ sheet: 'File', row: null, column: 'file', message: 'Dung lượng file tối đa là 5 MB.' }]);
      return;
    }

    setChecking(true);
    try {
      const result = await importProgramExcel(picked, 'preview');
      if (result?.valid && result?.preview) {
        setPreview(result.preview);
      } else {
        setCellErrors(result?.errors || []);
        setErrorMessage('File Excel có lỗi cần chỉnh sửa trước khi nhập.');
      }
    } catch (requestError) {
      const responseData = requestError.response?.data?.data;
      if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
        setCellErrors(responseData.errors);
        setErrorMessage(requestError.response?.data?.message || 'File Excel có lỗi nội dung hoặc định dạng.');
      } else {
        setErrorMessage(apiErrorMessage(requestError));
      }
    } finally {
      setChecking(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview || committing) return;
    setCommitting(true);
    setErrorMessage('');
    try {
      const result = await importProgramExcel(file, 'commit');
      const savedName = result?.savedProgram?.name || preview.name;
      onSaved(`Đã nhập chương trình ${savedName} từ Excel.`);
    } catch (requestError) {
      const responseData = requestError.response?.data?.data;
      if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
        setCellErrors(responseData.errors);
        setPreview(null);
        setErrorMessage(requestError.response?.data?.message || 'Không thể lưu do phát sinh lỗi kiểm tra.');
      } else {
        setErrorMessage(apiErrorMessage(requestError));
      }
      setCommitting(false);
    }
  };

  const busy = checking || committing;

  return <Dialog title="Nhập chương trình nuôi từ Excel (.xlsx)" labelId="program-excel-import-title" busy={busy} onClose={onClose} wide className={styles.editor}>
    <div className={styles.editorBody}>
      <div className={styles.excelDrop}>
        <label htmlFor="program-excel-file" className={styles.excelPickerLabel}>
          <FileSpreadsheet size={20} />
          <span>{file ? file.name : 'Chọn file Excel (.xlsx) theo mẫu chuẩn 5 sheet'}</span>
        </label>
        <input id="program-excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy} onChange={handleFileChange} className={styles.excelInput} />
        <p className={styles.itemHint}>
          File bắt buộc đúng đuôi <code>.xlsx</code> (tối đa 5 MB) gồm 5 sheet: <strong>ThongTinChung</strong>, <strong>CamDinhMuc</strong>, <strong>LichUongThuoc</strong>, <strong>LichVacXin</strong>, <strong>ThuocTron</strong>.
        </p>
      </div>

      {checking && <p className={styles.empty} role="status">Đang kiểm tra định dạng file và nội dung nghiệp vụ...</p>}

      {errorMessage && <p role="alert" className={styles.error}><AlertCircle size={16} />{errorMessage}</p>}

      {cellErrors.length > 0 && <div className={styles.stepTableWrap}>
        <table className={styles.stepTable} aria-label="Danh sách lỗi file Excel">
          <thead>
            <tr>
              <th>Sheet</th>
              <th>Dòng</th>
              <th>Cột</th>
              <th>Nội dung lỗi</th>
            </tr>
          </thead>
          <tbody>
            {cellErrors.map((err, idx) => <tr key={`${err.sheet}-${err.row}-${err.column}-${idx}`} className={styles.rowError}>
              <td><strong>{err.sheet || 'File'}</strong></td>
              <td>{err.row ?? '—'}</td>
              <td><code>{err.column || '—'}</code></td>
              <td>{err.message}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}

      {preview && <div className={styles.previewBox}>
        <div className={styles.previewHeader}>
          <CheckCircle2 size={18} />
          <div>
            <strong>{preview.name}</strong>
            <span>{preview.breed} · {preview.durationDays} ngày · {preview.steps.length} nội dung hợp lệ</span>
          </div>
        </div>
        <div className={styles.sections}>
          {STEP_CATEGORIES.map(category => {
            const steps = preview.steps.filter(step => step.category === category.value);
            if (steps.length === 0) return null;
            return <section key={category.value} className={styles.section}>
              <h4>{category.label} <span>{steps.length}</span></h4>
              <ul>
                {steps.map((step, i) => <li key={`${category.value}-${i}`}>
                  <span className={styles.dayChip}>{days(step)}</span>
                  <div>
                    <strong>{step.name}</strong>
                    {describeStep(step) && <small>{describeStep(step)}</small>}
                    {step.note && <small className={styles.note}>{step.note}</small>}
                  </div>
                </li>)}
              </ul>
            </section>;
          })}
        </div>
      </div>}
    </div>

    <footer className={styles.footer}>
      <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={busy}>Đóng</button>
      <button type="button" className={`farmshift-btn ${styles.saveButton}`} onClick={handleCommit}
        disabled={!preview || busy} aria-busy={committing}>
        <Upload size={15} />{committing ? 'Đang lưu...' : 'Xác nhận lưu'}
      </button>
    </footer>
  </Dialog>;
}
