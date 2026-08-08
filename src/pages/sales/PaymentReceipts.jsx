import SalesListPage from '../../components/SalesTable/SalesListPage';
import SalesViewPage from '../../components/SalesDetail/SalesViewPage';
import SalesFormPage from '../../components/SalesForm/SalesFormPage';
import { paymentReceiptListConfig, paymentReceiptViewConfig } from '../../config/salesPageConfigs';
import { SALES_FORM_CONFIGS } from '../../config/salesFormConfigs';
import paymentReceiptService from '../../services/paymentReceiptService';

export function PaymentReceipts() {
  return <SalesListPage config={paymentReceiptListConfig} />;
}

export function PaymentReceiptDetails() {
  return <SalesViewPage config={paymentReceiptViewConfig} />;
}

export function AddPaymentReceipt() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.paymentReceipt} service={paymentReceiptService} navigateToList="/payment-receipts" />;
}

export function EditPaymentReceipt() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.paymentReceipt} service={paymentReceiptService} navigateToList="/payment-receipts" />;
}

export default PaymentReceipts;
