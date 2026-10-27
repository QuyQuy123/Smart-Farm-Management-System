// src/features/farmshift/PurchasesView.jsx
// Quản lý Hóa đơn nhập hàng, Nhà cung cấp & Tags chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, FileSpreadsheet, Eye, ScanText,
  DollarSign, Upload, Tag, Printer,
  Trash2, Pencil, AlertTriangle, PackageCheck, Loader2,
  ZoomIn, ZoomOut, RotateCw, ExternalLink, FileText,
  Camera, RefreshCw, Smartphone, Check, ArrowLeft
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import {
  listPurchases,
  createPurchase,
  importStock,
  payPurchase,
  cancelPurchase,
  ocrPurchase,
  listPurchaseTags,
  createPurchaseTag,
  updatePurchaseTag,
  deletePurchaseTag
} from '../../services/purchaseService';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../services/supplierService';
import { listProductTypes } from '../../services/productTypeService';
import { listProductCategories } from '../../services/productCategoryService';
import { listMeasurementUnits } from '../../services/measurementUnitService';
import styles from './PurchasesView.module.css';
import { PurchaseRowActions } from './PurchaseRowActions';
import { ConfirmStockImport } from './ConfirmStockImport';
import { PrintablePurchaseVoucher } from './PrintablePurchaseVoucher';

