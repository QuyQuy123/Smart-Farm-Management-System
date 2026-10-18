package com.farmshift.backendFarmShift.dto.response;

import java.util.List;

public record CustomerContactPage(List<CustomerContactResponse> content, long totalElements, int totalPages, int page, int size) {
}
