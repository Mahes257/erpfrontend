package com.vishatech.erp.service;

import com.vishatech.erp.dto.CustomerRequest;
import com.vishatech.erp.dto.CustomerResponse;
import com.vishatech.erp.entity.Customer;
import com.vishatech.erp.repository.CustomerRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public List<CustomerResponse> list(String q) {
        List<Customer> customers = (q == null || q.isBlank())
                ? customerRepository.findAll()
                : customerRepository.search(q.trim().toLowerCase());
        return customers.stream().map(this::toResponse).toList();
    }

    public CustomerResponse get(Long id) {
        return toResponse(find(id));
    }

    public CustomerResponse create(CustomerRequest request) {
        Customer customer = new Customer();
        apply(customer, request);
        customer.setCreatedAt(LocalDateTime.now());
        customer.setUpdatedAt(LocalDateTime.now());
        return toResponse(customerRepository.save(customer));
    }

    public CustomerResponse update(Long id, CustomerRequest request) {
        Customer customer = find(id);
        apply(customer, request);
        customer.setUpdatedAt(LocalDateTime.now());
        return toResponse(customerRepository.save(customer));
    }

    public void delete(Long id) {
        customerRepository.delete(find(id));
    }

    private Customer find(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new com.vishatech.erp.exception.ResourceNotFoundException("Customer not found: " + id));
    }

    private void apply(Customer customer, CustomerRequest r) {
        customer.setBusinessName(r.businessName());
        customer.setClientCode(r.clientCode());
        customer.setAlias(r.alias());
        customer.setContactPerson(r.contactPerson());
        customer.setEmail(r.email());
        customer.setPhone(r.phone());
        customer.setGstin(r.gstin());
        customer.setPan(r.pan());
        customer.setBillingAddress(r.billingAddress());
        customer.setBillingCity(r.billingCity());
        customer.setBillingState(r.billingState());
        customer.setBillingPin(r.billingPin());
        customer.setShippingAddress(r.shippingAddress());
        customer.setShippingCity(r.shippingCity());
        customer.setShippingState(r.shippingState());
        customer.setShippingPin(r.shippingPin());
        customer.setCountry(r.country() == null || r.country().isBlank() ? "India" : r.country());
        customer.setPaymentTerms(r.paymentTerms());
        customer.setCreditLimit(r.creditLimit() == null ? java.math.BigDecimal.ZERO : r.creditLimit());
        customer.setSalesPerson(r.salesPerson());
        customer.setCategory(r.category());
        customer.setStatus(r.status() == null || r.status().isBlank() ? "Active" : r.status());
        customer.setNotes(r.notes());
    }

    private CustomerResponse toResponse(Customer c) {
        return new CustomerResponse(
                c.getId(), c.getBusinessName(), c.getClientCode(), c.getAlias(),
                c.getContactPerson(), c.getEmail(), c.getPhone(), c.getGstin(), c.getPan(),
                c.getBillingAddress(), c.getBillingCity(), c.getBillingState(), c.getBillingPin(),
                c.getShippingAddress(), c.getShippingCity(), c.getShippingState(), c.getShippingPin(),
                c.getCountry(), c.getPaymentTerms(), c.getCreditLimit(), c.getSalesPerson(),
                c.getCategory(), c.getStatus(), c.getNotes(), c.getCreatedAt());
    }
}
