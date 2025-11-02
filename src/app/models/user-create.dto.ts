import { Role } from './role.enum';

export interface UserCreateDto {
  username: string;
  email: string;
  // password:string
  //privacyPolicyAccepted: boolean;
  role: Role;
  companyId?: number | null; // Puede ser null o undefined
}