//import { LoggerManager } from "typescript-logger";

//export const log = LoggerManager.create('scrups');
class ScrupsLogger {
  constructor() {

  }

  debug(msg: string) {
    console.log(msg);
  }
  info(msg: string) {
    console.log(msg);
  }
  warn(msg: string) {
    console.log(msg);
  }
  error(msg: string) {
    console.log(msg);
  }
}

export const log = new ScrupsLogger();
