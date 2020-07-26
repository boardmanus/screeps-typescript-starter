import { Operation } from "Operation";
import { log } from "lib/logger/log";


export enum Prerequisite {
  NONE,
  COLLECT_ENERGY,
  DELIVER_ENERGY
}


export interface Model {
  id(): string;
  type(): string;
  site(): RoomObject;
  priority(workers: Creep[]): number;
  isSatisfied(workers: Creep[]): boolean;
  efficiency(worker: Creep): number;
  completion(worker?: Creep): number;
  work(worker: Creep): Operation[];
  satisfiesPrerequisite(prerequisite: Prerequisite): boolean;
  baseWorkerBody(): BodyPartConstant[];
}

export type Map = { [id: string]: Model };

class Factory {

  private _builders: { [builderId: string]: (id: string) => Model | undefined };

  constructor() {
    this._builders = {};
  }

  build(id: string): Model | undefined {
    const builder = this._builders[this.builderId(id)];
    return builder(id);
  }

  addBuilder(builderId: string, builder: (id: string) => Model | undefined) {
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


export const factory = new Factory();
