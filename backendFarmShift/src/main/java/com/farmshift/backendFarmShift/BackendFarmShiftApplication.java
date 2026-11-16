package com.farmshift.backendFarmShift;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class BackendFarmShiftApplication {

	private static final TimeZone APP_TIMEZONE = TimeZone.getTimeZone("Asia/Bangkok");

	static {
		TimeZone.setDefault(APP_TIMEZONE);
	}

	@PostConstruct
	public void initTimezone() {
		TimeZone.setDefault(APP_TIMEZONE);
	}

	public static void main(String[] args) {
		TimeZone.setDefault(APP_TIMEZONE);
		SpringApplication.run(BackendFarmShiftApplication.class, args);
	}

}
