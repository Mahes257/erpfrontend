import SalesListPage from '../../components/SalesTable/SalesListPage';
import SalesViewPage from '../../components/SalesDetail/SalesViewPage';
import SalesFormPage from '../../components/SalesForm/SalesFormPage';
import { proformaInvoiceListConfig, proformaInvoiceViewConfig } from '../../config/salesPageConfigs';
import { SALES_FORM_CONFIGS } from '../../config/salesFormConfigs';
import proformaInvoiceService from '../../services/proformaInvoiceService';

export function ProformaInvoices() {
  return <SalesListPage config={proformaInvoiceListConfig} />;
}

export function ProformaInvoiceDetails() {
  return <SalesViewPage config={proformaInvoiceViewConfig} />;
}

export function AddProformaInvoice() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.proformaInvoice} service={proformaInvoiceService} navigateToList="/proforma-invoices" />;
}

export function EditProformaInvoice() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.proformaInvoice} service={proformaInvoiceService} navigateToList="/proforma-invoices" />;
}

export default ProformaInvoices;
