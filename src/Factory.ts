import { log } from "./lib/logger/log";

export class Factory<T> {

  private _builders : { [builderId: string]: (id : string) => T };

  constructor() {
    this._builders = {};
  }

  build(id : string) : T {
    const builder = this._builders[this.builderId(id)];
    return builder(id);
  }

  addBuilder(builderId : string, builder : (id: string) => T) {
    this._builders[builderId] = builder;
    log.info(`Added factory method for ${builderId}`)
  }

  builderId(id : string) : string {
    const frags = id.split('-');
    if (frags.length < 2) {
      return '';
    }

    return frags[1];
  }
}
