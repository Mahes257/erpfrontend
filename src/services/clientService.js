import api from '../api/axiosInstance';
import { isEnumCrash, fetchSegmentedPage } from './leadService';
import { clientToLeadPayload } from '../utils/clientHelpers';
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

/** Read a single lead record (unwraps ApiResponse). */
async function fetchLead(id) {
  const { data } = await api.get(`/leads/${id}`);
  return data?.data ?? data;
}

const clientService = {
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

  // Next client number from the existing auto_number_sequences infrastructure
  // (module CLIENT, prefix C-) — the backend advances the sequence on
  // allocation, so each call yields a fresh, never-reused number.
  async getNextNumber() {
    return request(async () => {
      const { data } = await api.get('/clients/next-number');
      return data?.data ?? data;
    });
  },

  // Uniqueness check: is this client number already used by another client?
  // Client numbers live in the internalNotes meta blob, so the existing
  // clients list is scanned for a matching C-xxxxxx number.
  async clientNoExists(number, excludeId) {
    return request(async () => {
      const target = String(number || '').trim().toLowerCase();
      if (!target) return false;
      // A single wide page covers the current dataset (~55 leads). If the
      // client count ever exceeds 500, this would need to page through all
      // clients to keep the duplicate check exhaustive.
      const { data } = await api.get('/clients', { params: { page: 0, size: 500 } });
      const rows = data?.content ?? [];
      return rows.some((row) => {
        if (row.id === excludeId) return false;
        const meta = readMeta(row.internalNotes);
        const candidate = String(meta.clientNo || row.clientNo || row.clientNumber || '').trim().toLowerCase();
        return candidate === target;
      });
    });
  },

  // The target backend has no clients summary endpoint; derive the KPI
  // numbers client-side from the scoped clients list.
  async getSummary() {
    return request(async () => {
      let rows;
      let total;
      try {
        const { data } = await api.get('/clients', { params: { page: 0, size: 200 } });
        rows = data?.content ?? [];
        total = Number(data?.totalElements ?? rows.length);
      } catch (error) {
        if (!isEnumCrash(error)) throw error;
        const page = await fetchSegmentedPage('clients', { page: 0, size: 200 });
        rows = page?.content ?? [];
        total = Number(page?.totalElements ?? rows.length);
      }
      let active = 0;
      let inactive = 0;
      let archived = 0;
      rows.forEach((row) => {
        const status = String(row.status || '').toUpperCase();
        if (status === 'INACTIVE') inactive += 1;
        else if (status === 'ARCHIVED') archived += 1;
        else active += 1;
      });
      // Soft-deleted clients are excluded from the base query, so count them
      // with a dedicated DELETED segment fetch.
      let deleted;
      try {
        const delRes = await api.get('/clients', { params: { page: 0, size: 200, status: 'DELETED' } });
        deleted = Number(delRes.data?.totalElements ?? delRes.data?.content?.length ?? 0);
      } catch (error) {
        if (!isEnumCrash(error)) throw error;
        const page = await fetchSegmentedPage('clients', { page: 0, size: 200, status: 'DELETED' });
        deleted = Number(page?.totalElements ?? page?.content?.length ?? 0);
      }
      const portfolioValue = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
      return { data: { total, active, inactive, archived, deleted, portfolioValue } };
    });
  },

  // Clients are modelled as leads (stage WON) in the target backend.
  async getClient(id) {
    return request(async () => {
      const { data } = await api.get(`/leads/${id}`);
      return data;
    });
  },

  async createClient(payload) {
    return request(async () => {
      const { data } = await api.post('/leads', clientToLeadPayload(payload));
      return data;
    });
  },

  // PUT is a full replacement on the backend, so fetch the existing lead
  // and merge the client form payload into it — otherwise lead fields the
  // client form does not edit (leadSource, secondary contacts, landmark,
  // expectedCloseDate, priority...) would be wiped on every client update.
  async updateClient(id, payload) {
    return request(async () => {
      const lead = await fetchLead(id);
      const full = clientToLeadPayload(payload);
      const { data } = await api.put(`/leads/${id}`, {
        ...lead,
        ...full,
        internalNotes: full.internalNotes
      });
      return data;
    });
  },

  async deleteClient(id) {
    return request(async () => {
      const { data } = await api.delete(`/leads/${id}`);
      return data;
    });
  },

  // No permanent-delete endpoint on the target backend; the leads DELETE is a
  // SOFT delete (status DELETED), so 'permanent' maps to the same safe flow.
  async deleteClientPermanent(id) {
    return request(async () => {
      const { data } = await api.delete(`/leads/${id}`);
      return data;
    });
  },

  async archiveClient(id) {
    return request(async () => {
      const { data } = await api.patch(`/leads/archive/${id}`);
      return data;
    });
  },

  async restoreClient(id) {
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

  async bulkDelete(ids) {
    return request(async () => {
      const { data } = await api.post('/leads/bulk-delete', { ids });
      return data;
    });
  },

  async bulkDeletePermanent(ids) {
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

  async bulkAssignOwner(ids, owner) {
    return request(async () => {
      const results = await Promise.all(ids.map((id) => api.patch(`/leads/${id}/owner`, { owner })));
      return { data: results.map((res) => res.data) };
    });
  },

  async bulkChangeStatus(ids, status) {
    return request(async () => {
      const s = String(status || '').toLowerCase();
      if (s === 'active') {
        await Promise.all(ids.map((id) => api.patch(`/leads/active/${id}`)));
      } else if (s === 'inactive') {
        await Promise.all(ids.map((id) => api.patch(`/leads/inactive/${id}`)));
      } else if (s === 'archived') {
        await Promise.all(ids.map((id) => api.patch(`/leads/archive/${id}`)));
      } else {
        await Promise.all(ids.map((id) => api.delete(`/leads/${id}`)));
      }
      return { data: { updated: ids.length } };
    });
  },

  async exportClients(payload = {}, options = {}) {
    return request(async () => {
      const { data } = await api.post('/leads/export', payload, options);
      return data;
    });
  },

  async importClients(formData) {
    return request(async () => {
      const { data } = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
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

export default clientService;
