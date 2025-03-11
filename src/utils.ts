import { join, resolve } from 'path';
//import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import l from './logger.js';
const logger = l.child({}, { msgPrefix: '[Utils]' });

dotenv.config();
//const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd = process.cwd();

/**
 * Resolves the provided path
 * @param path The path to be resolved
 * @param dataRelative The path relative to DATA if the provided path is empty
 */
export function resolvePath(path: string | undefined, dataRelative?: string[]): string {
  path = path?.trim() || '';
  
  if (!path && process.env.DATA) {
    const to = join(...(dataRelative || []));
    path = resolve(process.env.DATA, to);
  }
  if (path.startsWith('.')) {
    path = resolve(cwd, path);
  }
  return path;
}

/**
 * Wait for the specified amount of ms before resolving
 * @param delay The number of millisec to wait before resolving
 * @returns 
 */
export async function sleep(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Fetch with possible retries
 * @param input See fetch
 * @param init See fetch
 * @param retryCount The number of possible retries (default 3)
 * @returns  See fetch
 */
export async function retryableFetch(input: string | URL | globalThis.Request, init?: RequestInit, retryCount: number = 3): Promise<Response> {
  try {
    logger.trace(`Trying '${input}'`);
    return await fetch(input, init);
  }
  catch (ex) {
    retryCount--;
    logger.trace({ msg: `Failed, retries left: ${retryCount}` , err: ex });
    if (!retryCount) {
      throw ex;
    }
    await sleep(500);
    return retryableFetch(input, init, retryCount);
  }
}
