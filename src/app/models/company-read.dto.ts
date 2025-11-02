export interface CompanyReadDto {
  id: number;
  name: string;
  taxId?: string;
  addressLine1?: string;
  city?: string;
  stateOrProvince?: string;
  phoneNumber?: string;
  email?: string;
  numberOfAgents: number;
  createdAt: string;
}


