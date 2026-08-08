import api from '../api/axiosInstance';

/**
 * The target backend has no /industries endpoints; industries are managed
 * through the generic master-values API under the 'industries' key, and the
 * MasterValueResponse shape ({id, value}) is mapped to {id, name} here.
 */
const MASTER_KEY = 'industries';

function toIndustry(item) {
  if (!item) return null;
  if (typeof item === 'string') return { id: null, name: item };
  return { id: item.id, name: item.value ?? item.name ?? item.label ?? '' };
}

const industryService = {
  async listIndustries() {
    const { data } = await api.get(`/masters/${MASTER_KEY}`);
    const list = data?.data ?? data ?? [];
    return (Array.isArray(list) ? list : []).map(toIndustry).filter(Boolean);
  },

  async createIndustry(name) {
    const { data } = await api.post(`/masters/${MASTER_KEY}`, { value: name });
    const created = data?.data ?? data;
    return toIndustry(created) || { id: null, name };
  },

  async renameIndustry(id, name) {
    const { data } = await api.put(`/masters/${MASTER_KEY}/${id}`, { value: name });
    const updated = data?.data ?? data;
    return toIndustry(updated) || { id, name };
  },

  async deleteIndustry(id) {
    const { data } = await api.delete(`/masters/${MASTER_KEY}/${id}`);
    return data?.data ?? data;
  }
};

export default industryService;
