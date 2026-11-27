import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowLeftRight, Info, Package, Warehouse } from 'lucide-react';
import { Dialog, FieldError } from './FarmAreaDialogs';
import { closeCycle, getCloseCyclePreview } from '../../services/cycleService';
import { apiErrorMessage, formatAmount, todayIso } from './farmAreaOptions';
import areaStyles from './AreasView.module.css';
import styles from './BarnDetailView.module.css';

const money = value => (value == null ? '—' : `${Math.round(Number(value)).toLocaleString('vi-VN')}đ`);

/**
 * Hộp thoại Kết thúc lứa nuôi:
 * 1) Hiển thị & bắt buộc xử lý cám đang mở bao còn dư tại chuồng (Chuyển chuồng / Hoàn kho / Hao hụt).
 * 2) Cảnh báo & gợi ý chuyển kho nếu Khu nuôi vẫn còn tồn kho cám/thuốc nguyên bao.
 */
export function CloseCycleDialog({ barn, cycle, onClose, onDone }) {
  const today = todayIso();
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState('');
  const [leftoverAction, setLeftoverAction] = useState('');
  const [targetCycleId, setTargetCycleId] = useState('');
  const [previewState, setPreviewState] = useState({ key: null, data: null, error: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const preview = previewState.key === cycle.id ? previewState.data : null;
  const loadingPreview = previewState.key !== cycle.id;
  const previewError = previewState.key === cycle.id ? previewState.error : '';

  useEffect(() => {
    let cancelled = false;
    getCloseCyclePreview(cycle.id)
      .then(data => {
        if (cancelled) return;
        setPreviewState({ key: cycle.id, data, error: '' });
        const targets = data?.transferTargetCycles || [];
        if ((data?.openedFeeds || []).length > 0) {
          if (targets.length > 0) {
            setLeftoverAction('TRANSFER_TO_CYCLE');
            setTargetCycleId(String(targets[0].cycleId));
          } else {
            setLeftoverAction('WRITE_OFF');
            setTargetCycleId('');
          }
        }
      })
      .catch(err => {
        if (!cancelled) setPreviewState({ key: cycle.id, data: null, error: apiErrorMessage(err) });
      });
    return () => { cancelled = true; };
  }, [cycle.id]);

  const openedFeeds = preview?.openedFeeds || [];
  const transferTargets = preview?.transferTargetCycles || [];
  const warehouseStocks = preview?.areaWarehouseStocks || [];
  const hasOpenedFeeds = openedFeeds.length > 0;
  const isLastActiveInArea = (preview?.otherActiveCyclesInArea ?? 0) === 0;
  const firstWarehouseId = warehouseStocks[0]?.warehouseId;

  const submit = async event => {
    event.preventDefault();
    if (saving) return;

    const found = {};
    if (!endDate) found.endDate = 'Vui lòng chọn ngày kết thúc.';
    else if (endDate > today) found.endDate = 'Ngày kết thúc không được sau hôm nay.';
    else if (cycle.startDate && endDate < cycle.startDate) {
      found.endDate = 'Ngày kết thúc không được trước ngày bắt đầu lứa.';
    }

    if (hasOpenedFeeds && !leftoverAction) {
      found.leftoverAction = 'Vui lòng chọn phương án xử lý cám đang mở bao còn dư.';
    }
    if (hasOpenedFeeds && leftoverAction === 'TRANSFER_TO_CYCLE' && !targetCycleId) {
      found.targetCycleId = 'Vui lòng chọn lứa nuôi nhận cám dư.';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setSubmitError('');
    try {
      await closeCycle(cycle.id, {
        endDate,
        note: note.trim(),
        leftoverFeedAction: hasOpenedFeeds ? leftoverAction : null,
        transferTargetCycleId:
          hasOpenedFeeds && leftoverAction === 'TRANSFER_TO_CYCLE' && targetCycleId
            ? Number(targetCycleId)
            : null,
      });
      onDone(`Đã kết thúc lứa nuôi thứ ${cycle.cycleNumber}${barn?.name ? ` (${barn.name})` : ''}.`);
    } catch (err) {
      const data = err.response?.data?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setErrors(data);
      } else {
        setSubmitError(apiErrorMessage(err));
      }
      setSaving(false);
    }
  };

  const isDirty = endDate !== today || note.trim() !== '';

  return (
    <Dialog
      title={`Kết thúc lứa nuôi thứ ${cycle.cycleNumber}`}
      labelId="close-cycle-dialog-title"
      busy={saving}
      isDirty={isDirty}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} noValidate>
        <div className={areaStyles.modalBody}>
          {submitError && (
            <p role="alert" className={areaStyles.error}>
              <AlertCircle size={16} />
              {submitError}
            </p>
          )}
          <p className={areaStyles.infoNote}>
            <Info size={16} />
            Chi phí, doanh thu và nhật ký được lưu vĩnh viễn trong lịch sử lứa. Sau khi kết thúc, lứa chỉ xem được, không ghi thêm dữ liệu.
          </p>

          <div className={areaStyles.formGrid}>
            <div>
              <label htmlFor="close-cycle-end-date">
                Ngày kết thúc <span className={areaStyles.required}>*</span>
              </label>
              <input
                id="close-cycle-end-date"
                type="date"
                max={today}
                value={endDate}
                disabled={saving}
                className={`farmshift-form-control ${errors.endDate ? areaStyles.invalid : ''}`}
                onChange={e => {
                  setEndDate(e.target.value);
                  setErrors(curr => ({ ...curr, endDate: undefined }));
                }}
              />
              <FieldError id="close-cycle-end-date-error" message={errors.endDate} />
            </div>

            <div className={areaStyles.fullRow}>
              <label htmlFor="close-cycle-note">Ghi chú kết thúc lứa</label>
              <textarea
                id="close-cycle-note"
                rows={2}
                maxLength={1000}
                value={note}
                disabled={saving}
                placeholder="Ghi chú chốt sổ lứa nuôi (không bắt buộc)..."
                className="farmshift-form-control"
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          {loadingPreview && (
            <p className={styles.closePreviewLoading} role="status">
              Đang kiểm tra cám mở bao và tồn kho khu nuôi...
            </p>
          )}

          {!loadingPreview && previewError && (
            <p className={areaStyles.warning}>
              <AlertTriangle size={16} />
              Không tải được thông tin tồn cám/thuốc: {previewError}
            </p>
          )}

          {!loadingPreview && hasOpenedFeeds && (
            <section className={styles.leftoverSection} aria-label="Xử lý cám mở bao còn dư tại chuồng">
              <div className={styles.leftoverHeader}>
                <Package size={16} />
                <strong>Cám đang mở bao còn dư tại chuồng ({openedFeeds.length} loại)</strong>
              </div>
              <p className={styles.leftoverSub}>
                Kho tổng đã xuất chẵn theo nguyên bao; số kg lẻ còn lại dưới đây cần chốt xử lý trước khi đóng lứa:
              </p>
              <ul className={styles.leftoverList}>
                {openedFeeds.map(item => (
                  <li key={item.productId || item.id}>
                    <span>
                      <strong>{item.feedName}</strong> ({item.warehouseName || 'Kho cám'})
                    </span>
                    <span className={styles.leftoverMetrics}>
                      <strong>{formatAmount(item.remainingKg)} kg</strong>
                      {item.remainingValue != null && <small> · {money(item.remainingValue)}</small>}
                    </span>
                  </li>
                ))}
              </ul>

              <div className={styles.leftoverOptions}>
                <label className={`${styles.leftoverOption} ${transferTargets.length === 0 ? styles.leftoverOptionDisabled : ''}`}>
                  <input
                    type="radio"
                    name="leftoverFeedAction"
                    value="TRANSFER_TO_CYCLE"
                    checked={leftoverAction === 'TRANSFER_TO_CYCLE'}
                    disabled={saving || transferTargets.length === 0}
                    onChange={() => {
                      setLeftoverAction('TRANSFER_TO_CYCLE');
                      setErrors(curr => ({ ...curr, leftoverAction: undefined, targetCycleId: undefined }));
                    }}
                  />
                  <div>
                    <strong>Chuyển sang chuồng đang nuôi khác</strong>
                    <small>
                      {transferTargets.length > 0
                        ? 'Cộng phần kg & giá trị cám mở bao sang lứa đích (kho tổng vẫn giữ nguyên số nguyên bao).'
                        : 'Hiện không còn lứa nào khác đang hoạt động để nhận cám.'}
                    </small>
                  </div>
                </label>

                {leftoverAction === 'TRANSFER_TO_CYCLE' && transferTargets.length > 0 && (
                  <div className={styles.leftoverTargetBox}>
                    <label htmlFor="leftover-target-cycle">Chọn chuồng / lứa nhận cám</label>
                    <select
                      id="leftover-target-cycle"
                      className="farmshift-form-control"
                      value={targetCycleId}
                      disabled={saving}
                      onChange={e => {
                        setTargetCycleId(e.target.value);
                        setErrors(curr => ({ ...curr, targetCycleId: undefined }));
                      }}
                    >
                      {transferTargets.map(t => (
                        <option key={t.cycleId} value={t.cycleId}>
                          {t.barnName} · {t.areaName} ({t.cycleCode})
                        </option>
                      ))}
                    </select>
                    <FieldError id="leftover-target-cycle-error" message={errors.targetCycleId} />
                  </div>
                )}

                <label className={styles.leftoverOption}>
                  <input
                    type="radio"
                    name="leftoverFeedAction"
                    value="RETURN_TO_WAREHOUSE"
                    checked={leftoverAction === 'RETURN_TO_WAREHOUSE'}
                    disabled={saving}
                    onChange={() => {
                      setLeftoverAction('RETURN_TO_WAREHOUSE');
                      setErrors(curr => ({ ...curr, leftoverAction: undefined, targetCycleId: undefined }));
                    }}
                  />
                  <div>
                    <strong>Nhập hoàn lại kho cám của khu</strong>
                    <small>Quy đổi kg lẻ còn lại thành phân số bao và cộng trả lại lô nhập kho nguồn.</small>
                  </div>
                </label>

                <label className={styles.leftoverOption}>
                  <input
                    type="radio"
                    name="leftoverFeedAction"
                    value="WRITE_OFF"
                    checked={leftoverAction === 'WRITE_OFF'}
                    disabled={saving}
                    onChange={() => {
                      setLeftoverAction('WRITE_OFF');
                      setErrors(curr => ({ ...curr, leftoverAction: undefined, targetCycleId: undefined }));
                    }}
                  />
                  <div>
                    <strong>Ghi nhận hao hụt / hủy bỏ</strong>
                    <small>Hạch toán giá trị phần cám dư vào khoản chi khác của lứa nuôi này.</small>
                  </div>
                </label>
              </div>
              <FieldError id="leftover-action-error" message={errors.leftoverAction} />
            </section>
          )}

          {!loadingPreview && warehouseStocks.length > 0 && (
            <section className={styles.warehouseAlertBox} aria-label="Tồn kho cám và thuốc tại Kho Khu">
              <div className={styles.warehouseAlertHeader}>
                <Warehouse size={16} />
                <strong>
                  {isLastActiveInArea
                    ? `Chuồng cuối cùng trong ${preview?.areaName || 'khu'} — Kho Khu còn ${warehouseStocks.length} mặt hàng`
                    : `Kho ${preview?.areaName || 'Khu'} còn ${warehouseStocks.length} mặt hàng cám/thuốc`}
                </strong>
              </div>
              <p className={styles.warehouseAlertText}>
                {isLastActiveInArea
                  ? 'Không còn chuồng nào đang nuôi trong khu này. Bạn có thể chuyển kho số cám/thuốc nguyên bao còn dư sang khu hoặc kho khác:'
                  : `Còn ${preview.otherActiveCyclesInArea} chuồng khác đang nuôi trong khu nên số cám/thuốc nguyên bao dưới đây sẽ tiếp tục dùng chung tại kho khu.`}
              </p>
              <ul className={styles.warehouseStockList}>
                {warehouseStocks.slice(0, 6).map(item => (
                  <li key={`${item.warehouseId}-${item.productId}-${item.unitName}`}>
                    <span>{item.productName} ({item.warehouseName})</span>
                    <strong>{formatAmount(item.totalStock)} {item.unitName}</strong>
                  </li>
                ))}
                {warehouseStocks.length > 6 && (
                  <li className={styles.warehouseMore}>...và {warehouseStocks.length - 6} mặt hàng khác</li>
                )}
              </ul>
              {isLastActiveInArea && firstWarehouseId && (
                <div className={styles.warehouseAlertAction}>
                  <Link
                    to={`/internal-stock?action=transfer&sourceWarehouseId=${encodeURIComponent(firstWarehouseId)}`}
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={onClose}
                  >
                    <ArrowLeftRight size={14} /> Tạo phiếu Chuyển kho
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className={areaStyles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>
            Bỏ qua
          </button>
          <button
            type="submit"
            className={`farmshift-btn ${areaStyles.deleteButton}`}
            disabled={saving || loadingPreview}
            aria-busy={saving}
          >
            {saving ? 'Đang lưu...' : 'Xác nhận kết thúc'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
