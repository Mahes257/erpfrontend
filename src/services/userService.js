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

/** Normalize the raw /users payload into an array of user objects. */
export function normalizeUsers(data) {
  const list = Array.isArray(data) ? data : data?.data ?? data?.users ?? [];
  return list
    .map((user) => {
      if (typeof user === 'string') return { id: null, name: user, email: '' };
      return {
        id: user?.id,
        name: user?.name ?? user?.fullName ?? user?.username ?? user?.email ?? '',
        email: user?.email ?? ''
      };
    })
    .filter((user) => user.name);
}

const userService = {
  async getUsers() {
    return request(async () => {
      const { data } = await api.get('/users');
      return data;
    });
  },

  async createOwner(name) {
    const fullName = String(name || '').trim();
    if (!fullName) {
      throw { message: 'Owner name is required', status: 400, data: null };
    }
    const email = `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 60) || 'owner'}@vishaktech.com`;
    const password = 'Owner@' + Math.random().toString(36).slice(2, 12);
    try {
      const { data } = await api.post('/auth/register', { fullName, email, password, role: 'USER' });
      const created = data?.data ?? data ?? {};
      return {
        id: created.id,
        name: created.fullName || created.name || fullName,
        email: created.email || email,
        alreadyExists: false
      };
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message || '';
      if (status === 409 || /already registered/i.test(message)) {
        return { id: null, name: fullName, email, alreadyExists: true };
      }
      throw normalizeApiError(error);
    }
  }
};

export default userService;
