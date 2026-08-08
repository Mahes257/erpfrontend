package com.vishatech.erp.dto;

public record DashboardStats(
        long totalExpenses,
        long netProfit,
        long cashBalance,
        long totalCustomers,
        long totalVendors,
        long activeLeads,
        long salesOrders,
        long purchaseOrders,
        long pendingDeliveries,
        long pendingReceipts,
        long pendingPayments,
        long pendingCprs,
        long totalQuotations,
        long totalSalesContracts,
        long totalProformaInvoices,
        long totalInvoices,
        long totalPaymentReceipts,
        long totalCreditNotes,
        long totalDeliveryChallans
) {
}
