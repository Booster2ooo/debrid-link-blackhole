import { unlink } from 'fs/promises';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
//import Watcher from 'watcher';
import { AuthManager, SmtpMailer, Watcher } from './services/index.js';
import l from './logger.js';
import { resolvePath } from './utils.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const downloadManager = __filename.replace('main', 'download-manager');
const logger = l;
const blackhole: string | undefined = resolvePath(process.env.BLACKHOLE, ['torrents']);
if (!blackhole) {
  throw new Error('Missing blackhole configuration');
}

let watcher: Watcher | undefined;
(async() => {
  try {
    logger.info('.: Debrid-Link Blackhole :.');
    logger.info(`Initiliazing AuthManager`);
    const mailer = new SmtpMailer();
    const authManager = new AuthManager(mailer);
    await authManager.getToken();

    logger.info(`Watching '${blackhole}'`);
    watcher = new Watcher(blackhole);
    
    const exit = () => {
      if (watcher) watcher.close();
      process.exit(0);
    }
    process.once('SIGTERM', () => {
      logger.info('\nSIGTERM signal received.');
      exit();
    });
    process.once('SIGINT', () => {
      logger.info('\nSIGINT signal received.');
      exit();
    });
    process.once('SIGQUIT', () => {
      logger.info('\nSIGQUIT signal received.');
      exit();
    });
    process.once('exit', () => {
      logger.info('Exiting');
    });

    watcher.on('add', (filePath: string) => {
      if (!filePath.endsWith('.torrent') && !filePath.endsWith('.magnet')) {
        logger.warn(`Ignored file '${filePath}', not a .torrent or .magnet`);
        return;
      }
      const child = spawn('node', [downloadManager, filePath]);
      child.once('exit', async (code, signal) => {
        logger.debug(`child process exited with code ${code} and signal ${signal}`);
        if (!code) {
          logger.debug(`Removing .torrent file '${filePath}'`);
          try {
            await unlink(filePath);
          }
          catch (ex) {
            logger.error({ msg: `Unable to remove .torrent file '${filePath}'`,  ex })
          }
        }
        else {
          logger.debug(`The download was flawed, keeping .torrent file '${filePath}'`);
        }
      });
      child.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
        //logger.debug(data.toString());
      });
      child.stderr.on('data', (data) => {
        process.stdout.write(data.toString());
        //logger.debug(data.toString());
      });
      child.once('close', (code, signal) => {
        logger.debug(`child process close all stdio with code ${code} and signal ${signal}`);
      });
      child.once('error ', (err) => {
        logger.debug('child process error ' + err);
      });
      child.once('disconnect ', () => {
        logger.debug('child process disconnected');
      });
    });
  }
  catch (ex) {
    if (watcher) {
      watcher.close();
    }
    logger.error(ex);
    process.exit(1);
  }
})();