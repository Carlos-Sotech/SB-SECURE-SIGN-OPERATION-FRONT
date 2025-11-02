import { Role } from "./role.enum";

export interface UserReadDto {
    id: number;
    username: string;
    email: string;
    privacyPolicyAccepted: boolean;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
    companyId?: number | null;
    companyName?: string | null;
}