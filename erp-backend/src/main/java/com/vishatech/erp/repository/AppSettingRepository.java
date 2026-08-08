package com.vishatech.erp.repository;

import com.vishatech.erp.entity.AppSetting;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppSettingRepository extends JpaRepository<AppSetting, Long> {

    Optional<AppSetting> findBySettingKey(String settingKey);
}
