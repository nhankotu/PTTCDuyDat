import axios from 'axios';
import {
  DashboardKpi,
  WeeklyTrendItem,
  DimensionStatItem,
  PeriodGroupStat,
  UploadBatch,
  UploadResult,
  UserAccount,
  AuthSession,
} from '../types';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT token to all requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('finra_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for automatic Refresh Token handling
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt refresh on login or refresh endpoint errors
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('finra_refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('finra_token');
        localStorage.removeItem('finra_refresh_token');
        localStorage.removeItem('finra_user');
        window.dispatchEvent(new Event('finra_auth_logout'));
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<AuthSession>(`${API_BASE}/auth/refresh`, {
          refreshToken,
        });

        localStorage.setItem('finra_token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('finra_refresh_token', data.refreshToken);
        }
        localStorage.setItem('finra_user', JSON.stringify(data));

        api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
        originalRequest.headers.Authorization = `Bearer ${data.token}`;

        processQueue(null, data.token);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('finra_token');
        localStorage.removeItem('finra_refresh_token');
        localStorage.removeItem('finra_user');
        window.dispatchEvent(new Event('finra_auth_logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const dashboardApi = {
  login: async (username: string, password: string): Promise<AuthSession> => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.token) {
      localStorage.setItem('finra_token', res.data.token);
    }
    if (res.data.refreshToken) {
      localStorage.setItem('finra_refresh_token', res.data.refreshToken);
    }
    localStorage.setItem('finra_user', JSON.stringify(res.data));
    return res.data;
  },

  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('finra_refresh_token');
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('finra_token');
      localStorage.removeItem('finra_refresh_token');
      localStorage.removeItem('finra_user');
      window.dispatchEvent(new Event('finra_auth_logout'));
    }
  },

  getKpi: async (batchId?: number, branch?: string): Promise<DashboardKpi> => {
    const res = await api.get('/dashboard/kpi', { params: { batchId, branch } });
    return res.data;
  },

  getWeeklyTrend: async (batchId?: number, branch?: string): Promise<WeeklyTrendItem[]> => {
    const res = await api.get('/dashboard/weekly-trend', { params: { batchId, branch } });
    return res.data;
  },

  getByProduct: async (batchId?: number, branch?: string): Promise<DimensionStatItem[]> => {
    const res = await api.get('/dashboard/by-product', { params: { batchId, branch } });
    return res.data;
  },

  getByTerm: async (batchId?: number, branch?: string): Promise<DimensionStatItem[]> => {
    const res = await api.get('/dashboard/by-term', { params: { batchId, branch } });
    return res.data;
  },

  getByBranch: async (batchId?: number): Promise<DimensionStatItem[]> => {
    const res = await api.get('/dashboard/by-branch', { params: { batchId } });
    return res.data;
  },

  getMultiDimensionStats: async (params: {
    batchId?: number;
    dimension: string;
    period: string;
    branch?: string;
    product?: string;
    term?: string;
    channel?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PeriodGroupStat[]> => {
    const res = await api.get('/dashboard/statistics', { params });
    return res.data;
  },

  getBranches: async (): Promise<string[]> => {
    const res = await api.get('/employees/branches');
    return res.data;
  },

  getBatches: async (): Promise<UploadBatch[]> => {
    const res = await api.get('/uploads');
    return res.data;
  },

  uploadExcel: async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getContracts: async (params: any) => {
    const res = await api.get('/contracts', { params });
    return res.data;
  },

  // User management APIs (Admin only)
  getUsers: async (): Promise<UserAccount[]> => {
    const res = await api.get('/users');
    return res.data;
  },

  createUser: async (data: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    branchAccess?: string;
  }): Promise<UserAccount> => {
    const res = await api.post('/users', data);
    return res.data;
  },

  deleteUser: async (id: number): Promise<any> => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
};
