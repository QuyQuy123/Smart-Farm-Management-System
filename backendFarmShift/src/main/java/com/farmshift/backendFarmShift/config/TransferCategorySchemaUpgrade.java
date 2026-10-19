package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Removes Hibernate's former enum CHECK when upgrading receipt types to free text. */
@Component @RequiredArgsConstructor
public class TransferCategorySchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    @Override public void run(ApplicationArguments args) throws Exception {
        try (var connection = jdbc.getDataSource().getConnection()) {
            if (!connection.getMetaData().getDatabaseProductName().equals("PostgreSQL")) return;
        }
        jdbc.execute("""
            DO $$ DECLARE constraint_row record; BEGIN
              FOR constraint_row IN
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'transfer_categories'::regclass AND contype = 'c'
                  AND pg_get_constraintdef(oid) LIKE '%slip_type%'
                  AND pg_get_constraintdef(oid) LIKE '%IMPORT%'
                  AND pg_get_constraintdef(oid) LIKE '%EXPORT%'
                  AND pg_get_constraintdef(oid) LIKE '%TRANSFER%'
              LOOP
                EXECUTE format('ALTER TABLE transfer_categories DROP CONSTRAINT %I', constraint_row.conname);
              END LOOP;
            END $$;
            """);
    }
}
