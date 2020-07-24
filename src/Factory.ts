import { log } from './ScrupsLogger'

export default class Factory<T> {

  private _builders: { [builderId: string]: (id: string) => T | undefined };

  constructor() {
    this._builders = {};
  }

  build(id: string): T | undefined {
    const builder = this._builders[this.builderId(id)];
    log.debug(`${this}: building ${id}`)
    return builder(id);
  }

  addBuilder(builderId: string, builder: (id: string) => T | undefined) {
    this._builders[builderId] = builder;
    log.info(`Added factory method for ${builderId}`)
  }

  builderId(id: string): string {
    const frags = id.split('-');
    if (frags.length < 2) {
      return '';
    }

    return frags[1];
  }
}
