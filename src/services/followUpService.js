import api from '../api/axiosInstance';
import { isEnumCrash, fetchSegmentedPage } from './leadService';
import { normalizeLead, serializeLead, applyFollowUpMeta } from '../utils/leadHelpers';
import { readMeta } from '../utils/leadMeta';

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

/** Normalize the follow-up form payload into the lead meta patch shape. */
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

/** Read a single lead record (unwraps ApiResponse). */
async function fetchLead(id) {
  const { data } = await api.get(`/leads/${id}`);
  return data?.data ?? data;
}

/** Persist the follow-up schedule on a lead via its meta blob. */
async function saveFollowUpMeta(leadId, patch, clear = false) {
  const lead = await fetchLead(leadId);
  const norm = normalizeLead(lead);
  // normalizeLead strips the meta blob for display; always write against the
  // RAW internalNotes so pre-existing meta keys (mode, remarks, outcome,
  // clientNo, etc.) survive the update.
  const internalNotes = applyFollowUpMeta(lead?.internalNotes ?? '', patch, clear);
  const { data } = await api.put(`/leads/${leadId}`, serializeLead({ ...norm, internalNotes }));
  return data;
}

const followUpService = {
  async listFollowUps(params = {}) {
    return request(async () => {
      try {
        const { data } = await api.get('/followups', { params });
        return data;
      } catch (error) {
        if (isEnumCrash(error)) return fetchSegmentedPage('followups', params);
        throw error;
      }
    });
  },

  // Follow-ups are modelled as open leads in the target backend.
  async getFollowUp(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}`);
      return data;
    });
  },

  async getLead(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}`);
      return data;
    });
  },

  async getFollowUpAttachments(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}/attachments`);
      return data;
    });
  },

  async uploadFollowUpAttachment(id, file) {
    return request(async () => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/leads/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    });
  },

  // The target backend exposes no attachment-delete endpoint; resolve so the
  // attachment is removed from local UI state only.
  async deleteFollowUpAttachment(id, attachmentId) {
    return request(async () => {
      await Promise.resolve();
      return { data: { id: attachmentId, deleted: true } };
    });
  },

  // A follow-up is stored on the linked lead itself (schedule in meta blob).
  async createFollowUp(payload) {
    return request(async () => {
      const leadId = payload?.leadId;
      if (!leadId) throw { message: 'A lead must be selected', status: 400, data: null };
      const data = await saveFollowUpMeta(leadId, followUpPatch(payload));
      return { data };
    });
  },

  async updateFollowUp(id, payload) {
    return request(async () => {
      const data = await saveFollowUpMeta(id, followUpPatch(payload));
      return { data };
    });
  },

  // Follow-ups are WON/LOST leads, so 'delete' uses the lead soft-delete
  // (status DELETED) — no physical DELETE, no FK errors, fully restorable.
  async deleteFollowUp(id) {
    return request(async () => {
      const { data } = await api.delete(`/leads/${id}`);
      return data;
    });
  },

  async restoreFollowUp(id) {
    return request(async () => {
      const { data } = await api.patch(`/leads/restore/${id}`);
      return data;
    });
  },

  async completeFollowUp(id) {
    return request(async () => {
      const data = await saveFollowUpMeta(id, { status: 'Completed' });
      return { data };
    });
  },

  async cancelFollowUp(id) {
    return request(async () => {
      const data = await saveFollowUpMeta(id, { status: 'Cancelled' });
      return { data };
    });
  },

  async archiveFollowUp(id) {
    return request(async () => {
      const { data } = await api.patch(`/leads/archive/${id}`);
      return data;
    });
  },

  async assignOwner(id, owner) {
    return request(async () => {
      const { data } = await api.patch(`/leads/${id}/owner`, { owner });
      return data;
    });
  },

  async reschedule(id, payload) {
    return request(async () => {
      const data = await saveFollowUpMeta(id, followUpPatch(payload));
      return { data };
    });
  },

  async bulkComplete(ids) {
    return request(async () => {
      const results = await Promise.all(ids.map((id) => saveFollowUpMeta(id, { status: 'Completed' })));
      return { data: { updated: results.length } };
    });
  },

  async bulkCancel(ids) {
    return request(async () => {
      const results = await Promise.all(ids.map((id) => saveFollowUpMeta(id, { status: 'Cancelled' })));
      return { data: { updated: results.length } };
    });
  },

  async bulkDelete(ids) {
    return request(async () => {
      const { data } = await api.post('/leads/bulk-delete', { ids });
      return data;
    });
  },

  // No followups summary endpoint on the target backend; compute client-side
  // from the scoped open-leads list.
  async getSummary() {
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
      let archived = 0;
      rows.forEach((lead) => {
        if (String(lead.status || '').toUpperCase() === 'ARCHIVED') archived += 1;
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
      // Soft-deleted leads are excluded from the base query; count them with a
      // dedicated DELETED segment fetch.
      let deleted;
      try {
        const delRes = await api.get('/followups', { params: { page: 0, size: 200, status: 'DELETED' } });
        deleted = Number(delRes.data?.totalElements ?? delRes.data?.content?.length ?? 0);
      } catch (error) {
        if (!isEnumCrash(error)) throw error;
        const page = await fetchSegmentedPage('followups', { page: 0, size: 200, status: 'DELETED' });
        deleted = Number(page?.totalElements ?? page?.content?.length ?? 0);
      }
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
          archived,
          deleted,
          highPriority
        }
      };
    });
  },

  async searchLeads(params = {}) {
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

  async getUsers() {
    return request(async () => {
      const { data } = await api.get('/users');
      return data;
    });
  }
};

export default followUpService;
