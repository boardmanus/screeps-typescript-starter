
class ScrupsLogger {
  constructor() {

  }

  debug(msg: string) {
    console.log(`DEBUG: ${msg}`);
  }
  info(msg: string) {
    console.log(`INFO: ${msg}`);
  }
  warning(msg: string) {
    console.log(`WARNING: ${msg}`);
  }
  error(msg: string) {
    console.log(`ERROR: ${msg}`);
  }
}

export const log = new ScrupsLogger();

//export { log } from "./lib/logger/log";
