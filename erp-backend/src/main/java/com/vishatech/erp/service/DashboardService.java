package com.vishatech.erp.service;

import com.vishatech.erp.dto.DashboardStats;
import com.vishatech.erp.entity.CprStatus;
import com.vishatech.erp.entity.LeadStatus;
import com.vishatech.erp.repository.CprRepository;
import com.vishatech.erp.repository.CreditNoteRepository;
import com.vishatech.erp.repository.CustomerRepository;
import com.vishatech.erp.repository.DeliveryChallanRepository;
import com.vishatech.erp.repository.InvoiceRepository;
import com.vishatech.erp.repository.LeadRepository;
import com.vishatech.erp.repository.PaymentReceiptRepository;
import com.vishatech.erp.repository.ProformaInvoiceRepository;
import com.vishatech.erp.repository.QuotationRepository;
import com.vishatech.erp.repository.SalesContractRepository;
import com.vishatech.erp.repository.SalesOrderRepository;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    private final LeadRepository leadRepository;
    private final CprRepository cprRepository;
    private final CustomerRepository customerRepository;
    private final QuotationRepository quotationRepository;
    private final SalesContractRepository salesContractRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final DeliveryChallanRepository deliveryChallanRepository;
    private final ProformaInvoiceRepository proformaInvoiceRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentReceiptRepository paymentReceiptRepository;
    private final CreditNoteRepository creditNoteRepository;

    public DashboardService(LeadRepository leadRepository, CprRepository cprRepository,
                            CustomerRepository customerRepository,
                            QuotationRepository quotationRepository,
                            SalesContractRepository salesContractRepository,
                            SalesOrderRepository salesOrderRepository,
                            DeliveryChallanRepository deliveryChallanRepository,
                            ProformaInvoiceRepository proformaInvoiceRepository,
                            InvoiceRepository invoiceRepository,
                            PaymentReceiptRepository paymentReceiptRepository,
                            CreditNoteRepository creditNoteRepository) {
        this.leadRepository = leadRepository;
        this.cprRepository = cprRepository;
        this.customerRepository = customerRepository;
        this.quotationRepository = quotationRepository;
        this.salesContractRepository = salesContractRepository;
        this.salesOrderRepository = salesOrderRepository;
        this.deliveryChallanRepository = deliveryChallanRepository;
        this.proformaInvoiceRepository = proformaInvoiceRepository;
        this.invoiceRepository = invoiceRepository;
        this.paymentReceiptRepository = paymentReceiptRepository;
        this.creditNoteRepository = creditNoteRepository;
    }

    public DashboardStats getStats() {
        // Exclude soft-deleted (status DELETED) leads from the dashboard
        // total so it stays consistent with the CRM Leads page KPI cards.
        long totalLeads = leadRepository.countByStatus(LeadStatus.ACTIVE)
                + leadRepository.countByStatus(LeadStatus.INACTIVE)
                + leadRepository.countByStatus(LeadStatus.ARCHIVED);
        long activeLeads = leadRepository.countByStatus(LeadStatus.ACTIVE);
        long pendingCprs = cprRepository.countByStatus(CprStatus.PENDING_APPROVAL);
        return new DashboardStats(
                0,
                0,
                0,
                customerRepository.count(),
                0,
                activeLeads,
                salesOrderRepository.count(),
                0,
                deliveryChallanRepository.count(),
                0,
                0,
                pendingCprs,
                quotationRepository.count(),
                salesContractRepository.count(),
                proformaInvoiceRepository.count(),
                invoiceRepository.count(),
                paymentReceiptRepository.count(),
                creditNoteRepository.count(),
                deliveryChallanRepository.count()
        );
    }
}
