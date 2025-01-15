export interface AuthFile {
  accessToken: string;
  refreshToken: string;
  expiresAt: string|Date;
}