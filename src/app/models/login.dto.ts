import { UserReadDto } from "./user-read.dto";

export interface LoginDto {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponseDto {
  token: string;
  user: UserReadDto; // Para tener la info del usuario logueado
  message: string;
  canManageCompanies?: boolean; // Opcional, si lo añades en la API
}