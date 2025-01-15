import l from '../logger.js';
import { IMailer } from "../models/mailer.js";
import nodemailer from 'nodemailer';

const logger = l.child({}, { msgPrefix: '[SmtpMailer]' });

export class SmtpMailer implements IMailer {
  #transporter: any;
  
  constructor(options?: { from: string, to: string[]}) {
    if (!process.env.SMTP_HOST) {
      throw new Error('Missing SMTP host');
    }
    if (!process.env.SMTP_PORT) {
      throw new Error('Missing SMTP port');
    }
    if (!process.env.SMTP_USER) {
      throw new Error('Missing SMTP user');
    }
    if (!process.env.SMTP_PASS) {
      throw new Error('Missing SMTP pass');
    }
    this.#transporter = nodemailer.createTransport(
      {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false,
        }
      },
      // Defaults
      {
        from: options?.from || process.env.MAIL_FROM!,
        to: options?.to.join(',') || process.env.MAIL_TO!
      }
    );
  }

  async sendMail(userCode: string, verificationLink: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#transporter.sendMail({
        subject: 'Confirm device',
        text: `Please confirm your Debrid Link device: ${verificationLink}`,
        html:`<p>Please confirm your Debrid Link device: <a href="${verificationLink}">${userCode}</a></p>` 
      }, (err: any, info: any) => {
        if (err) {
          logger.error(`Couldn't send email, ${err}`, { err });
        }
        logger.debug(`Email sent, ${JSON.stringify(info)}`, { info });
        resolve(info);
      })
    });
  }

}