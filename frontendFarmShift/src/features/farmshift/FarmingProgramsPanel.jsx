import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { deleteProgram, listPrograms } from '../../services/farmingProgramService';
import { FarmingProgramDialog } from './FarmingProgramDialog';
import { FormDialog } from './CycleDialogs';
import { STEP_CATEGORIES, apiErrorMessage, describeStep } from './farmAreaOptions';
import styles from './FarmingPrograms.module.css';

const weight = value => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const days = step => (step.dayFrom === step.dayTo ? `Ngày ${step.dayFrom}` : `Ngày ${step.dayFrom}–${step.dayTo}`);

/** Thiết lập chăn nuôi → Chương trình nuôi theo giống. Chủ trại tạo / sửa / xóa; các vai trò khác chỉ xem. */
export function FarmingProgramsPanel() {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: -1, programs: [], error: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [lookupDay, setLookupDay] = useState('1');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listPrograms().then(programs => { if (!cancelled) setState({ key: revision, programs: Array.isArray(programs) ? programs : [], error: '' }); })
      .catch(error => { if (!cancelled) setState({ key: revision, programs: [], error: apiErrorMessage(error) }); });
    return () => { cancelled = true; };
  }, [revision]);

  const loading = state.key !== revision;
  const { programs, error } = state;
  const selected = programs.find(program => program.id === selectedId) || programs[0];
  const day = Number(lookupDay);
  const todaySteps = useMemo(() => (selected && Number.isInteger(day) && day > 0
    ? selected.steps.filter(step => day >= step.dayFrom && day <= step.dayTo)
      .sort((a, b) => STEP_CATEGORIES.findIndex(item => item.value === a.category) - STEP_CATEGORIES.findIndex(item => item.value === b.category))
    : []), [selected, day]);
  const done = message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); };

  const confirmDelete = program => setModal({
    type: 'delete', title: 'Xóa chương trình nuôi', submitLabel: 'Xóa chương trình', danger: true, initial: {}, fields: [],
    intro: `Bạn chắc chắn muốn xóa chương trình ${program.name}? Thao tác này không thể hoàn tác.`,
    onSubmit: async () => { await deleteProgram(program.id); setSelectedId(null); return `Đã xóa chương trình ${program.name}.`; },
  });

  return <section className={styles.panel}>
    <header className={styles.panelHeader}>
      <div><h2><ClipboardList size={20} />Chương trình nuôi theo giống</h2>
        <p>Định mức cám, lịch vắc-xin, thuốc trộn, nhiệt độ và công việc theo ngày tuổi. Khi nhập đàn, chọn chương trình để hệ thống lập kế hoạch hằng ngày.</p></div>
      {canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => setModal({ type: 'edit' })}><PlusCircle size={16} />Tạo chương trình</button>}
    </header>

    {loading ? <p className={styles.empty} role="status">Đang tải chương trình nuôi...</p>
      : error ? <div className={styles.empty} role="alert"><p>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : programs.length === 0 ? <p className={styles.empty}>{canEdit ? 'Chưa có chương trình nuôi. Bấm "Tạo chương trình" để thêm chương trình cho giống đầu tiên.' : 'Chưa có chương trình nuôi nào.'}</p>
          : <>
            <div className={styles.cards}>
              {programs.map(program => <button key={program.id} type="button" className={`${styles.programCard} ${selected?.id === program.id ? styles.programCardActive : ''}`}
                onClick={() => setSelectedId(program.id)} aria-pressed={selected?.id === program.id}>
                <span className={styles.breed}>{program.breed}</span>
                <strong>{program.name}</strong>
                <span className={styles.meta}>{program.durationDays} ngày
                  {program.targetWeightMin != null || program.targetWeightMax != null
                    ? ` · ${[program.targetWeightMin, program.targetWeightMax].filter(value => value != null).map(weight).join('–')} kg` : ''}</span>
                <span className={styles.counts}>{STEP_CATEGORIES.map(category => {
                  const count = program.steps.filter(step => step.category === category.value).length;
                  return count ? `${count} ${category.item}` : null;
                }).filter(Boolean).join(' · ')}</span>
                <span className={styles.usage}>{program.activeFlockCount ? `Đang dùng cho ${program.activeFlockCount} đàn` : 'Chưa có đàn đang nuôi'}</span>
              </button>)}
            </div>

            {selected && <div className={styles.detail}>
              <div className={styles.detailHeader}>
                <div><h3>{selected.name} <small>{selected.code}</small></h3>{selected.description && <p>{selected.description}</p>}</div>
                {canEdit && <div className={styles.detailActions}>
                  <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setModal({ type: 'edit', program: selected })}><Pencil size={15} />Chỉnh sửa</button>
                  <button type="button" className={`farmshift-btn ${styles.deleteButton}`} onClick={() => confirmDelete(selected)}><Trash2 size={15} />Xóa</button>
                </div>}
              </div>

              <div className={styles.lookup}>
                <label htmlFor="program-lookup-day"><CalendarDays size={16} />Tra cứu theo ngày tuổi</label>
                <input id="program-lookup-day" className="farmshift-form-control" type="number" min="1" max={selected.durationDays} value={lookupDay}
                  onChange={event => setLookupDay(event.target.value)} />
                <span className={styles.lookupResult}>{todaySteps.length === 0 ? 'Không có nội dung nào trong ngày này.'
                  : todaySteps.map(step => `${STEP_CATEGORIES.find(item => item.value === step.category)?.label}: ${step.name}${describeStep(step) ? ` (${describeStep(step)})` : ''}`).join(' · ')}</span>
              </div>

              <div className={styles.sections}>
                {STEP_CATEGORIES.map(category => {
                  const steps = selected.steps.filter(step => step.category === category.value).sort((a, b) => a.dayFrom - b.dayFrom || a.dayTo - b.dayTo);
                  return <section key={category.value} className={styles.section}>
                    <h4>{category.label} <span>{steps.length}</span></h4>
                    {steps.length === 0 ? <p className={styles.muted}>Chưa có {category.item}.</p> : <ul>
                      {steps.map(step => <li key={step.id}><span className={styles.dayChip}>{days(step)}</span>
                        <div><strong>{step.name}</strong>{describeStep(step) && <small>{describeStep(step)}</small>}{step.note && <small className={styles.note}>{step.note}</small>}</div></li>)}
                    </ul>}
                  </section>;
                })}
              </div>
            </div>}
          </>}

    {modal?.type === 'edit' && <FarmingProgramDialog program={modal.program} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.type === 'delete' && <FormDialog {...modal} onClose={() => setModal(null)} onDone={done} />}
  </section>;
}
