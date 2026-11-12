export interface ReportPeriod {
  fromDate: string;
  toDate: string;
  asOfDate: string;
}

export interface KpiMetrics {
  totalSales: string | null;
  totalBalance: string | null;
  totalCustomers: number | null;
  totalContracts: number | null;
  avgSizePerContract: string | null;
  avgSizePerCustomer: string | null;
}

export interface AccessInfo {
  revenue: boolean;
  balance: boolean;
  scopesDiffer: boolean;
}

export interface KpiReportResponse {
  datasetId?: string;
  period: ReportPeriod;
  metrics: KpiMetrics;
  access: AccessInfo;
  dataStatus: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
  warnings: string[];
}

export interface TrendPoint {
  periodLabel: string;
  fromDate: string;
  toDate: string;
  totalSales: string | null;
  totalBalance: string | null;
  contractCount: number | null;
  customerCount: number | null;
}

export interface PivotItem {
  groupKey: string;
  groupName: string;
  totalSales: string | null;
  totalBalance: string | null;
  contractCount: number | null;
  customerCount: number | null;
  salesSharePercent: number | null;
  balanceSharePercent: number | null;
}

export interface ContractDetailItem {
  appendixNumber: string;
  customerCode: string;
  customerName: string;
  productName: string;
  term: string;
  signDate: string;
  expireDate?: string;
  liquidateDate?: string;
  saleId: string;
  saleName?: string;
  effectiveSaleId: string;
  status: string;
  channel: string;
  contractValue: string | null;
  settledAmount: string | null;
  balance: string | null;
}

export interface StockContractItem {
  id: number;
  appendixNumber: string;
  customerCode: string;
  customerName: string;
  contractValue: string | null;
  liquidatedAmount: string | null;
  balance: string | null;
  signDate: string;
  expireDate?: string;
  liquidateDate?: string;
  saleId: string;
}

export interface StockReportResponse {
  totalContractValue: string | null;
  totalLiquidated: string | null;
  totalBalance: string | null;
  totalContracts: number | null;
  totalCustomers: number | null;
  items: StockContractItem[];
}

export interface OrgTreeNode {
  employeeId: string;
  fullName: string;
  position: string;
  department?: string;
  branch?: string;
  region?: string;
  managerEmployeeId?: string;
  canViewRevenue: boolean;
  canViewBalance: boolean;
  subordinates: OrgTreeNode[];
}

export interface StagingRecordItem {
  id: number;
  rowIndex: number;
  sheetName?: string;
  entityKey?: string;
  classification: 'NEW' | 'UNCHANGED' | 'CHANGED' | 'AMBIGUOUS' | 'INVALID';
  parsedData: any;
  diffData: any;
  validationErrors: string[];
  resolutionAction: string;
  resolutionNotes?: string;
}

export interface ImportRowErrorItem {
  rowIndex: number;
  entityKey?: string;
  validationErrors: string[];
}

export interface ImportPreviewResponse {
  previewId: string;
  batchId: number;
  sourceType: string;
  fileName: string;
  fileSha256: string;
  expectedRevision: number;
  totalRows: number;
  newRows: number;
  unchangedRows: number;
  changedRows: number;
  ambiguousRows: number;
  invalidRows: number;
  errors?: ImportRowErrorItem[];
  items: StagingRecordItem[];
  warnings: string[];
  isStale: boolean;
}

export interface ImportConfirmResponse {
  batchId: number;
  previewId: string;
  sourceType: string;
  confirmedRows: number;
  skippedRows: number;
  status: string;
  message: string;
}

export interface AccessRequestItem {
  id: number;
  requestingUserId: number;
  targetEmployeeId: string;
  requestRevenue: boolean;
  requestBalance: boolean;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  resultingGrantId?: number;
  createdAt: string;
}

export interface ReportView {
  viewEmployeeId?: string;
  view: 'self' | 'subtree';
}
export interface ViewScopeNode {
  id: string;
  label: string;
  position: string;
  parentId?: string;
  branch?: string;
  department?: string;
  canViewRevenue: boolean;
  canViewBalance: boolean;
  canViewSubtree: boolean;
  source?: 'HR' | 'CONTRACT';
}

export interface DimensionFilters {
  products: string[];
  terms: string[];
  channels: string[];
  statuses: string[];
}
export interface ContractPage {
  items: ContractDetailItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}
export interface ContractFilters {
  asOfDate?: string;
  basis?: 'sales' | 'balance';
  search?: string;
  minValue?: string;
  maxValue?: string;
  minBalance?: string;
  maxBalance?: string;
  changedSale?: boolean;
  sort?: string;
}
