import SalesListPage from '../../components/SalesTable/SalesListPage';
import SalesViewPage from '../../components/SalesDetail/SalesViewPage';
import SalesFormPage from '../../components/SalesForm/SalesFormPage';
import { invoiceListConfig, invoiceViewConfig } from '../../config/salesPageConfigs';
import { SALES_FORM_CONFIGS } from '../../config/salesFormConfigs';
import invoiceService from '../../services/invoiceService';

export function Invoices() {
  return <SalesListPage config={invoiceListConfig} />;
}

export function InvoiceDetails() {
  return <SalesViewPage config={invoiceViewConfig} />;
}

export function AddInvoice() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.invoice} service={invoiceService} navigateToList="/invoices" />;
}

export function EditInvoice() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.invoice} service={invoiceService} navigateToList="/invoices" />;
}

export default Invoices;