export const PurchasesView = () => {
  const { showToast } = useNotification();
  const { user } = useAuth();
  const isOwnerOrAccountant = user?.role === 'ROLE_FARM_OWNER' || user?.role === 'ROLE_ACCOUNTANT';

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'suppliers' | 'tags'
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [tags, setTags] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState('');
  const [productRevision, setProductRevision] = useState(0);
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');
  const [creationTime, setCreationTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [filterStock, setFilterStock] = useState('ALL');
  const [filterTag, setFilterTag] = useState('ALL');
  const [revision, setRevision] = useState(0);

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderViewTab, setOrderViewTab] = useState('info'); // 'info' | 'voucher'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrBanner, setOcrBanner] = useState(false);
  const [isOcrDraft, setIsOcrDraft] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrWarnings, setOcrWarnings] = useState([]);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState(null);
  const [ocrPreviewName, setOcrPreviewName] = useState('');
  const [ocrPreviewType, setOcrPreviewType] = useState('image/png');
  const [ocrZoom, setOcrZoom] = useState(1);
  const [ocrRotation, setOcrRotation] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const [ocrTab, setOcrTab] = useState('upload'); // 'upload' | 'camera'
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [cameraError, setCameraError] = useState('');
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [stockConfirmation, setStockConfirmation] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Supplier modal
  const [supplierModal, setSupplierModal] = useState(null); // { mode: 'create'|'edit'|'delete', item }
  const [supplierForm, setSupplierForm] = useState({
    name: '', representative: '', phone: '', productTypeId: '',
    email: '', address: '', taxCode: '', bankName: '', bankAccount: '',
    paymentPolicy: 'Trả theo đơn', note: '', tagIds: []
  });

  // Tag modal
  const [tagModal, setTagModal] = useState(null); // { mode: 'create'|'edit'|'delete', item }
  const [tagForm, setTagForm] = useState({ name: '', color: '#019788', description: '' });

  // Direct Frontend Validation Error States
  const [poErrors, setPoErrors] = useState({});
  const poErrorMessages = Object.entries(poErrors).flatMap(([field, value]) =>
    field === 'items' ? (value || []).flatMap((row, index) => Object.values(row || {}).filter(Boolean).map(message => `Dòng ${index + 1}: ${message}`))
      : value ? [value] : []).concat(!isOcrDraft && productError ? [productError] : [], !isOcrDraft && unitsError ? [unitsError] : []);

  const [supplierErrors, setSupplierErrors] = useState({});
  const [tagErrors, setTagErrors] = useState({});
  const [paymentError, setPaymentError] = useState('');

  // New purchase state
  const [newPo, setNewPo] = useState({
    supplierId: '',
    supplierName: '',
    supplierTaxCode: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
    referenceCode: '',
    paymentStatus: 'Trả sau',
    paidAmount: '',
    stockStatus: 'Chưa nhập kho',
    tagIds: [],
    items: [
      { productCategoryId: '', name: '', qty: 1, unit: '', price: 0 }
    ]
  });

  // Re-fetch trigger
  const fetchData = useCallback(() => {
    setLoading(true);
    setRevision(r => r + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pos, sups, tgs, pts, cats] = await Promise.all([
          listPurchases(searchTerm, filterPayment).catch(() => []),
          listSuppliers().catch(() => []),
          listPurchaseTags().catch(() => []),
          listProductTypes().catch(() => []),
          listProductCategories().catch(() => [])
        ]);
        if (!cancelled) {
          setPurchases(Array.isArray(pos) ? pos : []);
          setSuppliers(Array.isArray(sups) ? sups : []);
          setTags(Array.isArray(tgs) ? tgs : []);
          setProductTypes(Array.isArray(pts) ? pts : []);
          setProductCategories(Array.isArray(cats) ? cats : []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu Hóa đơn nhập hàng:', err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchTerm, filterPayment, revision]);

  useEffect(() => {
    const handleAiAction = (event) => {
      const action = event.detail;
      if (!action) return;
      if (action.executed || action.uiCommand === 'REFRESH_DATA') {
        fetchData();
      }
      if (action.uiCommand === 'OPEN_CREATE_PURCHASE_MODAL') {
        setShowAddModal(true);
        if (action.prefillData) {
          setNewPo(prev => ({
            ...prev,
            supplierName: action.prefillData.supplierName || prev.supplierName,
            supplierId: action.prefillData.supplierId || prev.supplierId,
            date: action.prefillData.date || prev.date
          }));
        }
      }
    };
    window.addEventListener('farmshift:ai-action', handleAiAction);
    return () => window.removeEventListener('farmshift:ai-action', handleAiAction);
  }, [fetchData]);

  useEffect(() => {
    if (!showAddModal || isOcrDraft) return;
    let cancelled = false;
    setProductLoading(true); setProductError('');
    listProductCategories().then(data => { if (!cancelled) setProductCategories(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) { setProductCategories([]); setProductError('Không tải được hàng hóa từ database. Vui lòng thử lại.'); } })
      .finally(() => { if (!cancelled) setProductLoading(false); });
    return () => { cancelled = true; };
  }, [showAddModal, productRevision, isOcrDraft]);

  useEffect(() => {
    if (!showAddModal || isOcrDraft) return;
    let cancelled = false;
    setUnitsLoading(true); setUnitsError('');
    listMeasurementUnits().then(data => { if (!cancelled) setUnits(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) { setUnits([]); setUnitsError('Không tải được đơn vị tính. Vui lòng thử lại.'); } })
      .finally(() => { if (!cancelled) setUnitsLoading(false); });
    return () => { cancelled = true; };
  }, [showAddModal, productRevision, isOcrDraft]);

  useEffect(() => {
    if (!showAddModal) return;
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setCreationTime(now.toLocaleString('vi-VN', { hour12: false }));
    setNewPo(previous => ({ ...previous, date, paymentStatus: 'Trả sau', stockStatus: 'Chưa nhập kho', paidAmount: '' }));
  }, [showAddModal]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  const handleVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && cameraStream) {
      node.srcObject = cameraStream;
      node.play().catch(() => {});
    }
  }, [cameraStream]);

  useEffect(() => {
    if (ocrTab === 'camera' && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, ocrTab]);

  const startCamera = async (facing = facingMode) => {
    setCameraError('');
    setIsCameraStarting(true);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Thiết bị không hỗ trợ camera trực tiếp');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing ? { ideal: facing } : undefined,
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 }
          },
          audio: false
        });
      } catch (errFallback) {
        console.warn('Fallback to basic video constraints:', errFallback);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setCameraError('Không thể mở camera (thiết bị không hỗ trợ hoặc chưa cấp quyền). Bạn có thể bấm "App máy ảnh" hoặc tải ảnh từ thiết bị.');
    } finally {
      setIsCameraStarting(false);
    }
  };

  const handleRetakeOcr = () => {
    setShowAddModal(false);
    setOcrBanner(false);
    setIsOcrDraft(false);
    setOcrPreviewUrl(null);
    setOcrRotation(0);
    setOcrWarnings([]);
    setShowOcrModal(true);
    setOcrTab('upload');
  };

  const handleSwitchFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopCamera();

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `hoa-don-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleTriggerOcr(file);
      }
    }, 'image/jpeg', 0.95);
  };

  const handleCloseOcrModal = useCallback(() => {
    if (ocrLoading) return;
    stopCamera();
    setShowOcrModal(false);
    setOcrTab('upload');
    setCameraError('');
  }, [ocrLoading, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Escape key closes open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showPaymentModal) {
          setShowPaymentModal(false);
          setPaymentError('');
        } else if (showOcrModal) {
          if (!ocrLoading) handleCloseOcrModal();
        } else if (showAddModal) {
          setShowAddModal(false);
          setPoErrors({});
          setOcrBanner(false); setIsOcrDraft(false);
          setOcrWarnings([]);
        } else if (supplierModal) {
          setSupplierModal(null);
          setSupplierErrors({});
        } else if (tagModal) {
          setTagModal(null);
          setTagErrors({});
        } else if (selectedOrder) {
          setSelectedOrder(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPaymentModal, showOcrModal, showAddModal, supplierModal, tagModal, selectedOrder, ocrLoading, handleCloseOcrModal]);

  // Helper to clear PO item error for a specific row and field
  const clearItemError = (idx, field) => {
    setPoErrors(prev => {
      if (!prev.items || !prev.items[idx] || !prev.items[idx][field]) return prev;
      const nextItems = [...prev.items];
      nextItems[idx] = { ...nextItems[idx], [field]: '' };
      return { ...prev, items: nextItems };
    });
  };

  // 1. Validator for PO Creation
  const validatePoForm = () => {
    const errs = {};
    const hasSupplier = newPo.supplierId === '__NEW__' || (newPo.supplierId && newPo.supplierId !== '') || (newPo.supplierName && newPo.supplierName.trim());
    if (!hasSupplier) {
      errs.supplierId = 'Vui lòng chọn nhà cung cấp.';
    }
    if (!newPo.date) {
      errs.date = 'Vui lòng chọn ngày lập hóa đơn.';
    }

    if (!isOcrDraft && (productLoading || productError || unitsLoading || unitsError)) errs.itemsGeneral = 'Vui lòng tải danh sách hàng hóa trước khi lưu.';
    const itemsErrs = [];
    let hasItemErr = false;
    if (!newPo.items || newPo.items.length === 0) {
      errs.itemsGeneral = 'Hóa đơn phải có ít nhất một mặt hàng.';
    } else {
      newPo.items.forEach((it, idx) => {
        const itemErr = {};
        if (isOcrDraft ? (!it.name?.trim() || it.name.trim().length > 200) : !productCategories.some(product => String(product.id) === String(it.productCategoryId) && product.warehouseId)) {
          itemErr.name = isOcrDraft ? 'Vui lòng nhập tên hàng hóa từ chứng từ, tối đa 200 ký tự.' : 'Vui lòng chọn hàng hóa thuộc kho trong danh sách.';
          hasItemErr = true;
        }
        const qtyNum = Number(it.qty);
        if (it.qty === '' || it.qty === null || it.qty === undefined || !Number.isFinite(qtyNum) || qtyNum <= 0) {
          itemErr.qty = 'Số lượng phải lớn hơn 0.';
          hasItemErr = true;
        }
        if (isOcrDraft ? (!it.unit?.trim() || it.unit.trim().length > 50) : !units.some(unit => unit.name === it.unit)) {
          itemErr.unit = isOcrDraft ? 'Vui lòng nhập đơn vị tính từ chứng từ, tối đa 50 ký tự.' : 'Vui lòng chọn đơn vị tính trong danh sách.';
          hasItemErr = true;
        }
        const priceNum = Number(it.price);
        if (it.price === '' || it.price === null || it.price === undefined || !/^\d+$/.test(String(it.price)) || !Number.isSafeInteger(priceNum) || priceNum <= 0) {
          itemErr.price = 'Đơn giá phải là số nguyên lớn hơn 0.';
          hasItemErr = true;
        }
        itemsErrs[idx] = itemErr;
      });
      if (hasItemErr) {
        errs.items = itemsErrs;
      }
    }

    const subtotal = (newPo.items || []).reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
    const discount = Number(newPo.discountAmount || 0);
    const otherCost = Number(newPo.otherCost || 0);

    if (newPo.discountAmount !== '' && newPo.discountAmount !== null && newPo.discountAmount !== undefined) {
      if (!Number.isSafeInteger(discount) || discount < 0) {
        errs.discountAmount = 'Chiết khấu phải là số nguyên không âm.';
      } else if (discount > subtotal) {
        errs.discountAmount = `Chiết khấu không được vượt quá tiền hàng (${subtotal.toLocaleString('vi-VN')} đ).`;
      }
    }

    if (newPo.otherCost !== '' && newPo.otherCost !== null && newPo.otherCost !== undefined) {
      if (!Number.isSafeInteger(otherCost) || otherCost < 0) {
        errs.otherCost = 'Chi phí khác phải là số nguyên không âm.';
      }
    }

    const totalAmt = Math.max(0, subtotal - discount + otherCost);

    if (newPo.paymentStatus === 'Thanh toán một phần') {
      const paid = Number(newPo.paidAmount);
      if (newPo.paidAmount === '' || newPo.paidAmount === null || newPo.paidAmount === undefined || !Number.isSafeInteger(paid) || paid <= 0) {
        errs.paidAmount = 'Vui lòng nhập số tiền trả trước lớn hơn 0.';
      } else if (paid > totalAmt) {
        errs.paidAmount = `Số tiền trả trước không được vượt quá tổng tiền hóa đơn (${totalAmt.toLocaleString('vi-VN')} đ).`;
      }
    }

    if (newPo.referenceCode && (!/^[\p{L}\p{N}\s._/()-]+$/u.test(newPo.referenceCode) || newPo.referenceCode.length > 100))
      errs.referenceCode = 'Số chứng từ chỉ gồm chữ, số và ký tự . _ / ( ) -, tối đa 100 ký tự.';
    // eslint-disable-next-line no-control-regex
    if (newPo.note?.trim() && (!/\p{L}/u.test(newPo.note) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(newPo.note) || newPo.note.length > 1000))
      errs.note = 'Ghi chú phải có nội dung chữ, tối đa 1000 ký tự.';
    return errs;
  };

  const validatePoField = (field, index) => {
    const errors = validatePoForm();
    setPoErrors(previous => {
      if (index !== undefined) {
        const items = [...(previous.items || [])];
        items[index] = { ...items[index], [field]: errors.items?.[index]?.[field] || '' };
        return { ...previous, items };
      }
      return { ...previous, [field]: errors[field] || '' };
    });
  };

  // 2. Validator for Supplier
  const validateSupplierForm = () => {
    const errs = {};
    const name = (supplierForm.name || '').trim();
    if (!name) {
      errs.name = 'Vui lòng nhập đơn vị cung cấp.';
    } else if (name.length < 2) {
      errs.name = 'Tên nhà cung cấp phải có ít nhất 2 ký tự.';
    } else if (name.length > 200) {
      errs.name = 'Tên nhà cung cấp không vượt quá 200 ký tự.';
    }

    const rep = (supplierForm.representative || '').trim();
    if (!rep) {
      errs.representative = 'Vui lòng nhập người đại diện.';
    } else if (rep.length < 2) {
      errs.representative = 'Người đại diện phải có ít nhất 2 ký tự.';
    } else if (rep.length > 100) {
      errs.representative = 'Tên người đại diện không vượt quá 100 ký tự.';
    }

    const rawPhone = (supplierForm.phone || '').trim();
    if (!rawPhone) {
      errs.phone = 'Vui lòng nhập số điện thoại.';
    } else {
      const cleanPhone = rawPhone.replace(/[\s.-]/g, '').replace(/^\+84/, '0');
      const phoneRegex = /^0[0-9]{9,10}$/;
      if (!phoneRegex.test(cleanPhone)) {
        errs.phone = 'Số điện thoại không hợp lệ (cần 10 hoặc 11 chữ số, ví dụ: 0912345678 hoặc 02838221133).';
      }
    }

    const effectiveTypeId = supplierForm.productTypeId || productTypes[0]?.id || 1;
    if (!effectiveTypeId) {
      errs.productTypeId = 'Vui lòng chọn nhóm nhà cung cấp.';
    }

    if (supplierForm.email && supplierForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(supplierForm.email.trim())) {
        errs.email = 'Địa chỉ email không đúng định dạng.';
      }
    }

    if (supplierForm.taxCode && supplierForm.taxCode.trim()) {
      const cleanTax = supplierForm.taxCode.replace(/[\s-]/g, '');
      if (!/^[0-9]{10}$|^[0-9]{13}$/.test(cleanTax)) {
        errs.taxCode = 'Mã số thuế phải gồm 10 hoặc 13 chữ số.';
      }
    }

    return errs;
  };

  // 3. Validator for Tag
  const validateTagForm = () => {
    const errs = {};
    const name = (tagForm.name || '').trim();
    if (!name) {
      errs.name = 'Vui lòng nhập tên thẻ phân loại.';
    } else if (name.length < 2) {
      errs.name = 'Tên thẻ Tag phải có ít nhất 2 ký tự.';
    } else if (name.length > 100) {
      errs.name = 'Tên thẻ không được vượt quá 100 ký tự.';
    } else {
      const isDup = tags.some(t =>
        t.name?.trim().toLowerCase() === name.toLowerCase() &&
        (tagModal?.mode !== 'edit' || t.id !== tagModal?.item?.id)
      );
      if (isDup) {
        errs.name = 'Tên thẻ Tag này đã tồn tại trong danh sách.';
      }
    }

    const color = (tagForm.color || '').trim();
    if (!color) {
      errs.color = 'Vui lòng chọn màu sắc nhận diện.';
    } else if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
      errs.color = 'Mã màu phải là mã HEX hợp lệ (ví dụ: #019788).';
    }

    return errs;
  };

  // 4. Validator for Payment
  const validatePaymentForm = () => {
    if (!paymentAmount || String(paymentAmount).trim() === '' || isNaN(Number(paymentAmount))) {
      return 'Vui lòng nhập số tiền thanh toán.';
    }
    const amt = Number(paymentAmount);
    if (amt <= 0) {
      return 'Số tiền thanh toán phải lớn hơn 0.';
    }
    const maxDebt = Number(selectedOrder?.debtAmount || 0);
    if (amt > maxDebt) {
      return `Số tiền thanh toán không được vượt quá số nợ còn lại (${maxDebt.toLocaleString('vi-VN')} đ).`;
    }
    return '';
  };

  // Handlers for PO
  const handleAddItemRow = () => {
    setNewPo(prev => ({
      ...prev,
      items: [...prev.items, { productCategoryId: '', name: '', qty: 1, unit: '', price: 0 }]
    }));
    setPoErrors(prev => {
      if (!prev.items) return prev;
      return { ...prev, items: [...prev.items, {}] };
    });
  };

  const handleRemoveItemRow = (idx) => {
    if (newPo.items.length <= 1) return;
    setNewPo(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
    setPoErrors(prev => {
      if (!prev.items) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== idx) };
    });
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    const errors = validatePoForm();
    if (Object.keys(errors).length > 0) {
      setPoErrors(errors);
      return;
    }
    setPoErrors({});
    try {
      const subtotal = newPo.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
      const discount = Number(newPo.discountAmount || 0);
      const otherCost = Number(newPo.otherCost || 0);
      const totalAmt = Math.max(0, subtotal - discount + otherCost);
      const paid = newPo.paymentStatus === 'Thanh toán hoàn tất'
        ? totalAmt
        : newPo.paymentStatus === 'Thanh toán một phần'
          ? Math.min(totalAmt, Math.max(0, Number(newPo.paidAmount || 0)))
          : 0;

      const finalStatus = newPo.paymentStatus === 'Thanh toán hoàn tất'
        ? 'Thanh toán hoàn tất'
        : newPo.paymentStatus === 'Trả sau'
          ? 'Trả sau'
          : (paid >= totalAmt && totalAmt > 0)
            ? 'Thanh toán hoàn tất'
            : (paid > 0)
              ? 'Thanh toán một phần'
              : 'Trả sau';

      const isNewSup = newPo.supplierId === '__NEW__' || (!newPo.supplierId && newPo.supplierName);
      const payload = {
        supplierId: isNewSup ? null : Number(newPo.supplierId),
        supplierName: newPo.supplierName || (suppliers.find(s => String(s.id) === String(newPo.supplierId))?.name || ''),
        date: newPo.date,
        referenceCode: newPo.referenceCode,
        note: newPo.note,
        paymentStatus: finalStatus,
        paidAmount: paid,
        stockStatus: newPo.stockStatus,
        discountAmount: discount,
        otherCost: otherCost,
        tagIds: newPo.tagIds,
        items: newPo.items.map(it => ({
          productCategoryId: !isOcrDraft && it.productCategoryId ? Number(it.productCategoryId) : null,
          name: it.name,
          qty: Number(it.qty),
          unit: it.unit,
          price: Number(it.price)
        }))
      };

      const created = await createPurchase(payload);
      showToast('Đã lưu các thay đổi thành công.', 'success');
      setShowAddModal(false);
      setPoErrors({});
      setOcrBanner(false); setIsOcrDraft(false);
      setOcrWarnings([]);
      fetchData();
      if (created) setSelectedOrder(created);
    } catch (err) {
      setPoErrors({ server: err.response?.data?.message || 'Không thể lưu thay đổi. Vui lòng thử lại.' });
    }
  };

  const handleImportStock = async (poId) => {
    try {
      const updated = await importStock(poId);
      showToast('Đã xác nhận nhập kho và cập nhật số dư tồn kho.', 'success');
      setSelectedOrder(updated);
      fetchData();
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi xác nhận nhập kho.', 'error');
      return false;
    }
  };

  const handlePayOrder = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const error = validatePaymentForm();
    if (error) {
      setPaymentError(error);
      showToast(error, 'warning');
      return;
    }
    try {
      const updated = await payPurchase(selectedOrder.id, {
        amount: Number(paymentAmount),
        note: paymentNote
      });
      showToast('Đã ghi nhận thanh toán thành công.', 'success');
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentError('');
      setSelectedOrder(updated);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể thanh toán.', 'error');
    }
  };

  const handleCancelPo = async (poId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn nhập hàng này?')) return;
    try {
      await cancelPurchase(poId);
      showToast('Đã hủy đơn nhập hàng thành công.', 'success');
      setSelectedOrder(null);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Bản ghi đã quyết toán không thể bị xóa. Vui lòng sử dụng điều chỉnh hoặc đính chính được cấp quyền.', 'error');
    }
  };

  const handleTriggerOcr = async (fileOrNull = null) => {
    try {
      setOcrLoading(true);
      let previewUrl = null;
      let previewName = '';
      let previewType = 'image/png';

      if (fileOrNull && (fileOrNull instanceof File || fileOrNull instanceof Blob)) {
        previewName = fileOrNull.name || 'chung_tu_goc.png';
        previewType = fileOrNull.type || 'image/png';
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          try {
            previewUrl = URL.createObjectURL(fileOrNull);
          } catch {
            previewUrl = '/samples/hoa_don_mau_cp.png';
          }
        } else {
          previewUrl = '/samples/hoa_don_mau_cp.png';
        }
      } else {
        previewUrl = '/samples/hoa_don_mau_cp.png';
        previewName = 'hoa_don_mau_cp.png';
        previewType = 'image/png';
      }

      setOcrPreviewUrl(previewUrl);
      setOcrPreviewName(previewName);
      setOcrPreviewType(previewType);
      setOcrZoom(1);
      setOcrRotation(0);

      const data = await ocrPurchase(fileOrNull);
      const matchedSup = data.supplierId
        ? suppliers.find(s => s.id === data.supplierId)
        : (data.supplierName ? suppliers.find(s => s.name?.toLowerCase() === data.supplierName?.toLowerCase()) : null);

      const defaultTags = matchedSup?.tagIds ? [...matchedSup.tagIds] : [];
      const isNewSup = !matchedSup && !!data.supplierName;

      setNewPo(prev => ({
        ...prev,
        supplierId: matchedSup ? String(matchedSup.id) : (isNewSup ? '__NEW__' : ''),
        supplierName: matchedSup ? matchedSup.name : (data.supplierName || ''),
        supplierTaxCode: data.supplierTaxCode || '',
        date: data.invoiceDate || new Date().toISOString().split('T')[0],
        referenceCode: data.referenceCode || '',
        note: (data.note && !data.note.toLowerCase().includes('trích xuất')) ? data.note : '',
        discountAmount: data.discountAmount || 0,
        otherCost: data.otherCost || 0,
        paymentStatus: data.paymentStatus || (data.paidAmount > 0 ? (data.paidAmount >= (data.totalAmount || 0) ? 'Thanh toán hoàn tất' : 'Thanh toán một phần') : 'Trả sau'),
        paidAmount: (data.paidAmount !== undefined && data.paidAmount !== null && data.paidAmount > 0) ? String(data.paidAmount) : '',
        tagIds: defaultTags,
        items: data.items && data.items.length > 0 ? data.items.map(it => ({
          productCategoryId: '',
          name: it.name || '',
          qty: it.qty ?? '',
          unit: it.unit || '',
          price: it.price || 0
        })) : [{ productCategoryId: '', name: '', qty: '', unit: '', price: 0 }]
      }));

      setOcrWarnings(data.warnings || []);
      setOcrBanner(true); setIsOcrDraft(true);
      setShowOcrModal(false);
      setShowAddModal(true);
      showToast('MSG30: Dữ liệu trích xuất từ OCR chỉ là bản nháp. Vui lòng kiểm tra và xác nhận mọi trường trước khi lưu bản ghi chính thức.', 'info');
    } catch (err) {
      let errMsg = 'Lỗi bóc tách hóa đơn. Vui lòng thử lại.';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errMsg = 'Quá thời gian kết nối AI Vision (quá 90s). Vui lòng thử lại hoặc dùng ảnh nhỏ hơn.';
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      } else if (err.message) {
        errMsg = err.message;
      }
      showToast(errMsg, 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  // In chứng từ Phiếu nhập kho chuẩn A4 (Mẫu 01-VT)
  const handlePrintVoucher = () => {
    document.body.classList.add('farmshift-printing');
    const cleanup = () => {
      document.body.classList.remove('farmshift-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2500);
    }, 60);
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (!purchases.length) {
      showToast('Không có dữ liệu hóa đơn nhập để xuất.', 'warning');
      return;
    }
    const headers = ['Mã đơn', 'Ngày nhập', 'Nhà cung cấp', 'Tổng tiền (VND)', 'Đã thanh toán (VND)', 'Công nợ (VND)', 'Thanh toán', 'Kho hàng', 'Ghi chú'];
    const rows = purchases.map(p => [
      p.code,
      p.date,
      `"${p.supplier}"`,
      p.totalAmount,
      p.paidAmount,
      p.debtAmount,
      `"${p.paymentStatus}"`,
      `"${p.stockStatus}"`,
      `"${p.note || ''}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Hoa_don_nhap_hang_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Xuất báo cáo thành công.', 'success');
  };

  // Tag CRUD Handlers
  const handleSaveTag = async (e) => {
    e.preventDefault();
    if (tagModal.mode !== 'delete') {
      const errors = validateTagForm();
      if (Object.keys(errors).length > 0) {
        setTagErrors(errors);
        showToast('Vui lòng kiểm tra lại thông tin thẻ Tag.', 'warning');
        return;
      }
    }
    try {
      if (tagModal.mode === 'create') {
        await createPurchaseTag(tagForm);
        showToast('Đã thêm thẻ phân loại thành công.', 'success');
      } else if (tagModal.mode === 'edit') {
        await updatePurchaseTag(tagModal.item.id, tagForm);
        showToast('Đã cập nhật thẻ phân loại.', 'success');
      } else if (tagModal.mode === 'delete') {
        await deletePurchaseTag(tagModal.item.id);
        showToast('Đã xóa thẻ phân loại.', 'success');
      }
      setTagModal(null);
      setTagErrors({});
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi thao tác thẻ phân loại.', 'error');
    }
  };

  // Open quick supplier modal directly from PO modal
  const handleOpenQuickSupplier = (initialName = '', initialTaxCode = '') => {
    const targetName = initialName || newPo.supplierName || '';
    const targetTax = initialTaxCode || newPo.supplierTaxCode || '';
    setSupplierForm({
      name: targetName,
      representative: 'Đại diện công ty',
      phone: '0988111222',
      productTypeId: productTypes[0]?.id || 1,
      email: '',
      address: '',
      taxCode: targetTax,
      bankName: '',
      bankAccount: '',
      paymentPolicy: 'Trả theo đơn',
      note: targetName ? `Thêm nhanh từ hóa đơn chứng từ ${newPo.referenceCode || ''}` : '',
      tagIds: []
    });
    setSupplierErrors({});
    setSupplierModal({ mode: 'create', returnToPo: true });
  };

  // Supplier CRUD Handlers
  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (supplierModal.mode !== 'delete') {
      const errors = validateSupplierForm();
      if (Object.keys(errors).length > 0) {
        setSupplierErrors(errors);
        showToast('Vui lòng kiểm tra lại thông tin nhà cung cấp.', 'warning');
        return;
      }
    }
    try {
      const selectedTypeId = Number(supplierForm.productTypeId || productTypes[0]?.id || 1);
      const payload = {
        ...supplierForm,
        productTypeId: selectedTypeId
      };
      if (supplierModal.mode === 'create') {
        const created = await createSupplier(payload);
        showToast('Đã thêm nhà cung cấp thành công.', 'success');
        if (supplierModal.returnToPo && created) {
          setSuppliers(prev => {
            const exists = prev.some(s => s.id === created.id);
            return exists ? prev : [created, ...prev];
          });
          setNewPo(prev => ({
            ...prev,
            supplierId: String(created.id),
            supplierName: created.name,
            tagIds: created.tagIds && created.tagIds.length ? [...created.tagIds] : prev.tagIds
          }));
          if (poErrors.supplierId) {
            setPoErrors(prev => ({ ...prev, supplierId: '' }));
          }
        }
      } else if (supplierModal.mode === 'edit') {
        await updateSupplier(supplierModal.item.id, payload);
        showToast('Đã cập nhật nhà cung cấp.', 'success');
      } else if (supplierModal.mode === 'delete') {
        await deleteSupplier(supplierModal.item.id);
        showToast('Đã xóa nhà cung cấp.', 'success');
      }
      setSupplierModal(null);
      setSupplierErrors({});
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi thao tác nhà cung cấp.', 'error');
    }
  };

  return (
    <FarmShiftLayout
      pageTitle="Hóa đơn nhập hàng"
      breadcrumbTitle={{ orders: 'Hóa đơn nhập hàng', suppliers: 'Nhà cung cấp', tags: 'Thẻ tag' }[activeTab]}
      breadcrumbs={[{ label: 'Hóa đơn nhập hàng' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="farmshift-btn farmshift-btn-secondary"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => setShowOcrModal(true)}
          >
            <ScanText size={16} /> Bóc tách hóa đơn
          </button>
          <button
            className="farmshift-btn farmshift-btn-excel"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          {isOwnerOrAccountant && (
            <button
              className="farmshift-btn farmshift-btn-mint"
              onClick={() => {
                setOcrBanner(false); setIsOcrDraft(false);
                setOcrPreviewUrl(null);
                setOcrPreviewName('');
                setShowAddModal(true);
              }}
            >
              <Plus size={16} /> Tạo đơn nhập hàng
            </button>
          )}
        </div>
      }
    >
      {/* ── Tabs Navigation ──────────────────────────────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Hóa đơn nhập hàng
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          Nhà cung cấp
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'tags' ? 'active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          Thẻ tag
        </button>
      </div>

      {/* ── Tab 1: Danh sách hóa đơn nhập hàng ──────────── */}
      {activeTab === 'orders' && (
        <>
          {/* Quick Metrics Cards (Đối chiếu chuẩn FarmShift_MienBinh_Full.html) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div className="farmshift-card" style={{ padding: '14px 18px', margin: 0 }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Tổng giá trị nhập</div>
              <strong style={{ fontSize: '18px', color: '#58a99a', display: 'block', marginTop: '4px' }}>
                {purchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0).toLocaleString('vi-VN')} đ
              </strong>
            </div>
            <div className="farmshift-card" style={{ padding: '14px 18px', margin: 0 }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Tiền đã trả</div>
              <strong style={{ fontSize: '18px', color: '#58a99a', display: 'block', marginTop: '4px' }}>
                {purchases.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0).toLocaleString('vi-VN')} đ
              </strong>
            </div>
            <div className="farmshift-card" style={{ padding: '14px 18px', margin: 0 }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Tiền chưa trả (Công nợ)</div>
              <strong style={{ fontSize: '18px', color: '#58a99a', display: 'block', marginTop: '4px' }}>
                {purchases.reduce((sum, p) => sum + Number(p.debtAmount || 0), 0).toLocaleString('vi-VN')} đ
              </strong>
            </div>
            <div className="farmshift-card" style={{ padding: '14px 18px', margin: 0 }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Tổng số hóa đơn</div>
              <strong style={{ fontSize: '18px', color: '#58a99a', display: 'block', marginTop: '4px' }}>
                {purchases.length} hóa đơn
              </strong>
            </div>
          </div>

          <div className="farmshift-toolbar">
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm kiếm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="farmshift-filter-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="farmshift-select"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
              >
                <option value="ALL">Tất cả thanh toán</option>
                <option value="hoàn tất">Đã thanh toán hoàn tất</option>
                <option value="Trả sau">Trả sau / Công nợ</option>
                <option value="phần">Thanh toán một phần</option>
              </select>

              <select
                className="farmshift-select"
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
              >
                <option value="ALL">Tất cả kho hàng</option>
                <option value="Đã nhập kho">Đã nhập kho</option>
                <option value="Chưa nhập kho">Chưa nhập kho</option>
              </select>

              <select
                className="farmshift-select"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="ALL">Tất cả thẻ tag ({tags.length})</option>
                {tags.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Nhà cung cấp</th>
                    <th>Thanh toán</th>
                    <th>Kho hàng</th>
                    <th>Tổng tiền</th>
                    <th>Ghi chú</th>
                    <th>Ngày nhập hàng</th>
                    <th aria-label="Thao tác"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-muted)' }}>
                        Đang tải danh sách hóa đơn...
                      </td>
                    </tr>
                  ) : purchases.filter(p => (filterStock === 'ALL' || p.stockStatus === filterStock) && (filterTag === 'ALL' || (p.tags && p.tags.includes(filterTag)))).length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-muted)' }}>
                        Không tìm thấy hóa đơn nhập hàng nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    purchases
                      .filter(p => (filterStock === 'ALL' || p.stockStatus === filterStock) && (filterTag === 'ALL' || (p.tags && p.tags.includes(filterTag))))
                      .map(p => (
                        <tr key={p.id}>
                          <td>
                            <button type="button" className={styles.invoiceCode} onClick={() => setSelectedOrder(p)} aria-label={`Xem hóa đơn ${p.code}`}>
                              {p.code}
                            </button>
                          </td>
                          <td>
                            <strong>{p.supplier}</strong>
                          </td>
                          <td>{p.paymentStatus}</td>
                          <td>{p.stockStatus}</td>
                          <td>
                            <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>
                              {Number(p.totalAmount || 0).toLocaleString('vi-VN')} đ
                            </strong>
                          </td>
                          <td style={{ color: 'var(--color-muted)', fontSize: '14.5px', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.note || '—'}
                          </td>
                          <td>{p.stockStatus === 'Đã nhập kho' && p.importedDate ? p.importedDate.split('-').reverse().join('/') : '—'}</td>
                          <td><PurchaseRowActions invoice={p} canEdit={isOwnerOrAccountant} suppliers={suppliers} tags={tags} onView={setSelectedOrder} onReload={fetchData} /></td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 2: Danh sách Nhà cung cấp ─────────────────── */}
      {activeTab === 'suppliers' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="farmshift-card-title">Danh sách Nhà cung cấp vật tư & con giống</h3>
            {isOwnerOrAccountant && (
              <button
                className="farmshift-btn farmshift-btn-mint"
                onClick={() => {
                  setSupplierForm({
                    name: '', representative: '', phone: '',
                    productTypeId: productTypes[0]?.id ? String(productTypes[0].id) : '1',
                    email: '', address: '', taxCode: '', bankName: '', bankAccount: '',
                    paymentPolicy: 'Trả theo đơn', note: '', tagIds: []
                  });
                  setSupplierModal({ mode: 'create' });
                }}
              >
                <Plus size={15} /> Thêm nhà cung cấp
              </button>
            )}
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên nhà cung cấp</th>
                  <th>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  <th>Tổng nhập lũy kế</th>
                  <th>Công nợ hiện tại</th>
                  <th>Ghi chú</th>
                  {isOwnerOrAccountant && <th style={{ textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-muted)' }}>
                      Chưa có nhà cung cấp nào.
                    </td>
                  </tr>
                ) : (
                  suppliers.map(sup => (
                    <tr key={sup.id}>
                      <td>
                        <strong style={{ color: 'var(--color-ink)' }}>{sup.name}</strong>
                        {sup.productTypeName && (
                          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                            {sup.productTypeName}
                          </div>
                        )}
                        {sup.tagNames && sup.tagNames.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {sup.tagNames.map((t, idx) => (
                              <span key={idx} style={{ fontSize: '12.5px', padding: '1px 6px', borderRadius: '12px', backgroundColor: '#e1ebff', color: '#387be8', fontWeight: 500 }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{sup.phone}</td>
                      <td>{sup.address || '—'}</td>
                      <td><strong>{Number(sup.totalPurchased || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td>
                        <span>
                          {Number(sup.debt || 0) > 0 ? `Nợ: ${Number(sup.debt).toLocaleString('vi-VN')} đ` : 'Hết nợ'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-muted)' }}>{sup.note || '—'}</td>
                      {isOwnerOrAccountant && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="farmshift-btn farmshift-btn-secondary"
                              style={{ padding: '4px 8px' }}
                              title="Sửa"
                              onClick={() => {
                                setSupplierForm({
                                  name: sup.name,
                                  representative: sup.representative || '',
                                  phone: sup.phone,
                                  productTypeId: sup.productTypeId ? String(sup.productTypeId) : (productTypes[0]?.id ? String(productTypes[0].id) : '1'),
                                  email: sup.email || '',
                                  address: sup.address || '',
                                  taxCode: sup.taxCode || '',
                                  bankName: sup.bankName || '',
                                  bankAccount: sup.bankAccount || '',
                                  paymentPolicy: sup.paymentPolicy || 'Trả theo đơn',
                                  note: sup.note || '',
                                  tagIds: sup.tagIds || []
                                });
                                setSupplierErrors({});
                                setSupplierModal({ mode: 'edit', item: sup });
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="farmshift-btn farmshift-btn-secondary"
                              style={{ padding: '4px 8px', color: 'var(--color-danger)' }}
                              title="Xóa"
                              onClick={() => setSupplierModal({ mode: 'delete', item: sup })}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Danh sách Thẻ Tags ────────────────────── */}
      {activeTab === 'tags' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="farmshift-card-title">Thẻ Tags phân loại hóa đơn chứng từ & nhà cung cấp</h3>
            {isOwnerOrAccountant && (
              <button
                className="farmshift-btn farmshift-btn-mint"
                onClick={() => {
                  setTagForm({ name: '', color: '#019788', description: '' });
                  setTagModal({ mode: 'create' });
                }}
              >
                <Plus size={15} /> Thêm thẻ Tag
              </button>
            )}
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên thẻ Tag</th>
                  <th>Màu sắc nhận diện</th>
                  <th>Mô tả</th>
                  <th>Số chứng từ gắn thẻ</th>
                  {isOwnerOrAccountant && <th style={{ textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {tags.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-muted)' }}>
                      Chưa có thẻ phân loại nào.
                    </td>
                  </tr>
                ) : (
                  tags.map(t => (
                    <tr key={t.id}>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: 'var(--rounded-pill)',
                            backgroundColor: `${t.color}20`,
                            color: t.color,
                            fontWeight: 600,
                            fontSize: '14.5px'
                          }}
                        >
                          <Tag size={13} /> {t.name}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.color, display: 'inline-block' }} />
                          <code style={{ fontSize: '13.5px' }}>{t.color}</code>
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-muted)' }}>{t.description || '—'}</td>
                      <td><strong>{t.usageCount || 0}</strong> chứng từ / NCC</td>
                      {isOwnerOrAccountant && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="farmshift-btn farmshift-btn-secondary"
                              style={{ padding: '4px 8px' }}
                              title="Sửa"
                              onClick={() => {
                                setTagForm({ name: t.name, color: t.color, description: t.description || '' });
                                setTagModal({ mode: 'edit', item: t });
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="farmshift-btn farmshift-btn-secondary"
                              style={{ padding: '4px 8px', color: 'var(--color-danger)' }}
                              title="Xóa"
                              onClick={() => setTagModal({ mode: 'delete', item: t })}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Chi tiết đơn nhập hàng ────────────────── */}
      {selectedOrder && (
        <div
          className="farmshift-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div className={`farmshift-modal ${styles.detailModal}`} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className={styles.detailHeading}>
                <h3 className="farmshift-modal-title" style={{ margin: 0 }}>
                  Chi tiết hóa đơn {selectedOrder.code}
                </h3>
                <div className={styles.detailTopActions}>
                {selectedOrder.stockStatus !== 'Đã nhập kho' && selectedOrder.stockStatus !== 'Đã hủy' && (
                  <button
                    className="farmshift-btn farmshift-btn-mint"
                    onClick={() => setStockConfirmation({ id: selectedOrder.id, code: selectedOrder.code })}
                  >
                    <PackageCheck size={15} /> Xác nhận nhập kho
                  </button>
                )}
                {Number(selectedOrder.debtAmount || 0) > 0 && selectedOrder.stockStatus !== 'Đã hủy' && (
                  <button
                    className="farmshift-btn farmshift-btn-mint"

                    onClick={() => {
                      setPaymentAmount(String(selectedOrder.debtAmount));
                      setShowPaymentModal(true);
                    }}
                  >
                    <DollarSign size={15} /> Thanh toán nợ
                  </button>
                )}
                <div className={styles.detailViewTabs}>
                  <button
                    type="button"
                    onClick={() => setOrderViewTab('info')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      border: 'none',
                      borderRadius: 'var(--rounded-sm)',
                      cursor: 'pointer',
                      backgroundColor: orderViewTab === 'info' ? 'var(--color-surface)' : 'transparent',
                      color: orderViewTab === 'info' ? 'var(--color-primary)' : 'var(--color-muted)',
                      boxShadow: orderViewTab === 'info' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    Xem chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderViewTab('voucher')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      border: 'none',
                      borderRadius: 'var(--rounded-sm)',
                      cursor: 'pointer',
                      backgroundColor: orderViewTab === 'voucher' ? 'var(--color-surface)' : 'transparent',
                      color: orderViewTab === 'voucher' ? 'var(--color-primary)' : 'var(--color-muted)',
                      boxShadow: orderViewTab === 'voucher' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    Mẫu in A4
                  </button>
                </div>
                </div>
              </div>
              <button
                type="button"
                className={styles.detailCloseButton}
                aria-label="Đóng chi tiết đơn nhập"
                onClick={() => {
                  setSelectedOrder(null);
                  setOrderViewTab('info');
                }}
              >
                ✕
              </button>
            </div>
            <div className="farmshift-modal-body">
              {orderViewTab === 'voucher' ? (
                <div style={{ padding: '8px 0' }}>
                  <PrintablePurchaseVoucher order={selectedOrder} onScreenPreview={true} />
                </div>
              ) : (
                <>
                  <div className={styles.workflowSteps} aria-label="Tiến độ hóa đơn">
                    {[
                      { label: 'Đã lưu đơn', done: true },
                      { label: `Nhập kho ${selectedOrder.stockStatus === 'Đã nhập kho' ? 'hoàn tất' : 'chưa hoàn tất'}`, done: selectedOrder.stockStatus === 'Đã nhập kho' },
                      { label: `Thanh toán ${Number(selectedOrder.debtAmount || 0) <= 0 ? 'hoàn tất' : 'còn nợ'}`, done: Number(selectedOrder.debtAmount || 0) <= 0 },
                    ].map(step => <div key={step.label} className={styles.workflowStep}>
                      <span className={styles.workflowTick} aria-label={step.done ? 'Đã hoàn tất' : 'Chưa hoàn tất'}>{step.done && <Check size={17} strokeWidth={2.5} aria-hidden="true" />}</span>
                      {step.label}
                    </div>)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', backgroundColor: 'var(--color-surface-soft)', padding: '14px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)' }}>
                    <div>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Nhà cung cấp:</div>
                      <strong style={{ fontSize: '15px', color: 'var(--color-ink)' }}>{selectedOrder.supplier}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Ngày lập đơn:</div>
                      <strong style={{ fontSize: '15px', color: 'var(--color-ink)' }}>{selectedOrder.date}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Trạng thái thanh toán:</div>
                      <span>
                        {selectedOrder.paymentStatus}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Trạng thái kho:</div>
                      <span>{selectedOrder.stockStatus}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Đã thanh toán:</div>
                      <strong style={{ color: 'var(--color-success)' }}>{Number(selectedOrder.paidAmount || 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Còn nợ lại:</div>
                      <strong style={{ color: Number(selectedOrder.debtAmount || 0) > 0 ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                        {Number(selectedOrder.debtAmount || 0).toLocaleString('vi-VN')} đ
                      </strong>
                    </div>
                    {selectedOrder.referenceCode && (
                      <div>
                        <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Mã tham chiếu / Số HĐ:</div>
                        <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>{selectedOrder.referenceCode}</strong>
                      </div>
                    )}
                    {(Number(selectedOrder.discountAmount || 0) > 0 || Number(selectedOrder.otherCost || 0) > 0) && (
                      <div>
                        <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Chiết khấu / Chi phí khác:</div>
                        <span style={{ fontSize: '14.5px', color: 'var(--color-body)' }}>
                          -{Number(selectedOrder.discountAmount || 0).toLocaleString('vi-VN')} đ / +{Number(selectedOrder.otherCost || 0).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    )}
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Tổng tiền hóa đơn:</div>
                      <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>{Number(selectedOrder.totalAmount || 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                    {selectedOrder.note && (
                      <div style={{ gridColumn: 'span 2', fontSize: '14.5px', color: 'var(--color-body)' }}>
                        <strong>Ghi chú:</strong> {selectedOrder.note}
                      </div>
                    )}
                    {selectedOrder.tags && selectedOrder.tags.length > 0 && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', marginBottom: '4px' }}>Thẻ Tag phân loại:</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {selectedOrder.tags.map((t, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '13px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                backgroundColor: '#e1f4ef',
                                color: '#008a7b',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Tag size={11} /> {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Danh sách mặt hàng nhập:</div>
                  <div className="farmshift-table-container" style={{ border: '1px solid var(--color-hairline)' }}>
                    <table className="farmshift-table">
                      <thead>
                        <tr>
                          <th>Mặt hàng</th>
                          <th>Số lượng</th>
                          <th>Đơn giá</th>
                          <th style={{ textAlign: 'right' }}>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items?.map((it, idx) => (
                          <tr key={idx}>
                            <td><strong>{it.name}</strong></td>
                            <td>{it.qty} {it.unit}</td>
                            <td>{Number(it.price).toLocaleString('vi-VN')} đ</td>
                            <td style={{ textAlign: 'right' }}>
                              <strong>{Number(it.amount || (it.qty * it.price)).toLocaleString('vi-VN')} đ</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="farmshift-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className={styles.detailBottomActions}>
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={handlePrintVoucher}
                >
                  <Printer size={15} /> In phiếu
                </button>
                {selectedOrder.stockStatus !== 'Đã nhập kho' && Number(selectedOrder.paidAmount || 0) === 0 && (
                  <button
                    className="farmshift-btn farmshift-btn-secondary"
                    style={{ color: 'var(--color-danger)' }}
                    onClick={() => handleCancelPo(selectedOrder.id)}
                  >
                    <Trash2 size={15} /> Hủy đơn
                  </button>
                )}

                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => {
                    setSelectedOrder(null);
                    setOrderViewTab('info');
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stockConfirmation && <ConfirmStockImport invoiceCode={stockConfirmation.code} onClose={() => setStockConfirmation(null)} onConfirm={() => handleImportStock(stockConfirmation.id)} />}

      {/* ── Modal: Thanh toán công nợ ────────────────────── */}
      {showPaymentModal && selectedOrder && (
        <div
          className="farmshift-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPaymentModal(false);
              setPaymentError('');
            }
          }}
        >
          <div className="farmshift-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Ghi nhận thanh toán đơn {selectedOrder.code}</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentError('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form noValidate onSubmit={handlePayOrder}>
              <div className="farmshift-modal-body">
                <div style={{ marginBottom: '14px', fontSize: '14.5px' }}>
                  Số tiền còn nợ: <strong style={{ color: 'var(--color-danger)' }}>{Number(selectedOrder.debtAmount).toLocaleString('vi-VN')} đ</strong>
                </div>
                <div className="farmshift-form-group">
                  <label htmlFor="pay-amount" className="farmshift-form-label">Số tiền thanh toán lần này (VNĐ) *</label>
                  <input
                    id="pay-amount"
                    type="number"
                    className={`farmshift-form-control ${paymentError ? 'has-error' : ''}`}
                    value={paymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      if (paymentError) setPaymentError('');
                    }}
                    required
                    max={selectedOrder.debtAmount}
                  />
                  {paymentError && (
                    <div className="farmshift-field-error">
                      <AlertTriangle size={12} /> {paymentError}
                    </div>
                  )}
                </div>
                <div className="farmshift-form-group" style={{ marginTop: '10px' }}>
                  <label htmlFor="pay-note" className="farmshift-form-label">Ghi chú thanh toán</label>
                  <input
                    id="pay-note"
                    type="text"
                    placeholder="Chuyển khoản Vietcombank đợt 2..."
                    className="farmshift-form-control"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentError('');
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint">Xác nhận thanh toán</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Tạo đơn nhập hàng mới ─────────────────── */}
      {showAddModal && (
        <div
          className="farmshift-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setOcrBanner(false); setIsOcrDraft(false);
            }
          }}
        >
          <div
            className={`farmshift-modal ${ocrPreviewUrl ? 'farmshift-split-modal' : ''}`}
            style={ocrPreviewUrl ? {} : { maxWidth: '820px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="farmshift-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {ocrPreviewUrl && (
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={handleRetakeOcr}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      padding: '4px 10px',
                      fontWeight: 600
                    }}
                    title="Quay lại chọn hoặc chụp ảnh khác"
                  >
                    <ArrowLeft size={14} /> Chụp / Chọn ảnh khác
                  </button>
                )}
                <h3 className="farmshift-modal-title">
                  {ocrPreviewUrl ? 'Đối chiếu chứng từ & Tạo đơn nhập hàng' : 'Tạo mới đơn nhập hàng'}
                </h3>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setOcrBanner(false); setIsOcrDraft(false);
                    setOcrPreviewUrl(null);
                    setOcrRotation(0);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '16px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              noValidate
              onSubmit={handleCreatePo}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              {poErrorMessages.length > 0 && <div role="alert" className={styles.formErrors}>
                <strong>Vui lòng kiểm tra thông tin:</strong>
                <ul>{poErrorMessages.map((message, index) => <li key={index}>{message}</li>)}</ul>
                {!isOcrDraft && (productError || unitsError) && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setProductRevision(value => value + 1)}>Thử lại</button>}
              </div>}
              <div
                className={`farmshift-modal-body ${ocrPreviewUrl ? 'farmshift-split-body' : ''}`}
                style={ocrPreviewUrl ? {} : { maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}
              >
                {/* ── CỘT TRÁI (LEFT PANE): XEM ẢNH CHỨNG TỪ GỐC KHI CÓ OCR ── */}
                {ocrPreviewUrl && (
                  <div className="farmshift-split-left-pane">
                    <div className="farmshift-split-left-toolbar">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          color: 'var(--color-ink)',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <FileText size={14} color="var(--color-primary)" />
                        <span title={ocrPreviewName || 'Chứng từ gốc A4'}>
                          {ocrPreviewName || 'hoa_don_mau_cp.png'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '12.5px', height: '26px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={handleRetakeOcr}
                          title="Tải ảnh khác hoặc chụp lại chứng từ"
                        >
                          <RefreshCw size={12} /> Đổi ảnh
                        </button>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '12.5px', height: '26px' }}
                          onClick={() => setOcrZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))}
                          title="Thu nhỏ"
                        >
                          <ZoomOut size={13} />
                        </button>
                        <span
                          style={{
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            minWidth: '40px',
                            textAlign: 'center',
                            color: 'var(--color-muted)'
                          }}
                        >
                          {Math.round(ocrZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '12.5px', height: '26px' }}
                          onClick={() => setOcrZoom(z => Math.min(2.5, +(z + 0.15).toFixed(2)))}
                          title="Phóng to"
                        >
                          <ZoomIn size={13} />
                        </button>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '12.5px', height: '26px' }}
                          onClick={() => setOcrRotation(r => (r + 90) % 360)}
                          title="Xoay ảnh 90° (nhấp để xoay ảnh ngay ngắn)"
                        >
                          <RotateCw size={13} />
                        </button>
                        <a
                          href={ocrPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{
                            padding: '3px 7px',
                            fontSize: '12.5px',
                            height: '26px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            textDecoration: 'none'
                          }}
                          title="Mở ảnh gốc trong tab mới"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>

                    <div className="farmshift-split-left-canvas">
                      {ocrPreviewType === 'application/pdf' ? (
                        <iframe
                          src={ocrPreviewUrl}
                          title="Tài liệu PDF gốc"
                          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff', borderRadius: '4px' }}
                        />
                      ) : (
                        <img
                          src={ocrPreviewUrl}
                          alt="Chứng từ gốc hóa đơn A4"
                          className="farmshift-split-left-image"
                          style={{
                            transform: `scale(${ocrZoom}) rotate(${ocrRotation}deg)`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.2s ease',
                            maxWidth: ocrRotation % 180 !== 0 ? '70%' : '100%'
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* ── CỘT PHẢI (RIGHT PANE): FORM NHẬP LIỆU THÔNG TIN ĐƠN ── */}
                <div className={ocrPreviewUrl ? 'farmshift-split-right-pane' : ''}>
                  {/* AI OCR Banner if loaded from OCR */}
                  {ocrBanner && (
                    <div
                      style={{
                        backgroundColor: '#fffbe6',
                        border: '1px solid #ffe58f',
                        padding: '12px 16px',
                        borderRadius: 'var(--rounded-md)',
                        marginBottom: '16px',
                        fontSize: '14.5px',
                        color: '#ad6800'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                        <span><strong>MSG30:</strong> Dữ liệu trích xuất từ OCR chỉ là bản nháp. Vui lòng kiểm tra và xác nhận mọi trường trước khi lưu bản ghi chính thức.</span>
                      </div>
                      {ocrWarnings && ocrWarnings.length > 0 && (
                        <ul style={{ margin: '8px 0 0 28px', padding: 0, fontSize: '14px', color: '#873800' }}>
                          {ocrWarnings.map((w, idx) => (
                            <li key={idx} style={{ marginTop: '2px' }}>{w}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div className="farmshift-form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label htmlFor="po-supplier-select" className="farmshift-form-label" style={{ margin: 0 }}>
                          Nhà cung cấp <span className={styles.requiredMark}>*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickSupplier(newPo.supplierName, newPo.supplierTaxCode)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '0 2px'
                          }}
                          title="Thêm nhanh nhà cung cấp mới vào danh mục"
                        >
                          <Plus size={13} /> Thêm mới
                        </button>
                      </div>

                      <select
                        id="po-supplier-select"
                        onBlur={() => validatePoField('supplierId')}
                        className={`farmshift-form-control ${poErrors.supplierId ? 'has-error' : ''}`}
                        value={newPo.supplierId || ''}
                        onChange={(e) => {
                          const supId = e.target.value;
                          if (supId === '__NEW__') {
                            setNewPo({
                              ...newPo,
                              supplierId: '__NEW__'
                            });
                          } else {
                            const found = suppliers.find(s => String(s.id) === String(supId));
                            setNewPo({
                              ...newPo,
                              supplierId: supId,
                              supplierName: found ? found.name : ''
                            });
                          }
                          if (poErrors.supplierId) {
                            setPoErrors(prev => ({ ...prev, supplierId: '' }));
                          }
                        }}
                        required
                      >
                        <option value="">-- Chọn Nhà cung cấp --</option>
                        {/* Hiển thị option NCC mới trích xuất từ OCR nếu chưa có trong DB */}
                        {newPo.supplierName && !suppliers.some(s => s.name?.toLowerCase() === newPo.supplierName?.toLowerCase()) && (
                          <option value="__NEW__" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                            ✨ [Mới từ chứng từ] {newPo.supplierName} (Tự động tạo mới)
                          </option>
                        )}
                        {/* Đảm bảo option cho NCC vừa tạo không bị mất nếu danh sách đang tải lại */}
                        {newPo.supplierId && newPo.supplierId !== '__NEW__' && !suppliers.some(s => String(s.id) === String(newPo.supplierId)) && (
                          <option value={newPo.supplierId}>
                            {newPo.supplierName || `Nhà cung cấp #${newPo.supplierId}`}
                          </option>
                        )}
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="po-date-input" className="farmshift-form-label">Ngày tạo đơn</label>
                      <input id="po-date-input" type="text" className="farmshift-form-control" value={creationTime} readOnly />
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="po-ref-code" className="farmshift-form-label">Số chứng từ / Mã tham chiếu</label>
                      <input
                        id="po-ref-code"
                        onBlur={() => validatePoField('referenceCode')}
                        type="text"
                        placeholder="HD-CP-0915"
                        className={`farmshift-form-control ${poErrors.referenceCode ? 'has-error' : ''}`}
                        maxLength={100}
                        value={newPo.referenceCode}
                        onChange={(e) => setNewPo({ ...newPo, referenceCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Chi tiết các mặt hàng nhập:</span>
                    <button
                      type="button"
                      className="farmshift-btn farmshift-btn-secondary"
                      style={{ fontSize: '13.5px', padding: '4px 10px' }}
                      onClick={handleAddItemRow}
                    >
                      + Thêm dòng hàng
                    </button>
                  </div>

                  {!isOcrDraft && !unitsLoading && !unitsError && !units.length && <p>Chưa có đơn vị tính. Vui lòng thêm tại Thiết lập danh mục → Đơn vị tính.</p>}
                  {!isOcrDraft && !productLoading && !productError && !productCategories.some(product => product.warehouseId) && <p>Chưa có hàng hóa thuộc kho. Vui lòng thêm hàng hóa trong Kho hàng hóa trước.</p>}

                  <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.9fr 0.9fr 1.3fr 1.3fr 30px', gap: '8px', marginBottom: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--color-muted)', padding: '0 2px' }}>
                    <span>Tên hàng hóa <span className={styles.requiredMark}>*</span></span>
                    <span>Số lượng <span className={styles.requiredMark}>*</span></span>
                    <span>Đơn vị <span className={styles.requiredMark}>*</span></span>
                    <span>Đơn giá (VNĐ) <span className={styles.requiredMark}>*</span></span>
                    <span style={{ textAlign: 'right' }}>Thành tiền</span>
                    <span></span>
                  </div>

                  {newPo.items.map((row, idx) => {
                    const itemErr = poErrors.items?.[idx] || {};
                    return (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.9fr 0.9fr 1.3fr 1.3fr 30px', gap: '8px', marginBottom: '10px', alignItems: 'flex-start' }}>
                        <div>
                          {isOcrDraft ? <input
                            type="text" aria-label={`Tên hàng hóa ${idx + 1}`} placeholder="Tên hàng hóa từ chứng từ" maxLength={200}
                            className={`farmshift-form-control ${itemErr.name ? 'has-error' : ''}`} value={row.name || ''}
                            onChange={event => { setNewPo(previous => ({ ...previous, items: previous.items.map((item, index) => index === idx ? { ...item, name: event.target.value, productCategoryId: '' } : item) })); clearItemError(idx, 'name'); }}
                            onBlur={() => validatePoField('name', idx)} required
                          /> : (
                          <select
                            aria-label={`Tên hàng hóa ${idx + 1}`}
                            onBlur={() => validatePoField('name', idx)}
                            disabled={productLoading || !!productError}
                            className={`farmshift-form-control ${itemErr.name ? 'has-error' : ''}`}
                            value={row.productCategoryId || ''}
                            onChange={event => {
                              const product = productCategories.find(product => String(product.id) === event.target.value);
                              setNewPo(prev => ({ ...prev, items: prev.items.map((item, index) => index === idx ? { ...item, productCategoryId: product ? String(product.id) : '', name: product?.name || '', unit: product?.specification || item.unit } : item) }));
                              clearItemError(idx, 'name');
                            }}
                            required
                          >
                            <option value="">{productLoading ? 'Đang tải hàng hóa...' : 'Chọn hàng hóa (Kho)'}</option>
                            {productCategories.filter(product => product.warehouseId).map(product => <option key={product.id} value={product.id}>{product.name} ({product.warehouseName})</option>)}
                          </select>
                          )}
                        </div>
                        <div>
                          <input
                            type="number"
                            placeholder="Số lượng"
                            onBlur={() => validatePoField('qty', idx)}
                            className={`farmshift-form-control ${itemErr.qty ? 'has-error' : ''}`}
                            value={row.qty}
                            min="0.1"
                            step="any"
                            onChange={(e) => {
                              const updated = [...newPo.items];
                              updated[idx].qty = e.target.value;
                              setNewPo({ ...newPo, items: updated });
                              clearItemError(idx, 'qty');
                            }}
                            required
                          />
                        </div>
                        <div>
                          {isOcrDraft ? <input
                            type="text" aria-label={`Đơn vị ${idx + 1}`} placeholder="Đơn vị" maxLength={50}
                            className={`farmshift-form-control ${itemErr.unit ? 'has-error' : ''}`} value={row.unit || ''}
                            onChange={event => { setNewPo(previous => ({ ...previous, items: previous.items.map((item, index) => index === idx ? { ...item, unit: event.target.value } : item) })); clearItemError(idx, 'unit'); }}
                            onBlur={() => validatePoField('unit', idx)} required
                          /> : (
                          <select
                            aria-label={`Đơn vị ${idx + 1}`}
                            onBlur={() => validatePoField('unit', idx)}
                            className={`farmshift-form-control ${itemErr.unit ? 'has-error' : ''}`}
                            value={units.some(unit => unit.name === row.unit) ? row.unit : ''}
                            disabled={unitsLoading || !!unitsError}
                            onChange={event => {
                              setNewPo(prev => ({ ...prev, items: prev.items.map((item, index) => index === idx ? { ...item, unit: event.target.value } : item) }));
                              clearItemError(idx, 'unit');
                            }}
                            required
                          >
                            <option value="">{unitsLoading ? 'Đang tải...' : 'Chọn'}</option>
                            {units.map(unit => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                          </select>
                          )}
                        </div>
                        <div>
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`Đơn giá (VNĐ) ${idx + 1}`}
                            onBlur={() => validatePoField('price', idx)}
                            placeholder="0"
                            className={`farmshift-form-control ${itemErr.price ? 'has-error' : ''}`}
                            value={/^\d*$/.test(String(row.price)) ? (Number(row.price) ? Number(row.price).toLocaleString('vi-VN') : '') : String(row.price ?? '')}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const digits = /^[\d.]*$/.test(raw) ? raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '') : raw;
                              if (/^\d+$/.test(digits) && !Number.isSafeInteger(Number(digits))) return;
                              const input = e.target;
                              const digitOffset = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, '').length;
                              const updated = [...newPo.items];
                              updated[idx].price = /^\d*$/.test(digits) ? (digits ? Number(digits) : 0) : digits;
                              setNewPo({ ...newPo, items: updated });
                              clearItemError(idx, 'price');
                              requestAnimationFrame(() => {
                                if (document.activeElement !== input) return;
                                let position = 0, count = 0;
                                while (position < input.value.length && count < digitOffset) {
                                  if (/\d/.test(input.value[position])) count++;
                                  position++;
                                }
                                input.setSelectionRange(position, position);
                              });
                            }}
                          />
                        </div>
                        <div>
                          <div
                            style={{
                              height: '38px',
                              padding: '0 10px',
                              borderRadius: 'var(--rounded-md)',
                              backgroundColor: 'var(--color-surface-soft)',
                              border: '1px solid var(--color-hairline)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              fontWeight: 600,
                              color: 'var(--color-ink)',
                              fontSize: '14.5px'
                            }}
                            title="Thành tiền = Số lượng × Đơn giá"
                          >
                            {((Number(row.qty) || 0) * (Number(row.price) || 0)).toLocaleString('vi-VN')} đ
                          </div>
                        </div>
                        <div style={{ paddingTop: '8px', textAlign: 'center' }}>
                          {newPo.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0 }}
                              title="Xóa dòng"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}



                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div className="farmshift-form-group">
                      <label htmlFor="po-payment-status" className="farmshift-form-label">Trạng thái thanh toán <span className={styles.requiredMark}>*</span></label>
                      <select
                        id="po-payment-status"
                        className="farmshift-form-control"
                        value={newPo.paymentStatus}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          const subtotal = newPo.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
                          const discount = Number(newPo.discountAmount || 0);
                          const otherCost = Number(newPo.otherCost || 0);
                          const totalAmt = Math.max(0, subtotal - discount + otherCost);
                          setNewPo({
                            ...newPo,
                            paymentStatus: newStatus,
                            paidAmount: newStatus === 'Thanh toán một phần' && !newPo.paidAmount ? String(Math.round(totalAmt / 2)) : (newStatus === 'Thanh toán một phần' ? newPo.paidAmount : '')
                          });
                          if (poErrors.paidAmount) {
                            setPoErrors(prev => ({ ...prev, paidAmount: '' }));
                          }
                        }}
                      >
                        <option value="Thanh toán hoàn tất">Thanh toán hoàn tất</option>
                        <option value="Thanh toán một phần">Thanh toán một phần</option>
                        <option value="Trả sau">Trả sau (Công nợ)</option>
                      </select>
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="po-stock-status" className="farmshift-form-label">Trạng thái kho hàng <span className={styles.requiredMark}>*</span></label>
                      <select
                        id="po-stock-status"
                        className="farmshift-form-control"
                        value={newPo.stockStatus}
                        onChange={(e) => setNewPo({ ...newPo, stockStatus: e.target.value })}
                      >
                        <option value="Đã nhập kho">Đã nhập kho</option>
                        <option value="Chưa nhập kho">Chưa nhập kho</option>
                      </select>
                    </div>
                  </div>

                  {newPo.paymentStatus === 'Thanh toán một phần' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px', padding: '12px 14px', backgroundColor: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)' }}>
                      <div className="farmshift-form-group">
                        <label htmlFor="po-partial-paid" className="farmshift-form-label">Số tiền trả trước (VNĐ) <span className={styles.requiredMark}>*</span></label>
                        <input
                          id="po-partial-paid"
                        onBlur={() => validatePoField('paidAmount')}
                          type="number"
                          placeholder="Nhập số tiền trả trước..."
                          min="1"
                          className={`farmshift-form-control ${poErrors.paidAmount ? 'has-error' : ''}`}
                          value={newPo.paidAmount || ''}
                          onChange={(e) => {
                            setNewPo({ ...newPo, paidAmount: e.target.value });
                            if (poErrors.paidAmount) {
                              setPoErrors(prev => ({ ...prev, paidAmount: '' }));
                            }
                          }}
                          required
                        />
                      </div>
                      <div className="farmshift-form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Tính vào công nợ NCC:</span>
                        <strong style={{ fontSize: '16px', color: '#ef4565', marginTop: '4px' }}>
                          {Math.max(
                            0,
                            (newPo.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0) - Number(newPo.discountAmount || 0) + Number(newPo.otherCost || 0))
                            - Number(newPo.paidAmount || 0)
                          ).toLocaleString('vi-VN')} đ
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="farmshift-form-group" style={{ marginTop: '14px' }}>
                    <label htmlFor="po-note-input" className="farmshift-form-label">Ghi chú đơn nhập</label>
                    <input
                      id="po-note-input"
                        onBlur={() => validatePoField('note')}
                      type="text"
                      placeholder={
                        ocrPreviewName
                          ? `Gợi ý: Nhập kho theo chứng từ ${ocrPreviewName}${newPo.referenceCode ? ` (Số ${newPo.referenceCode})` : ''}...`
                          : 'Nhập ghi chú cho đơn nhập hàng (tùy chọn)...'
                      }
                      className={`farmshift-form-control ${poErrors.note ? 'has-error' : ''}`}
                        maxLength={1000}
                      value={newPo.note}
                      onChange={(e) => setNewPo({ ...newPo, note: e.target.value })}
                    />
                  </div>

                  <div className="farmshift-form-group" style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="farmshift-form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={14} color="var(--color-primary)" /> Gắn thẻ Tag phân loại đơn nhập:
                      </label>
                      {(() => {
                        const curSup = suppliers.find(s => String(s.id) === String(newPo.supplierId));
                        if (curSup?.tagIds?.length > 0) {
                          return (
                            <button
                              type="button"
                              className="farmshift-btn farmshift-btn-secondary"
                              style={{ fontSize: '12.5px', padding: '2px 8px', height: '24px' }}
                              onClick={() => {
                                const set = new Set([...(newPo.tagIds || []), ...curSup.tagIds]);
                                setNewPo({ ...newPo, tagIds: Array.from(set) });
                              }}
                              title="Áp dụng các thẻ tag của Nhà cung cấp này vào đơn nhập"
                            >
                              + Lấy thẻ tag từ NCC ({curSup.tagIds.length})
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {tags.length === 0 ? (
                        <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>
                          Chưa có thẻ tag nào. Tạo thêm thẻ tại tab <strong>Thẻ Tags phân loại</strong>.
                        </div>
                      ) : (
                        tags.map(t => {
                          const isSelected = (newPo.tagIds || []).includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                const current = newPo.tagIds || [];
                                const updated = isSelected ? current.filter(id => id !== t.id) : [...current, t.id];
                                setNewPo({ ...newPo, tagIds: updated });
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13.5px',
                                padding: '4px 10px',
                                borderRadius: '16px',
                                border: `1.5px solid ${isSelected ? t.color || 'var(--color-primary)' : 'var(--color-hairline)'}`,
                                backgroundColor: isSelected ? `${t.color || '#019788'}18` : 'var(--color-surface-soft)',
                                color: isSelected ? (t.color || 'var(--color-primary)') : 'var(--color-ink)',
                                fontWeight: isSelected ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.color || '#019788' }} />
                              {t.name}
                              {isSelected && <span style={{ fontSize: '12.5px', marginLeft: '2px' }}>✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
                    <div className="farmshift-form-group">
                      <label htmlFor="po-discount-amount" className="farmshift-form-label">Chiết khấu giảm giá (VNĐ)</label>
                      <input
                        id="po-discount-amount"
                        onBlur={() => validatePoField('discountAmount')}
                        type="number"
                        placeholder="0"
                        min="0"
                        className={`farmshift-form-control ${poErrors.discountAmount ? 'has-error' : ''}`}
                        value={newPo.discountAmount || ''}
                        onChange={(e) => {
                          setNewPo({ ...newPo, discountAmount: e.target.value });
                          if (poErrors.discountAmount) {
                            setPoErrors(prev => ({ ...prev, discountAmount: '' }));
                          }
                        }}
                      />
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="po-other-cost" className="farmshift-form-label">Chi phí khác / Vận chuyển (VNĐ)</label>
                      <input
                        id="po-other-cost"
                        onBlur={() => validatePoField('otherCost')}
                        type="number"
                        placeholder="0"
                        min="0"
                        className={`farmshift-form-control ${poErrors.otherCost ? 'has-error' : ''}`}
                        value={newPo.otherCost || ''}
                        onChange={(e) => {
                          setNewPo({ ...newPo, otherCost: e.target.value });
                          if (poErrors.otherCost) {
                            setPoErrors(prev => ({ ...prev, otherCost: '' }));
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-md)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-ink)' }}>Tổng tiền:</span>
                      <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                        {Math.max(
                          0,
                          newPo.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0)
                          - Number(newPo.discountAmount || 0)
                          + Number(newPo.otherCost || 0)
                        ).toLocaleString('vi-VN')} đ
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="farmshift-modal-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 24px',
                  borderTop: '1px solid var(--color-hairline)',
                  backgroundColor: 'var(--color-surface)'
                }}
              >
                {ocrPreviewUrl ? (
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={handleRetakeOcr}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14.5px' }}
                  >
                    <ArrowLeft size={15} /> Chụp lại / Đổi ảnh khác
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      setOcrBanner(false); setIsOcrDraft(false);
                      setOcrPreviewUrl(null);
                      setOcrRotation(0);
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="farmshift-btn farmshift-btn-mint">
                    Lưu hóa đơn nhập
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: AI OCR Bóc tách phiếu nhập ───────────────────────────── */}
      {showOcrModal && (
        <div
          className="farmshift-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !ocrLoading) handleCloseOcrModal();
          }}
        >
          <div className="farmshift-modal" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                <ScanText size={18} /> Bóc tách phiếu nhập / Hóa đơn A4
              </h3>
              <button
                type="button"
                className={`${styles.detailCloseButton} ${styles.ocrCloseButton}`}
                aria-label="Đóng bóc tách hóa đơn"
                disabled={ocrLoading}
                onClick={handleCloseOcrModal}
              >
                ✕
              </button>
            </div>
            <div className="farmshift-modal-body">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    stopCamera();
                    handleTriggerOcr(file);
                    e.target.value = '';
                  }
                }}
              />
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    stopCamera();
                    handleTriggerOcr(file);
                    e.target.value = '';
                  }
                }}
              />

              {/* Mode switch tabs: Tải file & Chụp ảnh */}
              {!ocrLoading && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    padding: '4px',
                    backgroundColor: 'var(--color-surface-soft)',
                    borderRadius: 'var(--rounded-lg)',
                    marginBottom: '16px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setOcrTab('upload');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: 'var(--rounded-md)',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '14.5px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: ocrTab === 'upload' ? 'var(--color-surface)' : 'transparent',
                      color: ocrTab === 'upload' ? 'var(--color-primary)' : 'var(--color-muted)',
                      boxShadow: ocrTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <Upload size={16} /> Tải file / Kéo thả
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOcrTab('camera');
                      startCamera();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: 'var(--rounded-md)',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '14.5px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: ocrTab === 'camera' ? 'var(--color-surface)' : 'transparent',
                      color: ocrTab === 'camera' ? 'var(--color-primary)' : 'var(--color-muted)',
                      boxShadow: ocrTab === 'camera' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <Camera size={16} /> Chụp ảnh trực tiếp
                  </button>
                </div>
              )}

              {/* Loading State with blurred preview background */}
              {ocrLoading && (
                <div
                  style={{
                    position: 'relative',
                    height: '340px',
                    borderRadius: 'var(--rounded-lg)',
                    overflow: 'hidden',
                    marginBottom: '16px',
                    backgroundColor: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-hairline)'
                  }}
                >
                  {/* Ảnh mờ của chứng từ đang xử lý làm nền */}
                  {ocrPreviewUrl ? (
                    <img
                      src={ocrPreviewUrl}
                      alt="Ảnh chứng từ đang bóc tách"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        filter: 'blur(6px) brightness(0.6)',
                        transform: 'scale(1.08)',
                        pointerEvents: 'none'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(17,24,39,0.95))'
                      }}
                    />
                  )}

                  {/* Card thông tin quét AI nổi bật */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '24px 32px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(17, 24, 39, 0.82)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                      maxWidth: '85%',
                      textAlign: 'center'
                    }}
                  >
                    <Loader2 size={40} color="#10b981" className="farmshift-spinner" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15.5px', color: '#ffffff', marginBottom: '4px' }}>
                        Đang bóc tách chứng từ bằng AI Vision...
                      </div>
                      <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                        {ocrPreviewName ? <span style={{ color: '#d1fae5', fontWeight: 500 }}>{ocrPreviewName} • </span> : null}
                        Đang căn chỉnh góc nghiêng và trích xuất bảng biểu
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 1: Upload / Dropzone */}
              {!ocrLoading && ocrTab === 'upload' && (
                <div
                  style={{
                    border: dragOver ? '2px dashed var(--color-primary)' : '2px dashed var(--color-border-strong)',
                    borderRadius: 'var(--rounded-lg)',
                    padding: '24px 20px',
                    textAlign: 'center',
                    backgroundColor: dragOver ? 'rgba(1, 151, 136, 0.05)' : 'var(--color-surface-soft)',
                    cursor: 'pointer',
                    marginBottom: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleTriggerOcr(file);
                  }}
                >
                  <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(1, 151, 136, 0.1)', color: 'var(--color-primary)', marginBottom: '10px' }}>
                    <Upload size={32} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-ink)' }}>
                    Kéo thả hoặc bấm vào đây để chọn Hóa đơn / Phiếu xuất kho
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <span className="farmshift-btn farmshift-btn-secondary" style={{ pointerEvents: 'none', fontSize: '13.5px', padding: '5px 12px' }}>
                      📁 Duyệt tệp từ thiết bị
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Camera Stream / Capture */}
              {!ocrLoading && ocrTab === 'camera' && (
                <div style={{ marginBottom: '16px' }}>
                  {cameraError ? (
                    <div
                      style={{
                        padding: '24px',
                        textAlign: 'center',
                        backgroundColor: 'var(--color-surface-soft)',
                        borderRadius: 'var(--rounded-lg)',
                        border: '1px solid var(--color-hairline)'
                      }}
                    >
                      <AlertTriangle size={36} color="var(--color-warning)" style={{ margin: '0 auto 10px auto' }} />
                      <div style={{ fontWeight: 600, color: 'var(--color-ink)', marginBottom: '6px' }}>
                        Không thể kết nối trực tiếp đến Camera
                      </div>
                      <div style={{ fontSize: '14.5px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                        {cameraError}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-mint"
                          onClick={() => {
                            if (cameraInputRef.current) cameraInputRef.current.click();
                          }}
                        >
                          <Smartphone size={15} /> Mở ứng dụng Máy ảnh trên máy
                        </button>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-secondary"
                          onClick={() => startCamera()}
                        >
                          <RefreshCw size={14} /> Thử lại
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Video Viewfinder Container */}
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '320px',
                          backgroundColor: '#000',
                          borderRadius: 'var(--rounded-lg)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <video
                          ref={handleVideoRef}
                          autoPlay
                          playsInline
                          muted
                          onLoadedMetadata={() => {
                            if (videoRef.current) {
                              videoRef.current.play().catch(() => {});
                            }
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                          }}
                        />

                        {/* Viewfinder frame overlay for A4 alignment */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '16px',
                            bottom: '16px',
                            left: '24px',
                            right: '24px',
                            border: '2px dashed rgba(255, 255, 255, 0.7)',
                            borderRadius: '8px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            paddingTop: '8px'
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: 'rgba(0,0,0,0.65)',
                              color: '#fff',
                              fontSize: '13.5px',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontWeight: 500
                            }}
                          >
                            Căn chỉnh hóa đơn A4 vào giữa khung hình
                          </span>
                        </div>

                        {isCameraStarting && (
                          <div style={{ position: 'absolute', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Loader2 size={24} className="farmshift-spinner" /> Đang khởi động camera...
                          </div>
                        )}
                      </div>

                      {/* Camera Action Toolbar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '10px',
                          padding: '8px 12px',
                          backgroundColor: 'var(--color-surface-soft)',
                          borderRadius: 'var(--rounded-md)'
                        }}
                      >
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-ghost"
                          onClick={() => {
                            if (cameraInputRef.current) cameraInputRef.current.click();
                          }}
                          title="Chụp bằng ứng dụng máy ảnh trên điện thoại / tablet"
                          style={{ fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Smartphone size={15} /> App máy ảnh
                        </button>

                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-mint"
                          onClick={handleCapturePhoto}
                          disabled={isCameraStarting}
                          style={{
                            padding: '9px 20px',
                            fontSize: '14.5px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 8px rgba(1, 151, 136, 0.3)'
                          }}
                        >
                          <Camera size={16} /> Chụp & Bóc tách ngay
                        </button>

                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-ghost"
                          onClick={handleSwitchFacing}
                          title="Đổi camera trước / sau"
                          style={{ fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <RefreshCw size={15} /> Đổi camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

                            <div style={{ backgroundColor: 'var(--color-surface-soft)', padding: '14px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', fontSize: '14.5px' }}>
                <ul style={{ margin: '0 0 0 18px', padding: 0, color: 'var(--color-body)' }}>
                  <li>Nhận diện tên Nhà cung cấp, ngày lập đơn và số hóa đơn</li>
                  <li>Bóc tách bảng danh sách mặt hàng, số lượng bao/kg và đơn giá</li>
                  <li>Nhận diện tình trạng thanh toán (Trả sau, Thanh toán một phần, Hoàn tất)</li>
                  <li>Tự động điền dữ liệu vào form tạo đơn nhập và khớp tồn kho</li>
                </ul>
              </div>
            </div>
            <div className="farmshift-modal-footer">
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                disabled={ocrLoading}
                onClick={handleCloseOcrModal}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm / Sửa / Xóa Nhà cung cấp ──────────── */}
      {supplierModal && (
        <div
          className="farmshift-modal-backdrop"
          style={{ zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSupplierModal(null);
              setSupplierErrors({});
            }
          }}
        >
          <div className={`farmshift-modal ${styles.supplierModal}`} style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">
                {supplierModal.mode === 'create' ? 'Thêm mới Nhà cung cấp' : supplierModal.mode === 'edit' ? 'Chỉnh sửa Nhà cung cấp' : 'Xóa Nhà cung cấp'}
              </h3>
              <button
                onClick={() => {
                  setSupplierModal(null);
                  setSupplierErrors({});
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            {supplierModal.mode === 'delete' ? (
              <form onSubmit={handleSaveSupplier}>
                <div className="farmshift-modal-body">
                  <p>Bạn có chắc chắn muốn xóa nhà cung cấp <strong>{supplierModal.item?.name}</strong>?</p>
                </div>
                <div className="farmshift-modal-footer">
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={() => {
                      setSupplierModal(null);
                      setSupplierErrors({});
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="farmshift-btn farmshift-btn-danger">Xác nhận xóa</button>
                </div>
              </form>
            ) : (
              <form noValidate onSubmit={handleSaveSupplier}>
                <div className="farmshift-modal-body">
                  <div className="farmshift-form-group">
                    <label htmlFor="sup-name" className="farmshift-form-label">Tên nhà cung cấp *</label>
                    <input
                      id="sup-name"
                      type="text"
                      className={`farmshift-form-control ${supplierErrors.name ? 'has-error' : ''}`}
                      value={supplierForm.name}
                      onChange={(e) => {
                        setSupplierForm({ ...supplierForm, name: e.target.value });
                        if (supplierErrors.name) setSupplierErrors(prev => ({ ...prev, name: '' }));
                      }}
                      required
                    />
                    {supplierErrors.name && (
                      <div className="farmshift-field-error">
                        <AlertTriangle size={12} /> {supplierErrors.name}
                      </div>
                    )}
                  </div>
                  <div className={styles.supplierFormGrid} style={{ marginTop: '10px' }}>
                    <div className="farmshift-form-group">
                      <label htmlFor="sup-rep" className="farmshift-form-label">Người đại diện *</label>
                      <input
                        id="sup-rep"
                        type="text"
                        className={`farmshift-form-control ${supplierErrors.representative ? 'has-error' : ''}`}
                        value={supplierForm.representative}
                        onChange={(e) => {
                          setSupplierForm({ ...supplierForm, representative: e.target.value });
                          if (supplierErrors.representative) setSupplierErrors(prev => ({ ...prev, representative: '' }));
                        }}
                        required
                      />
                      {supplierErrors.representative && (
                        <div className="farmshift-field-error">
                          <AlertTriangle size={12} /> {supplierErrors.representative}
                        </div>
                      )}
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="sup-phone" className="farmshift-form-label">Số điện thoại *</label>
                      <input
                        id="sup-phone"
                        type="text"
                        placeholder="0912345678 hoặc 02838221133"
                        className={`farmshift-form-control ${supplierErrors.phone ? 'has-error' : ''}`}
                        value={supplierForm.phone}
                        onChange={(e) => {
                          setSupplierForm({ ...supplierForm, phone: e.target.value });
                          if (supplierErrors.phone) setSupplierErrors(prev => ({ ...prev, phone: '' }));
                        }}
                        required
                      />
                      {supplierErrors.phone && (
                        <div className="farmshift-field-error">
                          <AlertTriangle size={12} /> {supplierErrors.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="farmshift-form-group" style={{ marginTop: '10px' }}>
                    <label htmlFor="sup-group" className="farmshift-form-label">Nhóm nhà cung cấp *</label>
                    <select
                      id="sup-group"
                      className={`farmshift-form-control ${supplierErrors.productTypeId ? 'has-error' : ''}`}
                      value={supplierForm.productTypeId || (productTypes[0]?.id ? String(productTypes[0].id) : '1')}
                      onChange={(e) => {
                        setSupplierForm({ ...supplierForm, productTypeId: e.target.value });
                        if (supplierErrors.productTypeId) setSupplierErrors(prev => ({ ...prev, productTypeId: '' }));
                      }}
                      required
                    >
                      {productTypes.length === 0 ? (
                        <option value="1">Thức ăn chăn nuôi (Mặc định)</option>
                      ) : (
                        productTypes.map(pt => (
                          <option key={pt.id} value={pt.id}>{pt.name}</option>
                        ))
                      )}
                    </select>
                    {supplierErrors.productTypeId && (
                      <div className="farmshift-field-error">
                        <AlertTriangle size={12} /> {supplierErrors.productTypeId}
                      </div>
                    )}
                  </div>
                  <div className={styles.supplierFormGrid} style={{ marginTop: '10px' }}>
                    <div className="farmshift-form-group">
                      <label htmlFor="sup-email" className="farmshift-form-label">Email liên hệ</label>
                      <input
                        id="sup-email"
                        type="email"
                        placeholder="contact@supplier.vn"
                        className={`farmshift-form-control ${supplierErrors.email ? 'has-error' : ''}`}
                        value={supplierForm.email || ''}
                        onChange={(e) => {
                          setSupplierForm({ ...supplierForm, email: e.target.value });
                          if (supplierErrors.email) setSupplierErrors(prev => ({ ...prev, email: '' }));
                        }}
                      />
                      {supplierErrors.email && (
                        <div className="farmshift-field-error">
                          <AlertTriangle size={12} /> {supplierErrors.email}
                        </div>
                      )}
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="sup-tax" className="farmshift-form-label">Mã số thuế</label>
                      <input
                        id="sup-tax"
                        type="text"
                        placeholder="0312345678"
                        className={`farmshift-form-control ${supplierErrors.taxCode ? 'has-error' : ''}`}
                        value={supplierForm.taxCode || ''}
                        onChange={(e) => {
                          setSupplierForm({ ...supplierForm, taxCode: e.target.value });
                          if (supplierErrors.taxCode) setSupplierErrors(prev => ({ ...prev, taxCode: '' }));
                        }}
                      />
                      {supplierErrors.taxCode && (
                        <div className="farmshift-field-error">
                          <AlertTriangle size={12} /> {supplierErrors.taxCode}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="farmshift-form-group" style={{ marginTop: '10px' }}>
                    <label htmlFor="sup-addr" className="farmshift-form-label">Địa chỉ</label>
                    <input
                      id="sup-addr"
                      type="text"
                      className="farmshift-form-control"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group" style={{ marginTop: '10px' }}>
                    <label htmlFor="sup-note" className="farmshift-form-label">Ghi chú</label>
                    <input
                      id="sup-note"
                      type="text"
                      className="farmshift-form-control"
                      value={supplierForm.note}
                      onChange={(e) => setSupplierForm({ ...supplierForm, note: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group" style={{ marginTop: '12px' }}>
                    <label className="farmshift-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Tag size={14} color="var(--color-primary)" /> Gắn thẻ Tag phân loại Nhà cung cấp
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {tags.length === 0 ? (
                        <div style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>
                          Chưa có thẻ tag nào. Tạo thêm thẻ tại tab <strong>Thẻ Tags phân loại</strong>.
                        </div>
                      ) : (
                        tags.map(t => {
                          const isSelected = (supplierForm.tagIds || []).includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                const current = supplierForm.tagIds || [];
                                const updated = isSelected ? current.filter(id => id !== t.id) : [...current, t.id];
                                setSupplierForm({ ...supplierForm, tagIds: updated });
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13.5px',
                                padding: '4px 10px',
                                borderRadius: '16px',
                                border: `1.5px solid ${isSelected ? t.color || 'var(--color-primary)' : 'var(--color-hairline)'}`,
                                backgroundColor: isSelected ? `${t.color || '#019788'}18` : 'var(--color-surface-soft)',
                                color: isSelected ? (t.color || 'var(--color-primary)') : 'var(--color-ink)',
                                fontWeight: isSelected ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.color || '#019788' }} />
                              {t.name}
                              {isSelected && <span style={{ fontSize: '12.5px', marginLeft: '2px' }}>✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                <div className="farmshift-modal-footer">
                  <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setSupplierModal(null)}>Hủy</button>
                  <button type="submit" className="farmshift-btn farmshift-btn-mint">Lưu thông tin</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Thêm / Sửa / Xóa Thẻ Tag ─────────────── */}
      {tagModal && (
        <div
          className="farmshift-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setTagModal(null);
              setTagErrors({});
            }
          }}
        >
          <div className="farmshift-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">
                {tagModal.mode === 'create' ? 'Thêm mới Thẻ Tag' : tagModal.mode === 'edit' ? 'Chỉnh sửa Thẻ Tag' : 'Xóa Thẻ Tag'}
              </h3>
              <button
                onClick={() => {
                  setTagModal(null);
                  setTagErrors({});
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            {tagModal.mode === 'delete' ? (
              <form onSubmit={handleSaveTag}>
                <div className="farmshift-modal-body">
                  <p>Bạn có chắc chắn muốn xóa thẻ tag <strong>{tagModal.item?.name}</strong>?</p>
                </div>
                <div className="farmshift-modal-footer">
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={() => {
                      setTagModal(null);
                      setTagErrors({});
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="farmshift-btn farmshift-btn-danger">Xác nhận xóa</button>
                </div>
              </form>
            ) : (
              <form noValidate onSubmit={handleSaveTag}>
                <div className="farmshift-modal-body">
                  <div className="farmshift-form-group">
                    <label htmlFor="tag-name" className="farmshift-form-label">Tên thẻ Tag *</label>
                    <input
                      id="tag-name"
                      type="text"
                      className={`farmshift-form-control ${tagErrors.name ? 'has-error' : ''}`}
                      placeholder="Cám Giai đoạn 1 (Úm)..."
                      value={tagForm.name}
                      onChange={(e) => {
                        setTagForm({ ...tagForm, name: e.target.value });
                        if (tagErrors.name) setTagErrors(prev => ({ ...prev, name: '' }));
                      }}
                      required
                    />
                    {tagErrors.name && (
                      <div className="farmshift-field-error">
                        <AlertTriangle size={12} /> {tagErrors.name}
                      </div>
                    )}
                  </div>
                  <div className="farmshift-form-group" style={{ marginTop: '10px' }}>
                    <label htmlFor="tag-color" className="farmshift-form-label">Màu sắc nhận diện *</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={tagForm.color}
                        onChange={(e) => {
                          setTagForm({ ...tagForm, color: e.target.value });
                          if (tagErrors.color) setTagErrors(prev => ({ ...prev, color: '' }));
                        }}
                        style={{ width: '40px', height: '36px', padding: 0, border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                      />
                      <input
                        id="tag-color"
                        type="text"
                        className={`farmshift-form-control ${tagErrors.color ? 'has-error' : ''}`}
                        value={tagForm.color}
                        onChange={(e) => {
                          setTagForm({ ...tagForm, color: e.target.value });
                          if (tagErrors.color) setTagErrors(prev => ({ ...prev, color: '' }));
                        }}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                    {tagErrors.color && (
                      <div className="farmshift-field-error">
                        <AlertTriangle size={12} /> {tagErrors.color}
                      </div>
                    )}
                  </div>
                  <div className="farmshift-form-group" style={{ marginTop: '10px' }}>
                    <label htmlFor="tag-desc" className="farmshift-form-label">Mô tả</label>
                    <input
                      id="tag-desc"
                      type="text"
                      className="farmshift-form-control"
                      placeholder="Ghi chú thêm về mục đích của tag..."
                      value={tagForm.description}
                      onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="farmshift-modal-footer">
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={() => {
                      setTagModal(null);
                      setTagErrors({});
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="farmshift-btn farmshift-btn-mint">Lưu thẻ Tag</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Printable A4 Voucher rendered for browser print dialog */}
      {selectedOrder && (
        <PrintablePurchaseVoucher order={selectedOrder} />
      )}
    </FarmShiftLayout>
  );
};
