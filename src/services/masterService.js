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

const masterService = {
  /** List master values for a key, e.g. 'pr_departments'. */
  async list(key) {
    return request(async () => {
      const { data } = await api.get(`/masters/${key}`);
      return data;
    });
  },

  /** Create (or reuse) a master value. */
  async create(key, value) {
    return request(async () => {
      const { data } = await api.post(`/masters/${key}`, { value });
      return data;
    });
  },

  /** Rename a master value. */
  async update(key, id, value) {
    return request(async () => {
      const { data } = await api.put(`/masters/${key}/${id}`, { value });
      return data;
    });
  },

  /** Delete a master value (blocked by the backend while it is in use). */
  async remove(key, id) {
    return request(async () => {
      const { data } = await api.delete(`/masters/${key}/${id}`);
      return data;
    });
  }
};

export default masterService;
