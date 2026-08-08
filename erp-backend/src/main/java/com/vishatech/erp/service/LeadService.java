package com.vishatech.erp.service;

import com.vishatech.erp.dto.ActivityResponse;
import com.vishatech.erp.dto.AttachmentResponse;
import com.vishatech.erp.dto.ClientNextNumberResponse;
import com.vishatech.erp.dto.ExportRequest;
import com.vishatech.erp.dto.HistoryResponse;
import com.vishatech.erp.dto.LeadNextNumberResponse;
import com.vishatech.erp.dto.LeadRequest;
import com.vishatech.erp.dto.LeadResponse;
import com.vishatech.erp.dto.NoteResponse;
import com.vishatech.erp.dto.TimelineResponse;
import com.vishatech.erp.entity.Activity;
import com.vishatech.erp.entity.Attachment;
import com.vishatech.erp.entity.HistoryEntry;
import com.vishatech.erp.entity.Lead;
import com.vishatech.erp.entity.LeadStage;
import com.vishatech.erp.entity.LeadStatus;
import com.vishatech.erp.entity.Note;
import com.vishatech.erp.entity.TimelineEntry;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.LeadRepository;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
public class LeadService {

    private static final int MAX_IMPORT_ROWS = 5000;

    private final LeadRepository leadRepository;
    private final FileStorageService fileStorageService;
    private final String baseUrl;

    public LeadService(LeadRepository leadRepository, FileStorageService fileStorageService,
                       @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.leadRepository = leadRepository;
        this.fileStorageService = fileStorageService;
        this.baseUrl = baseUrl;
    }

    // ============================== Read ==============================

