package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.UpdateFarmRequest;
import com.farmshift.backendFarmShift.entity.Farm;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.repository.FarmRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalTime;

@Service
@RequiredArgsConstructor
public class FarmService {
    private final FarmRepository repository;
    private static final long CURRENT_FARM_ID = 1L;
    public static final LocalTime DEFAULT_FIRST_MEAL = LocalTime.of(7, 0);
    private static final LocalTime EARLIEST_FIRST_MEAL = LocalTime.of(4, 0);
    private static final LocalTime LATEST_FIRST_MEAL = LocalTime.of(10, 0);
    /** Các cữ trong ngày chia đều trong khoảng này: 3 cữ cách 4 tiếng, 4 cữ cách 3 tiếng. */
    private static final int FEEDING_WINDOW_MINUTES = 12 * 60;

    @Transactional(readOnly = true)
    public Farm getCurrentFarm() {
        return repository.findById(CURRENT_FARM_ID).orElse(null);
    }

    @Transactional
    public Farm updateCurrentFarm(UpdateFarmRequest request) {
        Farm farm = repository.findById(CURRENT_FARM_ID).orElseGet(Farm::new);
        farm.setId(CURRENT_FARM_ID);
        farm.setName(request.getName().trim());
        farm.setOwner(request.getOwner().trim());
        farm.setPhone(request.getPhone().trim());
        farm.setScale(clean(request.getScale()));
        farm.setAddress(clean(request.getAddress()));
        farm.setType(clean(request.getType()));
        return repository.saveAndFlush(farm);
    }

    /** Giờ cữ ăn đầu tiên đã cài, mặc định 07:00. */
    @Transactional(readOnly = true)
    public LocalTime firstMealTime() {
        Farm farm = getCurrentFarm();
        return farm == null || farm.getFirstMealTime() == null ? DEFAULT_FIRST_MEAL : farm.getFirstMealTime();
    }

    @Transactional
    public Farm updateMealSchedule(LocalTime firstMealTime) {
        LocalTime time = firstMealTime.withSecond(0).withNano(0);
        if (time.isBefore(EARLIEST_FIRST_MEAL) || time.isAfter(LATEST_FIRST_MEAL)) {
            throw new BadRequestException("Giờ cữ ăn đầu tiên phải từ 04:00 đến 10:00.", "MEAL_TIME_RANGE");
        }
        Farm farm = repository.findById(CURRENT_FARM_ID)
                .orElseThrow(() -> new BadRequestException("Hãy khai báo thông tin trang trại trước.", "FARM_NOT_SET"));
        farm.setFirstMealTime(time);
        return repository.saveAndFlush(farm);
    }

    /** Giờ của cữ thứ meal trong meals cữ: chia đều 12 tiếng kể từ cữ đầu, làm tròn 15 phút. */
    public static LocalTime mealTime(LocalTime first, int meal, int meals) {
        if (meals <= 1) return first;
        long step = Math.round(FEEDING_WINDOW_MINUTES / (double) meals / 15) * 15;
        return first.plusMinutes(step * (meal - 1));
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
