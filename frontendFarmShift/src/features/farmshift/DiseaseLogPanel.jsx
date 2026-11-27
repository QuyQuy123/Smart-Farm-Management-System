import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Pencil, Pill, PlusCircle, RotateCcw, Stethoscope, Trash2 } from 'lucide-react';
import {
  addDiseaseTreatment, createCycleDisease, deleteCycleDisease, deleteDiseaseTreatment,
  listCycleDiseases, listDiseaseMedicineSources, updateCycleDisease, updateDiseaseTreatmentCost,
} from '../../services/cycleDiseaseService';
import { Dialog } from './FarmAreaDialogs';
import { DRINKING_MEDICINE_METHODS, MEDICINE_METHODS, apiErrorMessage, formatAmount, formatDay, labelOf, todayIso } from './farmAreaOptions';
import { CurrencyInput } from '../../components/CurrencyInput/CurrencyInput';
import { QuantityInput } from '../../components/QuantityInput/QuantityInput';
import { formatInventoryOption, formatStockAfterExport } from '../../utils/selectFormatters';
import styles from './DiseaseLogPanel.module.css';

const TREATMENT_METHODS = [
  ...DRINKING_MEDICINE_METHODS,
  ...MEDICINE_METHODS.filter(m => m.value !== 'MIX_WATER'),
  { value: 'INJECTION', label: 'Tiêm' },
];

const money = value => (value == null ? '—' : `${Math.round(Number(value)).toLocaleString('vi-VN')}đ`);

/**
 * Sổ bệnh án theo dõi đợt bệnh nhiều ngày & chi phí thuốc từng đợt bệnh trong BarnDetailView (OPS-02).
 * Ẩn toàn bộ cột/chip tiền thuốc khi canFinance === false (ROLE_FARM_WORKER).
 */
