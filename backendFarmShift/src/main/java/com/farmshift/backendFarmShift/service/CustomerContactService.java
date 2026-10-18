package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.entity.CustomerContact;
import com.farmshift.backendFarmShift.dto.request.CustomerContactRequest;
import com.farmshift.backendFarmShift.dto.response.CustomerContactResponse;
import com.farmshift.backendFarmShift.dto.response.CustomerContactPage;
import com.farmshift.backendFarmShift.repository.CustomerContactRepository;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class CustomerContactService {
    private final CustomerContactRepository repository;
    public CustomerContactPage list(int page, String query) {
        if (page < 0) throw new BadRequestException("Trang không hợp lệ.");
        String search = query == null ? "" : query.strip();
        if (search.length() > 200) throw new BadRequestException("Từ khóa tìm kiếm không quá 200 ký tự.");
        var pageable = PageRequest.of(page, 10, Sort.by("createdAt", "id"));
        var result = search.isEmpty() ? repository.findAll(pageable)
                : repository.findByNameContainingIgnoreCaseOrPhoneContaining(search, search, pageable);
        return new CustomerContactPage(result.getContent().stream().map(this::response).toList(), result.getTotalElements(), result.getTotalPages(), page, 10);
    }
    public CustomerContactResponse get(Long id) { return response(find(id)); }
    @Transactional public CustomerContactResponse create(CustomerContactRequest request) { return save(new CustomerContact(), request); }
    @Transactional public CustomerContactResponse update(Long id, CustomerContactRequest request) { return save(find(id), request); }
    @Transactional public void delete(Long id) { repository.delete(find(id)); }
    private CustomerContact find(Long id) { return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khách hàng.")); }
    private CustomerContactResponse save(CustomerContact customer, CustomerContactRequest request) {
        customer.setName(Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC));
        customer.setPhone(request.phone().strip());
        return response(repository.saveAndFlush(customer));
    }
    private CustomerContactResponse response(CustomerContact customer) { return new CustomerContactResponse(customer.getId(), customer.getName(), customer.getPhone()); }
}
