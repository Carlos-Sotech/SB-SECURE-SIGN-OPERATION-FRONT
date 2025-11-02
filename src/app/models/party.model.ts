export enum PartyStatus {
  Pending = 0,
  Signed = 1,
  Omitted = 2
}

export interface SignatureArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  partyId?: number;
  color?: string;
}

export interface PartyTextCreateDto {
  text: string;
}

export interface PartyCreateDto {
  idOperation: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
  required: boolean;
  prefix: string;
  voice: boolean;
  photo: boolean;
  fingerPrint: boolean;
  partyTexts: PartyTextCreateDto[];
  signatureArea?: SignatureArea;
}

export interface PartyUpdateDto {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
  required: boolean;
  prefix: string;
  voice: boolean;
  photo: boolean;
  fingerPrint: boolean;
  partyTexts: PartyTextCreateDto[];
}

export interface PartyReadDto {
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
  prefix: string;
  voice: boolean;
  photo: boolean;
  fingerPrint: boolean;
  status: string;
  signedAt?: Date;
  omittedAt?: Date;
  partyTexts: PartyTextReadDto[];
}

export interface PartyTextReadDto {
  id: number;
  idParty: number;
  text: string;
} 