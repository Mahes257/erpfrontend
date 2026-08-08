import { useMemo } from 'react';
import { Contact2, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CrmPage from '../components/CRM/CrmPage';
import { getInitials, avatarColor } from '../utils/leadHelpers';

const CONTACT_COLUMNS = [
  { key: 'number', label: 'Contact No', width: 120, sortable: true, visible: true, align: 'left' },
  { key: 'name', label: 'Contact Details', width: 210, sortable: true, visible: true, sticky: 'left' },
  { key: 'contact', label: 'Contact Info', width: 210, sortable: false, visible: true, align: 'left' },
  { key: 'country', label: 'Location', width: 130, sortable: false, visible: true, align: 'left' },
  { key: 'date', label: 'Added Date', width: 135, sortable: true, visible: true, align: 'left' },
  { key: 'status', label: 'Status', width: 115, sortable: true, visible: true, align: 'center' },
  { key: 'actions', label: 'Actions', width: 96, sortable: false, visible: true, sticky: 'right', align: 'center' }
];

const CARD_FILTERS = {
  total: null,
  active: { key: 'status', value: 'Active' },
  inactive: { key: 'status', value: 'Inactive' }
};

export default function Contacts() {
  const navigate = useNavigate();
  const renderers = useMemo(
    () => ({
      name: (row) => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${avatarColor(row.name)} border border-black/5`}>
            {getInitials(row.name)}
          </div>
          <div className="flex flex-col">
            <button
              onClick={() => navigate(`/leads/${row.id}`)}
              className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer text-left"
              title="View contact details"
            >
              {row.name}
            </button>
            <button
              onClick={() => navigate(`/leads/${row.id}`)}
              className="text-[10px] text-slate-500 hover:text-slate-700 font-normal text-left cursor-pointer"
              title="View contact details"
            >
              {row.leadNo || `ID: #${String(row.id).padStart(4, '0')}`}
            </button>
          </div>
        </div>
      ),
      number: (row) => (
        <button
          onClick={() => navigate(`/leads/${row.id}`)}
          className="font-mono text-[11px] font-semibold text-slate-600 hover:text-slate-800 cursor-pointer text-left"
          title="View contact details"
        >
          {row.leadNo || '—'}
        </button>
      )
    }),
    [navigate]
  );

  const cards = useMemo(
    () => ({ list, totalCount }) => [
      { key: 'total', label: 'All Contacts', value: totalCount, icon: Contact2, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', highlight: true },
      { key: 'active', label: 'Active', value: list.filter((r) => r.status === 'Active').length, icon: CheckCircle, iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
      { key: 'inactive', label: 'Inactive', value: list.filter((r) => r.status === 'Inactive').length, icon: XCircle, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' }
    ],
    []
  );

  return (
    <CrmPage
      title="Your Contacts"
      breadcrumb={['VISHAK TECH', 'Contacts']}
      endpoint="contacts"
      noun="contacts"
      filename="contacts"
      columns={CONTACT_COLUMNS}
      renderers={renderers}
      cards={cards}
      cardFilters={CARD_FILTERS}
      searchPlaceholder="Search by Name, Phone, Email, Country..."
      emptyMessage="No contacts found matching your criteria."
      errorMessage="Failed to load contacts. Please try again."
      addButton={{ label: 'Add Contact', to: '/leads/new' }}
      importButton={{ label: 'Upload Contacts' }}
    />
  );
}
