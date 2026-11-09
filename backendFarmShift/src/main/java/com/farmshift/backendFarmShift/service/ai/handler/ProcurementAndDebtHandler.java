package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.AiRbacPolicy;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

/**
 * Handles Procurement & Supplier Debt AI queries and debt payment authorization.
 * Strict RBAC: Workers are blocked from debt payments or viewing financial debt totals.
 */
@Slf4j
@Component
@Order(40)
@RequiredArgsConstructor
public class ProcurementAndDebtHandler implements AssistantCommandHandler {

    private final SupplierRepository supplierRepository;
    private static final NumberFormat CURRENCY_FORMAT = NumberFormat.getInstance(new Locale("vi", "VN"));

    @Override
    public int getOrder() {
        return 40;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) return false;
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

        return (norm.contains("cong no") || norm.contains("no nha cung cap") || norm.contains("tra no") || norm.contains("thanh toan no"))
                && (norm.contains("nha cung cap") || norm.contains("dabaco") || norm.contains("cargill") || norm.contains("cp") || norm.contains("hanvet") || norm.contains("bao nhieu"));
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

        boolean isPayment = norm.contains("tra no") || norm.contains("thanh toan no") || norm.contains("thanh toan");

        // RBAC Check: Worker blocked from financial mutations
        if (isPayment && context.isWorker()) {
            return AiRbacPolicy.createForbiddenResponse();
        }

        List<Supplier> suppliers = supplierRepository.findAll();
        Supplier targetSupplier = suppliers.stream()
                .filter(s -> s.getName() != null && norm.contains(VietnameseSpeechNormalizer.removeVietnameseDiacritics(s.getName()).toLowerCase()))
                .findFirst()
                .orElse(null);

        if (targetSupplier != null) {
            long debt = targetSupplier.getOpeningDebt() != null ? targetSupplier.getOpeningDebt() : 0L;
            if (context.isWorker()) {
                return AiAssistantResponse.builder()
                        .reply("Thông tin công nợ nhà cung cấp **" + targetSupplier.getName() + "** được bảo mật theo phân quyền.")
                        .actionType("QUERY_SUPPLIER_DEBT")
                        .executed(true)
                        .build();
            }

            return AiAssistantResponse.builder()
                    .reply("📊 Hiện tại công nợ đối với nhà cung cấp **" + targetSupplier.getName() + "** là **"
                            + CURRENCY_FORMAT.format(debt) + " VNĐ**.")
                    .actionType("QUERY_SUPPLIER_DEBT")
                    .executed(true)
                    .navigateTo("/purchases")
                    .build();
        }

        return null;
    }
}
