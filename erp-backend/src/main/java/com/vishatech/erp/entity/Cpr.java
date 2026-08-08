package com.vishatech.erp.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
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
@Table(name = "cprs")
public class Cpr {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40, unique = true)
    private String prNo;

    private LocalDateTime prDate;

    private String department;

    private String requestedBy;

    private LocalDateTime requiredDate;

    private String priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private CprStatus status = CprStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private CprApprovalStatus approvalStatus = CprApprovalStatus.PENDING;

    private String sourceLead;

    private String clientName;

    private String contactPerson;

    private String phone;

    private String email;

    private String company;

    private String gst;

    private String project;

    private String leadNo;

    private String pan;

    private String vendor;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String billingAddress;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String shippingAddress;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(precision = 18, scale = 2)
    private BigDecimal costWorkout;

    @Column(precision = 10, scale = 2)
    private BigDecimal profitPercent;

    @Column(precision = 18, scale = 2)
    private BigDecimal grandTotal;

    private String convertedToQtn;

    /** Id of the real Quotation row created when this CPR is converted (FK-style link). */
    private Long quotationId;

    /** Id of the Cost Workout linked to this CPR (FK-style link). */
    private Long costWorkoutId;

    /** Cost Workout number for linked-document display. */
    private String costWorkoutCwNo;

    /** Current Cost Workout status for linked-document display. */
    private String costWorkoutStatus;

    private String currentStage;

    private String submittedBy;

    private LocalDateTime submittedAt;

    private String approvedBy;

    private LocalDateTime approvalDate;

    private String rejectedBy;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String approvalRemarks;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime archivedAt;

    @OneToMany(mappedBy = "cpr", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<CprItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "cpr", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("uploadedAt ASC")
    private List<CprAttachment> attachments = new ArrayList<>();

    @OneToMany(mappedBy = "cpr", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<CprTimeline> timeline = new ArrayList<>();

    @OneToMany(mappedBy = "cpr", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<CprHistory> history = new ArrayList<>();

    @OneToMany(mappedBy = "cpr", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<CprComment> comments = new ArrayList<>();

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addItem(CprItem item) {
        item.setCpr(this);
        items.add(item);
    }

    public void addAttachment(CprAttachment attachment) {
        attachment.setCpr(this);
        attachments.add(attachment);
    }

    public void addTimeline(CprTimeline entry) {
        entry.setCpr(this);
        timeline.add(entry);
    }

    public void addHistory(CprHistory entry) {
        entry.setCpr(this);
        history.add(entry);
    }

    public void addComment(CprComment entry) {
        entry.setCpr(this);
        comments.add(entry);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPrNo() {
        return prNo;
    }

    public void setPrNo(String prNo) {
        this.prNo = prNo;
    }

    public LocalDateTime getPrDate() {
        return prDate;
    }

    public void setPrDate(LocalDateTime prDate) {
        this.prDate = prDate;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public LocalDateTime getRequiredDate() {
        return requiredDate;
    }

    public void setRequiredDate(LocalDateTime requiredDate) {
        this.requiredDate = requiredDate;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public CprStatus getStatus() {
        return status;
    }

    public void setStatus(CprStatus status) {
        this.status = status;
    }

    public CprApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(CprApprovalStatus approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public String getSourceLead() {
        return sourceLead;
    }

    public void setSourceLead(String sourceLead) {
        this.sourceLead = sourceLead;
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

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public String getGst() {
        return gst;
    }

    public void setGst(String gst) {
        this.gst = gst;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public String getLeadNo() {
        return leadNo;
    }

    public void setLeadNo(String leadNo) {
        this.leadNo = leadNo;
    }

    public String getPan() {
        return pan;
    }

    public void setPan(String pan) {
        this.pan = pan;
    }

    public String getVendor() {
        return vendor;
    }

    public void setVendor(String vendor) {
        this.vendor = vendor;
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

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getCostWorkout() {
        return costWorkout;
    }

    public void setCostWorkout(BigDecimal costWorkout) {
        this.costWorkout = costWorkout;
    }

    public BigDecimal getProfitPercent() {
        return profitPercent;
    }

    public void setProfitPercent(BigDecimal profitPercent) {
        this.profitPercent = profitPercent;
    }

    public BigDecimal getGrandTotal() {
        return grandTotal;
    }

    public void setGrandTotal(BigDecimal grandTotal) {
        this.grandTotal = grandTotal;
    }

    public String getConvertedToQtn() {
        return convertedToQtn;
    }

    public void setConvertedToQtn(String convertedToQtn) {
        this.convertedToQtn = convertedToQtn;
    }

    public Long getQuotationId() {
        return quotationId;
    }

    public void setQuotationId(Long quotationId) {
        this.quotationId = quotationId;
    }

    public Long getCostWorkoutId() {
        return costWorkoutId;
    }

    public void setCostWorkoutId(Long costWorkoutId) {
        this.costWorkoutId = costWorkoutId;
    }

    public String getCostWorkoutCwNo() {
        return costWorkoutCwNo;
    }

    public void setCostWorkoutCwNo(String costWorkoutCwNo) {
        this.costWorkoutCwNo = costWorkoutCwNo;
    }

    public String getCostWorkoutStatus() {
        return costWorkoutStatus;
    }

    public void setCostWorkoutStatus(String costWorkoutStatus) {
        this.costWorkoutStatus = costWorkoutStatus;
    }

    public String getCurrentStage() {
        return currentStage;
    }

    public void setCurrentStage(String currentStage) {
        this.currentStage = currentStage;
    }

    public String getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(String submittedBy) {
        this.submittedBy = submittedBy;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public LocalDateTime getApprovalDate() {
        return approvalDate;
    }

    public void setApprovalDate(LocalDateTime approvalDate) {
        this.approvalDate = approvalDate;
    }

    public String getRejectedBy() {
        return rejectedBy;
    }

    public void setRejectedBy(String rejectedBy) {
        this.rejectedBy = rejectedBy;
    }

    public String getApprovalRemarks() {
        return approvalRemarks;
    }

    public void setApprovalRemarks(String approvalRemarks) {
        this.approvalRemarks = approvalRemarks;
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

    public List<CprItem> getItems() {
        return items;
    }

    public void setItems(List<CprItem> items) {
        this.items = items;
    }

    public List<CprAttachment> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<CprAttachment> attachments) {
        this.attachments = attachments;
    }

    public List<CprTimeline> getTimeline() {
        return timeline;
    }

    public void setTimeline(List<CprTimeline> timeline) {
        this.timeline = timeline;
    }

    public List<CprHistory> getHistory() {
        return history;
    }

    public void setHistory(List<CprHistory> history) {
        this.history = history;
    }

    public List<CprComment> getComments() {
        return comments;
    }

    public void setComments(List<CprComment> comments) {
        this.comments = comments;
    }
}
