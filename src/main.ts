
import { ErrorMapper } from "utils/ErrorMapper";
import { King } from "./King";
import { Operation } from "./Operation";
import { log } from './ScrupsLogger'
import 'types.impl';
import * as data from "../package.json";
import * as Profiler from "Profiler/Profiler";
import Cli from "Cli";


// Any code written outside the `loop()` method is executed only when the
// Screeps system reloads your script.
// Use this bootstrap wisely. You can cache some of your stuff to save CPU.
// You should extend prototypes before the game loop executes here.

// This is an example for using a config variable from `config.ts`.
// NOTE: this is used as an example, you may have better performance
// by setting USE_PROFILER through webpack, if you want to permanently
// remove it on deploy
// Start the profiler
log.info(`Scripts bootstrapped`);
log.info(`Revision ID: ${(<any>data).version}`);

global.Profiler = Profiler.init();

export const loop = ErrorMapper.wrapLoop(() => {

  log.info(` ***** TICK ${Game.time} ***** `);
  Cli.create();

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

  log.info(`About to perform ${operations.length} operations`);
  _.each(operations, (op: Operation): void => {
    try {
      op();
    }
    catch (e) {
      log.error(`${op}: ${e}`)
    }
  });
});
