export interface Operation {
  id: number;
  minutesAlive: number;
  status: string;
  userId: number;
  superUserId?: number;
  user?: User;
  superUser?: User;
  filePDF?: File | null;
  operationType: OperationTypeEnum;
  readingAllPages: boolean;
  readingConfirmed: boolean;
  readingText?: string;
  certificateId?: string;
  createdAt: Date;
  updatedAt?: Date;
  descripcionOperacion: string;
}

export enum OperationTypeEnum {
  LOCAL = 'Local',
  REMOTA = 'Remota'
}

export enum OperationStatusEnum {
  PENDING = 'Pendiente',
  LANZADA = 'Lanzada',
  COMPLETADA = 'Completada',
  CADUCADA = 'Caducada',
  RECHAZADA = 'Rechazada',
}

// DTOs for API operations
export interface OperationReadDto {
  id: number;
  minutesAlive: number;
  status: string;
  userId: number;
  userName: string;
  superUserId?: number;
  superUserName: string;
  filePDF?: string;
  operationType: OperationTypeEnum;
  operationTypeName: string;
  readingAllPages: boolean;
  readingConfirmed: boolean;
  readingText?: string;
  certificateId?: string;
  createdAt: Date;
  updatedAt?: Date;
  signedAt?: Date;
  rejectedAt?: Date;
  isNecessaryConfirmReading: boolean;
  workFlowUrl?: string;
  descripcionOperacion?: string;
}

export interface OperationCreateDto {
  minutesAlive: number;
  status: string;
  userId: number;
  superUserId?: number;
  operationType: OperationTypeEnum;
  readingAllPages: boolean;
  readingConfirmed: boolean;
  readingText?: string;
  certificateId?: string;
  isNecessaryConfirmReading: boolean;
  descripcionOperacion?: string;
}

export interface Agreement {
  id: number;
  idOperation: number;
  accepted: boolean;
  text: string;
  acceptedAt?: Date;
  operation?: Operation;
}

export interface Party {
  id: number;
  idOperation: number;
  uniqueIdentifier: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  voice: boolean;
  photo: boolean;
  signedAt?: Date;
  omittedAt?: Date;
  operation?: Operation;
  partyTexts: PartyText[];
}

export interface PartyText {
  id: number;
  idParty: number;
  text: string;
  party?: Party;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  companyId?: number;
  companyName?: string;
  createdAt: Date;
} 