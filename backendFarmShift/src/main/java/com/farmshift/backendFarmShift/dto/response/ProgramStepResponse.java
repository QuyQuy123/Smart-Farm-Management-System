package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.AdministrationMethod;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import java.math.BigDecimal;

/** state: DONE / IN_PROGRESS / UPCOMING so với ngày tuổi hiện tại của đàn (null với chương trình mẫu). */
public record ProgramStepResponse(Long id, ProgramStepCategory category, String name, int dayFrom, int dayTo, BigDecimal quantity,
                                  String unit, Integer mealsPerDay, AdministrationMethod method, BigDecimal tempMin,
                                  BigDecimal tempMax, String note, String state) {
}
