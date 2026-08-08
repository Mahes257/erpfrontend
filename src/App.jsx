import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider, ErrorBoundary, PageLoader, ThemeProvider, ExchangeRateProvider } from './components/Common';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AppLayout from './components/Layout/AppLayout';
import { isAuthenticated } from './services/authService';

const SignIn = lazy(() => import('./pages/SignIn'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadPipeline = lazy(() => import('./pages/LeadPipeline'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const AddLead = lazy(() => import('./pages/AddLead'));
const EditLead = lazy(() => import('./pages/EditLead'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Clients = lazy(() => import('./pages/ClientsPage'));
const AddClient = lazy(() => import('./pages/AddClient'));
const EditClient = lazy(() => import('./pages/EditClient'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const FollowUps = lazy(() => import('./pages/FollowUpsPage'));
const AddFollowUp = lazy(() => import('./pages/AddFollowUp'));
const EditFollowUp = lazy(() => import('./pages/EditFollowUp'));
const Cprs = lazy(() => import('./pages/Cprs'));
const AddCpr = lazy(() => import('./pages/AddCpr'));
const EditCpr = lazy(() => import('./pages/EditCpr'));
const CprView = lazy(() => import('./pages/CprView'));
const CprReports = lazy(() => import('./pages/CprReports'));
const QuotationView = lazy(() => import('./pages/QuotationView'));
const CostWorkouts = lazy(() => import('./pages/CostWorkouts'));
const AddCostWorkout = lazy(() => import('./pages/AddCostWorkout'));
const CostWorkoutView = lazy(() => import('./pages/CostWorkoutView'));
const Quotations = lazy(() => import('./pages/sales/Quotations'));
const QuotationDetails = lazy(() => import('./pages/sales/Quotations').then((m) => ({ default: m.QuotationDetails })));
const AddQuotation = lazy(() => import('./pages/sales/Quotations').then((m) => ({ default: m.AddQuotation })));
const EditQuotation = lazy(() => import('./pages/sales/Quotations').then((m) => ({ default: m.EditQuotation })));
const QuotationDashboard = lazy(() => import('./pages/sales/QuotationDashboard'));
const QuotationApproval = lazy(() => import('./pages/sales/QuotationApproval'));
const QuotationConvert = lazy(() => import('./pages/sales/QuotationConvert'));
const QuotationEmail = lazy(() => import('./pages/sales/QuotationEmail'));
const QuotationRevision = lazy(() => import('./pages/sales/QuotationRevision'));
const QuotationTimeline = lazy(() => import('./pages/sales/QuotationTimeline'));
const QuotationLinkedDocuments = lazy(() => import('./pages/sales/QuotationLinkedDocuments'));
const QuotationReport = lazy(() => import('./pages/sales/QuotationReport'));
const QuotationWorkflows = lazy(() => import('./pages/sales/QuotationWorkflows'));
const QuotationComparison = lazy(() => import('./pages/sales/QuotationComparison'));
const QuotationDesign = lazy(() => import('./pages/sales/QuotationDesign'));
const QuotationPrint = lazy(() => import('./pages/sales/QuotationPrint'));
const SalesContracts = lazy(() => import('./pages/sales/SalesContracts'));
const SalesContractDetails = lazy(() => import('./pages/sales/SalesContracts').then((m) => ({ default: m.SalesContractDetails })));
const AddSalesContract = lazy(() => import('./pages/sales/SalesContracts').then((m) => ({ default: m.AddSalesContract })));
const EditSalesContract = lazy(() => import('./pages/sales/SalesContracts').then((m) => ({ default: m.EditSalesContract })));
const SalesOrders = lazy(() => import('./pages/sales/SalesOrders'));
const SalesOrderDetails = lazy(() => import('./pages/sales/SalesOrders').then((m) => ({ default: m.SalesOrderDetails })));
const AddSalesOrder = lazy(() => import('./pages/sales/SalesOrders').then((m) => ({ default: m.AddSalesOrder })));
const EditSalesOrder = lazy(() => import('./pages/sales/SalesOrders').then((m) => ({ default: m.EditSalesOrder })));
const DeliveryChallans = lazy(() => import('./pages/sales/DeliveryChallans'));
const DeliveryChallanDetails = lazy(() => import('./pages/sales/DeliveryChallans').then((m) => ({ default: m.DeliveryChallanDetails })));
const AddDeliveryChallan = lazy(() => import('./pages/sales/DeliveryChallans').then((m) => ({ default: m.AddDeliveryChallan })));
const EditDeliveryChallan = lazy(() => import('./pages/sales/DeliveryChallans').then((m) => ({ default: m.EditDeliveryChallan })));
const ProformaInvoices = lazy(() => import('./pages/sales/ProformaInvoices'));
const ProformaInvoiceDetails = lazy(() => import('./pages/sales/ProformaInvoices').then((m) => ({ default: m.ProformaInvoiceDetails })));
const AddProformaInvoice = lazy(() => import('./pages/sales/ProformaInvoices').then((m) => ({ default: m.AddProformaInvoice })));
const EditProformaInvoice = lazy(() => import('./pages/sales/ProformaInvoices').then((m) => ({ default: m.EditProformaInvoice })));
const Invoices = lazy(() => import('./pages/sales/Invoices'));
const InvoiceDetails = lazy(() => import('./pages/sales/Invoices').then((m) => ({ default: m.InvoiceDetails })));
const AddInvoice = lazy(() => import('./pages/sales/Invoices').then((m) => ({ default: m.AddInvoice })));
const EditInvoice = lazy(() => import('./pages/sales/Invoices').then((m) => ({ default: m.EditInvoice })));
const PaymentReceipts = lazy(() => import('./pages/sales/PaymentReceipts'));
const PaymentReceiptDetails = lazy(() => import('./pages/sales/PaymentReceipts').then((m) => ({ default: m.PaymentReceiptDetails })));
const AddPaymentReceipt = lazy(() => import('./pages/sales/PaymentReceipts').then((m) => ({ default: m.AddPaymentReceipt })));
const EditPaymentReceipt = lazy(() => import('./pages/sales/PaymentReceipts').then((m) => ({ default: m.EditPaymentReceipt })));
const CreditNotes = lazy(() => import('./pages/sales/CreditNotes'));
const CreditNoteDetails = lazy(() => import('./pages/sales/CreditNotes').then((m) => ({ default: m.CreditNoteDetails })));
const AddCreditNote = lazy(() => import('./pages/sales/CreditNotes').then((m) => ({ default: m.AddCreditNote })));
const EditCreditNote = lazy(() => import('./pages/sales/CreditNotes').then((m) => ({ default: m.EditCreditNote })));
const FinancialSettings = lazy(() => import('./pages/FinancialSettings'));

function IndexRedirect() {
  return <Navigate to={isAuthenticated() ? '/dashboard' : '/signin'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <ErrorBoundary>
            <ExchangeRateProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<IndexRedirect />} />
                <Route path="/signin" element={<SignIn />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/pipeline" element={<LeadPipeline />} />
                    <Route path="/leads/new" element={<AddLead />} />
                    <Route path="/leads/:id/edit" element={<EditLead />} />
                    <Route path="/leads/:id" element={<LeadDetail />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/clients/new" element={<AddClient />} />
                    <Route path="/clients/:id/edit" element={<EditClient />} />
                    <Route path="/clients/:id" element={<ClientDetail />} />
                    <Route path="/followups" element={<FollowUps />} />
                    <Route path="/followups/new" element={<AddFollowUp />} />
                    <Route path="/followups/:id/edit" element={<EditFollowUp />} />
                    <Route path="/cprs" element={<Cprs />} />
                    <Route path="/cprs/reports" element={<CprReports />} />
                    <Route path="/cprs/new" element={<AddCpr />} />
                    <Route path="/cprs/:id/edit" element={<EditCpr />} />
                    <Route path="/cprs/:id" element={<CprView />} />
                    <Route path="/quotations/:cprId" element={<QuotationView />} />
                    <Route path="/cost-workouts" element={<CostWorkouts />} />
                    <Route path="/cost-workouts/new" element={<AddCostWorkout />} />
                    <Route path="/cost-workouts/:id/edit" element={<AddCostWorkout />} />
                    <Route path="/cost-workouts/:id" element={<CostWorkoutView />} />
                    <Route path="/quotations" element={<Quotations />} />
                    <Route path="/quotations/new" element={<AddQuotation />} />
                    <Route path="/quotations/:id/edit" element={<EditQuotation />} />
                    {/* distinct path: /quotations/:cprId is used by the CPR-linked Quotation preview */}
                    <Route path="/quotations/:id/view" element={<QuotationDetails />} />
                    <Route path="/quotations/dashboard" element={<QuotationDashboard />} />
                    <Route path="/quotations/approval" element={<QuotationApproval />} />
                    <Route path="/quotations/convert" element={<QuotationConvert />} />
                    <Route path="/quotations/email/:id" element={<QuotationEmail />} />
                    <Route path="/quotations/revision" element={<QuotationRevision />} />
                    <Route path="/quotations/timeline" element={<QuotationTimeline />} />
                    <Route path="/quotations/linked-documents" element={<QuotationLinkedDocuments />} />
                    <Route path="/quotations/report" element={<QuotationReport />} />
                    <Route path="/quotations/workflows" element={<QuotationWorkflows />} />
                    <Route path="/quotations/comparison" element={<QuotationComparison />} />
                    <Route path="/quotations/design" element={<QuotationDesign />} />
                    <Route path="/quotations/print/:id" element={<QuotationPrint />} />
                    <Route path="/settings" element={<FinancialSettings />} />
                    <Route path="/sales-contracts" element={<SalesContracts />} />
                    <Route path="/sales-contracts/new" element={<AddSalesContract />} />
                    <Route path="/sales-contracts/:id/edit" element={<EditSalesContract />} />
                    <Route path="/sales-contracts/:id" element={<SalesContractDetails />} />
                    <Route path="/sales-orders" element={<SalesOrders />} />
                    <Route path="/sales-orders/new" element={<AddSalesOrder />} />
                    <Route path="/sales-orders/:id/edit" element={<EditSalesOrder />} />
                    <Route path="/sales-orders/:id" element={<SalesOrderDetails />} />
                    <Route path="/delivery-challans" element={<DeliveryChallans />} />
                    <Route path="/delivery-challans/new" element={<AddDeliveryChallan />} />
                    <Route path="/delivery-challans/:id/edit" element={<EditDeliveryChallan />} />
                    <Route path="/delivery-challans/:id" element={<DeliveryChallanDetails />} />
                    <Route path="/proforma-invoices" element={<ProformaInvoices />} />
                    <Route path="/proforma-invoices/new" element={<AddProformaInvoice />} />
                    <Route path="/proforma-invoices/:id/edit" element={<EditProformaInvoice />} />
                    <Route path="/proforma-invoices/:id" element={<ProformaInvoiceDetails />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/invoices/new" element={<AddInvoice />} />
                    <Route path="/invoices/:id/edit" element={<EditInvoice />} />
                    <Route path="/invoices/:id" element={<InvoiceDetails />} />
                    <Route path="/payment-receipts" element={<PaymentReceipts />} />
                    <Route path="/payment-receipts/new" element={<AddPaymentReceipt />} />
                    <Route path="/payment-receipts/:id/edit" element={<EditPaymentReceipt />} />
                    <Route path="/payment-receipts/:id" element={<PaymentReceiptDetails />} />
                    <Route path="/credit-notes" element={<CreditNotes />} />
                    <Route path="/credit-notes/new" element={<AddCreditNote />} />
                    <Route path="/credit-notes/:id/edit" element={<EditCreditNote />} />
                    <Route path="/credit-notes/:id" element={<CreditNoteDetails />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
            </ExchangeRateProvider>
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
