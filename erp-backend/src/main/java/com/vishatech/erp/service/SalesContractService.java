package com.vishatech.erp.service;

import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesContractItemRequest;
import com.vishatech.erp.dto.SalesContractItemResponse;
import com.vishatech.erp.dto.SalesContractNextNumberResponse;
import com.vishatech.erp.dto.SalesContractRequest;
import com.vishatech.erp.dto.SalesContractResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.entity.SalesAttachment;
import com.vishatech.erp.entity.SalesContract;
import com.vishatech.erp.entity.SalesContractItem;
import com.vishatech.erp.entity.SalesHistory;
import com.vishatech.erp.entity.SalesOrder;
import com.vishatech.erp.entity.SalesOrderItem;
import com.vishatech.erp.entity.SalesTimeline;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.SalesAttachmentRepository;
import com.vishatech.erp.repository.SalesContractRepository;
import com.vishatech.erp.repository.SalesHistoryRepository;
import com.vishatech.erp.repository.SalesOrderRepository;
import com.vishatech.erp.repository.SalesTimelineRepository;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class SalesContractService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String MODULE = "sales-contract";

    private final SalesContractRepository salesContractRepository;
    private final SalesTimelineRepository timelineRepository;
    private final SalesHistoryRepository historyRepository;
    private final SalesAttachmentRepository attachmentRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final FileStorageService fileStorageService;
    private final String baseUrl;

    public SalesContractService(SalesContractRepository salesContractRepository,
                                SalesTimelineRepository timelineRepository,
                                SalesHistoryRepository historyRepository,
                                SalesAttachmentRepository attachmentRepository,
                                SalesOrderRepository salesOrderRepository,
                                FileStorageService fileStorageService,
                                @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.salesContractRepository = salesContractRepository;
        this.timelineRepository = timelineRepository;
        this.historyRepository = historyRepository;
        this.attachmentRepository = attachmentRepository;
        this.salesOrderRepository = salesOrderRepository;
        this.fileStorageService = fileStorageService;
        this.baseUrl = baseUrl;
    }

    public Page<SalesContractResponse> list(int page, int size, String search, String sort,
                                            String status, String client, String salesExecutive,
                                            String dateFrom, String dateTo,
                                            BigDecimal minAmount, BigDecimal maxAmount) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<SalesContract> spec = buildSpecification(search, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
        return salesContractRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public SalesContractResponse get(Long id) {
        return toResponse(getContract(id));
    }

    public SalesContractNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new SalesContractNextNumberResponse(buildNo(next), next);
    }

    public Map<String, Object> stats() {
        List<String> excluded = List.of("archived", "deleted");
        Map<String, Object> stats = new LinkedHashMap<>();
        long active = 0;
        for (String status : List.of("draft", "submitted", "under review", "approved", "active", "completed", "cancelled")) {
            long count = salesContractRepository.countByStatus(status);
            stats.put(status.replace(" ", ""), count);
            active += count;
        }
        stats.put("total", active);
        stats.put("active", active);
        stats.put("archived", salesContractRepository.countByStatus("archived"));
        stats.put("deleted", salesContractRepository.countByStatus("deleted"));
        stats.put("totalAmt", salesContractRepository.sumGrandTotalExcluding(excluded));
        return stats;
    }

    public SalesContractResponse create(SalesContractRequest request, boolean draft) {
        SalesContract contract = new SalesContract();
        if (request.scNo() != null && !request.scNo().isBlank()) {
            if (salesContractRepository.existsByScNo(request.scNo().trim())) {
                throw new BadRequestException("Contract number already exists: " + request.scNo());
            }
            contract.setScNo(request.scNo().trim());
        } else {
            contract.setScNo(buildNo(nextSequence()));
        }
        applyRequest(contract, request);
        if (draft) {
            contract.setStatus("draft");
        } else if (request.status() != null && !request.status().isBlank()) {
            contract.setStatus(normalizeStatus(request.status()));
        } else {
            contract.setStatus("draft");
        }
        recalcTotals(contract);
        SalesContract saved = salesContractRepository.save(contract);
        addTimeline(saved, "created", "Sales Contract created",
                "Sales Contract '" + saved.getScNo() + "' was created.");
        addHistory(saved, "Sales Contract", null, saved.getScNo(), currentUserName());
        return toResponse(saved);
    }

    public SalesContractResponse update(Long id, SalesContractRequest request) {
        SalesContract contract = getContract(id);
        applyRequest(contract, request);
        if (request.status() != null && !request.status().isBlank()) {
            contract.setStatus(normalizeStatus(request.status()));
        }
        recalcTotals(contract);
        addTimeline(contract, "updated", "Sales Contract updated",
                "Sales Contract details were updated by " + currentUserName() + ".");
        return toResponse(salesContractRepository.save(contract));
    }

    public SalesContractResponse delete(Long id) {
        SalesContract contract = getContract(id);
        contract.setStatus("deleted");
        contract.setArchivedAt(LocalDateTime.now());
        addTimeline(contract, "deleted", "Sales Contract deleted",
                "Sales Contract was moved to trash by " + currentUserName() + ".");
        addHistory(contract, "Status", null, "Deleted", currentUserName());
        return toResponse(salesContractRepository.save(contract));
    }

    public SalesContractResponse restore(Long id) {
        SalesContract contract = getContract(id);
        String previous = contract.getStatus();
        String target = ("deleted".equals(previous) || "archived".equals(previous)) ? "draft" : previous;
        contract.setStatus(target);
        contract.setArchivedAt(null);
        addTimeline(contract, "restored", "Sales Contract restored",
                "Sales Contract was restored by " + currentUserName() + ".");
        addHistory(contract, "Status", titleCase(previous), titleCase(target), currentUserName());
        return toResponse(salesContractRepository.save(contract));
    }

    public SalesContractResponse archive(Long id) {
        SalesContract contract = getContract(id);
        contract.setStatus("archived");
        contract.setArchivedAt(LocalDateTime.now());
        addTimeline(contract, "archived", "Sales Contract archived",
                "Sales Contract was archived by " + currentUserName() + ".");
        addHistory(contract, "Status", null, "Archived", currentUserName());
        return toResponse(salesContractRepository.save(contract));
    }

    public SalesContractResponse changeStatus(Long id, String status) {
        SalesContract contract = getContract(id);
        String normalized = normalizeStatus(status);
        if ("deleted".equals(contract.getStatus())) {
            throw new BadRequestException("Cannot change status of a deleted Sales Contract");
        }
        contract.setStatus(normalized);
        addTimeline(contract, "status", "Status changed",
                "Status changed to '" + titleCase(normalized) + "' by " + currentUserName() + ".");
        addHistory(contract, "Status", null, titleCase(normalized), currentUserName());
        return toResponse(salesContractRepository.save(contract));
    }

    public SalesContractResponse approve(Long id) {
        SalesContract contract = getContract(id);
        if ("deleted".equals(contract.getStatus())) {
            throw new BadRequestException("Cannot approve a deleted Sales Contract");
        }
        contract.setStatus("approved");
        addTimeline(contract, "approved", "Sales Contract approved",
                "Sales Contract approved by " + currentUserName() + ".");
        addHistory(contract, "Status", null, "Approved", currentUserName());
        return toResponse(salesContractRepository.save(contract));
    }

    public SalesContractResponse duplicate(Long id) {
        SalesContract source = getContract(id);
        SalesContract copy = new SalesContract();
        copy.setScNo(buildNo(nextSequence()));
        copy.setPoRef(source.getPoRef());
        copy.setLeadNo(source.getLeadNo());
        copy.setQtnRef(source.getQtnRef());
        copy.setCurrency(source.getCurrency());
        copy.setClientId(source.getClientId());
        copy.setClientName(source.getClientName());
        copy.setContactPerson(source.getContactPerson());
        copy.setEmail(source.getEmail());
        copy.setPhone(source.getPhone());
        copy.setCity(source.getCity());
        copy.setState(source.getState());
        copy.setBillingAddress(source.getBillingAddress());
        copy.setShippingAddress(source.getShippingAddress());
        copy.setGstin(source.getGstin());
        copy.setPan(source.getPan());
        copy.setPaymentTerms(source.getPaymentTerms());
        copy.setDeliveryTerms(source.getDeliveryTerms());
        copy.setSalesExecutive(source.getSalesExecutive());
        copy.setDuration(source.getDuration());
        copy.setWarranty(source.getWarranty());
        copy.setCommercialTerms(source.getCommercialTerms());
        copy.setScope(source.getScope());
        copy.setExclusions(source.getExclusions());
        copy.setRemarks(source.getRemarks());
        copy.setDiscount(source.getDiscount());
        copy.setCharges(source.getCharges());
        copy.setStatus("draft");
        copy.setContractDate(LocalDateTime.now());
        for (SalesContractItem sourceItem : source.getItems()) {
            SalesContractItem item = new SalesContractItem();
            copyItem(item, sourceItem);
            copy.addItem(item);
        }
        recalcTotals(copy);
        SalesContract saved = salesContractRepository.save(copy);
        addTimeline(saved, "created", "Sales Contract created",
                "Duplicated from Sales Contract '" + source.getScNo() + "'.");
        addHistory(saved, "Sales Contract", null, saved.getScNo(), currentUserName());
        return toResponse(saved);
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            SalesContract contract = getContract(id);
            if (!"archived".equals(contract.getStatus()) && !"deleted".equals(contract.getStatus())) {
                contract.setStatus("archived");
                contract.setArchivedAt(LocalDateTime.now());
                addTimeline(contract, "archived", "Sales Contract archived",
                        "Sales Contract was archived by " + currentUserName() + ".");
                salesContractRepository.save(contract);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            SalesContract contract = getContract(id);
            if ("archived".equals(contract.getStatus()) || "deleted".equals(contract.getStatus())) {
                contract.setStatus("draft");
                contract.setArchivedAt(null);
                addTimeline(contract, "restored", "Sales Contract restored",
                        "Sales Contract was restored by " + currentUserName() + ".");
                salesContractRepository.save(contract);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        List<SalesContract> contracts = salesContractRepository.findAllById(ids);
        salesContractRepository.deleteAll(contracts);
        return contracts.size();
    }

    /** Sales Contract → Sales Order conversion. */
    public SalesContractResponse convertToSalesOrder(Long id) {
        SalesContract contract = getContract(id);
        if ("converted".equals(contract.getConvertedToSo())) {
            throw new BadRequestException("Contract already converted to a Sales Order");
        }
        SalesOrder so = new SalesOrder();
        so.setSoNo(buildSoNumber());
        so.setScRef(contract.getScNo());
        so.setLeadNo(contract.getLeadNo());
        so.setQtnRef(contract.getQtnRef());
        so.setOrderDate(LocalDateTime.now());
        so.setStatus("draft");
        so.setCurrency(contract.getCurrency() == null ? "INR" : contract.getCurrency());
        so.setClientId(contract.getClientId());
        so.setClientName(contract.getClientName());
        so.setContactPerson(contract.getContactPerson());
        so.setEmail(contract.getEmail());
        so.setPhone(contract.getPhone());
        so.setCity(contract.getCity());
        so.setState(contract.getState());
        so.setBillingAddress(contract.getBillingAddress());
        so.setShippingAddress(contract.getShippingAddress());
        so.setGstin(contract.getGstin());
        so.setPan(contract.getPan());
        so.setPaymentTerms(contract.getPaymentTerms());
        so.setDeliveryTerms(contract.getDeliveryTerms());
        so.setSalesExecutive(contract.getSalesExecutive());
        so.setTerms(contract.getCommercialTerms());
        so.setRemarks(contract.getRemarks());
        for (SalesContractItem sourceItem : contract.getItems()) {
            SalesOrderItem item = new SalesOrderItem();
            item.setDescription(sourceItem.getDescription());
            item.setSku(sourceItem.getSku());
            item.setHsn(sourceItem.getHsn());
            item.setUom(sourceItem.getUom());
            item.setQty(sourceItem.getQty());
            item.setRate(sourceItem.getRate());
            item.setDiscountPct(sourceItem.getDiscountPct());
            item.setGstRate(sourceItem.getGstRate());
            so.addItem(item);
        }
        so.setSubTotal(contract.getSubTotal());
        so.setDiscount(contract.getDiscount());
        so.setTaxTotal(contract.getTaxTotal());
        so.setCgstTotal(contract.getCgstTotal());
        so.setSgstTotal(contract.getSgstTotal());
        so.setCharges(contract.getCharges());
        so.setGrandTotal(contract.getGrandTotal());
        SalesOrder savedSo = salesOrderRepository.save(so);

        addTargetTimeline("sales-order", savedSo.getId(), "created", "Sales Order created",
                "Sales Order '" + savedSo.getSoNo() + "' created from Sales Contract '" + contract.getScNo() + "'.");
        addTargetHistory("sales-order", savedSo.getId(), "Sales Order", savedSo.getSoNo(), currentUserName());

        contract.setConvertedToSo(so.getSoNo());
        addTimeline(contract, "converted", "Converted to Sales Order",
                "Sales Contract converted to Sales Order " + so.getSoNo() + ".");
        addHistory(contract, "Status", null, "Converted", currentUserName());
        return toResponse(salesContractRepository.save(contract));
    }

    public List<SalesContractResponse> export(String search, String status, String client, String salesExecutive,
                                              String dateFrom, String dateTo, BigDecimal minAmount, BigDecimal maxAmount) {
        Specification<SalesContract> spec = buildSpecification(search, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
        return salesContractRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<SalesContractResponse> contracts) {
        StringBuilder sb = new StringBuilder();
        sb.append("Contract No,Date,Client,Status,Items,Amount,Created\n");
        for (SalesContractResponse c : contracts) {
            sb.append(escapeCsv(c.scNo())).append(',')
              .append(escapeCsv(c.date())).append(',')
              .append(escapeCsv(c.clientName())).append(',')
              .append(escapeCsv(c.status())).append(',')
              .append(c.itemsCount() == null ? "" : c.itemsCount()).append(',')
              .append(c.grandTotal() == null ? "" : c.grandTotal().toPlainString()).append(',')
              .append(escapeCsv(c.createdAt())).append('\n');
        }
        return sb.toString();
    }

    public List<SalesTimelineResponse> getTimeline(Long id) {
        getContract(id);
        return timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::timelineResponse).toList();
    }

    public List<SalesHistoryResponse> getHistory(Long id) {
        getContract(id);
        return historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::historyResponse).toList();
    }

    public List<SalesAttachmentResponse> getAttachments(Long id) {
        getContract(id);
        return attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, id)
                .stream().map(this::attachmentResponse).toList();
    }

    public SalesAttachmentResponse addAttachment(Long id, MultipartFile file) {
        getContract(id);
        String storedName = fileStorageService.store(file);
        SalesAttachment attachment = new SalesAttachment();
        attachment.setModuleType(MODULE);
        attachment.setModuleId(id);
        attachment.setName(file.getOriginalFilename());
        attachment.setStoredName(storedName);
        attachment.setContentType(file.getContentType());
        attachment.setSize(file.getSize());
        attachment.setUrl(baseUrl + "/v1/files/" + storedName);
        SalesAttachment saved = attachmentRepository.save(attachment);
        addTimeline(id, "attachment", "File attached", file.getOriginalFilename());
        return attachmentResponse(saved);
    }

    public void deleteAttachment(Long id, Long attachmentId) {
        getContract(id);
        SalesAttachment attachment = attachmentRepository.findById(attachmentId)
                .filter(a -> MODULE.equals(a.getModuleType()) && id.equals(a.getModuleId()))
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));
        attachmentRepository.delete(attachment);
    }

    private SalesContractResponse toResponse(SalesContract contract) {
        List<SalesContractItemResponse> itemResponses = contract.getItems().stream().map(this::itemResponse).toList();
        BigDecimal totalQty = itemResponses.stream()
                .map(SalesContractItemResponse::qty)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new SalesContractResponse(
                contract.getId(), contract.getScNo(), contract.getPoRef(),
                contract.getContractDate() == null ? null : contract.getContractDate().toLocalDate().toString(),
                contract.getLeadNo(), contract.getQtnRef(), contract.getStatus(), contract.getCurrency(),
                contract.getClientId(), contract.getClientName(), contract.getContactPerson(),
                contract.getEmail(), contract.getPhone(), contract.getCity(), contract.getState(),
                contract.getBillingAddress(), contract.getShippingAddress(), contract.getGstin(),
                contract.getPan(), contract.getPaymentTerms(), contract.getDeliveryTerms(),
                contract.getSalesExecutive(),
                contract.getValidity() == null ? null : contract.getValidity().toLocalDate().toString(),
                contract.getDuration(), contract.getWarranty(), contract.getCommercialTerms(),
                contract.getScope(), contract.getExclusions(), contract.getRemarks(),
                contract.getSubTotal(), contract.getDiscount(), contract.getDiscountPct(),
                contract.getCgstTotal(), contract.getSgstTotal(), contract.getTaxTotal(),
                contract.getCharges(), contract.getGrandTotal(),
                itemResponses.size(), totalQty, contract.getConvertedToSo(),
                contract.getContractDate() == null
                        ? (contract.getCreatedAt() == null ? null : contract.getCreatedAt().toLocalDate().toString())
                        : contract.getContractDate().toLocalDate().toString(),
                contract.getCreatedAt() == null ? null : contract.getCreatedAt().toString(),
                contract.getUpdatedAt() == null ? null : contract.getUpdatedAt().toString(),
                contract.getArchivedAt() == null ? null : contract.getArchivedAt().toString(),
                itemResponses,
                attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, contract.getId())
                        .stream().map(this::attachmentResponse).toList(),
                timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, contract.getId())
                        .stream().map(this::timelineResponse).toList(),
                historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, contract.getId())
                        .stream().map(this::historyResponse).toList()
        );
    }

    private SalesContractItemResponse itemResponse(SalesContractItem item) {
        BigDecimal qty = nvl(item.getQty(), BigDecimal.ONE);
        BigDecimal rate = nvl(item.getRate(), BigDecimal.ZERO);
        BigDecimal discPct = nvl(item.getDiscountPct(), BigDecimal.ZERO);
        BigDecimal gst = nvl(item.getGstRate(), BigDecimal.ZERO);
        BigDecimal gross = qty.multiply(rate);
        BigDecimal discAmt = gross.multiply(discPct).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        BigDecimal net = gross.subtract(discAmt);
        BigDecimal cgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
        BigDecimal sgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
        BigDecimal total = net.add(cgst).add(sgst);
        return new SalesContractItemResponse(item.getId(), item.getDescription(), item.getSku(), item.getHsn(),
                item.getUom(), qty, rate, discPct, gst,
                gross.setScale(2, RoundingMode.HALF_UP), discAmt.setScale(2, RoundingMode.HALF_UP),
                net.setScale(2, RoundingMode.HALF_UP), cgst.setScale(2, RoundingMode.HALF_UP),
                sgst.setScale(2, RoundingMode.HALF_UP), total.setScale(2, RoundingMode.HALF_UP));
    }

    private SalesAttachmentResponse attachmentResponse(SalesAttachment attachment) {
        return new SalesAttachmentResponse(attachment.getId(), attachment.getName(), attachment.getContentType(),
                attachment.getSize(), attachment.getUrl(),
                attachment.getUploadedAt() == null ? null : attachment.getUploadedAt().toString());
    }

    private SalesTimelineResponse timelineResponse(SalesTimeline entry) {
        return new SalesTimelineResponse(entry.getId(), entry.getType(), entry.getTitle(), entry.getDetail(),
                entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private SalesHistoryResponse historyResponse(SalesHistory entry) {
        return new SalesHistoryResponse(entry.getId(), entry.getField(), entry.getOldValue(), entry.getNewValue(),
                entry.getChangedBy(), entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private SalesContract getContract(Long id) {
        return salesContractRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sales Contract not found with id: " + id));
    }

    private void applyRequest(SalesContract contract, SalesContractRequest request) {
        contract.setPoRef(request.poRef());
        contract.setContractDate(parseDate(request.contractDate()));
        contract.setLeadNo(request.leadNo());
        contract.setQtnRef(request.qtnRef());
        contract.setCurrency(request.currency());
        contract.setClientId(request.clientId());
        contract.setClientName(request.clientName());
        contract.setContactPerson(request.contactPerson());
        contract.setEmail(request.email());
        contract.setPhone(request.phone());
        contract.setCity(request.city());
        contract.setState(request.state());
        contract.setBillingAddress(request.billingAddress());
        contract.setShippingAddress(request.shippingAddress());
        contract.setGstin(request.gstin());
        contract.setPan(request.pan());
        contract.setPaymentTerms(request.paymentTerms());
        contract.setDeliveryTerms(request.deliveryTerms());
        contract.setSalesExecutive(request.salesExecutive());
        contract.setValidity(parseDate(request.validity()));
        contract.setDuration(request.duration());
        contract.setWarranty(request.warranty());
        contract.setCommercialTerms(request.commercialTerms());
        contract.setScope(request.scope());
        contract.setExclusions(request.exclusions());
        contract.setRemarks(request.remarks());
        contract.setDiscount(request.discount() == null ? BigDecimal.ZERO : request.discount());
        contract.setCharges(request.charges() == null ? BigDecimal.ZERO : request.charges());
        contract.getItems().clear();
        if (request.items() != null) {
            for (SalesContractItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                SalesContractItem item = new SalesContractItem();
                item.setDescription(itemRequest.description());
                item.setSku(itemRequest.sku());
                item.setHsn(itemRequest.hsn());
                item.setUom(itemRequest.uom());
                item.setQty(nvl(itemRequest.qty(), BigDecimal.ONE));
                item.setRate(nvl(itemRequest.rate(), BigDecimal.ZERO));
                item.setDiscountPct(nvl(itemRequest.discountPct(), BigDecimal.ZERO));
                item.setGstRate(nvl(itemRequest.gstRate(), BigDecimal.ZERO));
                contract.addItem(item);
            }
        }
    }

    private void copyItem(SalesContractItem target, SalesContractItem source) {
        target.setDescription(source.getDescription());
        target.setSku(source.getSku());
        target.setHsn(source.getHsn());
        target.setUom(source.getUom());
        target.setQty(source.getQty());
        target.setRate(source.getRate());
        target.setDiscountPct(source.getDiscountPct());
        target.setGstRate(source.getGstRate());
    }

    private void recalcTotals(SalesContract contract) {
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        for (SalesContractItem item : contract.getItems()) {
            BigDecimal qty = nvl(item.getQty(), BigDecimal.ONE);
            BigDecimal rate = nvl(item.getRate(), BigDecimal.ZERO);
            BigDecimal discPct = nvl(item.getDiscountPct(), BigDecimal.ZERO);
            BigDecimal gst = nvl(item.getGstRate(), BigDecimal.ZERO);
            BigDecimal gross = qty.multiply(rate);
            BigDecimal discAmt = gross.multiply(discPct).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            BigDecimal net = gross.subtract(discAmt);
            BigDecimal cgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
            BigDecimal sgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
            subTotal = subTotal.add(net);
            cgstTotal = cgstTotal.add(cgst);
            sgstTotal = sgstTotal.add(sgst);
        }
        contract.setSubTotal(subTotal.setScale(2, RoundingMode.HALF_UP));
        contract.setCgstTotal(cgstTotal.setScale(2, RoundingMode.HALF_UP));
        contract.setSgstTotal(sgstTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal taxTotal = cgstTotal.add(sgstTotal);
        contract.setTaxTotal(taxTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal discount = nvl(contract.getDiscount(), BigDecimal.ZERO);
        BigDecimal charges = nvl(contract.getCharges(), BigDecimal.ZERO);
        BigDecimal grand = subTotal.add(taxTotal).subtract(discount).add(charges);
        if (grand.compareTo(BigDecimal.ZERO) < 0) {
            grand = BigDecimal.ZERO;
        }
        contract.setGrandTotal(grand.setScale(2, RoundingMode.HALF_UP));
        if (subTotal.compareTo(BigDecimal.ZERO) > 0 && discount.compareTo(BigDecimal.ZERO) > 0) {
            contract.setDiscountPct(discount.multiply(BigDecimal.valueOf(100))
                    .divide(subTotal, 2, RoundingMode.HALF_UP));
        } else {
            contract.setDiscountPct(BigDecimal.ZERO);
        }
    }

    private Specification<SalesContract> buildSpecification(String search, String status, String client,
                                                            String salesExecutive, String dateFrom, String dateTo,
                                                            BigDecimal minAmount, BigDecimal maxAmount) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("scNo")), like),
                        cb.like(cb.lower(root.get("clientName")), like),
                        cb.like(cb.lower(root.get("leadNo")), like),
                        cb.like(cb.lower(root.get("salesExecutive")), like),
                        cb.like(cb.lower(root.get("qtnRef")), like),
                        cb.like(cb.lower(cb.toString(root.get("poRef"))), like)
                ));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.trim().toLowerCase()));
            } else {
                predicates.add(cb.not(root.get("status").in("archived", "deleted")));
            }
            if (client != null && !client.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("clientName")), client.trim().toLowerCase()));
            }
            if (salesExecutive != null && !salesExecutive.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("salesExecutive")), salesExecutive.trim().toLowerCase()));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("contractDate"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("contractDate"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
            }
            if (minAmount != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("grandTotal"), minAmount));
            }
            if (maxAmount != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("grandTotal"), maxAmount));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Sort buildSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        String[] parts = sort.split(",");
        String field = parts[0];
        String mapped = switch (field) {
            case "clientName", "salesExecutive", "contractDate", "validity", "grandTotal", "status", "createdAt",
                 "updatedAt", "scNo" -> "scNo".equals(field) ? "scNo" : field;
            case "id" -> "scNo";
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = salesContractRepository.count();
        long maxSuffix = 0;
        String prefix = "SC-" + Year.now().getValue() + "-";
        for (SalesContract contract : salesContractRepository.findAll()) {
            String no = contract.getScNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return Math.max(count, maxSuffix) + 1;
    }

    private String buildNo(long sequence) {
        return String.format("SC-%d-%06d", Year.now().getValue(), sequence);
    }

    private String buildSoNumber() {
        long maxSuffix = 0;
        String prefix = "SO-" + Year.now().getValue() + "-";
        for (SalesOrder so : salesOrderRepository.findAll()) {
            String no = so.getSoNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return String.format("SO-%d-%06d", Year.now().getValue(), Math.max(salesOrderRepository.count(), maxSuffix) + 1);
    }

    private LocalDateTime parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            if (value.length() <= 10) {
                return LocalDate.parse(value, DATE_FMT).atStartOfDay();
            }
            return LocalDateTime.parse(value);
        } catch (Exception e) {
            return null;
        }
    }

    private String normalizeStatus(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase().replace(" ", "_");
        return switch (normalized) {
            case "submitted" -> "submitted";
            case "under_review", "under review" -> "under review";
            case "approved" -> "approved";
            case "active" -> "active";
            case "completed" -> "completed";
            case "cancelled" -> "cancelled";
            case "archived" -> "archived";
            case "deleted" -> "deleted";
            default -> "draft";
        };
    }

    private String titleCase(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.replace("_", " ");
        return normalized.substring(0, 1).toUpperCase() + normalized.substring(1).toLowerCase();
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private BigDecimal nvl(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }

    private String currentUserName() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        return "System";
    }

    private void addTimeline(SalesContract contract, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(contract.getId());
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        timelineRepository.save(entry);
    }

    private void addTimeline(Long id, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(id);
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        timelineRepository.save(entry);
    }

    private void addHistory(SalesContract contract, String field, String oldValue, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(MODULE);
        entry.setModuleId(contract.getId());
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        historyRepository.save(entry);
    }

    /** Adds a timeline entry for a document created by a conversion (different module). */
    private void addTargetTimeline(String module, Long id, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(module);
        entry.setModuleId(id);
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        timelineRepository.save(entry);
    }

    /** Adds a history entry for a document created by a conversion (different module). */
    private void addTargetHistory(String module, Long id, String field, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(module);
        entry.setModuleId(id);
        entry.setField(field);
        entry.setOldValue(null);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        historyRepository.save(entry);
    }
}
