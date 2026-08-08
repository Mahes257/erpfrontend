package com.vishatech.erp.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sales_orders")
public class SalesOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40, unique = true)
    private String soNo;

    private String customerPo;

    private LocalDateTime orderDate;

    private String leadNo;

    private String scRef;

    private String qtnRef;

    @Column(nullable = false, length = 40)
    private String status = "draft";

    private String currency;

    private String priority;

    private Long clientId;

    private String clientName;

    private String contactPerson;

    private String email;

    private String phone;

    private String city;

    private String state;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String billingAddress;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String shippingAddress;

    private String gstin;

    private String pan;

    private String paymentTerms;

    private String salesExecutive;

    private LocalDateTime deliveryDate;

    private String deliveryTerms;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String terms;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(precision = 18, scale = 2)
    private BigDecimal subTotal = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(precision = 8, scale = 2)
    private BigDecimal discountPct = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal cgstTotal = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal sgstTotal = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal taxTotal = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal charges = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal grandTotal = BigDecimal.ZERO;

    private String convertedToInv;

    private String convertedToDc;

    private String convertedToProforma;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime archivedAt;

    @OneToMany(mappedBy = "salesOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<SalesOrderItem> items = new ArrayList<>();

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addItem(SalesOrderItem item) {
        item.setSalesOrder(this);
        items.add(item);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSoNo() {
        return soNo;
    }

    public void setSoNo(String soNo) {
        this.soNo = soNo;
    }

    public String getCustomerPo() {
        return customerPo;
    }

    public void setCustomerPo(String customerPo) {
        this.customerPo = customerPo;
    }

    public LocalDateTime getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(LocalDateTime orderDate) {
        this.orderDate = orderDate;
    }

    public String getLeadNo() {
        return leadNo;
    }

    public void setLeadNo(String leadNo) {
        this.leadNo = leadNo;
    }

    public String getScRef() {
        return scRef;
    }

    public void setScRef(String scRef) {
        this.scRef = scRef;
    }

    public String getQtnRef() {
        return qtnRef;
    }

    public void setQtnRef(String qtnRef) {
        this.qtnRef = qtnRef;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getContactPerson() {
        return contactPerson;
    }

    public void setContactPerson(String contactPerson) {
        this.contactPerson = contactPerson;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getBillingAddress() {
        return billingAddress;
    }

    public void setBillingAddress(String billingAddress) {
        this.billingAddress = billingAddress;
    }

    public String getShippingAddress() {
        return shippingAddress;
    }

    public void setShippingAddress(String shippingAddress) {
        this.shippingAddress = shippingAddress;
    }

    public String getGstin() {
        return gstin;
    }

    public void setGstin(String gstin) {
        this.gstin = gstin;
    }

    public String getPan() {
        return pan;
    }

    public void setPan(String pan) {
        this.pan = pan;
    }

    public String getPaymentTerms() {
        return paymentTerms;
    }

    public void setPaymentTerms(String paymentTerms) {
        this.paymentTerms = paymentTerms;
    }

    public String getSalesExecutive() {
        return salesExecutive;
    }

    public void setSalesExecutive(String salesExecutive) {
        this.salesExecutive = salesExecutive;
    }

    public LocalDateTime getDeliveryDate() {
        return deliveryDate;
    }

    public void setDeliveryDate(LocalDateTime deliveryDate) {
        this.deliveryDate = deliveryDate;
    }

    public String getDeliveryTerms() {
        return deliveryTerms;
    }

    public void setDeliveryTerms(String deliveryTerms) {
        this.deliveryTerms = deliveryTerms;
    }

    public String getTerms() {
        return terms;
    }

    public void setTerms(String terms) {
        this.terms = terms;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public BigDecimal getSubTotal() {
        return subTotal;
    }

    public void setSubTotal(BigDecimal subTotal) {
        this.subTotal = subTotal;
    }

    public BigDecimal getDiscount() {
        return discount;
    }

    public void setDiscount(BigDecimal discount) {
        this.discount = discount;
    }

    public BigDecimal getDiscountPct() {
        return discountPct;
    }

    public void setDiscountPct(BigDecimal discountPct) {
        this.discountPct = discountPct;
    }

    public BigDecimal getCgstTotal() {
        return cgstTotal;
    }

    public void setCgstTotal(BigDecimal cgstTotal) {
        this.cgstTotal = cgstTotal;
    }

    public BigDecimal getSgstTotal() {
        return sgstTotal;
    }

    public void setSgstTotal(BigDecimal sgstTotal) {
        this.sgstTotal = sgstTotal;
    }

    public BigDecimal getTaxTotal() {
        return taxTotal;
    }

    public void setTaxTotal(BigDecimal taxTotal) {
        this.taxTotal = taxTotal;
    }

    public BigDecimal getCharges() {
        return charges;
    }

    public void setCharges(BigDecimal charges) {
        this.charges = charges;
    }

    public BigDecimal getGrandTotal() {
        return grandTotal;
    }

    public void setGrandTotal(BigDecimal grandTotal) {
        this.grandTotal = grandTotal;
    }

    public String getConvertedToInv() {
        return convertedToInv;
    }

    public void setConvertedToInv(String convertedToInv) {
        this.convertedToInv = convertedToInv;
    }

    public String getConvertedToDc() {
        return convertedToDc;
    }

    public void setConvertedToDc(String convertedToDc) {
        this.convertedToDc = convertedToDc;
    }

    public String getConvertedToProforma() {
        return convertedToProforma;
    }

    public void setConvertedToProforma(String convertedToProforma) {
        this.convertedToProforma = convertedToProforma;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(LocalDateTime archivedAt) {
        this.archivedAt = archivedAt;
    }

    public List<SalesOrderItem> getItems() {
        return items;
    }

    public void setItems(List<SalesOrderItem> items) {
        this.items = items;
    }
}