    @Transactional
    public Page<LeadResponse> list(int page, int size, String search, String sort,
                                   String stage, String status, String owner, String source,
                                   String dateFrom, String dateTo, BigDecimal minValue, BigDecimal maxValue) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<Lead> spec = buildSpecification(search, stage, status, owner, source, dateFrom, dateTo, minValue, maxValue);
        return leadRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<LeadResponse> listScoped(String scope, int page, int size, String search, String sort,
                                         String stage, String status, String owner, String source,
                                         String dateFrom, String dateTo, BigDecimal minValue, BigDecimal maxValue) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<Lead> spec = buildSpecification(search, stage, status, owner, source, dateFrom, dateTo, minValue, maxValue)
                .and(scopePredicate(scope));
        return leadRepository.findAll(spec, pageable).map(this::toResponse);
    }

    private Specification<Lead> scopePredicate(String scope) {
        return (root, query, cb) -> switch (scope) {
            case "clients" -> cb.equal(root.get("stage"), LeadStage.WON);
            case "followups" -> cb.not(root.get("stage").in(List.of(LeadStage.WON, LeadStage.LOST)));
            default -> cb.conjunction();
        };
    }

    @Transactional
    public LeadResponse get(Long id) {
        return toResponse(getLead(id));
    }

    // ============================== Write ==============================

    public LeadResponse create(LeadRequest request) {
        if (request.leadNo() != null && !request.leadNo().isBlank()
                && leadRepository.existsByLeadNo(request.leadNo())) {
            throw new BadRequestException("Lead number already exists: " + request.leadNo());
        }
        Lead lead = new Lead();
        applyRequest(lead, request);
        ensureLeadNo(lead);
        lead.addTimeline(entry("created", "Lead created", "Lead '" + display(lead.getName()) + "' was added to the pipeline."));
        lead.addActivity(activity("created", "Lead created", "Lead was created.", null));
        lead.addHistory(history("Lead", null, lead.getName(), currentUserName()));
        return toResponse(leadRepository.save(lead));
    }

    /**
     * Next lead number from the existing auto_number_sequences infrastructure
     * (module LEAD, prefix LEAD-). The next value is the max of the stored
     * sequence and the highest existing LEAD-xxxxxx suffix, plus one.
     */
    public LeadNextNumberResponse getNextNumber() {
        long next = nextLeadSequence();
        return new LeadNextNumberResponse(buildLeadNo(next), next);
    }

    /**
     * Next client number from the existing auto_number_sequences infrastructure
     * (module CLIENT, prefix C-). Clients are modelled as leads (stage WON)
     * and the client number is persisted by the frontend inside the lead's
     * internalNotes meta blob, so the next value is the max of the stored
     * sequence and the highest C-xxxxxx suffix found in the meta blobs,
     * plus one. The stored sequence is advanced on allocation so two rapid
     * allocations can never collide (the blob has no unique constraint).
     */
    public ClientNextNumberResponse getNextClientNumber() {
        long next = nextClientSequence();
        leadRepository.upsertClientSequence(next);
        return new ClientNextNumberResponse(buildClientNo(next), next);
    }

    public LeadResponse update(Long id, LeadRequest request) {
        Lead lead = getLead(id);
        if (request.leadNo() != null && !request.leadNo().isBlank()
                && !request.leadNo().equals(lead.getLeadNo())
                && leadRepository.existsByLeadNo(request.leadNo())) {
            throw new BadRequestException("Lead number already exists: " + request.leadNo());
        }
        applyRequest(lead, request);
        lead.addTimeline(entry("updated", "Lead updated", "Lead details were updated by " + currentUserName() + "."));
        return toResponse(leadRepository.save(lead));
    }

    public void delete(Long id) {
        // SOFT delete: the lead row stays in the database so the Lead Number
        // and all relationships (follow-ups, history, timeline, CPR records)
        // remain intact. FK constraints are never violated.
        Lead lead = getLead(id);
        if (lead.getStatus() != LeadStatus.DELETED) {
            LeadStatus previous = lead.getStatus();
            lead.setStatus(LeadStatus.DELETED);
            lead.setDeletedAt(LocalDateTime.now());
            lead.setArchivedAt(null);
            lead.addTimeline(entry("deleted", "Lead deleted", "Lead was moved to Deleted by " + currentUserName() + "."));
            lead.addHistory(history("Status", label(previous), "Deleted", currentUserName()));
            leadRepository.save(lead);
        }
    }

    public LeadResponse archive(Long id) {
        Lead lead = getLead(id);
        LeadStatus previous = lead.getStatus();
        lead.setStatus(LeadStatus.ARCHIVED);
        lead.setArchivedAt(LocalDateTime.now());
        lead.addTimeline(entry("archived", "Lead archived", "Lead was archived by " + currentUserName() + "."));
        lead.addHistory(history("Status", label(previous), "Archived", currentUserName()));
        return toResponse(leadRepository.save(lead));
    }

    public LeadResponse restore(Long id) {
        Lead lead = getLead(id);
        LeadStatus previous = lead.getStatus();
        lead.setStatus(LeadStatus.ACTIVE);
        lead.setArchivedAt(null);
        lead.setDeletedAt(null);
        lead.addTimeline(entry("restored", "Lead restored", "Lead was restored by " + currentUserName() + "."));
        lead.addHistory(history("Status", label(previous), "Active", currentUserName()));
        return toResponse(leadRepository.save(lead));
    }

    public LeadResponse markInactive(Long id) {
        Lead lead = getLead(id);
        LeadStatus previous = lead.getStatus();
        if (previous == LeadStatus.INACTIVE) {
            return toResponse(lead);
        }
        lead.setStatus(LeadStatus.INACTIVE);
        lead.setArchivedAt(null);
        lead.addTimeline(entry("status", "Lead marked inactive", "Lead was marked inactive by " + currentUserName() + "."));
        lead.addHistory(history("Status", label(previous), "Inactive", currentUserName()));
        return toResponse(leadRepository.save(lead));
    }

    public LeadResponse activate(Long id) {
        Lead lead = getLead(id);
        LeadStatus previous = lead.getStatus();
        if (previous == LeadStatus.ACTIVE) {
            return toResponse(lead);
        }
        lead.setStatus(LeadStatus.ACTIVE);
        lead.setArchivedAt(null);
        lead.setDeletedAt(null);
        lead.addTimeline(entry("status", "Lead activated", "Lead was activated by " + currentUserName() + "."));
        lead.addHistory(history("Status", label(previous), "Active", currentUserName()));
        return toResponse(leadRepository.save(lead));
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Lead lead = getLead(id);
            if (lead.getStatus() != LeadStatus.ARCHIVED) {
                lead.setStatus(LeadStatus.ARCHIVED);
                lead.setArchivedAt(LocalDateTime.now());
                lead.addTimeline(entry("archived", "Lead archived", "Lead was archived by " + currentUserName() + "."));
                leadRepository.save(lead);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Lead lead = getLead(id);
            if (lead.getStatus() != LeadStatus.ACTIVE) {
                lead.setStatus(LeadStatus.ACTIVE);
                lead.setArchivedAt(null);
                lead.setDeletedAt(null);
                lead.addTimeline(entry("restored", "Lead restored", "Lead was restored by " + currentUserName() + "."));
                leadRepository.save(lead);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        // SOFT delete for every selected lead — never a physical DELETE, so
        // FollowUp / history / timeline / CPR foreign keys are never hit.
        int count = 0;
        for (Long id : ids) {
            Lead lead = getLead(id);
            if (lead.getStatus() != LeadStatus.DELETED) {
                LeadStatus previous = lead.getStatus();
                lead.setStatus(LeadStatus.DELETED);
                lead.setDeletedAt(LocalDateTime.now());
                lead.setArchivedAt(null);
                lead.addTimeline(entry("deleted", "Lead deleted", "Lead was moved to Deleted by " + currentUserName() + "."));
                lead.addHistory(history("Status", label(previous), "Deleted", currentUserName()));
                leadRepository.save(lead);
                count++;
            }
        }
        return count;
    }

    public LeadResponse assignOwner(Long id, String owner) {
        Lead lead = getLead(id);
        String previous = lead.getOwner();
        if (owner.equals(previous)) {
            return toResponse(lead);
        }
        lead.setOwner(owner);
        lead.addTimeline(entry("owner", "Owner assigned",
                "Owner changed from '" + display(previous) + "' to '" + owner + "'."));
        lead.addHistory(history("Owner", previous, owner, currentUserName()));
        return toResponse(leadRepository.save(lead));
    }

    public LeadResponse changeStage(Long id, String stage) {
        Lead lead = getLead(id);
        LeadStage previous = lead.getStage();
        LeadStage next = parseStage(stage);
        if (next == previous) {
            return toResponse(lead);
        }
        lead.setStage(next);
        lead.addTimeline(entry("stage", "Stage changed",
                "Stage changed from '" + label(previous) + "' to '" + label(next) + "'."));
        lead.addHistory(history("Stage", label(previous), label(next), currentUserName()));
        return toResponse(leadRepository.save(lead));
    }

    public LeadResponse duplicate(Long id) {
        Lead source = getLead(id);
        Lead copy = new Lead();
        copy.setName(source.getName() + " (Copy)");
        copy.setCompany(source.getCompany());
        copy.setTitle(source.getTitle());
        copy.setStage(LeadStage.NEW);
        copy.setStatus(LeadStatus.ACTIVE);
        copy.setSource(source.getSource());
        copy.setEmail(source.getEmail());
        copy.setPhone(source.getPhone());
        copy.setWebsite(source.getWebsite());
        copy.setValue(source.getValue());
        copy.setOwner(source.getOwner());
        copy.setBusinessName(source.getBusinessName());
        copy.setBusinessType(source.getBusinessType());
        copy.setIndustry(source.getIndustry());
        copy.setTaxId(source.getTaxId());
        copy.setSecondaryName(source.getSecondaryName());
        copy.setSecondaryEmail(source.getSecondaryEmail());
        copy.setSecondaryPhone(source.getSecondaryPhone());
        copy.setAddress(source.getAddress());
        copy.setCity(source.getCity());
        copy.setState(source.getState());
        copy.setPincode(source.getPincode());
        copy.setCountry(source.getCountry());
        copy.setInternalNotes(source.getInternalNotes());
        ensureLeadNo(copy);
        copy.addTimeline(entry("created", "Lead created", "Duplicated from lead '" + display(source.getName()) + "'."));
        return toResponse(leadRepository.save(copy));
    }

    // ============================== Export / Import ==============================

    @Transactional
    public List<LeadResponse> export(ExportRequest request) {
        Specification<Lead> spec = buildExportSpecification(request);
        return leadRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<LeadResponse> leads) {
        StringBuilder sb = new StringBuilder();
        sb.append("Name,Company,Email,Phone,Value,Stage,Source,Owner,Status,CreatedAt\n");
        for (LeadResponse l : leads) {
            sb.append(escapeCsv(l.name())).append(',')
              .append(escapeCsv(l.company())).append(',')
              .append(escapeCsv(l.email())).append(',')
              .append(escapeCsv(l.phone())).append(',')
              .append(l.value() == null ? "" : l.value().toPlainString()).append(',')
              .append(escapeCsv(l.stage())).append(',')
              .append(escapeCsv(l.source())).append(',')
              .append(escapeCsv(l.owner())).append(',')
              .append(escapeCsv(l.status())).append(',')
              .append(escapeCsv(l.createdAt())).append('\n');
        }
        return sb.toString();
    }

    public int importLeads(MultipartFile file) {
        String content;
        try {
            content = new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BadRequestException("Could not read the uploaded file");
        }
        String[] lines = content.split("\\r?\\n");
        int imported = 0;
        int headerOffset = 0;
        if (lines.length > 0 && looksLikeHeader(lines[0])) {
            headerOffset = 1;
        }
        for (int i = headerOffset; i < lines.length && imported < MAX_IMPORT_ROWS; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] cols = splitCsvLine(line);
            Lead lead = new Lead();
            lead.setName(trim(col(cols, 0)));
            if (lead.getName() == null || lead.getName().isBlank()) {
                continue;
            }
            lead.setCompany(trim(col(cols, 1)));
            lead.setEmail(trim(col(cols, 2)));
            lead.setPhone(trim(col(cols, 3)));
            lead.setValue(parseNumber(trim(col(cols, 4))));
            lead.setStage(parseStageSafe(trim(col(cols, 5))));
            lead.setSource(trim(col(cols, 6)));
            lead.setOwner(trim(col(cols, 7)));
            lead.setWebsite(trim(col(cols, 8)));
            lead.setCity(trim(col(cols, 9)));
            lead.setState(trim(col(cols, 10)));
            lead.setCountry(trim(col(cols, 11)));
            lead.setAddress(trim(col(cols, 12)));
            ensureLeadNo(lead);
            lead.addTimeline(entry("imported", "Lead imported", "Lead '" + lead.getName() + "' was imported from a file."));
            leadRepository.save(lead);
            imported++;
        }
        return imported;
    }

    private boolean looksLikeHeader(String line) {
        String lower = line.toLowerCase();
        return lower.contains("name") || lower.contains("company") || lower.contains("email");
    }

    private String[] splitCsvLine(String line) {
        return line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);
    }

    private String col(String[] cols, int index) {
        if (index >= cols.length) {
            return null;
        }
        String value = cols[index];
        if (value == null) {
            return null;
        }
        value = value.trim();
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            value = value.substring(1, value.length() - 1).replace("\"\"", "\"");
        }
        return value;
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private BigDecimal parseNumber(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
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

    // ============================== Sub-resources ==============================

    @Transactional
    public List<TimelineResponse> getTimeline(Long id) {
        return getLead(id).getTimeline().stream().map(this::timelineResponse).toList();
    }

    @Transactional
    public List<ActivityResponse> getActivities(Long id) {
        return getLead(id).getActivities().stream().map(this::activityResponse).toList();
    }

    @Transactional
    public List<NoteResponse> getNotes(Long id) {
        return getLead(id).getNotes().stream().map(this::noteResponse).toList();
    }

    public NoteResponse addNote(Long id, String text) {
        Lead lead = getLead(id);
        Note note = new Note();
        note.setText(text);
        note.setAuthor(currentUserName());
        lead.addNote(note);
        String preview = text.length() > 120 ? text.substring(0, 120) + "..." : text;
        lead.addTimeline(entry("note", "Note added", preview));
        leadRepository.save(lead);
        return noteResponse(note);
    }

    @Transactional
    public List<AttachmentResponse> getAttachments(Long id) {
        return getLead(id).getAttachments().stream().map(this::attachmentResponse).toList();
    }

    public AttachmentResponse addAttachment(Long id, MultipartFile file) {
        Lead lead = getLead(id);
        String storedName = fileStorageService.store(file);
        Attachment attachment = new Attachment();
        attachment.setName(file.getOriginalFilename());
        attachment.setStoredName(storedName);
        attachment.setContentType(file.getContentType());
        attachment.setSize(file.getSize());
        attachment.setUrl(baseUrl + "/v1/files/" + storedName);
        lead.addAttachment(attachment);
        lead.addTimeline(entry("attachment", "File attached", file.getOriginalFilename()));
        leadRepository.save(lead);
        return attachmentResponse(attachment);
    }

    @Transactional
    public List<HistoryResponse> getHistory(Long id) {
        return getLead(id).getHistory().stream().map(this::historyResponse).toList();
    }

    // ============================== Mapping ==============================

    private LeadResponse toResponse(Lead lead) {
        return new LeadResponse(
                lead.getId(),
                lead.getLeadNo(),
                lead.getName(),
                lead.getCompany(),
                lead.getTitle(),
                label(lead.getStage()),
                label(lead.getStatus()),
                lead.getSource(),
                lead.getEmail(),
                lead.getPhone(),
                lead.getWebsite(),
                lead.getValue(),
                lead.getOwner(),
                lead.getBusinessName(),
                lead.getBusinessType(),
                lead.getIndustry(),
                lead.getTaxId(),
                lead.getSecondaryName(),
                lead.getSecondaryEmail(),
                lead.getSecondaryPhone(),
                lead.getAddress(),
                lead.getCity(),
                lead.getState(),
                lead.getPincode(),
                lead.getCountry(),
                lead.getInternalNotes(),
                lead.getPan(),
                lead.getPreferredVendor(),
                lead.getProject(),
                lead.getCreatedAt() == null ? null : lead.getCreatedAt().toLocalDate().toString(),
                lead.getCreatedAt() == null ? null : lead.getCreatedAt().toString(),
                lead.getUpdatedAt() == null ? null : lead.getUpdatedAt().toString(),
                lead.getArchivedAt() == null ? null : lead.getArchivedAt().toString(),
                lead.getNotes().stream().map(this::noteResponse).toList(),
                lead.getActivities().stream().map(this::activityResponse).toList(),
                lead.getAttachments().stream().map(this::attachmentResponse).toList(),
                lead.getTimeline().stream().map(this::timelineResponse).toList(),
                lead.getHistory().stream().map(this::historyResponse).toList()
        );
    }

    private NoteResponse noteResponse(Note note) {
        return new NoteResponse(note.getId(), note.getText(), note.getAuthor(),
                note.getCreatedAt() == null ? null : note.getCreatedAt().toString());
    }

    private ActivityResponse activityResponse(Activity activity) {
        return new ActivityResponse(activity.getId(), activity.getType(), activity.getTitle(), activity.getDetail(),
                activity.getOwner(), activity.getCreatedAt() == null ? null : activity.getCreatedAt().toString());
    }

    private AttachmentResponse attachmentResponse(Attachment attachment) {
        return new AttachmentResponse(attachment.getId(), attachment.getName(), attachment.getContentType(),
                attachment.getSize(), attachment.getUrl(),
                attachment.getUploadedAt() == null ? null : attachment.getUploadedAt().toString());
    }

    private TimelineResponse timelineResponse(TimelineEntry entry) {
        return new TimelineResponse(entry.getId(), entry.getType(), entry.getTitle(), entry.getDetail(),
                entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private HistoryResponse historyResponse(HistoryEntry entry) {
        return new HistoryResponse(entry.getId(), entry.getField(), entry.getOldValue(), entry.getNewValue(),
                entry.getChangedBy(), entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private TimelineEntry entry(String type, String title, String detail) {
        TimelineEntry entry = new TimelineEntry();
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        return entry;
    }

    private Activity activity(String type, String title, String detail, String owner) {
        Activity activity = new Activity();
        activity.setType(type);
        activity.setTitle(title);
        activity.setDetail(detail);
        activity.setOwner(owner);
        return activity;
    }

    private HistoryEntry history(String field, String oldValue, String newValue, String changedBy) {
        HistoryEntry entry = new HistoryEntry();
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        return entry;
    }

    // ============================== Helpers ==============================

    /** Assign the next LEAD-xxxxxx number when the lead has none yet. */
    private void ensureLeadNo(Lead lead) {
        if (lead.getLeadNo() == null || lead.getLeadNo().isBlank()) {
            long next = nextLeadSequence();
            lead.setLeadNo(buildLeadNo(next));
            leadRepository.upsertLeadSequence(next);
        }
    }

    private long nextLeadSequence() {
        long maxFromLeads = 0;
        for (String number : leadRepository.findAllLeadNos()) {
            if (number == null || !number.startsWith("LEAD-")) {
                continue;
            }
            try {
                maxFromLeads = Math.max(maxFromLeads, Long.parseLong(number.substring("LEAD-".length())));
            } catch (NumberFormatException ignored) {
                // skip malformed numbers
            }
        }
        long stored = leadRepository.findLeadSequenceValue().orElse(0L);
        return Math.max(maxFromLeads, stored) + 1;
    }

    private String buildLeadNo(long sequence) {
        return String.format("LEAD-%06d", sequence);
    }

    private long nextClientSequence() {
        long maxFromBlobs = 0;
        // Required format C-XXXXXX; the [A-Z]+ prefix also tolerates any
        // legacy CLIENT-xxxxxx numbers so custom numbers are never reused.
        Pattern clientPattern = Pattern.compile("\"clientNo\"\\s*:\\s*\"[A-Z]+-(\\d+)\"");
        for (String blob : leadRepository.findClientNumberBlobs()) {
            if (blob == null) {
                continue;
            }
            Matcher matcher = clientPattern.matcher(blob);
            while (matcher.find()) {
                try {
                    maxFromBlobs = Math.max(maxFromBlobs, Long.parseLong(matcher.group(1)));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        long stored = leadRepository.findClientSequenceValue().orElse(0L);
        return Math.max(maxFromBlobs, stored) + 1;
    }

    private String buildClientNo(long sequence) {
        // Required format: C- + 6-digit zero-padded number (C-000001, C-000002, ...)
        return String.format("C-%06d", sequence);
    }

    private Lead getLead(Long id) {
        return leadRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lead not found with id: " + id));
    }

    private void applyRequest(Lead lead, LeadRequest request) {
        lead.setName(request.leadName());
        lead.setCompany(request.companyName());
        lead.setTitle(request.designation());
        lead.setEmail(request.email());
        lead.setPhone(request.phone());
        lead.setWebsite(request.website());
        lead.setValue(request.estimatedValue());
        if (request.pipelineStage() != null && !request.pipelineStage().isBlank()) {
            lead.setStage(parseStage(request.pipelineStage()));
        } else if (lead.getStage() == null) {
            lead.setStage(LeadStage.NEW);
        }
        lead.setSource(request.leadSource());
        lead.setOwner(request.assignedTo());
        lead.setBusinessName(request.businessName());
        lead.setBusinessType(request.businessType());
        lead.setIndustry(request.industry());
        lead.setTaxId(request.taxId());
        lead.setSecondaryName(request.secondaryName());
        lead.setSecondaryEmail(request.secondaryEmail());
        lead.setSecondaryPhone(request.secondaryPhone());
        lead.setAddress(request.address());
        lead.setCity(request.city());
        lead.setState(request.state());
        lead.setPincode(request.pincode());
        lead.setCountry(request.country());
        lead.setInternalNotes(request.internalNotes());
        if (request.leadNo() != null && !request.leadNo().isBlank()) {
            lead.setLeadNo(request.leadNo());
        }
        lead.setPan(request.pan());
        lead.setPreferredVendor(request.preferredVendor());
        lead.setProject(request.project());
    }

    private Specification<Lead> buildSpecification(String search, String stage, String status, String owner,
                                                   String source, String dateFrom, String dateTo,
                                                   BigDecimal minValue, BigDecimal maxValue) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("company")), like),
                        cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(root.get("phone")), like),
                        cb.like(cb.lower(root.get("owner")), like),
                        cb.like(cb.lower(root.get("city")), like)
                ));
            }
            if (stage != null && !stage.isBlank()) {
                predicates.add(cb.equal(root.get("stage"), parseStage(stage)));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), parseStatus(status)));
            } else {
                // Default views (All / Active / Archived and the clients,
                // followups, contacts scopes) exclude soft-deleted leads.
                predicates.add(cb.notEqual(root.get("status"), LeadStatus.DELETED));
            }
            if (owner != null && !owner.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("owner")), "%" + owner.trim().toLowerCase() + "%"));
            }
            if (source != null && !source.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("source")), source.trim().toLowerCase()));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
            }
            if (minValue != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("value"), minValue));
            }
            if (maxValue != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("value"), maxValue));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<Lead> buildExportSpecification(ExportRequest request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (request != null && request.ids() != null && !request.ids().isEmpty()) {
                predicates.add(root.get("id").in(request.ids()));
            }
            if (request != null && request.stage() != null && !request.stage().isBlank()) {
                predicates.add(cb.equal(root.get("stage"), parseStage(request.stage())));
            }
            if (request != null && request.status() != null && !request.status().isBlank()) {
                predicates.add(cb.equal(root.get("status"), parseStatus(request.status())));
            }
            if (request != null && request.search() != null && !request.search().isBlank()) {
                String like = "%" + request.search().trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("company")), like),
                        cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(root.get("owner")), like)
                ));
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
            case "name", "company", "value", "stage", "owner", "source", "status" -> field;
            case "date" -> "createdAt";
            case "createdAt" -> "createdAt";
            case "updatedAt" -> "updatedAt";
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private LeadStage parseStage(String value) {
        try {
            return LeadStage.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid stage: " + value);
        }
    }

    private LeadStage parseStageSafe(String value) {
        try {
            return LeadStage.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            return LeadStage.NEW;
        }
    }

    private LeadStatus parseStatus(String value) {
        try {
            return LeadStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid status: " + value);
        }
    }

    private String label(Enum<?> value) {
        if (value == null) {
            return null;
        }
        String name = value.name();
        return name.substring(0, 1).toUpperCase() + name.substring(1).toLowerCase();
    }

    private String display(String value) {
        return value == null ? "" : value;
    }

    private String currentUserName() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        return "System";
    }
}
