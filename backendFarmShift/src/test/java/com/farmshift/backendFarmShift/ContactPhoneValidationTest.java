package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.SupplierRequest;
import com.farmshift.backendFarmShift.dto.request.CustomerContactRequest;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class ContactPhoneValidationTest {
    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    @AfterAll static void close() { FACTORY.close(); }
    @ParameterizedTest @ValueSource(strings = {"02412345678", "02812345678", "0912345678", "1234567890"})
    void acceptsValidNumbersForBothRequests(String phone) {
        var validator = FACTORY.getValidator();
        assertTrue(validator.validate(new SupplierRequest("Công ty A", "Nguyễn Văn A", phone, 1L)).isEmpty());
        assertTrue(validator.validate(new CustomerContactRequest("Khách A", phone)).isEmpty());
    }
    @ParameterizedTest @ValueSource(strings = {"0241234567", "0281234567", "024123456789", "09123456789", "091234567", "09123abc78", "+84912345678", "091 2345678", "０９１２３４５６７８", ""})
    void rejectsInvalidNumbersForBothRequests(String phone) {
        var validator = FACTORY.getValidator();
        assertFalse(validator.validate(new SupplierRequest("Công ty A", "Nguyễn Văn A", phone, 1L)).isEmpty());
        assertFalse(validator.validate(new CustomerContactRequest("Khách A", phone)).isEmpty());
    }
}
