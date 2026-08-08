import api from '../api/axiosInstance';
import {
  normalizeLead,
  serializeLead,
  leadToLeadRequest,
  applyFollowUpMeta,
  mapStageToBackend
} from '../utils/leadHelpers';
import { readMeta } from '../utils/leadMeta';
import { todayISO } from '../utils/leadHelpers';

export function normalizeApiError(error) {
  if (error.response) {
    const serverMessage =
      error.response.data?.message ||
      error.response.data?.error ||
      error.response.data?.detail ||
      `Request failed with status ${error.response.status}`;
    return {
      message: serverMessage,
      status: error.response.status,
      data: error.response.data
    };
  }
  if (error.request) {
    return {
      message: 'Unable to reach the server. Please check your network connection.',
      status: null,
      data: null
    };
  }
  return {
    message: error.message || 'An unexpected error occurred.',
    status: null,
    data: null
  };
}

async function request(executor) {
  try {
    return await executor();
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/* ------------------------------------------------------------------
 * Legacy-enum resilience.
 *
 * The current backend stores status/stage as @Enumerated(STRING) but the
 * leads table still contains rows written by an older CRM that used enum
 * values the backend no longer knows (status 'DELETED', stage 'HIGH' /
 * 'MEDIUM' / 'LOW'...). Hibernate cannot deserialize those rows, so ANY
 * query whose result page contains one of them returns HTTP 500
 * ("No enum constant ..."). The backend cannot be changed, so the
 * frontend never asks it to read such a row: it queries each valid
 * (stage x status) pair separately (every such segment is guaranteed
 * clean) and merges the segments client-side.
 * ------------------------------------------------------------------ */
export const VALID_STAGES = ['HOT', 'WARM', 'COLD', 'NEW', 'QUALIFIED', 'NEGOTIATION', 'WON', 'LOST'];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED'];

/** Stages a scoped endpoint can actually return (mirrors backend scopePredicate). */
const ENDPOINT_STAGES = {
  leads: VALID_STAGES,
  contacts: VALID_STAGES,
  clients: ['WON'],
  followups: ['HOT', 'WARM', 'COLD', 'NEW', 'QUALIFIED', 'NEGOTIATION']
};

/** True when a request failed because the DB row carries a legacy enum string. */
export function isEnumCrash(error) {
  const message = String(
    error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      ''
  );
  return error?.response?.status === 500 && message.includes('No enum constant');
}

function sortMerged(rows, sortParam) {
  const [rawKey, rawDir] = String(sortParam || 'createdAt,desc').split(',');
  const asc = rawDir === 'asc';
  const key = rawKey === 'date' ? 'createdAt' : rawKey === 'number' ? 'id' : rawKey;
  const getValue = (row) => {
    const value = row == null ? undefined : row[key];
    if (value == null) return '';
    return typeof value === 'string' ? value.toLowerCase() : value;
  };
  return [...rows].sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

/**
 * Fetch a page of lead-shaped rows from a scoped endpoint without ever
 * asking the backend to deserialize legacy enum rows. Fetches one query
 * per valid (stage x status) pair (each is guaranteed clean), merges the
 * segments, sorts and paginates client-side, and returns a Spring Page
 * shaped object so existing parsePageResponse/UI code keeps working.
 */
export async function fetchSegmentedPage(endpoint, params = {}) {
  const page = Math.max(0, Number(params.page) || 0);
  const size = Math.min(Math.max(Number(params.size) || 10, 1), 200);
  const stages = ENDPOINT_STAGES[endpoint] || VALID_STAGES;
  const requestedStage = params.stage ? String(params.stage).toUpperCase() : null;
  const requestedStatus = params.status ? String(params.status).toUpperCase() : null;
  const stageList = requestedStage ? stages.filter((s) => s === requestedStage) : stages;
  // Soft-deleted leads are only fetched when explicitly requested (the
  // Deleted tab); default views never include the DELETED segment.
  const statusList = requestedStatus
    ? VALID_STATUSES.filter((s) => s === requestedStatus)
    : VALID_STATUSES.filter((s) => s !== 'DELETED');

  const base = { ...params };
  delete base.page;
  delete base.size;
  delete base.stage;
  delete base.status;

  const settled = await Promise.allSettled(
    stageList.flatMap((stage) =>
      statusList.map((status) =>
        api
          .get(`/${endpoint}`, { params: { ...base, page: 0, size: 200, stage, status } })
          .then((res) => res.data)
      )
    )
  );

  let content = [];
  let total = 0;
  settled.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      const rows = result.value?.content ?? (Array.isArray(result.value) ? result.value : []);
      content.push(...rows);
      total += Number(result.value?.totalElements ?? rows.length);
    }
  });

  // Every segment failed for a real reason (network/auth) — surface the
  // failure instead of silently showing an empty page.
  if (settled.length > 0 && settled.every((result) => result.status === 'rejected')) {
    const first = settled.find((result) => result.status === 'rejected');
    throw first?.reason ?? new Error('Failed to load leads');
  }

  content = sortMerged(content, params.sort);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = page * size;
  const pageContent = content.slice(start, start + size);
  return {
    content: pageContent,
    totalElements: total,
    totalPages,
    number: page,
    size,
    numberOfElements: pageContent.length,
    first: page === 0,
    last: start + size >= total,
    empty: pageContent.length === 0,
    pageable: {
      pageNumber: page,
      pageSize: size,
      sort: { sorted: true, unsorted: false, empty: false },
      offset: start,
      paged: true,
      unpaged: false
    }
  };
}

