import api from '../api/axiosInstance';
import { normalizeApiError } from './cprService';

async function request(executor) {
  try {
    return await executor();
  } catch (error) {
    throw normalizeApiError(error);
  }
}

const customerService = {
  async list(q) {
    return request(async () => {
      const { data } = await api.get('/customers', { params: q ? { q } : {} });
      return data;
    });
  },

  async get(id) {
    return request(async () => {
      const { data } = await api.get(`/customers/${id}`);
      return data;
    });
  },

  async create(payload) {
    return request(async () => {
      const { data } = await api.post('/customers', payload);
      return data;
    });
  },

  async update(id, payload) {
    return request(async () => {
      const { data } = await api.put(`/customers/${id}`, payload);
      return data;
    });
  },

  async remove(id) {
    return request(async () => {
      const { data } = await api.delete(`/customers/${id}`);
      return data;
    });
  }
};

export default customerService;
