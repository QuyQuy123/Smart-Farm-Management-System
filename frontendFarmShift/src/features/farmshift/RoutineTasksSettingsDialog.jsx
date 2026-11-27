import { useMemo, useState } from 'react';
import { AlertCircle, Check, Plus } from 'lucide-react';
import { setBarnRoutineTasks } from '../../services/workAssignmentService';
import { Dialog } from './FarmAreaDialogs';
import {
  CUSTOM_ROUTINE_PREFIX,
  DEFAULT_ROUTINE_CODES,
  MAX_CUSTOM_ROUTINE_LENGTH,
  ROUTINE_TASK_PRESETS,
  apiErrorMessage,
  isCustomRoutineCode,
  routineTaskTitle,
} from './farmAreaOptions';
import dialogStyles from './AreasView.module.css';
import styles from './RoutineTasksSettingsDialog.module.css';

const normalizeKey = text => String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const PRESET_BY_TITLE_KEY = new Map(ROUTINE_TASK_PRESETS.map(p => [normalizeKey(p.title), p.code]));

/**
 * Multi-select chip picker for daily barn routine tasks + inline custom tag creation.
 */
export function RoutineTaskTagPicker({ selectedCodes = DEFAULT_ROUTINE_CODES, onChange, disabled = false }) {
  const [sessionCustomCodes, setSessionCustomCodes] = useState(() =>
    (Array.isArray(selectedCodes) ? selectedCodes : []).filter(isCustomRoutineCode)
  );
  const [addingCustom, setAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customError, setCustomError] = useState('');

  const selectedSet = useMemo(() => new Set(Array.isArray(selectedCodes) ? selectedCodes : []), [selectedCodes]);

  const allTags = useMemo(() => {
    const map = new Map();
    ROUTINE_TASK_PRESETS.forEach(p => map.set(p.code, p.title));
    sessionCustomCodes.forEach(code => {
      if (!map.has(code)) map.set(code, routineTaskTitle(code));
    });
    (Array.isArray(selectedCodes) ? selectedCodes : []).forEach(code => {
      if (!map.has(code)) map.set(code, routineTaskTitle(code));
    });
    return [...map.entries()].map(([code, title]) => ({ code, title }));
  }, [sessionCustomCodes, selectedCodes]);

  const toggleTag = code => {
    if (disabled) return;
    const current = Array.isArray(selectedCodes) ? selectedCodes : [];
    const next = current.includes(code)
      ? current.filter(item => item !== code)
      : [...current, code];
    onChange(next);
  };

  const addCustomTag = () => {
    const cleaned = customTitle.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      setCustomError('Vui lòng nhập tên công việc.');
      return;
    }
    if (cleaned.includes(',')) {
      setCustomError('Tên công việc không được chứa dấu phẩy.');
      return;
    }
    if (cleaned.length > MAX_CUSTOM_ROUTINE_LENGTH) {
      setCustomError(`Tên công việc tối đa ${MAX_CUSTOM_ROUTINE_LENGTH} ký tự.`);
      return;
    }

    const key = normalizeKey(cleaned);
    const matchedPreset = PRESET_BY_TITLE_KEY.get(key);
    const existingCustom = allTags.find(tag => isCustomRoutineCode(tag.code) && normalizeKey(tag.title) === key)?.code;
    const targetCode = matchedPreset || existingCustom || `${CUSTOM_ROUTINE_PREFIX}${cleaned}`;

    if (isCustomRoutineCode(targetCode) && !sessionCustomCodes.includes(targetCode)) {
      setSessionCustomCodes(prev => [...prev, targetCode]);
    }
    if (!selectedSet.has(targetCode)) {
      onChange([...(Array.isArray(selectedCodes) ? selectedCodes : []), targetCode]);
    }
    setCustomTitle('');
    setCustomError('');
    setAddingCustom(false);
  };

  return (
    <div>
      <div className={styles.summaryRow}>
        <span>Đã chọn {selectedSet.size} công việc hằng ngày</span>
      </div>
      <div className={styles.tagGrid} role="group" aria-label="Danh sách thẻ công việc hằng ngày">
        {allTags.map(tag => {
          const active = selectedSet.has(tag.code);
          return (
            <button
              key={tag.code}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              className={`${styles.tag} ${active ? styles.tagActive : styles.tagInactive}`}
              onClick={() => toggleTag(tag.code)}
            >
              <span>{tag.title}</span>
              {active ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className={styles.customSection}>
        {!addingCustom ? (
          <button
            type="button"
            className={styles.addCustomTrigger}
            disabled={disabled}
            onClick={() => {
              setAddingCustom(true);
              setCustomError('');
            }}
          >
            + Thêm việc khác tự định nghĩa
          </button>
        ) : (
          <>
            <div className={styles.customInputRow}>
              <input
                type="text"
                aria-label="Tên công việc hằng ngày tự định nghĩa"
                className={`farmshift-form-control ${styles.customInput}`}
                placeholder="Ví dụ: Kiểm tra nguồn nước uống..."
                maxLength={MAX_CUSTOM_ROUTINE_LENGTH}
                value={customTitle}
                disabled={disabled}
                onChange={event => {
                  setCustomTitle(event.target.value);
                  if (customError) setCustomError('');
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomTag();
                  }
                }}
              />
              <button
                type="button"
                className="farmshift-btn farmshift-btn-mint"
                disabled={disabled}
                onClick={addCustomTag}
              >
                Thêm
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                disabled={disabled}
                onClick={() => {
                  setAddingCustom(false);
                  setCustomTitle('');
                  setCustomError('');
                }}
              >
                Đóng
              </button>
            </div>
            {customError && <p className={styles.customError} role="alert">{customError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Modal cài đặt công việc hằng ngày mặc định áp dụng từ hôm nay tới cuối chu kỳ nuôi của chuồng.
 */
export function RoutineTasksSettingsDialog({ barnId, barnName, initialCodes, onClose, onSaved }) {
  const [initialList] = useState(() =>
    (Array.isArray(initialCodes) ? [...initialCodes] : [...DEFAULT_ROUTINE_CODES]).sort()
  );
  const [selectedCodes, setSelectedCodes] = useState(() =>
    Array.isArray(initialCodes) ? [...initialCodes] : [...DEFAULT_ROUTINE_CODES]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sortedSelected = [...selectedCodes].sort();
  const isDirty =
    sortedSelected.length !== initialList.length ||
    sortedSelected.some((code, idx) => code !== initialList[idx]);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const savedCodes = await setBarnRoutineTasks(barnId, selectedCodes);
      await onSaved(savedCodes);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Cài đặt công việc hằng ngày (Cả chu kỳ)"
      labelId="routine-tasks-settings-title"
      busy={saving}
      isDirty={isDirty}
      onClose={onClose}
      wide
    >
      <div className={dialogStyles.modalBody}>
        {error && (
          <p role="alert" className={styles.errorAlert}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </p>
        )}
        <p className={styles.intro}>
          Chọn nhanh các công việc hằng ngày cho chuồng <strong>{barnName}</strong>. Hệ thống sẽ tự động tạo các việc này mỗi ngày cho đến khi kết thúc lứa.
        </p>
        <RoutineTaskTagPicker
          selectedCodes={selectedCodes}
          onChange={setSelectedCodes}
          disabled={saving}
        />
      </div>
      <footer className={dialogStyles.footer}>
        <button
          type="button"
          className="farmshift-btn farmshift-btn-secondary"
          disabled={saving}
          onClick={onClose}
        >
          Hủy
        </button>
        <button
          type="button"
          className="farmshift-btn farmshift-btn-mint"
          disabled={saving}
          aria-busy={saving}
          onClick={handleConfirm}
        >
          {saving ? 'Đang lưu...' : 'Xác nhận & Áp dụng'}
        </button>
      </footer>
    </Dialog>
  );
}
