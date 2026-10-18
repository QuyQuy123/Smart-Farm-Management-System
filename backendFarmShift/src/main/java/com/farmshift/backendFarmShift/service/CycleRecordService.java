package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.CycleExpenseRequest;
import com.farmshift.backendFarmShift.dto.request.FeedRecordRequest;
import com.farmshift.backendFarmShift.dto.request.WeightSampleRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.CycleExpenseRepository;
import com.farmshift.backendFarmShift.repository.FeedRecordRepository;
import com.farmshift.backendFarmShift.repository.WeightSampleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.farmshift.backendFarmShift.service.CycleService.checkDate;
import static com.farmshift.backendFarmShift.service.CycleService.clean;

/** Nhật ký hằng ngày của lứa: cám, cân mẫu, khoản chi bổ sung. Chỉ ghi được khi lứa đang nuôi. */
@Service
@RequiredArgsConstructor
@Transactional
public class CycleRecordService {
    private final CycleService cycleService;
    private final FeedRecordRepository feedRepository;
    private final WeightSampleRepository weightRepository;
    private final CycleExpenseRepository expenseRepository;

    public Long addFeed(Long cycleId, FeedRecordRequest request, String user) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        checkDate(cycle, request.recordDate(), "Ngày cho ăn");
        FeedRecord record = new FeedRecord();
        record.setCycle(cycle);
        record.setRecordDate(request.recordDate());
        record.setFeedName(FarmAreaService.normalizeName(request.feedName()));
        record.setQuantityKg(request.quantityKg());
        record.setUnitPrice(request.unitPrice());
        record.setNote(clean(request.note()));
        record.setCreatedBy(user);
        return feedRepository.save(record).getId();
    }

    public void deleteFeed(Long cycleId, Long id) {
        cycleService.requireActive(cycleId);
        feedRepository.delete(feedRepository.findByIdAndCycleId(id, cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhật ký cám.")));
    }

    public Long addWeight(Long cycleId, WeightSampleRequest request, String user) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        checkDate(cycle, request.sampleDate(), "Ngày cân");
        WeightSample sample = new WeightSample();
        sample.setCycle(cycle);
        sample.setSampleDate(request.sampleDate());
        sample.setAvgWeightKg(request.avgWeightKg());
        sample.setSampleSize(request.sampleSize());
        sample.setNote(clean(request.note()));
        sample.setCreatedBy(user);
        return weightRepository.save(sample).getId();
    }

    public void deleteWeight(Long cycleId, Long id) {
        cycleService.requireActive(cycleId);
        weightRepository.delete(weightRepository.findByIdAndCycleId(id, cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lần cân mẫu.")));
    }

    public Long addExpense(Long cycleId, CycleExpenseRequest request, String user) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        checkDate(cycle, request.expenseDate(), "Ngày chi");
        CycleExpense expense = new CycleExpense();
        expense.setCycle(cycle);
        expense.setExpenseDate(request.expenseDate());
        expense.setCategory(request.category());
        expense.setAmount(request.amount());
        expense.setNote(clean(request.note()));
        expense.setCreatedBy(user);
        return expenseRepository.save(expense).getId();
    }

    public void deleteExpense(Long cycleId, Long id) {
        cycleService.requireActive(cycleId);
        expenseRepository.delete(expenseRepository.findByIdAndCycleId(id, cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khoản chi.")));
    }
}
