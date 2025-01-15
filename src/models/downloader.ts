/**
 * Represents a service used to download files
 */
export interface IDownloader {
  /**
   * Download the provided url to the specified location
   * @param url The URL to download
   * @param tempDestination The location where the file is being downloaded
   * @param destination The location where the file is moved when the download completed 
   */
  download(url: string, tempDestination: string, destination: string): Promise<void>;

  /**
   * Free the downloaders resources
   */
  destroy(): Promise<void>;
}