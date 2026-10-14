package com.farmshift.backendFarmShift.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * Asynchronous & Multi-threaded Task Executor Configuration.
 * <p>
 * Provides dedicated thread pools for concurrent multi-table search operations,
 * background telemetry processing, and parallel data aggregation.
 */
@Slf4j
@Configuration
@EnableAsync
public class AsyncConfig {

    public static final String SEARCH_EXECUTOR = "searchTaskExecutor";

    @Bean(name = SEARCH_EXECUTOR)
    public ThreadPoolTaskExecutor searchTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        int processors = Runtime.getRuntime().availableProcessors();
        
        executor.setCorePoolSize(Math.max(2, processors));
        executor.setMaxPoolSize(Math.max(4, processors * 2));
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("FarmShift-Search-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        
        log.info("Initialized [{}] with corePoolSize={}, maxPoolSize={}",
                SEARCH_EXECUTOR, executor.getCorePoolSize(), executor.getMaxPoolSize());
        return executor;
    }
}
