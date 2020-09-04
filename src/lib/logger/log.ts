import { LogLevels } from './logLevels';
import * as Config from '../../config/config';

function color(str: string, c: string): string {
  return `<font color='${c}'>${str}</font>`;
}

function time(): string {
  return color(Game.time.toString(), 'gray');
}

export default class Log {

  public get level(): number { return Memory.log?.level ?? 1; }
  public set level(value: number) { Memory.log.level = value; }
  public get showSource(): boolean { return Memory.log?.showSource ?? false; }
  public set showSource(value: boolean) { Memory.log.showSource = value; }
  public get showTick(): boolean { return Memory.log?.showTick ?? false; }
  public set showTick(value: boolean) { Memory.log.showTick = value; }

  constructor() {
    _.defaultsDeep(Memory, {
      log: {
        level: Config.LOG_LEVEL,
        showTick: Config.LOG_PRINT_TICK
      }
    });
  }

  public error(...args: any[]) {
    if (this.level >= LogLevels.ERROR) {
      console.log.apply(this, [this.buildArguments(LogLevels.ERROR), args]);
    }
  }

  public warning(...args: any[]) {
    if (this.level >= LogLevels.WARNING) {
      console.log.apply(this, [this.buildArguments(LogLevels.WARNING), args]);
    }
  }

  public info(...args: any[]) {
    if (this.level >= LogLevels.INFO) {
      console.log.apply(this, [this.buildArguments(LogLevels.INFO), args]);
    }
  }

  public debug(...args: any[]) {
    if (this.level >= LogLevels.DEBUG) {
      console.log.apply(this, [this.buildArguments(LogLevels.DEBUG), args]);
    }
  }

  private buildArguments(level: number): string[] {
    const out: string[] = [];
    if (this.showTick) {
      out.push(time());
    }

    switch (level) {
      case LogLevels.ERROR:
        out.push(color('ERROR:', 'red'));
        break;
      case LogLevels.WARNING:
        out.push(color('WARN: ', 'yellow'));
        break;
      case LogLevels.INFO:
        out.push(color('INFO: ', 'green'));
        break;
      case LogLevels.DEBUG:
        out.push(color('DEBUG:', 'gray'));
        break;
      default:
        break;
    }

    return out;
  }
}

export const log = new Log();

declare const global: any;
global.log = log;
