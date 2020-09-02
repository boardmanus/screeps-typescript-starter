import ErrorMapper from 'utils/ErrorMapper';
import King from 'King';
import { Operation } from 'Operation';
import log from 'ScrupsLogger';
import 'types.impl';
import * as Profiler from 'Profiler/Profiler';
import Cli from 'Cli';
import * as data from '../package.json';

// Any code written outside the `loop()` method is executed only when the
// Screeps system reloads your script.
// Use this bootstrap wisely. You can cache some of your stuff to save CPU.
// You should extend prototypes before the game loop executes here.

// This is an example for using a config variable from `config.ts`.
// NOTE: this is used as an example, you may have better performance
// by setting USE_PROFILER through webpack, if you want to permanently
// remove it on deploy
// Start the profiler
log.info('Scripts bootstrapped');
log.info(`Revision ID: ${data.version}`);

global.Profiler = Profiler.init();

const loop = ErrorMapper.wrapLoop(() => {

  log.info(` ***** TICK ${Game.time} ***** `);
  Cli.create();

  _.each(Memory.creeps, (_creep, name) => {
    if (name && !Game.creeps[name]) {
      delete Memory.creeps[name];
    }
  });

  _.each(Memory.rooms, (_room, name) => {
    if (name && !Game.rooms[name]) {
      delete Memory.rooms[name];
    }
  });

  const king = new King();

  const operations = king.rule();

  king.save();

  log.info(`About to perform ${operations.length} operations`);
  _.each(operations, (op: Operation): void => {
    try {
      op();
    } catch (e) {
      log.error(`${op}: ${e}`);
    }
  });
});

export { loop as default };
