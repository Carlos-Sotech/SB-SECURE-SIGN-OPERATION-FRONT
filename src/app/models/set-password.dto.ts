export interface SetPasswordDto {
  token: string;
  newPassword: string;
  privacyPolicyAccepted: boolean;
}
