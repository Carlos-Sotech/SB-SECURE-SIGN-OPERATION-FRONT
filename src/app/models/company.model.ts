export interface Company {
  id: number;
  name: string;
  taxId?: string;
  addressLine1?: string;
  city?: string;
  stateOrProvince?: string;
  phoneNumber?: string;
  email?: string;
  numberOfAgents: number;
  maxMonthlyOperations: number;
  currentMonthOperationsCount: number;
  lastResetYearMonth: number;
  createdAt: string;
  hasUnlimitedOperations?: boolean;
  hasReachedMonthlyLimit?: boolean;
  remainingOperations?: number;
}