/** Read a single lead record (unwraps ApiResponse). */
async function fetchLead(id) {
  const { data } = await api.get(`/leads/${id}`);
  return data?.data ?? data;
}

/** PUT the full lead payload back, preserving every field + meta patch. */
async function patchLead(id, extra) {
  const lead = await fetchLead(id);
  const res = await api.put(`/leads/${id}`, leadToLeadRequest(lead, extra));
  return res.data;
}

/** Persist the follow-up schedule on a lead via its meta blob. */
async function saveFollowUpMeta(leadId, patch, clear = false) {
  const lead = await fetchLead(leadId);
  const norm = normalizeLead(lead);
  // normalizeLead strips the meta blob for display; always write against the
  // RAW internalNotes so pre-existing meta keys (mode, remarks, outcome,
  // clientNo, etc.) survive the update.
  const internalNotes = applyFollowUpMeta(lead?.internalNotes ?? '', patch, clear);
  const res = await api.put(`/leads/${leadId}`, serializeLead({ ...norm, internalNotes }));
  return res.data;
}

/** Map a lead record into the follow-up item shape the CRM UI expects. */
function followUpFromLead(lead) {
  const meta = readMeta(lead?.internalNotes);
  const norm = normalizeLead(lead);
  return {
    id: lead.id,
    leadId: lead.id,
    leadNo: norm.leadNo || '',
    leadName: norm.name || '',
    leadCompany: norm.company || '',
    leadPhone: norm.phone || '',
    leadEmail: norm.email || '',
    leadStage: norm.stage || '',
    leadOwner: norm.owner || '',
    leadIndustry: norm.industry || '',
    leadCity: norm.city || '',
    leadValue: norm.value || 0,
    followUpDate: meta.followUpDate || '',
    followUpTime: meta.followUpTime || '',
    mode: meta.mode || 'Call',
    priority: meta.priority || 'Medium',
    assignedUser: meta.assignedUser || norm.owner || '',
    remarks: meta.remarks || '',
    status: meta.status || 'Pending',
    outcome: meta.outcome || '',
    discussion: meta.discussion || '',
    feedback: meta.feedback || '',
    requirement: meta.requirement || '',
    nextFollowUpDate: meta.nextFollowUpDate || '',
    reminder: meta.reminder || '',
    reminderType: meta.reminderType || '',
    attachments: Array.isArray(lead.attachments) ? lead.attachments : [],
    createdAt: lead.createdAt || ''
  };
}

