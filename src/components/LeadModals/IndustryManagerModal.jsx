import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Modal, ConfirmDialog, useToast } from '../Common';
import industryService from '../../services/industryService';

export default function IndustryManagerModal({ open, onClose, onRefresh, onAdded }) {
  const toast = useToast();
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const addInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await industryService.listIndustries();
      setIndustries(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load industries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSearch('');
      setAddName('');
      setEditingId(null);
      try {
        const list = await industryService.listIndustries();
        if (!cancelled) setIndustries(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Failed to load industries');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    setTimeout(() => addInputRef.current?.focus(), 60);
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const refresh = () => {
    load();
    onRefresh?.();
  };

  const handleAdd = async () => {
    const name = addName.trim().replace(/\s+/g, ' ');
    if (!name || adding) return;
    setAdding(true);
    try {
      const created = await industryService.createIndustry(name);
      toast.success(`Industry "${created?.name || name}" added`);
      setAddName('');
      refresh();
      onAdded?.(created?.name || name);
    } catch (err) {
      toast.error(err?.message || 'Failed to add industry');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (industry) => {
    setEditingId(industry.id);
    setEditName(industry.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleRename = async (id) => {
    const name = editName.trim().replace(/\s+/g, ' ');
    if (!name || savingId) return;
    setSavingId(id);
    try {
      const updated = await industryService.renameIndustry(id, name);
      toast.success(`Industry renamed to "${updated?.name || name}"`);
      cancelEdit();
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Failed to rename industry');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSavingId(deleting.id);
    try {
      await industryService.deleteIndustry(deleting.id);
      toast.success(`Industry "${deleting.name}" deleted`);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete industry');
    } finally {
      setSavingId(null);
    }
  };

  const filtered = industries.filter((industry) =>
    String(industry.name || '').toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Manage Industries"
        maxWidth="max-w-lg"
        footer={
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search industries..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-blue-500/60 focus:bg-surface"
              />
            </div>
          </div>

          <div className="flex items-end gap-2.5">
            <label className="flex-1 block">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                New Industry
              </span>
              <input
                ref={addInputRef}
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Enter industry name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-blue-500/60 focus:bg-surface"
              />
            </label>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!addName.trim() || adding}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-3 py-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Industries</span>
              <span className="text-[11px] font-semibold text-slate-400">{filtered.length}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs font-semibold text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs font-semibold text-slate-400">
                  {search ? 'No industries match your search' : 'No industries yet'}
                </p>
              </div>
            ) : (
              <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {filtered.map((industry) => {
                  const isEditing = editingId === industry.id;
                  const isSaving = savingId === industry.id;
                  return (
                    <li key={industry.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors">
                      {isEditing ? (
                        <>
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRename(industry.id);
                              }
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500/60"
                          />
                          <button
                            type="button"
                            onClick={() => handleRename(industry.id)}
                            disabled={!editName.trim() || isSaving}
                            aria-label="Save"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            aria-label="Cancel"
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-xs font-medium text-slate-700 truncate">{industry.name}</span>
                          <button
                            type="button"
                            onClick={() => startEdit(industry)}
                            aria-label={`Edit ${industry.name}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(industry)}
                            aria-label={`Delete ${industry.name}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={savingId !== null}
        title="Delete Industry?"
        message={`Delete "${deleting?.name || ''}"? Leads currently using this industry will have it cleared.`}
        confirmLabel="Delete"
        icon={Trash2}
      />
    </>
  );
}
