package com.farmshift.backendFarmShift.validation;

public final class ContactPhoneRules {
    public static final String PATTERN = "^(?:(?:024|028)[0-9]{8}|(?!(?:024|028))[0-9]{10})$";
    public static final String MESSAGE = "Số điện thoại chỉ gồm chữ số: đầu 024 hoặc 028 phải có 11 số, các đầu số khác phải có 10 số.";
    private ContactPhoneRules() {}
}
