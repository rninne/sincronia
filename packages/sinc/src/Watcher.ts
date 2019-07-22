import chokidar from "chokidar";
import * as Utils from "./utils";
import { pushFile } from "./server";
class Watcher {
  watcher?: chokidar.FSWatcher;
  constructor() {
    this.watcher = undefined;
  }
  startWatching(directory: string) {
    this.watcher = chokidar.watch(directory);
    this.watcher.on("change", this.fileChanged);
  }
  private async fileChanged(path: string) {
    try {
      let payload = await Utils.parseFileNameParams(path);
      const targetServer =
        process.env.SN_INSTANCE ||
        console.error("No server configured for push!") ||
        "";
      if (targetServer && payload) {
        await pushFile(targetServer, payload);
        console.log(`${path} pushed to server!`);
      }
    } catch (e) {
      console.error(`${path} failed to sync!`);
    }
  }
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
export default new Watcher();
