import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { getFarm, updateMealSchedule } from '../../services/farmService';
import { Dialog } from './FarmAreaDialogs';
import { apiErrorMessage } from './farmAreaOptions';
import areaStyles from './AreasView.module.css';
import styles from './MealScheduleDialog.module.css';

const DEFAULT_FIRST_MEAL = '07:00';
/** Các cữ chia đều trong 12 tiếng kể từ cữ đầu (3 cữ cách 4 tiếng, 4 cữ cách 3 tiếng), làm tròn 15 phút — giống backend. */
const FEEDING_WINDOW_MINUTES = 12 * 60;
const MEAL_COUNTS = [2, 3, 4, 5, 6];

const toMinutes = hhmm => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};
const toHhmm = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const stepMinutes = meals => Math.round(FEEDING_WINDOW_MINUTES / meals / 15) * 15;
const mealTimes = (first, meals) => Array.from({ length: meals }, (_, index) => toHhmm(toMinutes(first) + stepMinutes(meals) * index));
const stepText = meals => {
  const minutes = stepMinutes(meals);
  return minutes % 60 ? `${Math.floor(minutes / 60)} tiếng ${minutes % 60} phút` : `${minutes / 60} tiếng`;
};

/** Chủ trại cài giờ cữ ăn đầu tiên; xem trước giờ các cữ theo số cữ trong ngày của chương trình nuôi. */
export function MealScheduleDialog({ onClose, onSaved }) {
  const { showToast } = useNotification();
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getFarm()
      .then(farm => { if (active) setFirst(farm?.firstMealTime ? String(farm.firstMealTime).slice(0, 5) : DEFAULT_FIRST_MEAL); })
      .catch(() => { if (active) setFirst(DEFAULT_FIRST_MEAL); });
    return () => { active = false; };
  }, []);

  const valid = /^\d{2}:\d{2}$/.test(first) && first >= '04:00' && first <= '10:00';
  const submit = async event => {
    event.preventDefault();
    if (!valid) { setError('Giờ cữ ăn đầu tiên phải từ 04:00 đến 10:00.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateMealSchedule(first);
      showToast(`Đã lưu giờ cho ăn: cữ đầu lúc ${first}.`, 'success');
      onSaved();
    } catch (failure) {
      setError(apiErrorMessage(failure));
      setSaving(false);
    }
  };

  return <Dialog title="Giờ cho ăn" labelId="meal-schedule-title" busy={saving} onClose={onClose}>
    <form onSubmit={submit} noValidate>
      <div className={areaStyles.modalBody}>
        {error && <p role="alert" className={areaStyles.error}><AlertCircle size={16} />{error}</p>}
        <label htmlFor="first-meal-time">Giờ cữ ăn đầu tiên</label>
        <input id="first-meal-time" type="time" min="04:00" max="10:00" step="900" className="farmshift-form-control" value={first}
          onChange={event => { setFirst(event.target.value); setError(''); }} disabled={saving || !first} />
        <p className={styles.hint}>Các cữ sau chia đều trong 12 tiếng: 3 cữ cách nhau 4 tiếng, 4 cữ cách nhau 3 tiếng. Số cữ lấy theo chương trình nuôi.</p>
        {valid && <table className={styles.preview}>
          <thead><tr><th>Số cữ / ngày</th><th>Cách nhau</th><th>Giờ cho ăn</th></tr></thead>
          <tbody>{MEAL_COUNTS.map(meals => <tr key={meals}>
            <td>{meals} cữ</td><td>{stepText(meals)}</td>
            <td>{mealTimes(first, meals).map(at => <span key={at} className={styles.time}>{at}</span>)}</td>
          </tr>)}</tbody>
        </table>}
      </div>
      <footer className={areaStyles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Bỏ qua</button>
        <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={saving || !first} aria-busy={saving}>{saving ? 'Đang lưu...' : 'Lưu giờ cho ăn'}</button>
      </footer>
    </form>
  </Dialog>;
}
