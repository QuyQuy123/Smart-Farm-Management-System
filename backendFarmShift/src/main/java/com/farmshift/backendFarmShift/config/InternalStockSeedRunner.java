package com.farmshift.backendFarmShift.config;

import com.farmshift.backendFarmShift.entity.InternalStockCategory;
import com.farmshift.backendFarmShift.repository.InternalStockCategoryRepository;
import com.farmshift.backendFarmShift.repository.InternalStockVoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@RequiredArgsConstructor
public class InternalStockSeedRunner implements ApplicationRunner {
    private final InternalStockCategoryRepository categoryRepository;
    private final InternalStockVoucherRepository voucherRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // Loại bỏ các danh mục IMPORT cũ nếu chưa phát sinh phiếu (hệ thống chỉ còn Xuất kho & Chuyển kho nội bộ)
        List<InternalStockCategory> importCategories = categoryRepository.findByMovementType("IMPORT");
        for (InternalStockCategory cat : importCategories) {
            if (!voucherRepository.existsByCategory_Id(cat.getId())) {
                categoryRepository.delete(cat);
            }
        }

        // Danh mục hệ thống mặc định (bảo vệ không xóa)
        seedIfMissing("EXPORT", "Xuất hủy", "xuất hủy", "Xuất hủy hàng hóa ẩm mốc, quá hạn hoặc hư hỏng trong trang trại", true);
        seedIfMissing("TRANSFER", "Chuyển kho nội bộ", "chuyển kho nội bộ", "Luân chuyển điều chuyển hàng hóa chung giữa các kho trong trang trại", true);

        // Danh mục nghiệp vụ thực tế trang trại (người dùng có thể sửa/xóa khi cần)
        seedIfMissing("EXPORT", "Xuất hao hụt kiểm kê", "xuất hao hụt kiểm kê", "Cân bằng kho khi phát hiện thiếu hụt, rơi vãi sau kiểm kê định kỳ", false);
        seedIfMissing("EXPORT", "Xuất vật tư tiêu hao", "xuất vật tư tiêu hao", "Xuất bóng sưởi, chất sát trùng, vôi bột, đệm lót dùng cho chuồng nuôi", false);

        seedIfMissing("TRANSFER", "Chuyển sang kho đệm chuồng", "chuyển sang kho đệm chuồng", "Chuyển cám, thuốc từ kho tổng sang kho đệm tại từng khu chuồng nuôi", false);
    }

    private void seedIfMissing(String movementType, String name, String nameKey, String description, boolean isSystem) {
        if (!categoryRepository.existsByNameKey(nameKey)) {
            InternalStockCategory cat = new InternalStockCategory();
            cat.setMovementType(movementType);
            cat.setName(name);
            cat.setNameKey(nameKey);
            cat.setDescription(description);
            cat.setSystem(isSystem);
            categoryRepository.save(cat);
        }
    }
}
