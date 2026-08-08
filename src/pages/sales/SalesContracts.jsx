import SalesContractListPage from './SalesContractListPage';
import SalesContractViewPage from './SalesContractViewPage';
import SalesContractFormPage from './SalesContractFormPage';

export function SalesContracts() {
  return <SalesContractListPage />;
}

export function SalesContractDetails() {
  return <SalesContractViewPage />;
}

export function AddSalesContract() {
  return <SalesContractFormPage />;
}

export function EditSalesContract() {
  return <SalesContractFormPage />;
}

export default SalesContracts;
