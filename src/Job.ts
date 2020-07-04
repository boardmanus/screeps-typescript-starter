import { Operation } from "Operation";


export enum Prerequisite {
  NONE,
  COLLECT_ENERGY,
  DELIVER_ENERGY
}


export interface Model {
  id(): string;
  site(): RoomObject;
  priority(workers: Creep[]): number;
  isSatisfied(workers: Creep[]): boolean;
  efficiency(worker: Creep): number;
  completion(worker?: Creep): number;
  work(worker: Creep): Operation[];
  satisfiesPrerequisite(prerequisite: Prerequisite): boolean;
  prerequisite(worker: Creep): Prerequisite;
  baseWorkerBody(): BodyPartConstant[];
}


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
    console.log(`INFO: Added factory method for ${builderId}`)
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
