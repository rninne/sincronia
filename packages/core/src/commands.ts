import { Sinc } from "@sincronia/types";
import ConfigManager from "./config";
import { startWatching } from "./Watcher";
import AppManager from "./AppManager";
import * as AppUtils from "./appUtils";
import { startWizard } from "./wizard";
import { logger } from "./Logger";
import { scopeCheckMessage, devModeLog, logPushResults } from "./logMessages";
import { getCurrentScope } from "./server";

async function scopeCheck(
  successFunc: () => void,
  swapScopes: boolean = false
) {
  try {
    const scopeCheck = await AppManager.checkScope(swapScopes);
    if (!scopeCheck.match) {
      scopeCheckMessage(scopeCheck);
      // Throw exception to register this as an error
      throw new Error();
    } else {
      successFunc();
    }
  } catch (e) {
    logger.error(
      "Failed to check your scope! You may want to make sure your project is configured correctly or run `npx sinc init`"
    );
    // Throw exception to register this as an error
    throw e;
  }
}

function setLogLevel(args: Sinc.SharedCmdArgs) {
  logger.setLogLevel(args.logLevel);
}

export async function devCommand(args: Sinc.SharedCmdArgs) {
  setLogLevel(args);
  scopeCheck(async () => {
    startWatching(ConfigManager.getSourcePath());
    devModeLog();

    let refresher = () => {
      refreshCommand(args, false);
    };
    let interval = ConfigManager.getRefresh();
    if (interval && interval > 0) {
      logger.info(`Checking for new manifest files every ${interval} seconds`);
      setInterval(refresher, interval * 1000);
    }
  });
}
export async function refreshCommand(
  args: Sinc.SharedCmdArgs,
  log: boolean = true
) {
  setLogLevel(args);
  scopeCheck(async () => {
    try {
      if (!log) setLogLevel({ logLevel: "warn" });
      await AppManager.syncManifest();
      setLogLevel(args);
    } catch (e) {
      throw e;
    }
  });
}
export async function pushCommand(args: Sinc.PushCmdArgs): Promise<void> {
  setLogLevel(args);
  scopeCheck(async () => {
    try {
      const { updateSet, ci, target, diff } = args;
      // Does not create update set if updateSetName is blank
      await AppManager.createAndAssignUpdateSet(updateSet, ci);
      const getEncodedPaths = async () => {
        if (target !== undefined && target !== "") {
          return target;
        }
        if (diff !== "") {
          return AppManager.gitDiff(diff);
        }
        return ConfigManager.getSourcePath();
      };
      const encodedPaths = await getEncodedPaths();
      const [fileTree, count] = await AppUtils.getFileTreeAndCount(
        encodedPaths
      );
      logger.info(`${count} files to push.`);
      let canPush = true;
      if (!ci) {
        canPush = await AppManager.canPush();
      }
      if (!canPush) {
        return;
      }
      const pushResults = await AppUtils.pushFiles(fileTree, count);
      logPushResults(pushResults);
    } catch (e) {
      throw e;
    }
  }, args.scopeSwap);
}
export async function downloadCommand(args: Sinc.CmdDownloadArgs) {
  setLogLevel(args);
  try {
    await AppManager.downloadWithFiles(args.scope as string);
  } catch (e) {
    throw e;
  }
}
export async function initCommand(args: Sinc.SharedCmdArgs) {
  setLogLevel(args);
  try {
    await startWizard();
  } catch (e) {
    throw e;
  }
}

export async function buildCommand(args: Sinc.BuildCmdArgs) {
  setLogLevel(args);
  try {
    if (args.diff !== "") {
      let files = await AppManager.gitDiff(args.diff);
      AppManager.writeDiff(files);
    }
    await AppManager.buildFiles();
  } catch (e) {
    throw e;
  }
}

export async function deployCommand(args: Sinc.SharedCmdArgs) {
  setLogLevel(args);
  try {
    await AppManager.deployFiles();
  } catch (e) {
    throw e;
  }
}

export async function statusCommand() {
  try {
    let scopeObj = await getCurrentScope();
    logger.info(`Instance: ${process.env.SN_INSTANCE}`);
    logger.info(`Scope: ${scopeObj.scope}`);
    logger.info(`User: ${process.env.SN_USER}`);
  } catch (e) {
    throw e;
  }
}
