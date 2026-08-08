import { FileDown, Printer, X } from 'lucide-react';
import { Modal, useToast } from '../Common';
import { cprDocument } from '../../utils/cprHelpers';
import { buildCprPrintHtml, exportCprDocumentPdf } from '../../utils/cprExportUtils';
import { formatDate, formatINR } from '../../utils/leadHelpers';

function InfoRow({ label, value }) {
  return (
    <div className="flex text-xs py-1">
      <span className="w-32 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-700 font-medium">{value || '—'}</span>
    </div>
  );
}

export default function CprPreviewModal({ cpr, open, onClose }) {
  const toast = useToast();
  if (!cpr) return null;
  const d = cprDocument(cpr);
  const totalQty = d.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

  const handlePdf = async () => {
    try {
      await exportCprDocumentPdf(cpr, `${cpr.prNo || 'cpr'}-${new Date().toISOString().slice(0, 10)}`);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err?.message || 'PDF export failed');
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.');
      return;
    }
    win.document.open();
    win.document.write(buildCprPrintHtml(cpr, 'Purchase Request'));
    win.document.close();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview - ${cpr.prNo || ''}`}
      footer={
        <>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={handlePdf}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" /> Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </>
      }
    >
      <div className="max-h-[65vh] overflow-y-auto pr-1">
        <div className="border border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-extrabold text-[#0B4A3D]">VISHAK TECH</div>
              <div className="text-xs text-slate-400 mt-0.5">Purchase Request</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-800">{cpr.prNo}</div>
              <div className="text-[11px] text-slate-400">{formatDate(cpr.prDate || cpr.createdAt)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bill To</div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-800">{cpr.client || cpr.clientName || '—'}</div>
                {cpr.company && <div>{cpr.company}</div>}
                {cpr.contactPerson && <div>{cpr.contactPerson}</div>}
                {cpr.phone && <div>{cpr.phone}</div>}
                {cpr.email && <div>{cpr.email}</div>}
                {cpr.gst && <div>GST: {cpr.gst}</div>}
                {cpr.billingAddress && <div>{cpr.billingAddress}</div>}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Details</div>
              <InfoRow label="Department" value={cpr.department} />
              <InfoRow label="Requested By" value={cpr.requestedBy || cpr.createdBy} />
              <InfoRow label="Required Date" value={formatDate(cpr.requiredDate)} />
              <InfoRow label="Priority" value={cpr.priority} />
              <InfoRow label="Lead No" value={cpr.leadNo} />
              <InfoRow label="Project" value={cpr.project} />
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Items ({d.items.length})
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                <thead>
                  <tr className="bg-[#0B4A3D] text-white">
                    {['#', 'Drawing No', 'Description', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-2 py-1.5 text-xs">{it.drawingNo || '—'}</td>
                      <td className="px-2 py-1.5 text-xs font-medium">{it.description || '—'}</td>
                      <td className="px-2 py-1.5 text-xs">{it.qty ?? '—'}</td>
                      <td className="px-2 py-1.5 text-xs">{it.unit || '—'}</td>
                      <td className="px-2 py-1.5 text-xs">{formatINR(Number(it.estimatedCost) || 0)}</td>
                      <td className="px-2 py-1.5 text-xs font-semibold">
                        {formatINR((Number(it.qty) || 0) * (Number(it.estimatedCost) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={6} className="px-2 py-2 text-xs font-bold text-[#0B4A3D]">
                      Total ({totalQty} qty)
                    </td>
                    <td className="px-2 py-2 text-xs font-extrabold text-[#0B4A3D]">{formatINR(d.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {cpr.remarks && (
            <div className="mt-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</div>
              <div className="text-xs text-slate-600 whitespace-pre-wrap">{cpr.remarks}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
