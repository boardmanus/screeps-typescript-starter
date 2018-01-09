import * as Profiler from "screeps-profiler";
import { log } from "./lib/logger/log";
import { King } from "./King";
import { Operation } from "./Operation";
import "./extensions";


// Any code written outside the `loop()` method is executed only when the
// Screeps system reloads your script.
// Use this bootstrap wisely. You can cache some of your stuff to save CPU.
// You should extend prototypes before the game loop executes here.

// This is an example for using a config variable from `config.ts`.
// NOTE: this is used as an example, you may have better performance
// by setting USE_PROFILER through webpack, if you want to permanently
// remove it on deploy
// Start the profiler
Profiler.enable();

log.info(`Scripts bootstrapped`);
if (__REVISION__) {
  log.info(`Revision ID: ${__REVISION__}`);
}


function mloop() {

  log.info(`***** TICK ${Game.time} *****`);

  for (const i in Memory.creeps) {
    if (!Game.creeps[i]) {
      delete Memory.creeps[i];
    }
  }

  for (const i in Memory.rooms) {
    if (!Game.rooms[i]) {
      delete Memory.rooms[i];
    }
  }

  let king = new King();

  const operations = king.rule();

  king.save();

  log.debug(`About to perform ${operations.length} operations`);
  _.each(operations, (op : Operation) : void => {
    op();
  });
}

/**
 * Screeps system expects this "loop" method in main.js to run the
 * application. If we have this line, we can be sure that the globals are
 * bootstrapped properly and the game loop is executed.
 * http://support.screeps.com/hc/en-us/articles/204825672-New-main-loop-architecture
 *
 * @export
 */
export const loop = () => { Profiler.wrap(mloop); }
//export const loop = mloop;