export function DiseaseLogPanel({
  cycle,
  flocks = [],
  canDaily,
  canFinance,
  isOwner,
  userEmail,
  refreshKey = 0,
  onChanged,
  onSummaryChange,
  embedded = false,
  showToast,
}) {
  const active = cycle?.status === 'ACTIVE';
  const today = todayIso();
  const [diseases, setDiseases] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const loadSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const onSummaryChangeRef = useRef(onSummaryChange);
  onSummaryChangeRef.current = onSummaryChange;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!cycle?.id) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError('');
    try {
      const [list, medSources] = await Promise.all([
        listCycleDiseases(cycle.id),
        active && canDaily ? listDiseaseMedicineSources(cycle.id).catch(() => []) : Promise.resolve([]),
      ]);
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      const nextList = Array.isArray(list) ? list : [];
      setDiseases(nextList);
      setSources(Array.isArray(medSources) ? medSources : []);
      onSummaryChangeRef.current?.({
        count: nextList.length,
        activeCount: nextList.filter(d => d.status === 'ACTIVE').length,
      });
    } catch (requestError) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setError(apiErrorMessage(requestError));
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [cycle?.id, active, canDaily]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const totalMedicineCostAll = canFinance
    ? diseases.reduce((sum, d) => sum + Number(d.totalMedicineCost || 0), 0)
    : null;
  const activeCount = diseases.filter(d => d.status === 'ACTIVE').length;

  const afterMutation = async message => {
    setModal(null);
    showToast?.(message, 'success');
    await load();
    onChanged?.();
  };

  const openCreateDisease = () => setModal({
    type: 'createDisease',
    form: { diseaseName: '', flockId: '', symptoms: '', startDate: today, affectedQuantity: '', note: '' },
    error: '',
  });

  const openAddTreatment = disease => setModal({
    type: 'addTreatment',
    disease,
    form: {
      treatmentDate: today,
      sourceMode: sources.length > 0 ? 'STOCK' : 'EXTERNAL',
      inventoryItemId: sources[0] ? String(sources[0].itemId) : '',
      stockQuantity: '1',
      medicineName: '',
      method: 'AUTO_DRINKER',
      dosageText: '',
      manualCost: '',
      note: '',
    },
    error: '',
  });

  const openEditTreatmentCost = (disease, treatment) => setModal({
    type: 'editTreatmentCost',
    disease,
    treatment,
    form: {
      manualCost: treatment.cost != null ? String(Math.round(Number(treatment.cost))) : '0',
    },
    error: '',
  });

  const handleMarkRecovered = async disease => {
    if (busy) return;
    setBusy(true);
    try {
      await updateCycleDisease(cycle.id, disease.id, { status: 'RECOVERED', endDate: today });
      await afterMutation(`Đã đánh dấu đợt bệnh "${disease.diseaseName}" đã khỏi.`);
    } catch (requestError) {
      showToast?.(apiErrorMessage(requestError), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReopenDisease = async disease => {
    if (busy) return;
    setBusy(true);
    try {
      await updateCycleDisease(cycle.id, disease.id, { status: 'ACTIVE', endDate: null });
      await afterMutation(`Đã mở lại theo dõi điều trị cho "${disease.diseaseName}".`);
    } catch (requestError) {
      showToast?.(apiErrorMessage(requestError), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDisease = async disease => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteCycleDisease(cycle.id, disease.id);
      await afterMutation(`Đã xóa đợt bệnh "${disease.diseaseName}".`);
    } catch (requestError) {
      showToast?.(apiErrorMessage(requestError), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUndoTreatment = async (disease, treatment) => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteDiseaseTreatment(cycle.id, disease.id, treatment.id);
      await afterMutation(`Đã hoàn tác lần dùng thuốc "${treatment.medicineName}".`);
    } catch (requestError) {
      showToast?.(apiErrorMessage(requestError), 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitCreateDisease = async event => {
    event.preventDefault();
    if (busy) return;
    const { form } = modal;
    if (!form.diseaseName.trim()) {
      setModal(curr => ({ ...curr, error: 'Vui lòng nhập tên bệnh.' }));
      return;
    }
    setBusy(true);
    try {
      await createCycleDisease(cycle.id, {
        diseaseName: form.diseaseName.trim(),
        flockId: form.flockId ? Number(form.flockId) : null,
        symptoms: form.symptoms.trim() || null,
        startDate: form.startDate || today,
        affectedQuantity: form.affectedQuantity ? Number(form.affectedQuantity) : null,
        note: form.note.trim() || null,
      });
      await afterMutation(`Đã khai báo đợt bệnh "${form.diseaseName.trim()}".`);
    } catch (requestError) {
      setModal(curr => ({ ...curr, error: apiErrorMessage(requestError) }));
    } finally {
      setBusy(false);
    }
  };

  const submitAddTreatment = async event => {
    event.preventDefault();
    if (busy) return;
    const { form, disease } = modal;
    const fromStock = form.sourceMode === 'STOCK' && form.inventoryItemId;
    if (fromStock && !(Number(form.stockQuantity) > 0)) {
      setModal(curr => ({ ...curr, error: 'Vui lòng nhập số lượng xuất kho lớn hơn 0.' }));
      return;
    }
    if (fromStock && Number(form.stockQuantity) > 9999999999999) {
      setModal(curr => ({ ...curr, error: 'Số lượng xuất kho vượt giới hạn cho phép.' }));
      return;
    }
    if (!fromStock && !form.medicineName.trim()) {
      setModal(curr => ({ ...curr, error: 'Vui lòng nhập tên thuốc điều trị.' }));
      return;
    }
    if (!fromStock && canFinance && form.manualCost !== '') {
      const manualAmount = Number(form.manualCost);
      if (!Number.isFinite(manualAmount) || manualAmount < 0 || manualAmount > 99999999999999) {
        setModal(curr => ({ ...curr, error: 'Chi phí thuốc phải từ 0 đến giới hạn cho phép.' }));
        return;
      }
    }
    setBusy(true);
    try {
      await addDiseaseTreatment(cycle.id, disease.id, {
        treatmentDate: form.treatmentDate || today,
        inventoryItemId: fromStock ? Number(form.inventoryItemId) : null,
        stockQuantity: fromStock ? Number(form.stockQuantity) : null,
        medicineName: fromStock ? null : form.medicineName.trim(),
        method: form.method || null,
        dosageText: form.dosageText.trim() || null,
        manualCost: !fromStock && canFinance && form.manualCost !== '' ? Number(form.manualCost) : null,
        note: form.note.trim() || null,
      });
      await afterMutation(`Đã ghi nhận dùng thuốc cho đợt bệnh "${disease.diseaseName}".`);
    } catch (requestError) {
      setModal(curr => ({ ...curr, error: apiErrorMessage(requestError) }));
    } finally {
      setBusy(false);
    }
  };

  const submitEditTreatmentCost = async event => {
    event.preventDefault();
    if (busy) return;
    const { form, disease, treatment } = modal;
    const raw = String(form.manualCost ?? '').trim();
    const amount = Number(raw);
    if (raw === '' || !Number.isFinite(amount) || amount < 0 || amount > 99999999999999) {
      setModal(curr => ({ ...curr, error: 'Vui lòng nhập chi phí thuốc hợp lệ (từ 0đ trở lên).' }));
      return;
    }
    setBusy(true);
    try {
      await updateDiseaseTreatmentCost(cycle.id, disease.id, treatment.id, { manualCost: Math.round(amount) });
      await afterMutation(`Đã cập nhật chi phí thuốc "${treatment.medicineName}".`);
    } catch (requestError) {
      setModal(curr => ({ ...curr, error: apiErrorMessage(requestError) }));
    } finally {
      setBusy(false);
    }
  };

  const canUndoTreatment = treatment => {
    if (isOwner) return true;
    if (!active || !userEmail || !treatment.createdBy) return false;
    const isOwn = String(treatment.createdBy).trim().toLowerCase() === String(userEmail).trim().toLowerCase();
    const createdDay = treatment.createdAt ? String(treatment.createdAt).slice(0, 10) : '';
    const sameDay = treatment.treatmentDate === today || createdDay === today;
    return isOwn && sameDay;
  };

  return <section className={`${styles.panel} ${embedded ? styles.panelEmbedded : ''}`} aria-label="Sổ bệnh án">
    <header className={styles.header}>
      <h3><Stethoscope size={17} />Sổ bệnh án ({diseases.length})</h3>
      {active && canDaily && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={openCreateDisease}>
        <PlusCircle size={15} />Khai báo đợt bệnh
      </button>}
    </header>

    {diseases.length > 0 && <div className={styles.summaryRow}>
      <span>Tổng số đợt bệnh: <strong>{diseases.length}</strong></span>
      <span>Đang điều trị: <strong>{activeCount}</strong></span>
      {canFinance && <span>Tổng tiền thuốc điều trị: <strong>{money(totalMedicineCostAll)}</strong></span>}
    </div>}

    {loading ? <p className={styles.empty} role="status">Đang tải sổ bệnh án...</p>
      : error ? <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>{error}</p>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={load}>Thử lại</button>
        </div>
        : diseases.length === 0 ? <p className={styles.empty}>Chưa ghi nhận đợt bệnh nào trong lứa nuôi này.</p>
          : <div className={styles.list}>
            {diseases.map(disease => <article key={disease.id} className={styles.diseaseCard}>
              <div className={styles.diseaseHead}>
                <div>
                  <div className={styles.diseaseTitle}>
                    <strong>{disease.diseaseName}</strong>
                    <span className={disease.status === 'ACTIVE' ? styles.badgeActive : styles.badgeRecovered}>
                      {disease.status === 'ACTIVE' ? 'Đang điều trị' : 'Đã khỏi'}
                    </span>
                    {canFinance && <span className={styles.costChip}>Tiền thuốc: {money(disease.totalMedicineCost)}</span>}
                  </div>
                  <div className={styles.meta}>
                    <span>Từ {formatDay(disease.startDate)}{disease.endDate ? ` đến ${formatDay(disease.endDate)}` : ' (đang theo dõi)'} · {disease.treatmentDays} ngày</span>
                    {disease.flockCode && <span>Đàn: {disease.flockCode}</span>}
                    {disease.affectedQuantity != null && <span>Ảnh hưởng: {formatAmount(disease.affectedQuantity)} con</span>}
                  </div>
                </div>
                {active && <div className={styles.actions}>
                  {canDaily && disease.status === 'ACTIVE' && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => openAddTreatment(disease)} disabled={busy}>
                    <Pill size={14} />Ghi dùng thuốc
                  </button>}
                  {canDaily && disease.status === 'ACTIVE' && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => handleMarkRecovered(disease)} disabled={busy}>
                    <CheckCircle2 size={14} />Đánh dấu đã khỏi
                  </button>}
                  {canDaily && disease.status === 'RECOVERED' && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => handleReopenDisease(disease)} disabled={busy}>
                    <RotateCcw size={14} />Mở lại điều trị
                  </button>}
                  {isOwner && disease.treatments.length === 0 && <button type="button" className={styles.iconButton} aria-label={`Xóa đợt bệnh ${disease.diseaseName}`}
                    onClick={() => handleDeleteDisease(disease)} disabled={busy}><Trash2 size={14} /></button>}
                </div>}
              </div>

              {disease.symptoms && <p className={styles.symptoms}>Triệu chứng: {disease.symptoms}</p>}

              {disease.treatments.length === 0 ? <p className={styles.empty}>Chưa có nhật ký dùng thuốc cho đợt bệnh này.</p>
                : <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Thuốc</th>
                        <th>Cách dùng / Liều</th>
                        <th>Số lượng kho</th>
                        {canFinance && <th>Thành tiền</th>}
                        <th>Người ghi</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {disease.treatments.map(t => <tr key={t.id}>
                        <td>{formatDay(t.treatmentDate)}</td>
                        <td><strong>{t.medicineName}</strong>{t.warehouseName && <small> · {t.warehouseName}</small>}</td>
                        <td>{[t.method && labelOf(TREATMENT_METHODS, t.method), t.dosageText].filter(Boolean).join(' · ') || '—'}</td>
                        <td>{t.stockQuantity != null ? `${formatAmount(t.stockQuantity)} ${t.unitName || ''}`.trim() : 'Ngoài kho'}</td>
                        {canFinance && <td>{money(t.cost)}</td>}
                        <td>{t.createdBy || '—'}</td>
                        <td className={styles.rowActions}>
                          {active && canFinance && t.inventoryItemId == null && t.stockQuantity == null && <button
                            type="button"
                            className={styles.editIconButton}
                            title="Cập nhật chi phí thuốc ngoài kho"
                            aria-label={`Cập nhật tiền thuốc ${t.medicineName}`}
                            onClick={() => openEditTreatmentCost(disease, t)}
                            disabled={busy}
                          ><Pencil size={14} /></button>}
                          {active && canUndoTreatment(t) && <button type="button" className={styles.iconButton}
                            title="Hoàn tác lần dùng thuốc" aria-label={`Hoàn tác thuốc ${t.medicineName}`}
                            onClick={() => handleUndoTreatment(disease, t)} disabled={busy}><RotateCcw size={14} /></button>}
                        </td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>}
            </article>)}
          </div>}

    {modal?.type === 'createDisease' && <Dialog title="Khai báo đợt bệnh mới" labelId="create-disease-title" busy={busy}
      isDirty={Boolean(modal.form.diseaseName || modal.form.affectedQuantity || modal.form.symptoms)} onClose={() => setModal(null)}>
      <form onSubmit={submitCreateDisease} noValidate>
        <div className={styles.formBox}>
          {modal.error && <p className={styles.error} role="alert">{modal.error}</p>}
          <div className={styles.field}>
            <label htmlFor="disease-name">Tên bệnh *</label>
            <input id="disease-name" className="farmshift-form-control" maxLength={200} placeholder="VD: Cầu trùng, CRD, E.coli"
              value={modal.form.diseaseName} onChange={e => setModal(c => ({ ...c, error: '', form: { ...c.form, diseaseName: e.target.value } }))} />
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="disease-start">Ngày phát hiện *</label>
              <input id="disease-start" type="date" className="farmshift-form-control" min={cycle.startDate} max={today}
                value={modal.form.startDate} onChange={e => setModal(c => ({ ...c, form: { ...c.form, startDate: e.target.value } }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="disease-affected">Số con bị ảnh hưởng</label>
              <QuantityInput id="disease-affected" suffix="con" inputClassName="farmshift-form-control" placeholder="VD: 50"
                value={modal.form.affectedQuantity} onChange={e => setModal(c => ({ ...c, form: { ...c.form, affectedQuantity: e.target.value } }))} />
            </div>
          </div>
          {flocks.length > 0 && <div className={styles.field}>
            <label htmlFor="disease-flock">Phạm vi đàn (tùy chọn)</label>
            <select id="disease-flock" className="farmshift-form-control" value={modal.form.flockId}
              onChange={e => setModal(c => ({ ...c, form: { ...c.form, flockId: e.target.value } }))}>
              <option value="">Toàn bộ lứa trong chuồng</option>
              {flocks.map(f => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}
            </select>
          </div>}
          <div className={styles.field}>
            <label htmlFor="disease-symptoms">Triệu chứng</label>
            <textarea id="disease-symptoms" rows={2} maxLength={1000} className="farmshift-form-control" placeholder="VD: Gà xù lông, phân sáp, giảm ăn"
              value={modal.form.symptoms} onChange={e => setModal(c => ({ ...c, form: { ...c.form, symptoms: e.target.value } }))} />
          </div>
        </div>
        <footer className={styles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setModal(null)} disabled={busy}>Hủy</button>
          <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu đợt bệnh'}</button>
        </footer>
      </form>
    </Dialog>}

    {modal?.type === 'addTreatment' && <Dialog title={`Ghi dùng thuốc · ${modal.disease.diseaseName}`} labelId="add-treatment-title" busy={busy}
      isDirty={Boolean(modal.form.stockQuantity || modal.form.medicineName || modal.form.manualCost || modal.form.dosageText)} onClose={() => setModal(null)}>
      <form onSubmit={submitAddTreatment} noValidate>
        <div className={styles.formBox}>
          {modal.error && <p className={styles.error} role="alert">{modal.error}</p>}
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="treatment-date">Ngày dùng thuốc *</label>
              <input id="treatment-date" type="date" className="farmshift-form-control" min={modal.disease.startDate} max={today}
                value={modal.form.treatmentDate} onChange={e => setModal(c => ({ ...c, form: { ...c.form, treatmentDate: e.target.value } }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="treatment-source-mode">Nguồn thuốc</label>
              <select id="treatment-source-mode" className="farmshift-form-control" value={modal.form.sourceMode}
                onChange={e => setModal(c => ({ ...c, error: '', form: { ...c.form, sourceMode: e.target.value } }))}>
                <option value="STOCK" disabled={sources.length === 0}>Xuất từ kho thuốc khu nuôi ({sources.length})</option>
                <option value="EXTERNAL">Thuốc mua lẻ ngoài kho</option>
              </select>
            </div>
          </div>

          {modal.form.sourceMode === 'STOCK' && sources.length > 0 ? (() => {
            const selectedSrc = sources.find(s => String(s.itemId) === String(modal.form.inventoryItemId)) || sources[0];
            const stockPreview = selectedSrc
              ? formatStockAfterExport(selectedSrc.availableStock, modal.form.stockQuantity, selectedSrc.unitName)
              : { text: '' };
            return <div className={styles.grid2}>
              <div className={styles.field}>
                <label htmlFor="treatment-item">Chọn thuốc trong kho *</label>
                <select id="treatment-item" className="farmshift-form-control" value={modal.form.inventoryItemId}
                  onChange={e => setModal(c => ({ ...c, form: { ...c.form, inventoryItemId: e.target.value } }))}>
                  {sources.map(src => <option key={src.itemId} value={src.itemId} disabled={Number(src.availableStock || 0) <= 0}>
                    {formatInventoryOption(src)}{src.warehouseName ? ` (${src.warehouseName})` : ''}
                  </option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="treatment-qty">Số lượng xuất kho *</label>
                <QuantityInput
                  id="treatment-qty"
                  allowDecimal
                  suffix={selectedSrc?.unitName || ''}
                  max={selectedSrc?.availableStock}
                  showMaxButton={Boolean(selectedSrc?.availableStock > 0)}
                  helper={stockPreview.text}
                  inputClassName="farmshift-form-control"
                  value={modal.form.stockQuantity}
                  onChange={e => setModal(c => ({ ...c, form: { ...c.form, stockQuantity: e.target.value } }))}
                />
              </div>
            </div>;
          })() : <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="treatment-med-name">Tên thuốc ngoài kho *</label>
              <input id="treatment-med-name" className="farmshift-form-control" maxLength={200} placeholder="VD: Toltrazuril 2.5%"
                value={modal.form.medicineName} onChange={e => setModal(c => ({ ...c, form: { ...c.form, medicineName: e.target.value } }))} />
            </div>
            {canFinance && <div className={styles.field}>
              <label htmlFor="treatment-manual-cost">Tiền thuốc (VNĐ)</label>
              <CurrencyInput id="treatment-manual-cost" inputClassName="farmshift-form-control" placeholder="VD: 150.000"
                value={modal.form.manualCost} onChange={e => setModal(c => ({ ...c, form: { ...c.form, manualCost: e.target.value } }))} />
            </div>}
          </div>}

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="treatment-method">Phương thức cấp</label>
              <select id="treatment-method" className="farmshift-form-control" value={modal.form.method}
                onChange={e => setModal(c => ({ ...c, form: { ...c.form, method: e.target.value } }))}>
                {TREATMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="treatment-dosage">Liều lượng / ghi chú pha</label>
              <input id="treatment-dosage" className="farmshift-form-control" maxLength={200} placeholder="VD: 1 ml/lít nước uống sáng"
                value={modal.form.dosageText} onChange={e => setModal(c => ({ ...c, form: { ...c.form, dosageText: e.target.value } }))} />
            </div>
          </div>
        </div>
        <footer className={styles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setModal(null)} disabled={busy}>Hủy</button>
          <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={busy}>{busy ? 'Đang lưu...' : 'Ghi nhận dùng thuốc'}</button>
        </footer>
      </form>
    </Dialog>}

    {modal?.type === 'editTreatmentCost' && <Dialog
      title={`Cập nhật tiền thuốc · ${modal.treatment.medicineName}`}
      labelId="edit-treatment-cost-title"
      busy={busy}
      isDirty={String(modal.form.manualCost ?? '') !== String(modal.treatment.totalCost ?? '')}
      onClose={() => setModal(null)}
    >
      <form onSubmit={submitEditTreatmentCost} noValidate>
        <div className={styles.formBox}>
          {modal.error && <p className={styles.error} role="alert">{modal.error}</p>}
          <p className={styles.symptoms}>
            Đợt bệnh: <strong>{modal.disease.diseaseName}</strong> · Ngày dùng: <strong>{formatDay(modal.treatment.treatmentDate)}</strong> (Thuốc mua lẻ ngoài kho)
          </p>
          <div className={styles.field}>
            <label htmlFor="edit-treatment-manual-cost">Tiền thuốc (VNĐ) *</label>
            <CurrencyInput
              id="edit-treatment-manual-cost"
              inputClassName="farmshift-form-control"
              placeholder="VD: 150.000"
              value={modal.form.manualCost}
              onChange={e => setModal(c => ({ ...c, error: '', form: { ...c.form, manualCost: e.target.value } }))}
            />
          </div>
        </div>
        <footer className={styles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setModal(null)} disabled={busy}>Hủy</button>
          <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu chi phí'}</button>
        </footer>
      </form>
    </Dialog>}
  </section>;
}
