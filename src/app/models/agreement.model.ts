export interface AgreementCreateDto {
  idOperation: number;
  text: string;
  accepted: boolean;
  acceptedAt?: Date;
}

export interface AgreementReadDto {
  id: number;
  idOperation: number;
  text: string;
  accepted: boolean;
  acceptedAt?: Date;
}

export interface AgreementUpdateDto {
  text: string;
  accepted: boolean;
  acceptedAt?: Date;
} 