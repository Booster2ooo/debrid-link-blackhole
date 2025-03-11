
import l from '../logger.js';
import { readFile, writeFile, stat, unlink } from 'fs/promises';
import { AuthDeviceCode, AuthFile, AuthResponse, IMailer } from '../models/index.js';
import { resolvePath, sleep } from '../utils.js';

const logger = l.child({}, { msgPrefix: '[AuthManager]' });

export class AuthManager {
  #OAUTH_ENDPOINT = 'https://debrid-link.com/api/oauth';
  #SCOPE = 'get.post.delete.seedbox';
  #STORAGE = resolvePath('./.access_token');
  #LOCK = resolvePath('./.access_token.lock');
  #clientId: string;
  #accessToken: string|undefined;
  #refreshToken: string|undefined;
  #expiresAt: Date|undefined;
  #mailer: IMailer;

  constructor(mailer: IMailer) {
    if (!process.env.DEBRID_LINK_CLIENT_ID) {
      throw new Error('[AuthManager] Missing auth option "clientId"');
    }
    if (!mailer) {
      throw new Error('[AuthManager] Mailer');
    }
    this.#clientId = process.env.DEBRID_LINK_CLIENT_ID;
    this.#mailer = mailer;
  }

  async #serializeAuthInfo(): Promise<void> {
    if (!this.#accessToken || !this.#refreshToken || !this.#expiresAt) {
      return;
    }
    await writeFile(
      this.#STORAGE, 
      JSON.stringify({
        accessToken: this.#accessToken,
        refreshToken: this.#refreshToken,
        expiresAt: this.#expiresAt.toISOString()
      }),
      { encoding: 'utf8' }
    );
  }

  async #deserializeAuthInfo(): Promise<void>  {
    if (this.#accessToken) {
      return;
    }
    try {
      const storageContent = await readFile(this.#STORAGE, { encoding: 'utf8' });
      if (!storageContent) {
        return;
      }
      const stored: AuthFile = JSON.parse(storageContent);
      if (!stored) {
        return;
      }
      this.#accessToken = stored.accessToken;
      this.#refreshToken = stored.refreshToken;
      this.#expiresAt = new Date(stored.expiresAt);
    }
    catch {}
  }

  async #lock(): Promise<void> {
    await writeFile(
      this.#LOCK, 
      'locked',
      { encoding: 'utf8' }
    );
  }

  async #unlock(): Promise<void> {
    await unlink(this.#LOCK);
  }

  async #waitLock(): Promise<void> {
    const checkLock = async () => {
      return stat(this.#LOCK)
        .then(stat => stat.isFile() && stat.size)
        .catch(() => false);
    }
    let isLocked = await checkLock();
    while(isLocked) {
      await sleep(1000);
      isLocked = await checkLock();
    }
  }

  async clearToken(): Promise<void> {
    this.#accessToken = undefined;
    this.#refreshToken = undefined;
    this.#expiresAt = undefined;
    try {
      await unlink(this.#STORAGE);
    }
    catch {}
  }

  async getToken(scope?: string): Promise<string> {
    await this.#deserializeAuthInfo();
    const now =  new Date();
    // adds 1 min expiracy window
    now.setMilliseconds(now.getMilliseconds() + 60 * 1000);
    if (this.#accessToken && this.#expiresAt && now < this.#expiresAt) {
      logger.debug(`Got valid token, expires at '${this.#expiresAt}' - current time(+1min) '${now}'`);
      return this.#accessToken;
    }
    if (this.#refreshToken) {
      logger.debug(`Token (almost) expired, trying to refresh`);
      try {
        const authResponse = await fetch(`${this.#OAUTH_ENDPOINT}/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: this.#clientId,
              refresh_token: this.#refreshToken,
            })
          })
          .then<AuthResponse>(response => response.json());
        return authResponse.access_token;
      }
      catch (ex) {
        logger.info({ msg: `Unable to refresh token.`,  ex });
      }
    }
    await this.#waitLock();
    await this.#lock();
    await this.clearToken();
    const deviceCode = await fetch(`${this.#OAUTH_ENDPOINT}/device/code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.#clientId,
          scope: scope || this.#SCOPE
        })
      })
      .then<AuthDeviceCode>(response => response.json());
    const verificationExpiry = new Date();
    verificationExpiry.setSeconds(verificationExpiry.getSeconds() + deviceCode.expires_in);
    const verificationLink = `${deviceCode.verification_url}/${deviceCode.user_code}`;
    logger.info({ msg: `Received device link: ${verificationLink}, expires on '${verificationExpiry}'`,  deviceCode });
    await this.#mailer.sendMail(deviceCode.user_code, verificationLink);
    while(!this.#accessToken && verificationExpiry >= new Date()) {
      try {
        const response = await fetch(`${this.#OAUTH_ENDPOINT}/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              grant_type: 'http://oauth.net/grant_type/device/1.0',
              client_id: this.#clientId,
              code: deviceCode.device_code
            })
          })
          .then<AuthResponse>(response => response.json());
        this.#accessToken = response.access_token;
        this.#refreshToken = response.refresh_token;
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);
        this.#expiresAt = expiresAt;
        await this.#serializeAuthInfo();
        await this.#unlock();
      }
      catch {
        await sleep(5 * 1000);
      }
    }
    if (!this.#accessToken) {
      throw new Error('Unable to generate access_token using device code');
    }
    return this.#accessToken;
  }
}