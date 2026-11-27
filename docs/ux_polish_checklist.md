# FarmShift — UX/UI Polish Audit Checklist (`frontendFarmShift`)

> Đồng bộ theo quy chuẩn [farmshift_ux_ui_polish_playbook.md](file:///d:/Smart-Farm-Management-System/.md/farmshift_ux_ui_polish_playbook.md).

## Core Components & Global Rules
- [x] `src/utils/selectFormatters.js` — `formatBarnOption`, `sortBarnsForOperation`, `formatInventoryOption`, `formatStockAfterExport`, `formatThousandsVi`, `formatShortVietnameseCurrency`
- [x] `src/components/CurrencyInput/CurrencyInput.jsx` & `CurrencyInput.module.css`
- [x] `src/components/QuantityInput/QuantityInput.jsx` & `QuantityInput.module.css`
- [x] `src/components/Modal/Modal.jsx` — hỗ trợ `isDirty` / `preventBackdropClose`
- [x] `src/layouts/FarmShiftLayout.module.css` — tăng `padding-bottom` trên Mobile PWA (`148px + safe-area`) tránh nút AI nổi đè lên thẻ/nút cuối
- [x] Cập nhật quy ước vào `AGENTS.md` và `docs/DESIGN.md`

---

## Batch 1: Nhập hàng & Công nợ
- [x] `src/features/farmshift/PurchaseRowActions.jsx` — `QuantityInput` (số lượng), `CurrencyInput` (đơn giá, chiết khấu, chi phí khác), modal dirty guard
- [x] `src/features/farmshift/PurchasesView.jsx` — `CurrencyInput` (thanh toán, trả trước, chiết khấu, chi phí khác), `QuantityInput` (số lượng dòng hàng), `isDirty` backdrop & Escape guard cho tất cả modal nhập liệu (`showAddModal`, `showPaymentModal`, `supplierModal`, `tagModal`)

## Batch 2: Xuất bán & Chuyển đàn
- [x] `src/features/farmshift/SalesView.jsx` — `QuantityInput` (số con + nút `Tất cả`, tổng kg + soft guardrail > 6 kg/con), `CurrencyInput` (đơn giá, tiền trả trước), dùng `sortBarnsForOperation` đẩy chuồng trống xuống cuối & đọc `BarnDto.currentQuantity`, live preview bình quân & thành tiền
- [x] `src/features/farmshift/TransfersView.jsx` — `QuantityInput` (số lượng), `CurrencyInput` (đơn giá)

## Batch 3: Chuồng nuôi, Nhật ký & Kế hoạch ngày
- [x] `src/features/farmshift/CycleDialogs.jsx` — dùng `CurrencyInput` & `QuantityInput` cho mọi dialog động + `isDirty` guard
- [x] `src/features/farmshift/BarnDetailView.jsx` — `QuantityInput` (số con chuyển + nút `Tất cả`), dropdown chuyển chuồng dùng `sortBarnsForOperation` & `formatBarnOption`
- [x] `src/features/farmshift/CloseCycleDialog.jsx` — `isDirty` backdrop guard
- [x] `src/features/farmshift/CycleHistoryView.jsx` — dropdown lọc chuồng dùng `sortBarnsForOperation` & `formatBarnOption`
- [x] `src/features/farmshift/BarnJournal.jsx` — `QuantityInput` (hao hụt + soft guardrail > 5% đàn, số con cân mẫu, tổng kg + soft guardrail > 6 kg/con)
- [x] `src/features/farmshift/BarnsView.jsx` — `QuantityInput` (số chuồng, sức chứa, hiện nuôi, ngày tuổi, cân nặng, số lượng nhập đàn, cân mục tiêu)
- [x] `src/features/farmshift/DailyPlanCard.jsx` — `QuantityInput` (lượng thực tế), dropdown kho nguồn dùng `formatInventoryOption` + khóa kho tồn 0, empty state (`Chưa nhập đàn` thay cho `0 con · ngày tuổi —`)

## Batch 4: Sổ bệnh án, Xuất nhập nội bộ & Nhật ký vận hành
- [x] `src/features/farmshift/DiseaseLogPanel.jsx` — `QuantityInput` (số con bị ảnh hưởng, số lượng thuốc xuất kho + `max` tồn kho + nút `Tất cả` + live preview tồn sau xuất), `CurrencyInput` (tiền thuốc mua ngoài, sửa tiền thuốc), dropdown chọn thuốc dùng `formatInventoryOption` + khóa chọn thuốc tồn 0, `isDirty` backdrop guard
- [x] `src/features/farmshift/InternalStockView.jsx` — `QuantityInput` (số lượng xuất/chuyển + `max` tồn kho + nút `Tất cả`), `CurrencyInput` (đơn giá), dropdown vật tư dùng `formatInventoryOption` + khóa chọn vật tư tồn 0, live preview `Tồn hiện tại -> Sau khi xuất còn`
- [x] `src/features/farmshift/InventoryItemDialog.jsx` — `onWheel` blur, auto-select `0`, dòng đọc nhẩm `>= 1.000.000`, `isDirty` backdrop guard (giữ tương thích 2 số thập phân)
- [x] `src/features/farmshift/FeedDiaryTab.jsx` — `QuantityInput` (cữ 1, cữ 2, cữ 3)
- [x] `src/features/farmshift/HealthDiaryTab.jsx` — `QuantityInput` (cân nặng TB, hao hụt)
- [x] `src/features/farmshift/EnvironmentalTab.jsx` — `QuantityInput` (nhiệt độ, độ ẩm)

## Batch 5: Khu nuôi, Chương trình nuôi, Phân công & IoT
- [x] `src/features/farmshift/FarmAreaDialogs.jsx` — `Dialog` hỗ trợ `isDirty` guard, `QuantityInput` (diện tích m², sức chứa tối đa con)
- [x] `src/features/farmshift/FarmingProgramDialog.jsx` — `QuantityInput` (thời gian nuôi, cân xuất chuồng, định lượng, từ ngày, đến ngày)
- [x] `src/features/farmshift/FarmingProgramsPanel.jsx` — `QuantityInput` (tra cứu ngày tuổi)
- [x] `src/features/farmshift/IotView.jsx` — `QuantityInput` (công suất, ngưỡng nhiệt độ), `DeviceDialog` `isDirty` backdrop guard
- [x] `src/features/farmshift/IotDevicesTab.jsx` — `QuantityInput` (ngưỡng nhiệt độ quạt)
- [x] `src/features/farmshift/MealScheduleDialog.jsx` — `isDirty` backdrop guard
- [x] `src/features/farmshift/RoutineTasksSettingsDialog.jsx` — `isDirty` backdrop guard
- [x] `src/features/farmshift/BarnResponsibilities.jsx` — `ResponsibilityDialog` `isDirty` backdrop guard
- [x] `src/features/farmshift/WorkAssignmentView.jsx` — `BarnWorkersDialog` `isDirty` backdrop guard
- [x] `src/features/farmshift/AccountView.jsx` — `showAddModal` & `showEditModal` `isDirty` backdrop guard

## Batch 6: Danh mục & Thiết lập
- [x] `src/features/farmshift/BrandsView.jsx` — `QuantityInput` (số lượng), `isDirty` backdrop guard
- [x] `src/features/farmshift/BreedingSettingsView.jsx` — `QuantityInput` (từ ngày tuổi, đến ngày tuổi)
- [x] `src/features/farmshift/MeasurementUnitsView.jsx` — `QuantityInput` (quy cách hàm lượng), `isDirty` backdrop guard
- [x] `src/features/farmshift/ProductTypesView.jsx` — `QuantityInput` (số lượng), `isDirty` backdrop guard
- [x] `src/features/farmshift/SuppliersView.jsx` — `isDirty` backdrop guard
- [x] `src/features/farmshift/CustomerContactsView.jsx` — `isDirty` backdrop guard
- [x] `src/features/farmshift/ProductCategoriesView.jsx` — `isDirty` backdrop guard
- [x] `src/features/farmshift/TransferCategoriesView.jsx` — `isDirty` backdrop guard
- [x] `src/features/farmshift/WarehouseCategoriesView.jsx` — `isDirty` backdrop guard
