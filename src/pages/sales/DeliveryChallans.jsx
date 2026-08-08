import SalesListPage from '../../components/SalesTable/SalesListPage';
import SalesViewPage from '../../components/SalesDetail/SalesViewPage';
import DeliveryChallanFormPage from './DeliveryChallanFormPage';
import { deliveryChallanListConfig, deliveryChallanViewConfig } from '../../config/salesPageConfigs';

export function DeliveryChallans() {
  return <SalesListPage config={deliveryChallanListConfig} />;
}

export function DeliveryChallanDetails() {
  return <SalesViewPage config={deliveryChallanViewConfig} />;
}

export function AddDeliveryChallan() {
  return <DeliveryChallanFormPage />;
}

export function EditDeliveryChallan() {
  return <DeliveryChallanFormPage />;
}

export default DeliveryChallans;