/** Normalize the follow-up form payload into the meta patch shape. */
function followUpPatch(payload = {}) {
  const patch = {
    followUpDate: payload.followUpDate || undefined,
    followUpTime: payload.followUpTime || undefined,
    mode: payload.mode || undefined,
    priority: payload.priority || undefined,
    assignedUser: payload.assignedUser || payload.assignedTo || undefined,
    remarks: payload.remarks || payload.discussion || undefined,
    status: payload.status || 'Pending',
    outcome: payload.outcome || undefined,
    feedback: payload.feedback || undefined,
    requirement: payload.requirement || undefined,
    nextFollowUpDate: payload.nextFollowUpDate || undefined,
    reminder: payload.reminder || undefined,
    reminderType: payload.reminderType || undefined
  };
  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined || patch[key] === null || patch[key] === '') delete patch[key];
  });
  return patch;
}

const leadService = {
  async listLeads(params = {}) {
    return request(async () => {
      try {
        const { data } = await api.get('/leads', { params });
        return data;
      } catch (error) {
        if (isEnumCrash(error)) return fetchSegmentedPage('leads', params);
        throw error;
      }
    });
  },

  async listClients(params = {}) {
    return request(async () => {
      try {
        const { data } = await api.get('/clients', { params });
        return data;
      } catch (error) {
        if (isEnumCrash(error)) return fetchSegmentedPage('clients', params);
        throw error;
      }
    });
  },

  async getLead(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}`);
      return data;
    });
  },

  async getNextNumber() {
    return request(async () => {
      const { data } = await api.get('/leads/next-number');
      const body = data?.data ?? data;
      return { data: { leadNo: body?.leadNo ?? '' } };
    });
  },

  async createLead(payload) {
    return request(async () => {
      const { data } = await api.post('/leads', payload);
      return data;
    });
  },

  async updateLead(id, payload) {
    return request(async () => {
      const { data } = await api.put(`/leads/${id}`, payload);
      return data;
    });
  },

  async deleteLead(id) {
    return request(async () => {
      const { data } = await api.delete(`/leads/${id}`);
      return data;
    });
  },

  // The backend has no permanent-delete endpoint — DELETE is a soft delete
  // (status DELETED, row + relationships preserved), so this is the same
  // operation as deleteLead; the label is kept for UI compatibility.
  async deleteLeadPermanent(id) {
    return request(async () => {
      const { data } = await api.delete(`/leads/${id}`);
      return data;
    });
  },

  async archiveLead(id) {
    return request(async () => {
      const { data } = await api.patch(`/leads/archive/${id}`);
      return data;
    });
  },

  async restoreLead(id) {
    return request(async () => {
      const { data } = await api.patch(`/leads/restore/${id}`);
      return data;
    });
  },

  async markInactive(id) {
    return request(async () => {
      const { data } = await api.patch(`/leads/inactive/${id}`);
      return data;
    });
  },

  async markActive(id) {
    return request(async () => {
      const { data } = await api.patch(`/leads/active/${id}`);
      return data;
    });
  },

  async listCrm(endpoint, params = {}) {
    return request(async () => {
      try {
        const { data } = await api.get(`/${endpoint}`, { params });
        return data;
      } catch (error) {
        if (isEnumCrash(error)) return fetchSegmentedPage(endpoint, params);
        throw error;
      }
    });
  },

  async bulkDelete(ids) {
    return request(async () => {
      const { data } = await api.post('/leads/bulk-delete', { ids });
      return data;
    });
  },

  async bulkDeletePermanent(ids) {
    // Same soft-delete endpoint as bulkDelete — the backend never issues a
    // physical DELETE, so lead relationships (follow-ups, history, CPR)
    // are always preserved.
    return request(async () => {
      const { data } = await api.post('/leads/bulk-delete', { ids });
      return data;
    });
  },

  async bulkArchive(ids) {
    return request(async () => {
      const { data } = await api.post('/leads/bulk-archive', { ids });
      return data;
    });
  },

  async bulkRestore(ids) {
    return request(async () => {
      const { data } = await api.post('/leads/bulk-restore', { ids });
      return data;
    });
  },

  async assignOwner(id, owner) {
    return request(async () => {
      const { data } = await api.patch(`/leads/${id}/owner`, { owner });
      return data;
    });
  },

  async changeStage(id, stage) {
    return request(async () => {
      const { data } = await api.patch(`/leads/${id}/stage`, { stage: mapStageToBackend(stage) });
      return data;
    });
  },

  // Persisted through the lead meta blob (the backend has no priority field).
  async changePriority(id, priority) {
    return request(async () => patchLead(id, { priority }));
  },

  async exportLeads(payload = {}, options = {}) {
    return request(async () => {
      const { data } = await api.post('/leads/export', payload, options);
      return data;
    });
  },

  async importLeads(formData) {
    return request(async () => {
      const { data } = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    });
  },

  async duplicateLead(id) {
    return request(async () => {
      const { data } = await api.post(`/leads/${id}/duplicate`);
      return data;
    });
  },

  async getTimeline(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}/timeline`);
      return data;
    });
  },

  async getActivities(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}/activities`);
      return data;
    });
  },

  async getNotes(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}/notes`);
      return data;
    });
  },

  async addNote(id, payload) {
    return request(async () => {
      const { data } = await api.post(`/leads/${id}/notes`, payload);
      return data;
    });
  },

  async getAttachments(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}/attachments`);
      return data;
    });
  },

  async addAttachment(id, formData) {
    return request(async () => {
      const { data } = await api.post(`/leads/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    });
  },

  async getHistory(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}/history`);
      return data;
    });
  },

  // In the unified model a lead carries at most one current schedule in its
  // meta blob, so this returns the lead itself shaped as a follow-up row.
  async getLeadFollowUps(id) {
    return request(async () => {
      const lead = await fetchLead(id);
      const meta = readMeta(lead?.internalNotes);
      if (!meta.followUpDate) return { data: [] };
      return { data: [followUpFromLead(lead)] };
    });
  },

  async addFollowUp(id, payload) {
    return request(async () => saveFollowUpMeta(id, followUpPatch(payload)));
  },

  // The followUpId argument is kept for API-shape compatibility; in the
  // unified model the follow-up record IS the lead, so the lead id is used.
  async updateFollowUp(id, followUpId, payload) {
    void followUpId;
    return request(async () => saveFollowUpMeta(id, followUpPatch(payload)));
  },

  async completeFollowUp(id, followUpId) {
    void followUpId;
    return request(async () => saveFollowUpMeta(id, { status: 'Completed' }));
  },

  async cancelFollowUp(id, followUpId) {
    void followUpId;
    return request(async () => saveFollowUpMeta(id, { status: 'Cancelled' }));
  },

  // Removes the schedule meta; the underlying lead record stays intact.
  async deleteFollowUp(id, followUpId) {
    void followUpId;
    return request(async () => saveFollowUpMeta(id, {}, true));
  },

  async getFollowUpSummary() {
    return request(async () => {
      let rows;
      let total;
      try {
        const { data } = await api.get('/followups', { params: { page: 0, size: 200 } });
        rows = data?.content ?? [];
        total = Number(data?.totalElements ?? rows.length);
      } catch (error) {
        if (!isEnumCrash(error)) throw error;
        const page = await fetchSegmentedPage('followups', { page: 0, size: 200 });
        rows = page?.content ?? [];
        total = Number(page?.totalElements ?? rows.length);
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let todayCount = 0;
      let overdue = 0;
      let upcoming = 0;
      let draft = 0;
      let pending = 0;
      let completed = 0;
      let cancelled = 0;
      let highPriority = 0;
      rows.forEach((lead) => {
        const meta = readMeta(lead?.internalNotes);
        const status = meta.status || 'Pending';
        if (status === 'Completed') completed += 1;
        if (status === 'Cancelled') cancelled += 1;
        if (status === 'Draft') draft += 1;
        if (status === 'Pending') pending += 1;
        if (String(meta.priority || '').toLowerCase() === 'high') highPriority += 1;
        if (!meta.followUpDate) return;
        const d = new Date(`${meta.followUpDate}T00:00:00`);
        if (Number.isNaN(d.getTime())) return;
        if (status === 'Completed' || status === 'Cancelled') return;
        const diff = Math.round((d - today) / 86400000);
        if (diff < 0) overdue += 1;
        else if (diff === 0) todayCount += 1;
        else upcoming += 1;
      });
      return {
        data: {
          total,
          today: todayCount,
          overdue,
          upcoming,
          missed: overdue,
          draft,
          pending,
          completed,
          cancelled,
          archived: 0,
          highPriority
        }
      };
    });
  },

  async getLeadSummary() {
    return request(async () => {
      // Fetch ONE segmented page of all readable leads and derive every
      // count from it. The backend can COUNT legacy rows it cannot
      // serialize back, so a raw count() would overstate what the table
      // can show; deriving from the same segmented page keeps the KPI
      // cards consistent with the rows the user can actually open.
      const page = await fetchSegmentedPage('leads', { page: 0, size: 200 });
      const rows = (page?.content ?? []).map(normalizeLead);
      const total = Number(page?.totalElements ?? rows.length);
      const countBy = (predicate) => rows.filter(predicate).length;
      let deleted;
      try {
        const deletedPage = await fetchSegmentedPage('leads', { page: 0, size: 200, status: 'DELETED' });
        deleted = Number(deletedPage?.totalElements ?? (deletedPage?.content ?? []).length);
      } catch {
        deleted = 0;
      }
      let followUpsToday;
      try {
        const summary = await leadService.getFollowUpSummary();
        followUpsToday = Number((summary?.data ?? summary)?.today ?? 0);
      } catch {
        followUpsToday = 0;
      }
      return {
        data: {
          total,
          active: countBy((lead) => String(lead.status || '').toUpperCase() === 'ACTIVE'),
          archived: countBy((lead) => String(lead.status || '').toUpperCase() === 'ARCHIVED'),
          deleted,
          newLeads: countBy((lead) => lead.stage === 'New'),
          qualified: countBy((lead) => lead.stage === 'Qualified'),
          negotiation: countBy((lead) => lead.stage === 'Negotiation'),
          won: countBy((lead) => lead.stage === 'Won'),
          lost: countBy((lead) => lead.stage === 'Lost'),
          followUpsToday
        }
      };
    });
  },

  // The backend has no convert-to-cpr endpoint; create a draft CPR with the
  // lead's data prefilled (items can be added afterwards in the CPR form).
  async convertToCpr(leadId) {
    return request(async () => {
      const lead = await fetchLead(leadId);
      const norm = normalizeLead(lead);
      const cprPayload = {
        prDate: todayISO(),
        priority: String(norm.priority || 'medium').toUpperCase(),
        status: 'draft',
        sourceLead: norm.name,
        clientName: norm.name,
        contactPerson: norm.name,
        phone: norm.phone,
        email: norm.email,
        company: norm.company,
        gst: norm.taxId,
        project: norm.project,
        leadNo: norm.leadNo,
        pan: norm.pan,
        billingAddress: norm.address,
        shippingAddress: norm.address,
        remarks: '',
        description: norm.description,
        items: []
      };
      const { data } = await api.post('/cprs', cprPayload, { params: { draft: true } });
      return data;
    });
  },

  async getCpr(id) {
    return request(async () => {
      const { data } = await api.get(`/cprs/${id}`);
      return data;
    });
  },

  async listCprs(params = {}) {
    return request(async () => {
      const { data } = await api.get('/cprs', { params });
      return data;
    });
  },

  async updateCpr(id, payload) {
    return request(async () => {
      const { data } = await api.put(`/cprs/${id}`, payload);
      return data;
    });
  },

  async deleteCpr(id) {
    return request(async () => {
      const { data } = await api.delete(`/cprs/${id}`);
      return data;
    });
  },

  async getUsers() {
    return request(async () => {
      const { data } = await api.get('/users');
      return data;
    });
  }
};

export default leadService;
