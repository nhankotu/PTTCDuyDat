export interface DashboardKpi {
  batchId: number;
  reportDate: string;
  branch?: string;
  totalRevenue: number;
  revenueUpsc: number;
  revenueFinra: number;
  totalBalanceCurrent: number;
  netGrowth: number;
  newCustomers: number;
  targetAmount: number;
  completionRate: number;
  bookRate: number;
  totalContracts: number;
  activeContracts: number;
}

export interface WeeklyTrendItem {
  weekLabel: string;
  dateRange: string;
  revenue: number;
  endBalance: number;
}

export interface DimensionStatItem {
  name: string;
  revenue: number;
  balance: number;
  contractCount: number;
  revenuePercentage: number;
  balancePercentage: number;
}

export interface PeriodGroupStat {
  periodLabel: string;
  periodKey: string;
  totalRevenue: number;
  totalBalance: number;
  items: DimensionStatItem[];
}

export interface UploadBatch {
  id: number;
  fileName: string;
  reportDate: string;
  totalRows: number;
  totalValue: number;
  totalBalance: number;
  status: string;
  errorMessage?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface UploadResult {
  batchId: number;
  fileName: string;
  reportDate: string;
  totalRows: number;
  totalValue: number;
  totalBalance: number;
  totalEmployees: number;
  totalEarlySettlements: number;
  totalExceptions: number;
  totalExcluded: number;
  status: string;
  message: string;
  elapsedSeconds: number;
}

export interface UserAccount {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'user';
  branchAccess?: string;
  scopeType?: string;
  scopeNodeId?: string;
  scopeNodeName?: string;
  scopeNodeRole?: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  username: string;
  fullName: string;
  role: string;
  branchAccess?: string;
  scopeType?: string;
  scopeNodeId?: string;
  scopeNodeName?: string;
  scopeNodeRole?: string;
}

export interface TreeNode {
  id: string;
  label: string;
  position: string;
  department?: string;
  branch?: string;
  region?: string;
  status?: string;
  directSubordinatesCount: number;
  totalSubordinatesCount: number;
  totalRevenue: number;
  totalBalance: number;
  children: TreeNode[];
}

export interface TreeFlatNode {
  id: string;
  label: string;
  position: string;
  branch?: string;
  region?: string;
  department?: string;
  scopeType: string;
  subordinatesCount: number;
}

export interface UpdateUserScopeRequest {
  scopeType: string;
  scopeNodeId?: string;
  scopeNodeName?: string;
  scopeNodeRole?: string;
}

export interface PermissionPreset {
  id: number;
  name: string;
  description?: string;
  scopeType: string;
  scopeNodeId?: string;
  scopeNodeName?: string;
  scopeNodeRole?: string;
  createdAt: string;
  createdBy?: string;
}

export interface CreatePermissionPresetRequest {
  name: string;
  description?: string;
  scopeType: string;
  scopeNodeId?: string;
  scopeNodeName?: string;
  scopeNodeRole?: string;
}

export interface BulkAssignScopeRequest {
  userIds: number[];
  scopeType: string;
  scopeNodeId?: string;
  scopeNodeName?: string;
  scopeNodeRole?: string;
}
