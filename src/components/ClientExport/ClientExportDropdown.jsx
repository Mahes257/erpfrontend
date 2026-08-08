import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import useClickOutside from '../../hooks/useClickOutside';
import useFloatingMenu from '../../hooks/useFloatingMenu';
import { useToast } from '../Common';
import { CLIENT_EXPORT_FORMATS, exportClientData, getClientExportFormat } from '../../utils/clientExport';

const FORMAT_ICONS = {
  'pdf-summary': FileText,
  'pdf-detailed': FileText,
  excel: FileSpreadsheet,
  csv: FileDown,
  print: Printer
};

const VARIANTS = {
  light: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-[#0B4A3D]',
  dark: 'bg-[rgba(11,74,61,0.15)] hover:bg-[rgba(11,74,61,0.25)] text-[#0B4A3D] border border-[#0B4A3D]'
};

export default function ClientExportDropdown({
  clients = [],
  columns = [],
  filename = 'clients',
  variant = 'light',
  disabled = false,
  buttonLabel = 'Export',
  noun = 'clients'
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toast = useToast();
  const { triggerRef, menuRef } = useFloatingMenu({ open });

  useClickOutside([ref, menuRef], () => setOpen(false), open);

  const handleExport = async (format) => {
    setOpen(false);
    if (!clients || clients.length === 0) {
      toast.error('No data available to export');
      return;
    }
    const config = getClientExportFormat(format);
    try {
      await exportClientData(format, clients, columns, filename);
      toast.success(
        format === 'print'
          ? 'Opening printable report...'
          : `Exported ${clients.length} client(s) as ${config?.label || format}`
      );
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
  };

  return (
    <div
      className="relative"
      ref={(node) => {
        ref.current = node;
        triggerRef.current = node;
      }}
    >
      <button
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg transition-colors cursor-pointer select-none ${VARIANTS[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span>{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="w-56 bg-surface border border-slate-200 rounded-xl shadow-lg py-1 animate-in fade-in zoom-in-95"
          >
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export ({clients.length} {noun})</div>
          </div>
          {CLIENT_EXPORT_FORMATS.map((item) => {
            const Icon = FORMAT_ICONS[item.key];
            return (
              <button
                key={item.key}
                onClick={() => handleExport(item.key)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="flex-1">
                  <span className="block text-xs font-semibold text-slate-700">{item.label}</span>
                  <span className="block text-[10px] text-slate-400 font-normal">{item.hint}</span>
                </span>
              </button>
            );
          })}
          </div>,
          document.body
        )}
    </div>
  );
}
