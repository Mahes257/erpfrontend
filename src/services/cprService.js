import api from '../api/axiosInstance';

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

const cprService = {
  async listCprs(params = {}) {
    return request(async () => {
      const { data } = await api.get('/cprs', { params });
      return data;
    });
  },

  async listAllCprs() {
    return request(async () => {
      const PAGE_SIZE = 100;
      let page = 0;
      const all = [];
      let done = false;
      while (!done) {
        const { data } = await api.get('/cprs', { params: { page, size: PAGE_SIZE } });
        if (Array.isArray(data)) {
          all.push(...data);
          done = data.length < PAGE_SIZE;
        } else {
          const items = data?.content ?? data?.data ?? data?.rows ?? [];
          const grandTotal = data?.totalElements ?? data?.total ?? data?.totalCount ?? items.length;
          all.push(...(Array.isArray(items) ? items : []));
          done = all.length >= grandTotal;
        }
        page += 1;
        // safety so the report never loops forever against a misbehaving API
        if (page > 500) done = true;
      }
      return all;
    });
  },

  async getCpr(id) {
    return request(async () => {
      const { data } = await api.get(`/cprs/${id}`);
      return data;
    });
  },

  async createCpr(payload, draft = false) {
    return request(async () => {
      const { data } = await api.post('/cprs', payload, { params: draft ? { draft: true } : {} });
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

  async archiveCpr(id) {
    return request(async () => {
      const { data } = await api.patch(`/cprs/archive/${id}`);
      return data;
    });
  },

  async restoreCpr(id) {
    return request(async () => {
      const { data } = await api.patch(`/cprs/restore/${id}`);
      return data;
    });
  },

  async submitCpr(id) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/submit`);
      return data;
    });
  },

  async approveCpr(id, remarks) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/approve`, { remarks });
      return data;
    });
  },

  async rejectCpr(id, remarks) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/reject`, { remarks });
      return data;
    });
  },

  async sendBackCpr(id, remarks) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/send-back`, { remarks });
      return data;
    });
  },

  async convertToQuotation(id) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/convert-quotation`);
      return data;
    });
  },

  async duplicateCpr(id) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/duplicate`);
      return data;
    });
  },

  async getNextNumber() {
    return request(async () => {
      const { data } = await api.get('/cprs/next-number');
      return data;
    });
  },

  async getStats() {
    return request(async () => {
      const { data } = await api.get('/cprs/stats');
      return data;
    });
  },

  async bulkDelete(ids) {
    return request(async () => {
      const { data } = await api.post('/cprs/bulk-delete', { ids });
      return data;
    });
  },

  async bulkPermanentDelete(ids) {
    return request(async () => {
      const { data } = await api.post('/cprs/bulk-permanent-delete', { ids });
      return data;
    });
  },

  async bulkArchive(ids) {
    return request(async () => {
      const { data } = await api.post('/cprs/bulk-archive', { ids });
      return data;
    });
  },

  async bulkRestore(ids) {
    return request(async () => {
      const { data } = await api.post('/cprs/bulk-restore', { ids });
      return data;
    });
  },

  async exportCprs(params = {}) {
    return request(async () => {
      const { data } = await api.post('/cprs/export', null, { params, responseType: 'blob' });
      return data;
    });
  },

  async getTimeline(id) {
    return request(async () => {
      const { data } = await api.get(`/cprs/${id}/timeline`);
      return data;
    });
  },

  async getHistory(id) {
    return request(async () => {
      const { data } = await api.get(`/cprs/${id}/history`);
      return data;
    });
  },

  async getAttachments(id) {
    return request(async () => {
      const { data } = await api.get(`/cprs/${id}/attachments`);
      return data;
    });
  },

  async getComments(id) {
    return request(async () => {
      const { data } = await api.get(`/cprs/${id}/comments`);
      return data;
    });
  },

  async addComment(id, text) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/comments`, { text });
      return data;
    });
  },

  async updateComment(id, commentId, text) {
    return request(async () => {
      const { data } = await api.put(`/cprs/${id}/comments/${commentId}`, { text });
      return data;
    });
  },

  async deleteComment(id, commentId) {
    return request(async () => {
      const { data } = await api.delete(`/cprs/${id}/comments/${commentId}`);
      return data;
    });
  },

  async getReportsSummary() {
    return request(async () => {
      const { data } = await api.get('/cprs/reports/summary');
      return data;
    });
  },

  async addAttachment(id, formData, onProgress) {
    return request(async () => {
      const { data } = await api.post(`/cprs/${id}/attachments`, formData, {
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
      const { data } = await api.delete(`/cprs/${id}/attachments/${attachmentId}`);
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
  }
};

export default cprService;
