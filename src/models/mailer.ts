export interface IMailer {
  sendMail(userCode: string, verificationLink: string): Promise<void>;
}