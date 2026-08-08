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
@Table(name = "sales_contracts")
public class SalesContract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40, unique = true)
    private String scNo;

    private String poRef;

    private LocalDateTime contractDate;

    private String leadNo;

    private String qtnRef;

    @Column(nullable = false, length = 40)
    private String status = "draft";

    private String currency;

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

    private String deliveryTerms;

    private String salesExecutive;

    private LocalDateTime validity;

    private String duration;

    private String warranty;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String commercialTerms;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String scope;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String exclusions;

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

    private String convertedToSo;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime archivedAt;

    @OneToMany(mappedBy = "salesContract", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<SalesContractItem> items = new ArrayList<>();

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addItem(SalesContractItem item) {
        item.setSalesContract(this);
        items.add(item);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getScNo() {
        return scNo;
    }

    public void setScNo(String scNo) {
        this.scNo = scNo;
    }

    public String getPoRef() {
        return poRef;
    }

    public void setPoRef(String poRef) {
        this.poRef = poRef;
    }

    public LocalDateTime getContractDate() {
        return contractDate;
    }

    public void setContractDate(LocalDateTime contractDate) {
        this.contractDate = contractDate;
    }

    public String getLeadNo() {
        return leadNo;
    }

    public void setLeadNo(String leadNo) {
        this.leadNo = leadNo;
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

    public String getDeliveryTerms() {
        return deliveryTerms;
    }

    public void setDeliveryTerms(String deliveryTerms) {
        this.deliveryTerms = deliveryTerms;
    }

    public String getSalesExecutive() {
        return salesExecutive;
    }

    public void setSalesExecutive(String salesExecutive) {
        this.salesExecutive = salesExecutive;
    }

    public LocalDateTime getValidity() {
        return validity;
    }

    public void setValidity(LocalDateTime validity) {
        this.validity = validity;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public String getWarranty() {
        return warranty;
    }

    public void setWarranty(String warranty) {
        this.warranty = warranty;
    }

    public String getCommercialTerms() {
        return commercialTerms;
    }

    public void setCommercialTerms(String commercialTerms) {
        this.commercialTerms = commercialTerms;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getExclusions() {
        return exclusions;
    }

    public void setExclusions(String exclusions) {
        this.exclusions = exclusions;
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

    public String getConvertedToSo() {
        return convertedToSo;
    }

    public void setConvertedToSo(String convertedToSo) {
        this.convertedToSo = convertedToSo;
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

    public List<SalesContractItem> getItems() {
        return items;
    }

    public void setItems(List<SalesContractItem> items) {
        this.items = items;
    }
}
