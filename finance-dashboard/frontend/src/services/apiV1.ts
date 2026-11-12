import { api } from './api';
import {
  DimensionFilters, ContractPage, ContractFilters,
  ViewScopeNode,
  ReportView,
  KpiReportResponse,
  TrendPoint,
  PivotItem,
  StockReportResponse,
  OrgTreeNode,
  ImportPreviewResponse,
  ImportConfirmResponse,
  AccessRequestItem,
} from '../types/v1';

export const apiV1 = {
  // 1. KPI & Reports
  getKpi: async (params: Partial<DimensionFilters> & {
    fromDate?: string;
    toDate?: string;
    asOfDate?: string;
    datasetId?: string;
    viewEmployeeId?: string;
    view?: 'self' | 'subtree';
    employeeId?: string;
    product?: string;
    term?: string;
  }): Promise<KpiReportResponse> => {
    const { data } = await api.get<KpiReportResponse>('/v1/reports/kpi', { params });
    return data;
  },

  getTrend: async (params: Partial<DimensionFilters> & {
    fromDate?: string;
    toDate?: string;
    period?: 'day' | 'week' | 'month' | 'quarter';
    employeeId?: string;
    datasetId?: string;
    viewEmployeeId?: string;
    view?: 'self' | 'subtree';
    weekMode?: 'standard' | 'business4week' | 'custom';
    customIntervalsJson?: string;
  }): Promise<TrendPoint[]> => {
    const { data } = await api.get<TrendPoint[]>('/v1/reports/trend', { params });
    return data;
  },

  getPivot: async (params: Partial<DimensionFilters> & {
    fromDate?: string;
    toDate?: string;
    groupBy?: 'product' | 'term' | 'channel' | 'branch' | 'sale';
    employeeId?: string;
    datasetId?: string;
    viewEmployeeId?: string;
    view?: 'self' | 'subtree';
  }): Promise<PivotItem[]> => {
    const { data } = await api.get<PivotItem[]>('/v1/reports/pivot', { params });
    return data;
  },

  // 2. Contracts
  getContracts: async (params: Partial<DimensionFilters> & ContractFilters & {
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
    employeeId?: string;
    product?: string;
    datasetId?: string;
    viewEmployeeId?: string;
    view?: 'self' | 'subtree';
  }): Promise<ContractPage> => {
    const { data } = await api.get<ContractPage>('/v1/contracts', { params });
    return data;
  },

  downloadContractsCsv: async (params: Partial<DimensionFilters> & ContractFilters & {
    fromDate?: string;
    toDate?: string;
    employeeId?: string;
    product?: string;
    datasetId?: string;
    viewEmployeeId?: string;
    view?: 'self' | 'subtree';
  }): Promise<Blob> => {
    const response = await api.get('/v1/contracts/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  exportContractsUrl: (params: {
    fromDate?: string;
    toDate?: string;
    employeeId?: string;
    product?: string;
    datasetId?: string;
    viewEmployeeId?: string;
    view?: 'self' | 'subtree';
  }): string => {
    const query = new URLSearchParams();
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    if (params.employeeId) query.set('employeeId', params.employeeId);
    if (params.product) query.set('product', params.product);
    if (params.datasetId) query.set('datasetId', params.datasetId);
    if (params.viewEmployeeId) query.set('viewEmployeeId', params.viewEmployeeId);
    if (params.view) query.set('view', params.view);
    return `/api/v1/contracts/export?${query.toString()}`;
  },

  // 3. Stocks
  getStocks: async (params: {
    fromDate?: string;
    toDate?: string;
    datasetId?: string;
    viewEmployeeId?: string;
    view?: 'self' | 'subtree';
  }): Promise<StockReportResponse> => {
    const { data } = await api.get<StockReportResponse>('/v1/stocks', { params });
    return data;
  },

  getFilterOptions: async (params: ReportView & { datasetId?: string; toDate: string }): Promise<DimensionFilters> => {
    const { data } = await api.get<DimensionFilters>('/v1/report-filters', { params });
    return data;
  },
  recordScopeSelection: async (value: ReportView & { datasetId?: string }): Promise<void> => {
    await api.post('/v1/view-scopes/selection', value);
  },
  getViewScopes: async (datasetId?: string): Promise<ViewScopeNode[]> => {
    const { data } = await api.get<ViewScopeNode[]>('/v1/view-scopes', { params: { datasetId } });
    return data;
  },

  // 4. Org Tree & Permissions
  getOrgTree: async (asOfDate?: string, context?: ReportView & { datasetId?: string }): Promise<OrgTreeNode[]> => {
    const { data } = await api.get<OrgTreeNode[]>('/v1/org-tree', {
      params: { asOfDate, ...context },
    });
    return data;
  },

  reparentManager: async (employeeId: string, payload: {
    newManagerEmployeeId: string;
    effectiveDate: string;
    reason: string;
  }): Promise<void> => {
    await api.put(`/v1/org-tree/${employeeId}/manager`, payload);
  },

  updateUserDataAccess: async (userId: number, payload: {
    employeeId?: string;
    canViewSubordinates: boolean;
    reason?: string;
  }): Promise<void> => {
    await api.put(`/v1/users/${userId}/data-access`, payload);
  },

  getAccessRequests: async (status?: string): Promise<AccessRequestItem[]> => {
    const { data } = await api.get<AccessRequestItem[]>('/v1/permissions/requests', {
      params: status ? { status } : {},
    });
    return data;
  },

  createAccessRequest: async (payload: {
    targetEmployeeId: string;
    requestRevenue: boolean;
    requestBalance: boolean;
    reason: string;
  }): Promise<{ id: number }> => {
    const { data } = await api.post<{ id: number }>('/v1/permissions/requests', payload);
    return data;
  },

  reviewAccessRequest: async (id: number, payload: {
    isApproved: boolean;
    reviewNotes: string;
    validTo?: string;
  }): Promise<void> => {
    await api.put(`/v1/permissions/requests/${id}/review`, payload);
  },

  createPeerGrant: async (payload: {
    userId: number;
    targetEmployeeId: string;
    grantRevenue: boolean;
    grantBalance: boolean;
    validFrom: string;
    validTo: string;
    grantReason: string;
  }): Promise<{ id: number }> => {
    const { data } = await api.post<{ id: number }>('/v1/permissions/peer-grants', payload);
    return data;
  },

  revokePeerGrant: async (id: number, reason?: string): Promise<void> => {
    await api.delete(`/v1/permissions/peer-grants/${id}`, {
      params: reason ? { reason } : {},
    });
  },

  // 5. Imports V2
  uploadImportPreview: async (
    file: File,
    sourceType?: string,
    sourceDate?: string,
    effectiveDate?: string
  ): Promise<ImportPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (sourceType) formData.append('sourceType', sourceType);
    if (sourceDate) formData.append('sourceDate', sourceDate);
    if (effectiveDate) formData.append('effectiveDate', effectiveDate);

    const { data } = await api.post<ImportPreviewResponse>('/v1/imports/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getImportPreview: async (
    previewId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ImportPreviewResponse> => {
    const { data } = await api.get<ImportPreviewResponse>(`/v1/imports/${previewId}`, {
      params: { page, pageSize },
    });
    return data;
  },

  confirmImport: async (
    previewId: string,
    payload: {
      expectedRevision: number;
      idempotencyKey: string;
      reason: string;
      rowResolutions?: Record<number, string>;
    }
  ): Promise<ImportConfirmResponse> => {
    const { data } = await api.post<ImportConfirmResponse>(
      `/v1/imports/${previewId}/confirm`,
      payload
    );
    return data;
  },

  // 6. Datasets
  getDatasets: async (): Promise<any[]> => {
    const { data } = await api.get('/v1/datasets');
    return data;
  },
};
