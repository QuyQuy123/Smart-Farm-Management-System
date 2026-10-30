// src/features/farmshift/SalesView.jsx
// Quản lý bán hàng và danh sách khách hàng.
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { readLocalSales } from '../../services/localSalesStorage';
import { useSearchParams } from 'react-router-dom';
import { listSalesCustomers, listSalesOrders, createSalesOrder, updateSalesOrder } from '../../services/salesCustomerService';
import { listBarns } from '../../services/farmAreaService';
import { listCycles } from '../../services/cycleService';
import styles from './SalesView.module.css';
import { extractWeightSlip, confirmWeightSlip } from '../../services/weightSlipService';
import { WeightSlipCapture } from './WeightSlipCapture';
import { SalesInvoiceTemplate } from './SalesInvoiceTemplate';
import { Plus, Search, FileSpreadsheet, X, Printer, Pencil, ScanText } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';

export const SalesView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ['orders', 'customers', 'create'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'create';
  const setActiveTab = tab => setSearchParams({ tab });
  const { user } = useAuth();
  const storageKey = `farmshift-sales-v1:${user?.email || 'demo'}`;
  const [sales, setSales] = useState(() => readLocalSales(storageKey));
  const requestId = useRef(null);
  const [saving, setSaving] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const invoiceRef = useRef(null);
  const [invoiceReady, setInvoiceReady] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('customer') || '');
  const customerFilter = searchParams.get('customer') || '';
  const showCustomerOrders = customer => {
    setSearchTerm(customer.name);
    setSearchParams({ tab: 'orders', customer: customer.name });
  };
  const clearCustomerFilter = () => {
    setSearchTerm('');
    setSearchParams({ tab: 'orders' });
  };
  const [editingSale, setEditingSale] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerPage, setCustomerPage] = useState(0);
  const customerPageCount = Math.max(1, Math.ceil(customers.length / 10));
  const currentCustomerPage = Math.min(customerPage, customerPageCount - 1);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState('');
  const [customerRevision, setCustomerRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listSalesOrders().then(rows => {
      if (cancelled) return;
      const local = readLocalSales(storageKey);
      setSales([...rows, ...local.filter(row => !rows.some(saved => saved.id === row.id))]);
    }).catch(() => { if (!cancelled) setOrdersError('Không thể tải đơn bán từ máy chủ. Vui lòng tải lại trang.'); });
    return () => { cancelled = true; };
  }, [storageKey]);
  useEffect(() => {
    let cancelled = false;
    listSalesCustomers().then(data => {
      if (!cancelled) setCustomers(data);
    }).catch(() => {
      if (!cancelled) setCustomersError('Không thể tải danh sách khách hàng. Vui lòng thử lại.');
    }).finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
  }, [customerRevision]);
  const formatMoney = value => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')} đ`;

  // New Sale state
  const [newSale, setNewSale] = useState({
    customer: '',
    phone: '',
    address: '',
    taxCode: '',
    paymentMethod: 'Tiền mặt',
    paymentStatus: 'PAID',
    paidAmount: '',
    date: new Date().toISOString().split('T')[0],
    flock: '',
    quantity: '',
    totalWeight: '',
    unitPrice: '',
    note: ''
  });

  const [showCapture, setShowCapture] = useState(false);
  const [ocrFile, setOcrFile] = useState(null), [ocrPreview, setOcrPreview] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false), [ocrError, setOcrError] = useState(''), [ocrDraft, setOcrDraft] = useState(null);
  const ocrRequest = useRef(null);
  useEffect(() => {
    if (!ocrFile) { setOcrPreview(''); return; }
    const url = URL.createObjectURL(ocrFile); setOcrPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [ocrFile]);
  useEffect(() => () => ocrRequest.current?.abort(), []);
  const clearOcr = () => {
    ocrRequest.current?.abort(); setShowCapture(false); setOcrFile(null); setOcrDraft(null); setOcrBusy(false); setOcrError('');
  };
  async function readWeightSlip(file) {
    ocrRequest.current?.abort();
    const controller = new AbortController(); ocrRequest.current = controller;
    setShowCapture(false); setOcrFile(file); setOcrDraft(null); setOcrBusy(true); setOcrError(''); setSaveError('');
    try {
      const draft = await extractWeightSlip(file, controller.signal);
      if (controller.signal.aborted) return;
      setOcrDraft(draft);
      const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
      const matches = cycleOptions.filter(option => draft.barnName && normalize(option.barnName) === normalize(draft.barnName)
        && (!draft.areaName || normalize(option.areaName) === normalize(draft.areaName))
        && (!draft.cycleCode || normalize(option.cycleCode) === normalize(draft.cycleCode)));
      const numeric = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(value) : '';
      setNewSale(previous => ({ ...previous, customer: draft.customer || '', phone: String(draft.phone || '').replace(/[^0-9]/g, ''),
        address: draft.address || '', taxCode: draft.taxCode || '', date: draft.date || '',
        quantity: numeric(draft.quantity), totalWeight: numeric(draft.totalWeight), unitPrice: numeric(draft.unitPrice),
        paymentMethod: draft.paymentMethod || 'Tiền mặt', paymentStatus: ['PAID', 'DEBT', 'PARTIAL'].includes(draft.status) ? draft.status : 'DEBT',
        paidAmount: numeric(draft.paidAmount), flock: matches.length === 1 ? matches[0].id : '', note: draft.note || '' }));
    } catch (error) {
      if (!controller.signal.aborted) setOcrError(error.response?.data?.message || error.message || 'Không bóc tách được phiếu cân. Vui lòng thử lại.');
    } finally { if (!controller.signal.aborted) setOcrBusy(false); }
  }
  const [cycleOptions, setCycleOptions] = useState([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cyclesError, setCyclesError] = useState('');
  const openSaleModal = async (sale = null) => {
    clearOcr();
    setEditingSale(sale);
    setCycleOptions(sale ? [{ id: '__existing__', label: sale.flock }] : []);
    setSaveError('');
    requestId.current = null;
    if (sale) {
      const buyer = customers.find(customer => customer.name === sale.customer && customer.phone === sale.phone);
      setNewSale({ customer: sale.customer, phone: sale.phone || '', address: sale.address || '',
        taxCode: buyer?.taxCode || '', paymentMethod: buyer?.paymentMethod || 'Tiền mặt',
        date: sale.date, flock: '__existing__', quantity: String(sale.quantity), totalWeight: String(sale.totalWeight),
        unitPrice: String(sale.unitPrice), note: sale.note || '',
        paymentStatus: sale.totalAmount <= sale.paidAmount ? 'PAID' : sale.paidAmount > 0 ? 'PARTIAL' : 'DEBT',
        paidAmount: String(sale.paidAmount),
      });
    } else {
      setNewSale({ customer: '', phone: '', address: '', taxCode: '', paymentMethod: 'Tiền mặt',
        paymentStatus: 'PAID', paidAmount: '', date: new Date().toISOString().split('T')[0],
        flock: '', quantity: '', totalWeight: '', unitPrice: '', note: '' });
    }
    setShowAddModal(Boolean(sale));
    setCyclesLoading(true);
    setCyclesError('');
    try {
      const barns = await listBarns();
      const options = await Promise.all(barns.map(async barn => {
        const cycles = await listCycles(barn.id);
        return cycles.map(cycle => ({
          id: String(cycle.id), areaName: barn.areaName, barnName: barn.name, cycleCode: cycle.code,
          label: `${barn.areaName} - ${barn.name} - ${cycle.code || `Lứa ${cycle.cycleNumber}`}`,
        }));
      }));
      setCycleOptions(sale ? [{ id: '__existing__', label: sale.flock }, ...options.flat()] : options.flat());
    } catch {
      setCycleOptions([]);
      setCyclesError('Không thể tải khu nuôi - chuồng - lứa. Vui lòng thử lại.');
    } finally {
      setCyclesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'create') openSaleModal();
    else clearOcr();
  }, [activeTab]);

  const closeSaleForm = () => {
    setShowAddModal(false);
    if (activeTab === 'create') setActiveTab('orders');
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    if (saving || ocrBusy || (ocrFile && (!ocrDraft || ocrError))) return;
    const qty = Number(newSale.quantity) || 0;
    const weight = Number(newSale.totalWeight) || 0;
    const price = Number(newSale.unitPrice) || 0;
    const totalAmount = weight * price;

    const paidAmount = newSale.paymentStatus === 'PAID' ? totalAmount : newSale.paymentStatus === 'DEBT' ? 0 : Number(newSale.paidAmount);
    if (newSale.paymentStatus === 'PARTIAL' && (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount >= totalAmount)) {
      setSaveError('Số tiền đã trả phải lớn hơn 0 và nhỏ hơn tổng doanh thu.');
      return;
    }
    const flock = newSale.flock === '__existing__' && editingSale ? editingSale.flock : cycleOptions.find(option => option.id === newSale.flock)?.label;
    if (!flock) { setSaveError('Vui lòng chọn khu nuôi - chuồng - lứa.'); return; }
    requestId.current ||= crypto.randomUUID();
    setSaving(true);
    setSaveError('');
    try {
      const body = {
        id: editingSale?.id || requestId.current, date: newSale.date, customer: newSale.customer.trim(),
        phone: newSale.phone.trim(), address: newSale.address.trim(), taxCode: newSale.taxCode.trim(), paymentMethod: newSale.paymentMethod, flock,
        quantity: qty, totalWeight: weight, unitPrice: price,
        status: newSale.paymentStatus, paidAmount, note: newSale.note,
      };
      const created = editingSale ? await updateSalesOrder(editingSale.id, body) : ocrFile ? await confirmWeightSlip(body, ocrFile) : await createSalesOrder(body);
      clearOcr();
      requestId.current = null;
      setSales(previous => editingSale ? previous.map(sale => sale.id === created.id ? created : sale) : [created, ...previous]);
      setCustomerRevision(value => value + 1);
      setShowAddModal(false);
      if (!editingSale) setActiveTab('orders');
      setNewSale(previous => ({ ...previous, customer: '', phone: '', address: '', taxCode: '', paymentMethod: 'Tiền mặt', quantity: '', totalWeight: '', unitPrice: '', note: '', paymentStatus: 'PAID', paidAmount: '' }));
    } catch (error) {
      setSaveError(error.response?.data?.message || 'Không thể lưu đơn bán. Vui lòng thử lại.');
    } finally { setSaving(false); }
  };

  const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const searchWords = normalizeSearch(searchTerm).trim().split(/\s+/).filter(Boolean);
  const filteredSales = sales.filter(s => {
    if (customerFilter) return normalizeSearch(s.customer).trim() === normalizeSearch(customerFilter).trim();
    const searchable = normalizeSearch([s.code, s.customer, s.flock].join(' '));
    return searchWords.every(word => searchable.includes(word));
  });

  return (
    <FarmShiftLayout
      pageTitle="Quản lý bán hàng"
      breadcrumbTitle={activeTab === 'customers' ? 'Khách hàng' : activeTab === 'create' ? 'Tạo đơn bán hàng' : 'Danh sách đơn bán'}
      breadcrumbs={[{ label: 'Quản lý bán hàng' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
        </div>
      }
    >
      {/* ── Tabs Navigation ──────────────────────────────── */}
      <div className="farmshift-tabs">
        <button type="button" className={`farmshift-tab-btn ${activeTab === 'create' ? 'active' : ''}`} disabled={saving} onClick={() => setActiveTab('create')}>
          <Plus size={16} /> Tạo đơn bán hàng
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Danh sách đơn bán
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Khách hàng
        </button>
      </div>

      {/* ── Tab 1: Đơn bán hàng ──────────────────────────── */}
      {activeTab === 'orders' && (
        <>
          {customerFilter && <div className={styles.customerFilter}>
            <span>Hóa đơn của khách hàng: <strong>{customerFilter}</strong></span>
            <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={clearCustomerFilter}>Bỏ lọc</button>
          </div>}
          {ordersError && <p role="alert" className={styles.error}>{ordersError}</p>}
          <div className="farmshift-toolbar">
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm theo khách hàng, khu nuôi,....."
                aria-label="Tìm đơn bán theo khách hàng, khu nuôi, chuồng nuôi, lứa hoặc mã hóa đơn"
                value={customerFilter || searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (customerFilter) setSearchParams({ tab: 'orders' }, { replace: true });
                }}
              />
            </div>
          </div>

          <div className="farmshift-card">
            <div className={`farmshift-table-container ${styles.ordersContainer}`} style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.ordersTable}`}>
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Ngày xuất</th>
                    <th>Khách hàng</th>
                    <th>Khu nuôi/Chuồng/lứa</th>
                    <th>Số lượng xuất</th>
                    <th>Tổng trọng lượng</th>
                    <th>Đơn giá</th>
                    <th>Tổng doanh thu</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-muted)' }}>
                        <strong style={{ display: 'block', color: 'var(--color-ink)', marginBottom: '8px' }}>
                          {(customerFilter || searchTerm) ? 'Không tìm thấy đơn bán phù hợp' : 'Chưa có đơn bán hàng'}
                        </strong>
                        {(customerFilter || searchTerm) ? 'Thử tìm theo khách hàng, khu nuôi, chuồng nuôi hoặc lứa khác.' : 'Các đơn bán sau khi được tạo sẽ hiển thị tại đây.'}
                      </td>
                    </tr>
                  )}
                  {filteredSales.map(s => (
                    <tr key={s.id}>
                      <td>
                        <button type="button" className={styles.invoiceLink} onClick={() => { setInvoiceReady(false); setSelectedSale(s); }} aria-label={`Xem hóa đơn ${s.code}`}>
                          {s.code}
                        </button>
                      </td>
                      <td>{s.date}</td>
                      <td><strong>{s.customer}</strong></td>
                      <td>{s.flock}</td>
                      <td><strong>{s.quantity.toLocaleString()}</strong> con</td>
                      <td><strong>{s.totalWeight.toLocaleString('vi-VN')}</strong> kg</td>
                      <td>{s.unitPrice.toLocaleString('vi-VN')} đ/kg</td>
                      <td>
                        <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>
                          {s.totalAmount.toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>
                        <span>
                          {s.totalAmount - s.paidAmount > 0 ? `Còn nợ ${formatMoney(s.totalAmount - s.paidAmount)}` : 'Đã thanh toán'}
                        </span>
                      </td>
                      <td>{s.weightSlipUrl && <a href={s.weightSlipUrl} target="_blank" rel="noreferrer" className={styles.invoiceLink} aria-label={`Xem phiếu cân ${s.code}`}>Phiếu cân</a>}<button type="button" className={styles.editButton} onClick={() => openSaleModal(s)} title="Chỉnh sửa hóa đơn" aria-label={`Sửa hóa đơn ${s.code}`}><Pencil size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 3: Khách hàng thương lái ─────────────────── */}
      {activeTab === 'customers' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Khách hàng</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Họ và tên/ đơn vị</th>
                  <th>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  <th>Tổng mua lũy kế</th>
                  <th>Công nợ</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {customersLoading ? <tr><td colSpan={6} role="status">Đang tải khách hàng...</td></tr>
                  : customersError ? <tr><td colSpan={6} role="alert">{customersError} <button className="farmshift-btn farmshift-btn-secondary" onClick={() => { setCustomersLoading(true); setCustomersError(''); setCustomerRevision(value => value + 1); }}>Thử lại</button></td></tr>
                  : customers.length === 0 ? <tr><td colSpan={6}>Chưa có khách hàng.</td></tr>
                  : customers.slice(currentCustomerPage * 10, (currentCustomerPage + 1) * 10).map(c => (
                  <tr key={c.id}>
                    <td><button type="button" className={styles.customerLink} onClick={() => showCustomerOrders(c)} aria-label={`Xem hóa đơn của ${c.name}`}>{c.name}</button></td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.address || '—'}</td>
                    <td><strong>{formatMoney(c.totalBought)}</strong></td>
                    <td>
                      {formatMoney(c.debt)}
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{c.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Phân trang khách hàng" className={styles.pagination}>
            <span>{customers.length ? `${currentCustomerPage * 10 + 1}–${Math.min((currentCustomerPage + 1) * 10, customers.length)} / ${customers.length} khách hàng` : '0 khách hàng'}</span>
            <div>
              <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={customersLoading || currentCustomerPage === 0} onClick={() => setCustomerPage(currentCustomerPage - 1)}>Trước</button>
              <span>Trang {currentCustomerPage + 1} / {customerPageCount}</span>
              <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={customersLoading || currentCustomerPage + 1 >= customerPageCount} onClick={() => setCustomerPage(currentCustomerPage + 1)}>Sau</button>
            </div>
          </nav>
        </div>
      )}

      {selectedSale && (
        <div className="farmshift-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setSelectedSale(null); }}>
          <div className={`farmshift-modal ${styles.modal} ${styles.invoiceModal}`} role="dialog" aria-modal="true" aria-label="Hóa đơn bán hàng">
            <div className={`farmshift-modal-header ${styles.invoiceHeader}`}>
              <button type="button" className={styles.closeButton} aria-label="Đóng chi tiết hóa đơn" onClick={() => setSelectedSale(null)}><X size={18} /></button>
            </div>
            <div className={styles.invoiceBody}><SalesInvoiceTemplate ref={invoiceRef} key={selectedSale.id} orderId={selectedSale.id} onReady={setInvoiceReady} /></div>
            <div className="farmshift-modal-footer"><button type="button" className="farmshift-btn farmshift-btn-mint" disabled={!invoiceReady} onClick={() => invoiceRef.current?.print()}><Printer size={16} />Xuất hóa đơn</button></div>
          </div>
        </div>
      )}

      {/* Creation lives in its own tab; editing keeps the existing dialog. */}
      {(activeTab === 'create' || showAddModal) && (
        <div className={showAddModal ? 'farmshift-modal-backdrop' : styles.salePage} onClick={event => { if (showAddModal && event.target === event.currentTarget && !saving) closeSaleForm(); }}>
          <div className={showAddModal ? `farmshift-modal ${styles.modal} ${styles.saleModal}` : `farmshift-card ${styles.salePageCard}`} role={showAddModal ? 'dialog' : 'region'} aria-modal={showAddModal ? true : undefined} aria-labelledby="sale-modal-title">
            <div className="farmshift-modal-header">
              <h3 id="sale-modal-title" className="farmshift-modal-title">{editingSale ? `Chỉnh sửa hóa đơn ${editingSale.code}` : 'Tạo đơn bán hàng'}</h3>
              {!editingSale && <button type="button" className="farmshift-btn farmshift-btn-mint" disabled={saving || ocrBusy || cyclesLoading} onClick={() => setShowCapture(true)}><ScanText size={16} />Bóc tách phiếu cân</button>}
              {showAddModal && <button
                disabled={saving}
                onClick={closeSaleForm}
                type="button"
                className={styles.closeButton}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>}
            </div>
            <div className={ocrFile ? styles.ocrReview : undefined}>
            {ocrFile && <aside className={styles.weightPreview} aria-label="Phiếu cân gốc">
              <h4>Phiếu cân gốc</h4>
              {ocrPreview && (ocrFile.type === 'application/pdf' ? <iframe src={ocrPreview} title="PDF phiếu cân gốc" /> : <img src={ocrPreview} alt="Ảnh phiếu cân gốc" />)}
              <div className={styles.captureActions}><button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving || ocrBusy} onClick={() => setShowCapture(true)}>Chọn phiếu khác</button><button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} onClick={clearOcr}>Bỏ phiếu cân</button></div>
              {ocrDraft?.referenceCode && <p>Mã phiếu: {ocrDraft.referenceCode}</p>}
              {ocrDraft?.barnName && <p>Trên phiếu: {ocrDraft.areaName || ''} / {ocrDraft.barnName} {ocrDraft.cycleCode || ''}</p>}
            </aside>}
            <form className={styles.saleForm} onSubmit={handleCreateSale}>
              <div className={`farmshift-modal-body ${styles.saleBody}`}>
                {ocrBusy && <p role="status" className={styles.fullField}>Đang bóc tách phiếu cân, vui lòng chờ...</p>}
                {ocrError && <p role="alert" className={`${styles.error} ${styles.fullField}`}>{ocrError}</p>}
                {ocrDraft && <div className={`${styles.ocrNotice} ${styles.fullField}`}><strong>Đối chiếu phiếu cân trước khi xác nhận</strong><p>Các mục không đọc rõ cần nhập bổ sung. Kiểm tra cân thực tế đã trừ bì, đơn giá và trạng thái thanh toán.</p>
                  {!ocrDraft.status && <p>Phiếu chưa thể hiện thanh toán: đang chọn Nợ, vui lòng kiểm tra lại.</p>}
                  {(ocrDraft.warnings || []).map((warning, index) => <p key={index}>{String(warning)}</p>)}
                  {!!ocrDraft.weighings?.length && <details><summary>Chi tiết các lượt cân đã đọc</summary><div className={styles.weighingTable}><table className="farmshift-table"><thead><tr><th>Mã cân</th><th>Số con</th><th>Cả lồng (kg)</th><th>Bì (kg)</th><th>Thực tế (kg)</th></tr></thead><tbody>{ocrDraft.weighings.map((row, index) => <tr key={index}><td>{row.code ?? '—'}</td><td>{row.quantity ?? '—'}</td><td>{row.grossWeight ?? '—'}</td><td>{row.tareWeight ?? '—'}</td><td>{row.netWeight ?? '—'}</td></tr>)}</tbody></table></div></details>}
                </div>}
                {saveError && <p role="alert" className={styles.error}>{saveError}</p>}
                <div className={styles.fieldRow}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Người mua <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      required
                      value={newSale.customer}
                      onChange={event => {
                        const name = event.target.value;
                        const matches = customers.filter(customer => customer.name?.trim().toLowerCase() === name.trim().toLowerCase());
                        const existing = matches.length === 1 ? matches[0] : null;
                        setNewSale(previous => ({ ...previous, customer: name, ...(existing ? { phone: existing.phone || '', address: existing.address || '', taxCode: existing.taxCode || '', paymentMethod: existing.paymentMethod || 'Tiền mặt' } : {}) }));
                      }}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày xuất chuồng <span className={styles.required}>*</span></label>
                    <input
                      type="date"
                      required
                      className="farmshift-form-control"
                      value={newSale.date}
                      onChange={(e) => setNewSale({ ...newSale, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label" htmlFor="sale-phone">Số điện thoại <span className={styles.required}>*</span></label>
                  <input id="sale-phone" type="tel" inputMode="numeric" pattern="[0-9]{10,11}" maxLength={11} required className="farmshift-form-control" value={newSale.phone} onChange={event => setNewSale({ ...newSale, phone: event.target.value.replace(/[^0-9]/g, '') })} />
                </div>
                <div className={`farmshift-form-group ${styles.wideField}`}>
                  <label className="farmshift-form-label" htmlFor="sale-address">Địa chỉ <span className={styles.required}>*</span></label>
                  <input id="sale-address" required maxLength={255} className="farmshift-form-control" value={newSale.address} onChange={event => setNewSale({ ...newSale, address: event.target.value })} />
                </div>


                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Khu nuôi - chuồng - lứa <span className={styles.required}>*</span></label>
                  <select
                    className="farmshift-form-control"
                    required
                    disabled={cyclesLoading || !!cyclesError}
                    value={newSale.flock}
                    onChange={(e) => setNewSale({ ...newSale, flock: e.target.value })}
                  >
                    <option value="">{cyclesLoading ? 'Đang tải...' : 'Chọn khu nuôi - chuồng - lứa'}</option>
                    {cycleOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  {cyclesError && <p role="alert" className={styles.error}>{cyclesError} <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => openSaleModal(editingSale)}>Thử lại</button></p>}
                  {!cyclesLoading && !cyclesError && cycleOptions.length === 0 && <p className={styles.hint}>Chưa có lứa nuôi trong cơ sở dữ liệu.</p>}
                </div>

                <div className={styles.fieldRow}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số con xuất <span className={styles.required}>*</span></label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="VD: 1000"
                      className="farmshift-form-control"
                      step="1"
                      value={newSale.quantity}
                      onChange={(e) => setNewSale({ ...newSale, quantity: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Tổng khối lượng (kg) <span className={styles.required}>*</span></label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      placeholder="VD: 2150"
                      className="farmshift-form-control"
                      value={newSale.totalWeight}
                      onChange={(e) => setNewSale({ ...newSale, totalWeight: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Đơn giá (đ/kg) <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[1-9][0-9.]*"
                      title="Nhập đơn giá lớn hơn 0"
                      required
                      placeholder="VD: 78.000"
                      className="farmshift-form-control"
                      value={newSale.unitPrice.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      onChange={(e) => setNewSale({ ...newSale, unitPrice: e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '') })}
                    />
                  </div>
                </div>

                <div className={`${styles.customerInvoiceFields} ${styles.fullField}`}>
                  <div className="farmshift-form-group"><label className="farmshift-form-label" htmlFor="sale-tax-code">Mã số thuế</label><input id="sale-tax-code" className="farmshift-form-control" maxLength={50} value={newSale.taxCode} onChange={event => setNewSale({ ...newSale, taxCode: event.target.value })} /></div>
                  <div className="farmshift-form-group"><label className="farmshift-form-label" htmlFor="sale-payment-method">Hình thức thanh toán <span className={styles.required}>*</span></label><select id="sale-payment-method" className="farmshift-form-control" required value={newSale.paymentMethod} onChange={event => setNewSale({ ...newSale, paymentMethod: event.target.value })}><option value="Tiền mặt">Tiền mặt</option><option value="Chuyển khoản">Chuyển khoản</option><option value="Tiền mặt / Chuyển khoản">Tiền mặt / Chuyển khoản</option>{newSale.paymentMethod && !['Tiền mặt','Chuyển khoản','Tiền mặt / Chuyển khoản'].includes(newSale.paymentMethod) && <option value={newSale.paymentMethod}>{newSale.paymentMethod}</option>}</select></div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label" htmlFor="sale-payment-status">Trạng thái <span className={styles.required}>*</span></label>
                  <select id="sale-payment-status" className="farmshift-form-control" required value={newSale.paymentStatus} onChange={event => setNewSale({ ...newSale, paymentStatus: event.target.value })}>
                    <option value="PAID">Đã thanh toán</option><option value="DEBT">Nợ</option><option value="PARTIAL">Thanh toán 1 phần</option>
                  </select>
                </div>
                {newSale.paymentStatus === 'PARTIAL' && <div className="farmshift-form-group">
                  <label className="farmshift-form-label" htmlFor="sale-paid-amount">Số tiền đã trả (đ) <span className={styles.required}>*</span></label>
                  <input id="sale-paid-amount" type="text" inputMode="numeric" required pattern="[1-9][0-9.]*" title="Nhập số tiền đã trả lớn hơn 0" className="farmshift-form-control" value={newSale.paidAmount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} onChange={event => setNewSale({ ...newSale, paidAmount: event.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '') })} />
                </div>}

                <div className={`farmshift-form-group ${newSale.paymentStatus === 'PARTIAL' ? styles.fullField : styles.wideField}`}>
                  <label className="farmshift-form-label">Ghi chú xuất bán</label>
                  <input
                    type="text"
                    className="farmshift-form-control"
                    value={newSale.note}
                    onChange={(e) => setNewSale({ ...newSale, note: e.target.value })}
                  />
                </div>
                <p className={styles.saleTotal}>Tổng tiền: <strong>{formatMoney(Number(newSale.totalWeight) * Number(newSale.unitPrice))}</strong></p>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  disabled={saving}
                onClick={closeSaleForm}
                >
                  Hủy
                </button>
                <button type="submit" disabled={saving || ocrBusy || !!ocrError || (ocrFile && !ocrDraft)} className="farmshift-btn farmshift-btn-mint">
                  {saving ? 'Đang lưu...' : editingSale ? 'Lưu thay đổi' : ocrFile ? 'Xác nhận và lưu đơn bán' : 'Lưu đơn bán'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {showCapture && <WeightSlipCapture onFile={readWeightSlip} onClose={() => setShowCapture(false)} />}
    </FarmShiftLayout>
  );
};
