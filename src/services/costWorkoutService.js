import api from '../api/axiosInstance';
import { normalizeApiError } from './cprService';

async function request(executor) {
  try {
    return await executor();
  } catch (error) {
    throw normalizeApiError(error);
  }
}

const costWorkoutService = {
  async listCws(params = {}) {
    return request(async () => {
      const { data } = await api.get('/cost-workouts', { params });
      return data;
    });
  },

  async getCw(id) {
    return request(async () => {
      const { data } = await api.get(`/cost-workouts/${id}`);
      return data;
    });
  },

  async createCw(payload, draft = false) {
    return request(async () => {
      const { data } = await api.post('/cost-workouts', payload, { params: draft ? { draft: true } : {} });
      return data;
    });
  },

  async updateCw(id, payload) {
    return request(async () => {
      const { data } = await api.put(`/cost-workouts/${id}`, payload);
      return data;
    });
  },

  async deleteCw(id) {
    return request(async () => {
      const { data } = await api.delete(`/cost-workouts/${id}`);
      return data;
    });
  },

  async permanentDeleteCw(id) {
    return request(async () => {
      const { data } = await api.delete(`/cost-workouts/${id}/permanent`);
      return data;
    });
  },

  async restoreCw(id) {
    return request(async () => {
      const { data } = await api.post(`/cost-workouts/${id}/restore`);
      return data;
    });
  },

  async archiveCw(id) {
    return request(async () => {
      const { data } = await api.post(`/cost-workouts/${id}/archive`);
      return data;
    });
  },

  async submitCw(id) {
    return request(async () => {
      const { data } = await api.post(`/cost-workouts/${id}/submit`);
      return data;
    });
  },

  async approveCw(id, remarks) {
    return request(async () => {
      const { data } = await api.post(`/cost-workouts/${id}/approve`, { remarks });
      return data;
    });
  },

  async rejectCw(id, remarks) {
    return request(async () => {
      const { data } = await api.post(`/cost-workouts/${id}/reject`, { remarks });
      return data;
    });
  },

  async duplicateCw(id) {
    return request(async () => {
      const { data } = await api.post(`/cost-workouts/${id}/duplicate`);
      return data;
    });
  },

  async getNextNumber() {
    return request(async () => {
      const { data } = await api.get('/cost-workouts/next-number');
      return data;
    });
  },

  async getStats() {
    return request(async () => {
      const { data } = await api.get('/cost-workouts/stats');
      return data;
    });
  },

  async getTimeline(id) {
    return request(async () => {
      const { data } = await api.get(`/cost-workouts/${id}/timeline`);
      return data;
    });
  },

  async getItems(id) {
    return request(async () => {
      const { data } = await api.get(`/cost-workouts/${id}/items`);
      return data;
    });
  },

  async getAttachments(id) {
    return request(async () => {
      const { data } = await api.get(`/cost-workouts/${id}/attachments`);
      return data;
    });
  },

  async getCustomCategories() {
    return request(async () => {
      const { data } = await api.get('/cost-workouts/custom-categories');
      return data;
    });
  },

  async saveCustomCategories(categories) {
    return request(async () => {
      const { data } = await api.post('/cost-workouts/custom-categories', { categories });
      return data;
    });
  },

  async getCustomUnits() {
    return request(async () => {
      const { data } = await api.get('/cost-workouts/custom-units');
      return data;
    });
  },

  async saveCustomUnits(units) {
    return request(async () => {
      const { data } = await api.post('/cost-workouts/custom-units', { units });
      return data;
    });
  }
};

export default costWorkoutService;
