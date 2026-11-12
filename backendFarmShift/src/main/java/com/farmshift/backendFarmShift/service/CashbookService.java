package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.CashFundRequest;
import com.farmshift.backendFarmShift.dto.request.CashFundTransferRequest;
import com.farmshift.backendFarmShift.dto.request.CashTransactionRequest;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.FundResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.TransactionResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.TransferResponse;
import com.farmshift.backendFarmShift.entity.CashFund;
import com.farmshift.backendFarmShift.entity.CashFundTransfer;
import com.farmshift.backendFarmShift.entity.CashTransaction;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.CashFundRepository;
import com.farmshift.backendFarmShift.repository.CashFundTransferRepository;
import com.farmshift.backendFarmShift.repository.CashTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CashbookService {
    private final CashFundRepository fundRepository;
    private final CashTransactionRepository transactionRepository;
    private final CashFundTransferRepository transferRepository;

    public CashbookSummaryResponse getSummary(String type, Long fundId, LocalDate from, LocalDate to, String search) {
        List<CashFund> allFunds = fundRepository.findAll(Sort.by("id").ascending());
        List<CashTransaction> allTx = transactionRepository.findAllByOrderByTxDateDescIdDesc();
        List<CashFundTransfer> allTransfers = transferRepository.findAllByOrderByTransferDateDescIdDesc();

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
                allTransfers.stream().map(this::toTransferResponse).toList()
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
        return toFundResponse(fundRepository.saveAndFlush(fund));
    }

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
        fundRepository.save(fund);
        return toTxResponse(transactionRepository.saveAndFlush(tx));
    }

    /**
     * Update an existing receipt/payment voucher (FIN-08).
     * Atomically reverses the previous balance effect on oldFund, then applies the updated amount/type to targetFund.
     */
    @Transactional
    public TransactionResponse updateTransaction(Long id, CashTransactionRequest request) {
        CashTransaction tx = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiếu thu / chi."));
        String newType = normalizeTxType(request.type());

        CashFund oldFund = tx.getFund();
        reverseBalanceDelta(oldFund, tx.getType(), tx.getAmount());

        CashFund targetFund = oldFund.getId().equals(request.fundId()) ? oldFund : findFund(request.fundId());
        applyBalanceDelta(targetFund, newType, request.amount());

        fundRepository.save(oldFund);
        if (!targetFund.getId().equals(oldFund.getId())) {
            fundRepository.save(targetFund);
        }

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
        CashFund fund = tx.getFund();
        reverseBalanceDelta(fund, tx.getType(), tx.getAmount());
        fundRepository.save(fund);
        transactionRepository.delete(tx);
    }

    @Transactional
    public TransferResponse createTransfer(CashFundTransferRequest request) {
        if (request.fromFundId().equals(request.toFundId())) {
            throw new BadRequestException("Quỹ nguồn và quỹ đích không được trùng nhau.");
        }
        CashFund fromFund = findFund(request.fromFundId());
        CashFund toFund = findFund(request.toFundId());
        long fee = request.fee() != null ? request.fee() : 0L;
        long totalDeduct = request.amount() + fee;
        if (fromFund.getBalance() < totalDeduct) {
            throw new BadRequestException("Số dư quỹ nguồn (" + fromFund.getName() + ") không đủ để thực hiện chuyển quỹ.");
        }

        fromFund.setBalance(fromFund.getBalance() - totalDeduct);
        toFund.setBalance(toFund.getBalance() + request.amount());
        fundRepository.save(fromFund);
        fundRepository.save(toFund);

        CashFundTransfer transfer = new CashFundTransfer();
        transfer.setCode(nextTransferCode());
        transfer.setTransferDate(request.date());
        transfer.setFromFund(fromFund);
        transfer.setToFund(toFund);
        transfer.setAmount(request.amount());
        transfer.setFee(fee);
        transfer.setNote(request.note() != null ? request.note().strip() : "");
        transfer.setCreator(currentActorName());

        return toTransferResponse(transferRepository.saveAndFlush(transfer));
    }

    /**
     * Records a linked cash disbursement voucher when paying a supplier purchase invoice with a selected CashFund.
     */
    @Transactional
    public void recordPurchaseDisbursement(Long cashFundId, LocalDate date, long amount, String supplierName, String invoiceCode, String note) {
        if (cashFundId == null || amount <= 0) return;
        CashFund fund = fundRepository.findById(cashFundId)
                .orElseThrow(() -> new ResourceNotFoundException("Nguồn quỹ thanh toán không tồn tại."));

        CashTransaction tx = new CashTransaction();
        tx.setCode(nextTxCode("Chi"));
        tx.setTxDate(date != null ? date : LocalDate.now(java.time.ZoneId.of("Asia/Bangkok")));
        tx.setType("Chi");
        tx.setCategory("Thanh toán công nợ NCC");
        tx.setAmount(amount);
        tx.setContact("Nhà cung cấp");
        tx.setPersonName(supplierName != null ? supplierName : "Nhà cung cấp");
        tx.setFund(fund);
        tx.setReferenceInvoiceCode(invoiceCode);
        tx.setNote(note != null && !note.isBlank() ? note.strip() : "Chi thanh toán hóa đơn nhập " + invoiceCode);
        tx.setCreator(currentActorName());

        fund.setBalance(fund.getBalance() - amount);
        fundRepository.save(fund);
        transactionRepository.save(tx);
    }

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
        fund.setBalance(request.balance());
        fund.setNote(request.note() != null ? request.note().strip() : "");
        fund.setActive(true);
    }

    private static String normalizeTxType(String raw) {
        if ("Thu".equalsIgnoreCase(raw == null ? "" : raw.strip())) return "Thu";
        if ("Chi".equalsIgnoreCase(raw == null ? "" : raw.strip())) return "Chi";
        throw new BadRequestException("Loại phiếu phải là 'Thu' hoặc 'Chi'.");
    }

    private static void applyBalanceDelta(CashFund fund, String type, long amount) {
        if ("Thu".equalsIgnoreCase(type)) {
            fund.setBalance(fund.getBalance() + amount);
        } else {
            fund.setBalance(fund.getBalance() - amount);
        }
    }

    private static void reverseBalanceDelta(CashFund fund, String type, long amount) {
        if ("Thu".equalsIgnoreCase(type)) {
            fund.setBalance(fund.getBalance() - amount);
        } else {
            fund.setBalance(fund.getBalance() + amount);
        }
    }

    private String nextTxCode(String type) {
        String prefix = "Thu".equalsIgnoreCase(type) ? "PT" : "PC";
        long num = transactionRepository.count() + 1;
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
}

