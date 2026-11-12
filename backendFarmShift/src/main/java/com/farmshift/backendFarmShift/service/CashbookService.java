package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.*;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.*;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CashbookService {
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Bangkok");

    private final CashFundRepository fundRepository;
    private final CashTransactionRepository transactionRepository;
    private final CashFundTransferRepository transferRepository;
    private final CashTransactionCategoryRepository categoryRepository;
    private final FarmAssetRepository assetRepository;
    private final PayrollRecordRepository payrollRepository;
    private final CycleCostAllocationRepository costAllocationRepository;
    private final AccountRepository accountRepository;
    private final FarmingCycleRepository cycleRepository;
    private final EntityManager entityManager;

    public CashbookSummaryResponse getSummary(String type, Long fundId, LocalDate from, LocalDate to, String search) {
        List<CashFund> allFunds = fundRepository.findAll(Sort.by("id").ascending());
        List<CashTransaction> allTx = transactionRepository.findAllByOrderByTxDateDescIdDesc();
        List<CashFundTransfer> allTransfers = transferRepository.findAllByOrderByTransferDateDescIdDesc();
        List<CycleCostAllocation> allCostAllocations = costAllocationRepository.findAllByOrderByAllocationDateDescIdDesc();
        List<FarmAsset> allAssets = assetRepository.findAllByOrderByIdDesc();
        List<PayrollRecord> allPayrolls = payrollRepository.findAllByOrderByPayPeriodDescIdDesc();
        List<CashTransactionCategory> allCategories = categoryRepository.findAllByOrderByTypeAscIdAsc();
        List<StaffOption> staffOptions = accountRepository.findAll(Sort.by("fullName").ascending()).stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsActive()))
                .map(a -> new StaffOption(
                        a.getId(),
                        a.getFullName() != null && !a.getFullName().isBlank() ? a.getFullName() : a.getEmail(),
                        a.getRole() != null ? a.getRole().getName() : ""))
                .toList();
        List<CycleOption> cycleOptions = cycleRepository.findAllWithBarnByOrderByIdDesc().stream()
                .map(c -> new CycleOption(
                        c.getId(),
                        CycleService.cycleCode(c),
                        c.getBarn() != null ? c.getBarn().getName() : "Trang trại",
                        c.getCycleNumber(),
                        c.getStatus() != null ? c.getStatus().name() : "ACTIVE"))
                .toList();

        String normalizedType = type != null ? type.strip() : "ALL";
        String query = search != null ? search.strip().toLowerCase(Locale.ROOT) : "";

        List<CashTransaction> filteredTx = allTx.stream().filter(t -> {
            if (!"ALL".equalsIgnoreCase(normalizedType) && !normalizedType.isBlank()
                    && !normalizedType.equalsIgnoreCase(t.getType())) {
                return false;
            }
            if (fundId != null && (t.getFund() == null || !fundId.equals(t.getFund().getId()))) {
                return false;
            }
            if (from != null && t.getTxDate().isBefore(from)) {
                return false;
            }
            if (to != null && t.getTxDate().isAfter(to)) {
                return false;
            }
            if (!query.isEmpty()) {
                boolean matches = contains(t.getCode(), query)
                        || contains(t.getPersonName(), query)
                        || contains(t.getCategory(), query)
                        || contains(t.getNote(), query)
                        || contains(t.getReferenceInvoiceCode(), query);
                if (!matches) return false;
            }
            return true;
        }).toList();

        long totalRevenue = allTx.stream().filter(t -> "Thu".equalsIgnoreCase(t.getType())).mapToLong(CashTransaction::getAmount).sum();
        long totalExpense = allTx.stream().filter(t -> "Chi".equalsIgnoreCase(t.getType())).mapToLong(CashTransaction::getAmount).sum();
        long totalFundsBalance = allFunds.stream().mapToLong(CashFund::getBalance).sum();

        return new CashbookSummaryResponse(
                totalRevenue,
                totalExpense,
                totalFundsBalance,
                allFunds.stream().map(this::toFundResponse).toList(),
                filteredTx.stream().map(this::toTxResponse).toList(),
                allTransfers.stream().map(this::toTransferResponse).toList(),
                allCostAllocations.stream().map(this::toCostAllocationResponse).toList(),
                allAssets.stream().map(this::toAssetResponse).toList(),
                allPayrolls.stream().map(this::toPayrollResponse).toList(),
                allCategories.stream().map(this::toCategoryResponse).toList(),
                staffOptions,
                cycleOptions
        );
    }

    public List<FundResponse> listFunds() {
        return fundRepository.findAll(Sort.by("id").ascending()).stream().map(this::toFundResponse).toList();
    }

    @Transactional
    public FundResponse createFund(CashFundRequest request) {
        String name = request.name().strip();
        if (fundRepository.existsByNameIgnoreCaseAndIdNot(name, -1L)) {
            throw new ConflictException("Tên nguồn quỹ đã tồn tại.", "CASH_FUND_DUPLICATE", "name");
        }
        CashFund fund = new CashFund();
        applyFundFields(fund, request, name);
        fund.setBalance(request.balance());
        return toFundResponse(fundRepository.saveAndFlush(fund));
    }

    /**
     * Updates fund metadata only. The balance is ledger-derived (vouchers & transfers),
     * so it is never overwritten from the request to avoid stale-form drift.
     */
    @Transactional
    public FundResponse updateFund(Long id, CashFundRequest request) {
        CashFund fund = findFund(id);
        String name = request.name().strip();
        if (fundRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ConflictException("Tên nguồn quỹ đã tồn tại.", "CASH_FUND_DUPLICATE", "name");
        }
        applyFundFields(fund, request, name);
        return toFundResponse(fundRepository.saveAndFlush(fund));
    }

    @Transactional
    public void deleteFund(Long id) {
        CashFund fund = findFund(id);
        if (transactionRepository.existsByFund_Id(id) || transferRepository.existsByFromFund_IdOrToFund_Id(id, id)) {
            throw new ConflictException("Nguồn quỹ đã phát sinh giao dịch hoặc chuyển quỹ nên không thể xóa.", "CASH_FUND_IN_USE", null);
        }
        if (fund.getBalance() != null && fund.getBalance() != 0L) {
            throw new ConflictException("Nguồn quỹ vẫn còn số dư nên không thể xóa. Vui lòng chuyển hết số dư sang quỹ khác trước.", "CASH_FUND_HAS_BALANCE", null);
        }
        fundRepository.delete(fund);
    }

    @Transactional
    public TransactionResponse createTransaction(CashTransactionRequest request) {
        String normalizedType = normalizeTxType(request.type());
        CashFund fund = findFund(request.fundId());

        CashTransaction tx = new CashTransaction();
        tx.setCode(nextTxCode(normalizedType));
        tx.setTxDate(request.date());
        tx.setType(normalizedType);
        tx.setCategory(request.category().strip());
        tx.setAmount(request.amount());
        tx.setContact(request.contact() != null && !request.contact().isBlank() ? request.contact().strip() : "Đối tượng khác");
        tx.setPersonName(request.name().strip());
        tx.setFund(fund);
        tx.setNote(request.note() != null ? request.note().strip() : "");
        tx.setCreator(currentActorName());

        applyBalanceDelta(fund, normalizedType, request.amount());
        return toTxResponse(transactionRepository.saveAndFlush(tx));
    }

    /**
     * Update an existing receipt/payment voucher (FIN-08).
     * Atomically reverses the previous balance effect on oldFund,
     * and applies the updated amount/type to targetFund.
     */
    @Transactional
    public TransactionResponse updateTransaction(Long id, CashTransactionRequest request) {
        CashTransaction tx = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiếu thu / chi."));
        requireManualVoucher(tx, "sửa");
        String newType = normalizeTxType(request.type());

        Long oldFundId = tx.getFund().getId();
        CashFund oldFund = findFund(oldFundId);
        CashFund targetFund = oldFundId.equals(request.fundId()) ? oldFund : findFund(request.fundId());
        moveVoucherBalance(oldFund, tx.getType(), tx.getAmount(), targetFund, newType, request.amount());

        tx.setTxDate(request.date());
        tx.setType(newType);
        tx.setCategory(request.category().strip());
        tx.setAmount(request.amount());
        tx.setContact(request.contact() != null && !request.contact().isBlank() ? request.contact().strip() : "Đối tượng khác");
        tx.setPersonName(request.name().strip());
        tx.setFund(targetFund);
        tx.setNote(request.note() != null ? request.note().strip() : "");

        return toTxResponse(transactionRepository.saveAndFlush(tx));
    }

    @Transactional
    public void deleteTransaction(Long id) {
        CashTransaction tx = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiếu thu / chi."));
        requireManualVoucher(tx, "xóa");
        CashFund fund = findFund(tx.getFund().getId());
        reverseBalanceDelta(fund, tx.getType(), tx.getAmount());
        transactionRepository.delete(tx);
    }

    /**
     * Vouchers auto-generated from source documents (purchase invoice, sales order, payroll, fund transfer fee)
     * must be adjusted at the source document so both modules stay in sync.
     */
    private static void requireManualVoucher(CashTransaction tx, String action) {
        String ref = tx.getReferenceInvoiceCode();
        if (ref != null && !ref.isBlank()) {
            throw new ConflictException(
                    "Phiếu " + tx.getCode() + " được sinh tự động từ chứng từ " + ref
                            + " nên không thể " + action + " trực tiếp tại Sổ quỹ. Vui lòng điều chỉnh tại chứng từ gốc.",
                    "CASH_TX_LINKED", null);
        }
    }

    @Transactional
    public TransferResponse createTransfer(CashFundTransferRequest request) {
        if (request.fromFundId().equals(request.toFundId())) {
            throw new BadRequestException("Quỹ nguồn và quỹ đích không được trùng nhau.");
        }
        CashFund fromFund = findFund(request.fromFundId());
        CashFund toFund = findFund(request.toFundId());
        long fee = request.fee() != null ? request.fee() : 0L;
        if (fee < 0) {
            throw new BadRequestException("Phí chuyển quỹ không được âm.");
        }
        long totalDeduct = request.amount() + fee;
        if (fromFund.getBalance() == null || fromFund.getBalance() < totalDeduct) {
            throw new BadRequestException("Số dư quỹ nguồn (" + fromFund.getName() + ") không đủ để thực hiện chuyển quỹ.");
        }
        if (fundRepository.takeBalance(fromFund.getId(), request.amount()) == 0) {
            throw new BadRequestException("Số dư quỹ nguồn (" + fromFund.getName() + ") không đủ để thực hiện chuyển quỹ.");
        }
        fundRepository.addBalance(toFund.getId(), request.amount());
        entityManager.refresh(fromFund);
        entityManager.refresh(toFund);

        CashFundTransfer transfer = new CashFundTransfer();
        transfer.setCode(nextTransferCode());
        transfer.setTransferDate(request.date());
        transfer.setFromFund(fromFund);
        transfer.setToFund(toFund);
        transfer.setAmount(request.amount());
        transfer.setFee(fee);
        transfer.setNote(request.note() != null ? request.note().strip() : "");
        transfer.setCreator(currentActorName());
        CashFundTransfer saved = transferRepository.saveAndFlush(transfer);

        // Phí chuyển khoản là chi phí thật -> ghi phiếu chi để Tổng thu - Tổng chi luôn khớp tổng tồn quỹ.
        if (fee > 0) {
            applyBalanceDelta(fromFund, "Chi", fee);
            CashTransaction feeTx = new CashTransaction();
            feeTx.setCode(nextTxCode("Chi"));
            feeTx.setTxDate(request.date());
            feeTx.setType("Chi");
            feeTx.setCategory("Chi phí khác");
            feeTx.setAmount(fee);
            feeTx.setContact("Đối tượng khác");
            feeTx.setPersonName(fromFund.getBank() != null && !fromFund.getBank().isBlank() ? fromFund.getBank() : fromFund.getName());
            feeTx.setFund(fromFund);
            feeTx.setReferenceInvoiceCode(saved.getCode());
            feeTx.setNote("Phí chuyển quỹ " + saved.getCode() + " (" + fromFund.getName() + " → " + toFund.getName() + ")");
            feeTx.setCreator(currentActorName());
            transactionRepository.save(feeTx);
        }

        return toTransferResponse(saved);
    }

    @Transactional(readOnly = true)
    public String resolveFundPaymentMethod(Long cashFundId) {
        if (cashFundId == null) return "Tiền mặt";
        CashFund fund = findFund(cashFundId);
        return "CASH".equalsIgnoreCase(fund.getFundType()) ? "Tiền mặt" : "Chuyển khoản";
    }

    /**
     * Records a linked cash disbursement voucher when paying a supplier purchase invoice with a selected CashFund.
     */
    @Transactional
    public void recordPurchaseDisbursement(Long cashFundId, LocalDate date, long amount, String supplierName, String invoiceCode, String note) {
        recordPurchaseDisbursement(cashFundId, date, amount, supplierName, invoiceCode, "Thanh toán công nợ NCC", note);
    }

    @Transactional
    public void recordPurchaseDisbursement(Long cashFundId, LocalDate date, long amount, String supplierName, String invoiceCode, String category, String note) {
        if (cashFundId == null || amount <= 0) return;
        CashFund fund = findFund(cashFundId);
        if (fundRepository.takeBalance(fund.getId(), amount) == 0) {
            throw new BadRequestException("Số dư quỹ (" + fund.getName() + ") không đủ để chi thanh toán hóa đơn " + invoiceCode + ".");
        }
        entityManager.refresh(fund);

        CashTransaction tx = new CashTransaction();
        tx.setCode(nextTxCode("Chi"));
        tx.setTxDate(date != null ? date : LocalDate.now(VN_ZONE));
        tx.setType("Chi");
        tx.setCategory(category != null && !category.isBlank() ? category.strip() : "Thanh toán công nợ NCC");
        tx.setAmount(amount);
        tx.setContact("Nhà cung cấp");
        tx.setPersonName(supplierName != null ? supplierName : "Nhà cung cấp");
        tx.setFund(fund);
        tx.setReferenceInvoiceCode(invoiceCode);
        tx.setNote(note != null && !note.isBlank() ? note.strip() : "Chi thanh toán hóa đơn nhập " + invoiceCode);
        tx.setCreator(currentActorName());

        transactionRepository.save(tx);
    }

    /**
     * Synchronizes a cash receipt voucher when creating or updating a sales order with a selected CashFund.
     * Passing cashFundId == null on creation leaves Cashbook untouched for backward compatibility.
     */
    @Transactional
    public void syncSalesReceipt(Long cashFundId, LocalDate date, BigDecimal paidAmount, String customerName, String orderCode, String note) {
        long paid = paidAmount == null ? 0L : paidAmount.setScale(0, RoundingMode.HALF_UP).longValueExact();
        Optional<CashTransaction> existingOpt = (orderCode != null && !orderCode.isBlank())
                ? transactionRepository.findFirstByReferenceInvoiceCodeAndTypeOrderByIdDesc(orderCode, "Thu")
                : Optional.empty();

        if (existingOpt.isPresent()) {
            CashTransaction existing = existingOpt.get();
            CashFund oldFund = findFund(existing.getFund().getId());
            if (paid <= 0) {
                reverseBalanceDelta(oldFund, existing.getType(), existing.getAmount());
                transactionRepository.delete(existing);
                return;
            }
            CashFund targetFund = cashFundId != null
                    ? (oldFund.getId().equals(cashFundId) ? oldFund : findFund(cashFundId))
                    : oldFund;
            moveVoucherBalance(oldFund, existing.getType(), existing.getAmount(), targetFund, "Thu", paid);
            existing.setTxDate(date != null ? date : LocalDate.now(VN_ZONE));
            existing.setType("Thu");
            existing.setCategory("Đơn bán gà");
            existing.setAmount(paid);
            existing.setContact("Khách hàng");
            existing.setPersonName(customerName != null && !customerName.isBlank() ? customerName.strip() : "Khách hàng");
            existing.setFund(targetFund);
            existing.setNote(note != null && !note.isBlank()
                    ? note.strip() + " (" + orderCode + ")"
                    : "Thu tiền đơn bán " + orderCode);
            transactionRepository.save(existing);
            return;
        }

        if (cashFundId == null || paid <= 0) return;

        CashFund fund = findFund(cashFundId);
        applyBalanceDelta(fund, "Thu", paid);

        CashTransaction tx = new CashTransaction();
        tx.setCode(nextTxCode("Thu"));
        tx.setTxDate(date != null ? date : LocalDate.now(VN_ZONE));
        tx.setType("Thu");
        tx.setCategory("Đơn bán gà");
        tx.setAmount(paid);
        tx.setContact("Khách hàng");
        tx.setPersonName(customerName != null && !customerName.isBlank() ? customerName.strip() : "Khách hàng");
        tx.setFund(fund);
        tx.setReferenceInvoiceCode(orderCode);
        tx.setNote(note != null && !note.isBlank()
                ? note.strip() + " (" + orderCode + ")"
                : "Thu tiền đơn bán " + orderCode);
        tx.setCreator(currentActorName());

        transactionRepository.save(tx);
    }

    /**
     * Synchronizes a disbursement voucher when adding a CycleExpense (Chi phí lứa) if an active CashFund exists.
     */
    @Transactional
    public void syncCycleExpense(CycleExpense expense) {
        if (expense == null || expense.getId() == null || expense.getAmount() == null) return;
        long amount = expense.getAmount().setScale(0, RoundingMode.HALF_UP).longValue();
        if (amount <= 0L) return;

        CashFund primaryFund = fundRepository.findAll(Sort.by("id").ascending()).stream()
                .filter(f -> Boolean.TRUE.equals(f.getActive()))
                .findFirst()
                .orElse(null);
        if (primaryFund == null) return;

        applyBalanceDelta(primaryFund, "Chi", amount);

        String category = switch (expense.getCategory()) {
            case MEDICINE -> "Thuốc thú y & vắc-xin";
            case ELECTRICITY, WATER -> "Tiền điện & nước trang trại";
            case LABOR -> "Tiền lương công nhân";
            case OTHER -> "Chi phí khác";
        };
        FarmingCycle cycle = expense.getCycle();
        String cycleCode = cycle != null ? CycleService.cycleCode(cycle) : "CHUNG";
        String barnName = cycle != null && cycle.getBarn() != null ? cycle.getBarn().getName() : "Trang trại";
        String baseNote = expense.getNote() != null && !expense.getNote().isBlank()
                ? expense.getNote().strip()
                : category;

        CashTransaction tx = new CashTransaction();
        tx.setCode(nextTxCode("Chi"));
        tx.setTxDate(expense.getExpenseDate() != null ? expense.getExpenseDate() : LocalDate.now(VN_ZONE));
        tx.setType("Chi");
        tx.setCategory(category);
        tx.setAmount(amount);
        tx.setContact("Đối tượng khác");
        tx.setPersonName("Chi phí lứa " + cycleCode + " (" + barnName + ")");
        tx.setFund(primaryFund);
        tx.setReferenceInvoiceCode("CE-" + expense.getId());
        tx.setNote(baseNote + " · " + barnName + " (" + cycleCode + ")");
        tx.setCreator(expense.getCreatedBy() != null && !expense.getCreatedBy().isBlank()
                ? expense.getCreatedBy()
                : currentActorName());

        transactionRepository.save(tx);
    }

    @Transactional
    public void deleteCycleExpenseVoucher(Long expenseId) {
        if (expenseId == null) return;
        transactionRepository.findFirstByReferenceInvoiceCodeAndTypeOrderByIdDesc("CE-" + expenseId, "Chi")
                .ifPresent(tx -> {
                    CashFund fund = findFund(tx.getFund().getId());
                    reverseBalanceDelta(fund, tx.getType(), tx.getAmount());
                    transactionRepository.delete(tx);
                });
    }

    // ── Cycle Cost Allocations ───────────────────────────────────────────────────────────

    @Transactional
    public CostAllocationResponse createCostAllocation(CycleCostAllocationRequest request) {
        CycleCostAllocation alloc = new CycleCostAllocation();
        alloc.setCode(nextCostAllocationCode());
        applyCostAllocationFields(alloc, request);
        return toCostAllocationResponse(costAllocationRepository.saveAndFlush(alloc));
    }

    @Transactional
    public CostAllocationResponse updateCostAllocation(Long id, CycleCostAllocationRequest request) {
        CycleCostAllocation alloc = costAllocationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khoản phân bổ chi phí."));
        applyCostAllocationFields(alloc, request);
        return toCostAllocationResponse(costAllocationRepository.saveAndFlush(alloc));
    }

    @Transactional
    public void deleteCostAllocation(Long id) {
        CycleCostAllocation alloc = costAllocationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khoản phân bổ chi phí."));
        costAllocationRepository.delete(alloc);
    }

    private void applyCostAllocationFields(CycleCostAllocation alloc, CycleCostAllocationRequest request) {
        if (request.cycleId() != null) {
            FarmingCycle cycle = cycleRepository.findById(request.cycleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lứa nuôi."));
            alloc.setCycle(cycle);
            alloc.setBarnName(cycle.getBarn() != null ? cycle.getBarn().getName() : "Trang trại");
            alloc.setCycleCode(CycleService.cycleCode(cycle));
        } else {
            alloc.setCycle(null);
            alloc.setBarnName(request.barnName() != null && !request.barnName().isBlank() ? request.barnName().strip() : "Toàn trang trại");
            alloc.setCycleCode(request.cycleCode() != null && !request.cycleCode().isBlank() ? request.cycleCode().strip() : "CHUNG");
        }
        alloc.setCostType(request.costType().strip());
        alloc.setAmount(request.amount());
        alloc.setSourceVoucherCode(request.sourceVoucherCode() != null ? request.sourceVoucherCode().strip() : "—");
        alloc.setAllocationDate(request.date());
        alloc.setNote(request.note() != null ? request.note().strip() : "");
    }

    // ── Fixed Assets & Depreciation ─────────────────────────────────────────────────────

    @Transactional
    public AssetResponse createAsset(FarmAssetRequest request) {
        FarmAsset asset = new FarmAsset();
        asset.setCode(nextAssetCode());
        applyAssetFields(asset, request);
        return toAssetResponse(assetRepository.saveAndFlush(asset));
    }

    @Transactional
    public AssetResponse updateAsset(Long id, FarmAssetRequest request) {
        FarmAsset asset = assetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài sản cố định."));
        applyAssetFields(asset, request);
        return toAssetResponse(assetRepository.saveAndFlush(asset));
    }

    @Transactional
    public void deleteAsset(Long id) {
        FarmAsset asset = assetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài sản cố định."));
        assetRepository.delete(asset);
    }

    private void applyAssetFields(FarmAsset asset, FarmAssetRequest request) {
        asset.setName(request.name().strip());
        asset.setCost(request.cost());
        asset.setDepreciationMonths(request.depreciationMonths());
        asset.setMonthlyDepreciation(Math.round((double) request.cost() / request.depreciationMonths()));
        asset.setBarnLocation(request.barnLocation() != null && !request.barnLocation().isBlank() ? request.barnLocation().strip() : "Toàn trang trại");
        asset.setPurchaseDate(request.purchaseDate() != null ? request.purchaseDate() : LocalDate.now(VN_ZONE));
        asset.setStatus(request.status() != null && !request.status().isBlank() ? request.status().strip() : "Đang trích khấu hao");
        asset.setNote(request.note() != null ? request.note().strip() : "");
    }

    // ── Employee Payroll & Atomic Disbursement ──────────────────────────────────────────

    @Transactional
    public PayrollResponse createPayroll(PayrollRequest request) {
        PayrollRecord record = new PayrollRecord();
        record.setCode(nextPayrollCode());
        record.setPaidAmount(0L);
        applyPayrollFields(record, request);
        return toPayrollResponse(payrollRepository.saveAndFlush(record));
    }

    @Transactional
    public PayrollResponse updatePayroll(Long id, PayrollRequest request) {
        PayrollRecord record = payrollRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bảng lương nhân viên."));
        applyPayrollFields(record, request);
        return toPayrollResponse(payrollRepository.saveAndFlush(record));
    }

    @Transactional
    public PayrollResponse payPayroll(Long id, PayrollPayRequest request) {
        PayrollRecord record = payrollRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bảng lương nhân viên."));
        long remaining = Math.max(0L, record.getRemainingAmount());
        if (remaining <= 0L) {
            throw new BadRequestException("Bảng lương " + record.getCode() + " đã được thanh toán đủ.");
        }
        if (request.amount() > remaining) {
            throw new BadRequestException("Số tiền thanh toán vượt quá số lương còn phải trả (" + remaining + " đ).");
        }

        CashFund fund = findFund(request.cashFundId());
        if (fundRepository.takeBalance(fund.getId(), request.amount()) == 0) {
            throw new BadRequestException("Số dư quỹ (" + fund.getName() + ") không đủ để chi lương.");
        }
        entityManager.refresh(fund);

        LocalDate payDate = request.paymentDate() != null ? request.paymentDate() : LocalDate.now(VN_ZONE);
        String voucherNote = request.note() != null && !request.note().isBlank()
                ? request.note().strip()
                : "Chi lương kỳ " + record.getPayPeriod() + " (" + record.getCode() + ")";

        CashTransaction tx = new CashTransaction();
        tx.setCode(nextTxCode("Chi"));
        tx.setTxDate(payDate);
        tx.setType("Chi");
        tx.setCategory("Tiền lương công nhân");
        tx.setAmount(request.amount());
        tx.setContact("Nhân sự");
        tx.setPersonName(record.getEmployeeName());
        tx.setFund(fund);
        tx.setReferenceInvoiceCode(record.getCode());
        tx.setNote(voucherNote);
        tx.setCreator(currentActorName());

        transactionRepository.save(tx);

        long newPaid = record.getPaidAmount() + request.amount();
        long newRemaining = Math.max(0L, record.getTotalAmount() - record.getAdvance() - newPaid);
        record.setPaidAmount(newPaid);
        record.setRemainingAmount(newRemaining);
        record.setStatus(newRemaining == 0L ? "Đã thanh toán" : "Còn nợ lương");

        return toPayrollResponse(payrollRepository.saveAndFlush(record));
    }

    @Transactional
    public void deletePayroll(Long id) {
        PayrollRecord record = payrollRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bảng lương nhân viên."));
        if (record.getPaidAmount() != null && record.getPaidAmount() > 0L) {
            throw new ConflictException("Không thể xóa bảng lương đã phát sinh thanh toán.", "PAYROLL_IN_USE", null);
        }
        payrollRepository.delete(record);
    }

    private void applyPayrollFields(PayrollRecord record, PayrollRequest request) {
        if (request.accountId() != null) {
            Account account = accountRepository.findById(request.accountId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên đã chọn."));
            record.setAccount(account);
            String fullName = account.getFullName() != null && !account.getFullName().isBlank() ? account.getFullName() : request.employeeName().strip();
            record.setEmployeeName(fullName);
        } else {
            record.setAccount(null);
            record.setEmployeeName(request.employeeName().strip());
        }
        long bonus = request.bonus() != null ? request.bonus() : 0L;
        long advance = request.advance() != null ? request.advance() : 0L;
        long total = (long) request.workDays() * request.dailyRate() + bonus;
        long paid = record.getPaidAmount() != null ? record.getPaidAmount() : 0L;
        long remain = Math.max(0L, total - advance - paid);

        record.setPayPeriod(request.payPeriod().strip());
        record.setWorkDays(request.workDays());
        record.setDailyRate(request.dailyRate());
        record.setBonus(bonus);
        record.setAdvance(advance);
        record.setTotalAmount(total);
        record.setRemainingAmount(remain);
        record.setStatus(remain == 0L ? "Đã thanh toán" : "Còn nợ lương");
        record.setNote(request.note() != null ? request.note().strip() : "");
    }

    // ── Cash Transaction Categories ──────────────────────────────────────────────────────

    @Transactional
    public CategoryResponse createCategory(CashTransactionCategoryRequest request) {
        String type = normalizeTxType(request.type());
        String name = request.name().strip();
        String key = categoryKey(type, name);
        if (categoryRepository.existsByNameKeyAndIdNot(key, -1L)) {
            throw new ConflictException("Loại phiếu '" + name + "' đã tồn tại.", "CATEGORY_DUPLICATE", "name");
        }
        CashTransactionCategory category = new CashTransactionCategory();
        category.setName(name);
        category.setNameKey(key);
        category.setType(type);
        category.setCostGroup(request.costGroup().strip());
        category.setNote(request.note() != null ? request.note().strip() : "");
        category.setActive(true);
        return toCategoryResponse(categoryRepository.saveAndFlush(category));
    }

    @Transactional
    public CategoryResponse updateCategory(Long id, CashTransactionCategoryRequest request) {
        CashTransactionCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục thu / chi."));
        String type = normalizeTxType(request.type());
        String name = request.name().strip();
        String key = categoryKey(type, name);
        if (categoryRepository.existsByNameKeyAndIdNot(key, id)) {
            throw new ConflictException("Loại phiếu '" + name + "' đã tồn tại.", "CATEGORY_DUPLICATE", "name");
        }
        category.setName(name);
        category.setNameKey(key);
        category.setType(type);
        category.setCostGroup(request.costGroup().strip());
        category.setNote(request.note() != null ? request.note().strip() : "");
        return toCategoryResponse(categoryRepository.saveAndFlush(category));
    }

    @Transactional
    public void deleteCategory(Long id) {
        CashTransactionCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục thu / chi."));
        if (transactionRepository.existsByCategoryIgnoreCaseAndTypeIgnoreCase(category.getName(), category.getType())) {
            throw new ConflictException("Danh mục đã phát sinh chứng từ thu/chi nên không thể xóa.", "CATEGORY_IN_USE", null);
        }
        categoryRepository.delete(category);
    }

    // ── Helpers & Locking ────────────────────────────────────────────────────────────────

    private CashFund findFund(Long id) {
        return fundRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nguồn quỹ."));
    }

    private void applyFundFields(CashFund fund, CashFundRequest request, String name) {
        fund.setName(name);
        fund.setAccountNo(request.accountNo() != null && !request.accountNo().isBlank() ? request.accountNo().strip() : "—");
        fund.setBank(request.bank().strip());
        String type = request.fundType() != null && request.fundType().equalsIgnoreCase("CASH") ? "CASH" : "BANK";
        fund.setFundType(type);
        fund.setNote(request.note() != null ? request.note().strip() : "");
        fund.setActive(true);
    }

    private static String normalizeTxType(String raw) {
        if ("Thu".equalsIgnoreCase(raw == null ? "" : raw.strip())) return "Thu";
        if ("Chi".equalsIgnoreCase(raw == null ? "" : raw.strip())) return "Chi";
        throw new BadRequestException("Loại phiếu phải là 'Thu' hoặc 'Chi'.");
    }

    private void applyBalanceDelta(CashFund fund, String type, long amount) {
        if ("Thu".equalsIgnoreCase(type)) {
            fundRepository.addBalance(fund.getId(), amount);
        } else {
            if (fundRepository.takeBalance(fund.getId(), amount) == 0) {
                throw new BadRequestException("Số dư quỹ (" + fund.getName() + ") không đủ để thực hiện phiếu chi.");
            }
        }
        entityManager.refresh(fund);
    }

    private void reverseBalanceDelta(CashFund fund, String type, long amount) {
        if ("Thu".equalsIgnoreCase(type)) {
            if (fundRepository.takeBalance(fund.getId(), amount) == 0) {
                throw new BadRequestException("Số dư quỹ (" + fund.getName() + ") không đủ để hoàn tác phiếu thu.");
            }
        } else {
            fundRepository.addBalance(fund.getId(), amount);
        }
        entityManager.refresh(fund);
    }

    /**
     * Moves a voucher's balance effect from (oldFund, oldType, oldAmount) to (newFund, newType, newAmount).
     * On the same fund only the net difference is applied, so editing a receipt whose money was already
     * spent does not fail on an intermediate full reversal.
     */
    private void moveVoucherBalance(CashFund oldFund, String oldType, long oldAmount,
                                    CashFund newFund, String newType, long newAmount) {
        if (oldFund.getId().equals(newFund.getId())) {
            long net = signed(newType, newAmount) - signed(oldType, oldAmount);
            if (net > 0) {
                applyBalanceDelta(newFund, "Thu", net);
            } else if (net < 0) {
                applyBalanceDelta(newFund, "Chi", -net);
            }
            return;
        }
        reverseBalanceDelta(oldFund, oldType, oldAmount);
        applyBalanceDelta(newFund, newType, newAmount);
    }

    private static long signed(String type, long amount) {
        return "Thu".equalsIgnoreCase(type) ? amount : -amount;
    }

    private String nextTxCode(String type) {
        String prefix = "Thu".equalsIgnoreCase(type) ? "PT" : "PC";
        long num = transactionRepository.countByCodeStartingWith(prefix) + 1;
        String code = String.format(Locale.ROOT, "%s%06d", prefix, num);
        while (transactionRepository.findByCode(code).isPresent()) {
            num++;
            code = String.format(Locale.ROOT, "%s%06d", prefix, num);
        }
        return code;
    }

    private String nextTransferCode() {
        long num = transferRepository.count() + 1;
        String code = String.format(Locale.ROOT, "CQ%06d", num);
        while (transferRepository.findByCode(code).isPresent()) {
            num++;
            code = String.format(Locale.ROOT, "CQ%06d", num);
        }
        return code;
    }

    private String nextCostAllocationCode() {
        long num = costAllocationRepository.count() + 1;
        String code = String.format(Locale.ROOT, "PB%04d", num);
        while (costAllocationRepository.findByCode(code).isPresent()) {
            num++;
            code = String.format(Locale.ROOT, "PB%04d", num);
        }
        return code;
    }

    private String nextAssetCode() {
        long num = assetRepository.count() + 1;
        String code = String.format(Locale.ROOT, "TS%04d", num);
        while (assetRepository.findByCode(code).isPresent()) {
            num++;
            code = String.format(Locale.ROOT, "TS%04d", num);
        }
        return code;
    }

    private String nextPayrollCode() {
        long num = payrollRepository.count() + 1;
        String code = String.format(Locale.ROOT, "CC%04d", num);
        while (payrollRepository.findByCode(code).isPresent()) {
            num++;
            code = String.format(Locale.ROOT, "CC%04d", num);
        }
        return code;
    }

    private static String categoryKey(String type, String name) {
        return type.toLowerCase(Locale.ROOT) + ":" + name.toLowerCase(Locale.ROOT);
    }

    private static String currentActorName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null ? auth.getName() : "Hệ thống";
    }

    private static boolean contains(String source, String query) {
        return source != null && source.toLowerCase(Locale.ROOT).contains(query);
    }

    private FundResponse toFundResponse(CashFund f) {
        return new FundResponse(f.getId(), f.getName(), f.getAccountNo(), f.getBank(), f.getFundType(),
                f.getBalance(), f.getNote(), Boolean.TRUE.equals(f.getActive()));
    }

    private TransactionResponse toTxResponse(CashTransaction t) {
        return new TransactionResponse(t.getId(), t.getCode(), t.getTxDate(), t.getType(), t.getCategory(),
                t.getAmount(), t.getContact(), t.getPersonName(), t.getFund().getId(), t.getFund().getName(),
                t.getNote(), t.getCreator(), t.getReferenceInvoiceCode(), t.getCreatedAt(), t.getUpdatedAt());
    }

    private TransferResponse toTransferResponse(CashFundTransfer tr) {
        return new TransferResponse(tr.getId(), tr.getCode(), tr.getTransferDate(),
                tr.getFromFund().getId(), tr.getFromFund().getName(),
                tr.getToFund().getId(), tr.getToFund().getName(),
                tr.getAmount(), tr.getFee(), tr.getNote(), tr.getCreator());
    }

    private CostAllocationResponse toCostAllocationResponse(CycleCostAllocation c) {
        return new CostAllocationResponse(c.getId(), c.getCode(),
                c.getCycle() != null ? c.getCycle().getId() : null,
                c.getBarnName(), c.getCycleCode(), c.getCostType(),
                c.getAmount(), c.getSourceVoucherCode(), c.getAllocationDate(), c.getNote());
    }

    private AssetResponse toAssetResponse(FarmAsset a) {
        return new AssetResponse(a.getId(), a.getCode(), a.getName(), a.getCost(), a.getDepreciationMonths(),
                a.getMonthlyDepreciation(), a.getBarnLocation(), a.getPurchaseDate(), a.getStatus(), a.getNote());
    }

    private PayrollResponse toPayrollResponse(PayrollRecord p) {
        return new PayrollResponse(p.getId(), p.getCode(),
                p.getAccount() != null ? p.getAccount().getId() : null,
                p.getEmployeeName(), p.getPayPeriod(), p.getWorkDays(), p.getDailyRate(),
                p.getBonus(), p.getAdvance(), p.getTotalAmount(), p.getPaidAmount(),
                p.getRemainingAmount(), p.getStatus(), p.getNote());
    }

    private CategoryResponse toCategoryResponse(CashTransactionCategory c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getType(), c.getCostGroup(),
                c.getNote(), Boolean.TRUE.equals(c.getActive()));
    }
}
