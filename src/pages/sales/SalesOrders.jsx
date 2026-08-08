import SalesListPage from '../../components/SalesTable/SalesListPage';
import SalesViewPage from '../../components/SalesDetail/SalesViewPage';
import SalesOrderFormPage from './SalesOrderFormPage';
import { salesOrderListConfig, salesOrderViewConfig } from '../../config/salesPageConfigs';

export function SalesOrders() {
  return <SalesListPage config={salesOrderListConfig} />;
}

export function SalesOrderDetails() {
  return <SalesViewPage config={salesOrderViewConfig} />;
}

export function AddSalesOrder() {
  return <SalesOrderFormPage />;
}

export function EditSalesOrder() {
  return <SalesOrderFormPage />;
}

export default SalesOrders;
