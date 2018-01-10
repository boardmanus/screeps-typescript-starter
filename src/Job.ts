import { Operation } from "./Operation";
import { log } from "./lib/logger/log";

class Factory {

  private _builders : { [builderId: string]: (id : string) => Job|undefined };

  constructor() {
    this._builders = {};
  }

  build(id : string) : Job|undefined {
    const builder = this._builders[this.builderId(id)];
    return builder(id);
  }

  addBuilder(builderId : string, builder : (id: string) => Job|undefined) {
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


export const JobFactory = new Factory();

export enum JobPrerequisite {
  NONE,
  COLLECT_ENERGY,
  DELIVER_ENERGY
}

export interface Job {
  id() : string;
  site() : RoomObject;
  priority() : number;
  isSatisfied(workers : Creep[]) : boolean;
  completion(worker? : Creep) : number;
  work(worker : Creep) : Operation[];
  satisfiesPrerequisite(prerequisite : JobPrerequisite) : boolean;
  prerequisite(worker : Creep) : JobPrerequisite;
  baseWorkerBody() : BodyPartConstant[];
}
