import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import useClickOutside from '../../hooks/useClickOutside';
import useFloatingMenu from '../../hooks/useFloatingMenu';
import { useToast } from '../Common';
import { FOLLOWUP_EXPORT_FORMATS, exportFollowUpData, getFollowUpExportFormat } from '../../utils/followUpExport';

const FORMAT_ICONS = {
  'pdf-summary': FileText,
  'pdf-detailed': FileText,
  excel: FileSpreadsheet,
  csv: FileDown,
  print: Printer
};

const VARIANTS = {
  light: 'bg-surface border border-slate-200 text-slate-600 hover:bg-slate-50',
  dark: 'bg-[#334155] hover:bg-[#475569] text-white border border-[#475569]'
};

export default function FollowUpExportDropdown({
  followUps = [],
  columns = [],
  filename = 'followups',
  variant = 'light',
  disabled = false,
  buttonLabel = 'Export',
  noun = 'follow-ups'
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toast = useToast();
  const { triggerRef, menuRef } = useFloatingMenu({ open });

  useClickOutside([ref, menuRef], () => setOpen(false), open);

  const handleExport = async (format) => {
    setOpen(false);
    if (!followUps || followUps.length === 0) {
      toast.error('No data available to export');
      return;
    }
    const config = getFollowUpExportFormat(format);
    try {
      await exportFollowUpData(format, followUps, columns, filename);
      toast.success(
        format === 'print'
          ? 'Opening printable report...'
          : `Exported ${followUps.length} follow-up(s) as ${config?.label || format}`
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
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-lg transition-colors cursor-pointer select-none ${VARIANTS[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
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
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export ({followUps.length} {noun})</div>
          </div>
          {FOLLOWUP_EXPORT_FORMATS.map((item) => {
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
