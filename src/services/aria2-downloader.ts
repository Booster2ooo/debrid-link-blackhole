import { rename } from 'fs/promises';
import { basename } from 'path';
import { Aria2Options, IDownloader } from '../models/index.js';
import Aria2 from 'aria2';
import l from '../logger.js';

const logger = l.child({}, { msgPrefix: '[Aria2Downloader]' });

/**
 * Download files using Aria2
 */
export class Aria2Downloader implements IDownloader {
  #aria2: any;

  constructor(options?: Aria2Options) {
    if (!options) {
      options = Object.fromEntries(
        Object.entries(process.env)
          .filter(([key, value]) => key.startsWith('ARIA2_') && value)
          .map(([key, value]) => [key.replace('ARIA2_','').toLowerCase(), key !== 'ARIA2_SECURE' ? value : value?.toLowerCase() === 'true'] as [keyof Aria2Options, string|boolean|number])
      ) as { [prop in keyof Aria2Options]: Aria2Options[prop]; };
    }
    logger.trace({ msg: 'Aria2 config', options });
    this.#aria2 = new Aria2(options);
    // Connecting to WS enables notifications
    this.#aria2.open()
      .catch((err: any) => logger.error(`Unable to connect to Aria2 WebSocket: ${err}`));
  }

  /** @inheritdoc */
  async destroy(): Promise<void> {
    try {
      await this.#aria2.close();
    }
    catch {}
  }

  /** @inheritdoc */
  async download(url: string, tempDestination: string, destination: string): Promise<void> {
    // tempDestination should be defined at Aria2 level and accessible to this app
    const filename = basename(destination);
    logger.debug({ msg: `Starting download of '${url}' as '${filename}`, url, filename });
    const gid = await this.#aria2.call('addUri', [url], { out: filename } );
    return new Promise((resolve, reject) => {
      this.#aria2.on('onDownloadComplete', async (evt: any[]) => {
        if (evt.some(item => item.gid === gid)) {
          logger.debug({ msg: `Download completed`,  url, filename });
          try {
            logger.trace({ msg: `Moving out from temp`, url, destination , tempDestination });
            await rename(tempDestination, destination);
            resolve();
          }
          catch (ex) {
            logger.debug({ msg: `Unable to move download from '${tempDestination}' to '${destination}'`,  ex });
            reject(`Unable to move download from '${tempDestination}' to '${destination}'`);
          }
        }
      });
      this.#aria2.on('onDownloadError', (evt: any[]) => {
        const error = evt.find(item => item.gid === gid);
        if (!error) {
          logger.debug({ msg: `Download failed`, url, filename, error });
          reject(error);
        }
      });
      
      // 24h timeout
      setTimeout(() => {
        logger.debug({ msg: `Download of '${url}' timedout`, url, filename });
        reject('aria2 never completed or errored, timing out');
      }, 24 * 60 * 60 * 1000);
    });
  }
}