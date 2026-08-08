package com.vishatech.erp.repository;

import com.vishatech.erp.entity.Customer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    @Query("SELECT c FROM Customer c WHERE LOWER(c.businessName) LIKE %:q% "
            + "OR LOWER(c.clientCode) LIKE %:q% OR LOWER(c.gstin) LIKE %:q% "
            + "OR LOWER(c.phone) LIKE %:q% OR LOWER(c.contactPerson) LIKE %:q%")
    List<Customer> search(@Param("q") String query);
}
