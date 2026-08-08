import SalesListPage from '../../components/SalesTable/SalesListPage';
import SalesViewPage from '../../components/SalesDetail/SalesViewPage';
import SalesFormPage from '../../components/SalesForm/SalesFormPage';
import { creditNoteListConfig, creditNoteViewConfig } from '../../config/salesPageConfigs';
import { SALES_FORM_CONFIGS } from '../../config/salesFormConfigs';
import creditNoteService from '../../services/creditNoteService';

export function CreditNotes() {
  return <SalesListPage config={creditNoteListConfig} />;
}

export function CreditNoteDetails() {
  return <SalesViewPage config={creditNoteViewConfig} />;
}

export function AddCreditNote() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.creditNote} service={creditNoteService} navigateToList="/credit-notes" />;
}

export function EditCreditNote() {
  return <SalesFormPage config={SALES_FORM_CONFIGS.creditNote} service={creditNoteService} navigateToList="/credit-notes" />;
}

export default CreditNotes;
