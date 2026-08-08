import api from '../api/axiosInstance';
import { normalizeApiError } from './cprService';

async function request(executor) {
  try {
    return await executor();
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * Builds a CRUD + workflow REST service for a sales module backed by
 * /v1/{resource}. Mirrors cprService's call shapes (ApiResponse wrapping).
 */
export default function createSalesService(resource) {
  const base = `/${resource}`;
  return {
    async list(params = {}) {
      return request(async () => {
        const { data } = await api.get(base, { params });
        return data;
      });
    },

    async get(id) {
      return request(async () => {
        const { data } = await api.get(`${base}/${id}`);
        return data;
      });
    },

    async create(payload, draft = false) {
      return request(async () => {
        const { data } = await api.post(base, payload, { params: draft ? { draft: true } : {} });
        return data;
      });
    },

    async update(id, payload) {
      return request(async () => {
        const { data } = await api.put(`${base}/${id}`, payload);
        return data;
      });
    },

    async delete(id) {
      return request(async () => {
        const { data } = await api.delete(`${base}/${id}`);
        return data;
      });
    },

    async archive(id) {
      return request(async () => {
        const { data } = await api.patch(`${base}/archive/${id}`);
        return data;
      });
    },

    async restore(id) {
      return request(async () => {
        const { data } = await api.patch(`${base}/restore/${id}`);
        return data;
      });
    },

    async changeStatus(id, status, remarks) {
      return request(async () => {
        const { data } = await api.post(`${base}/${id}/status`, { status, remarks });
        return data;
      });
    },

    async duplicate(id) {
      return request(async () => {
        const { data } = await api.post(`${base}/${id}/duplicate`);
        return data;
      });
    },

    async approve(id) {
      return request(async () => {
        const { data } = await api.post(`${base}/${id}/approve`);
        return data;
      });
    },

    async getNextNumber() {
      return request(async () => {
        const { data } = await api.get(`${base}/next-number`);
        return data;
      });
    },

    async getStats() {
      return request(async () => {
        const { data } = await api.get(`${base}/stats`);
        return data;
      });
    },

    async bulkDelete(ids) {
      return request(async () => {
        const { data } = await api.post(`${base}/bulk-delete`, { ids });
        return data;
      });
    },

    async bulkArchive(ids) {
      return request(async () => {
        const { data } = await api.post(`${base}/bulk-archive`, { ids });
        return data;
      });
    },

    async bulkRestore(ids) {
      return request(async () => {
        const { data } = await api.post(`${base}/bulk-restore`, { ids });
        return data;
      });
    },

    async exportCsv(params = {}) {
      return request(async () => {
        const { data } = await api.post(`${base}/export`, null, { params, responseType: 'blob' });
        return data;
      });
    },

    async getTimeline(id) {
      return request(async () => {
        const { data } = await api.get(`${base}/${id}/timeline`);
        return data;
      });
    },

    async getHistory(id) {
      return request(async () => {
        const { data } = await api.get(`${base}/${id}/history`);
        return data;
      });
    },

    async getAttachments(id) {
      return request(async () => {
        const { data } = await api.get(`${base}/${id}/attachments`);
        return data;
      });
    },

    async addAttachment(id, formData, onProgress) {
      return request(async () => {
        const { data } = await api.post(`${base}/${id}/attachments`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: onProgress
            ? (e) => onProgress(e.loaded || 0, e.total || 0)
            : undefined
        });
        return data;
      });
    },

    async deleteAttachment(id, attachmentId) {
      return request(async () => {
        const { data } = await api.delete(`${base}/${id}/attachments/${attachmentId}`);
        return data;
      });
    },

    async uploadMany(id, files, { onFileStart, onProgress } = {}) {
      const results = [];
      for (const file of files) {
        onFileStart?.(file);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await this.addAttachment(id, formData, (loaded, total) => onProgress?.(file, loaded, total));
          results.push({ ok: true, file, data: res });
        } catch (err) {
          results.push({ ok: false, file, error: normalizeApiError(err) });
        }
      }
      return results;
    },

    async postAction(id, action, payload) {
      return request(async () => {
        const { data } = await api.post(`${base}/${id}/${action}`, payload ?? {});
        return data;
      });
    }
  };
}
