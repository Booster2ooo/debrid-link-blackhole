import l from '../logger.js';
import { IMailer } from "../models/mailer.js";
import Mailjet from 'node-mailjet';

const logger = l.child({}, { msgPrefix: '[MailjetMailer]' });

export class MailjetMailer implements IMailer {
  #from: Mailjet.SendEmailV3_1.EmailAddressTo;
  #to: Mailjet.SendEmailV3_1.EmailAddressTo[];
  #mailjet: Mailjet.Client;
  
  constructor(options?: { from: Mailjet.SendEmailV3_1.EmailAddressTo, to: Mailjet.SendEmailV3_1.EmailAddressTo[]}) {
    if (!process.env.MJ_APIKEY_PUBLIC) {
      throw new Error('Missing Mailjet API key');
    }
    if (!process.env.MJ_APIKEY_PRIVATE) {
      throw new Error('Missing Mailjet API secret');
    }
    this.#from = options?.from || {
      Email: process.env.MAIL_FROM!,
      Name: 'Debrid-Link Blackhole'
    };
    this.#to = options?.to || [{
      Email: process.env.MAIL_TO!
    }];
    this.#mailjet = new Mailjet.Client({
      apiKey: process.env.MJ_APIKEY_PUBLIC,
      apiSecret: process.env.MJ_APIKEY_PRIVATE,
    });
  }

  async sendMail(userCode: string, verificationLink: string): Promise<void> {
    const payload: Mailjet.SendEmailV3_1.Body = {
      Messages: [
        {
          From:  this.#from,
          To: this.#to,
          Subject: 'Confirm device',
          TextPart: `Please confirm your Debrid Link device: ${verificationLink}`,
          HTMLPart:`<p>Please confirm your Debrid Link device: <a href="${verificationLink}">${userCode}</a></p>`
        }
      ]
    };
    return this.#mailjet
      .post('send', { version: 'v3.1' })
      .request(payload)
      .then(response => {
        logger.debug({ response });
      });
  }
}