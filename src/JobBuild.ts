import { Operation } from "./Operation";
import { Job, JobFactory, JobPrerequisite } from "./Job";
import { log } from "./lib/logger/log";
import u from "./Utility"


function build_site(job : JobBuild, worker : Creep, site : ConstructionSite) {
  return () => {
    const res = worker.build(site);
    switch (res) {
      case OK:
        log.info(`${job.id()}: ${worker} built stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        const moveRes = worker.moveTo(site);
        if (moveRes == OK) {
          log.info(`${job.id()}: ${worker} moved to construction site ${site}`);
        }
        else {
          log.warning(`${job.id()}: ${worker} failed to move towards construction site ${site} (${u.errstr(moveRes)})`);
        }
        break;
      default:
        log.warning(`${job.id()}: ${worker} failed while building at ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export class JobBuild implements Job {

  static readonly TYPE = 'build';

  //private _state : BuildState;
  readonly _site : ConstructionSite;
  readonly _priority : number;

  constructor(site : ConstructionSite, priority? : number) {

    this._site = site;
    this._priority = priority || 10;
  }

  id() : string {
    return `job-${JobBuild.TYPE}-${this._site.id}-${this._priority}`;
  }

  toString() : string {
    return this.id();
  }

  site() : RoomPosition {
    return this._site.pos;
  }
  priority() : number {
    return this._priority;
  }

  isSatisfied(workers : Creep[]) : boolean {
    return workers.length > 2;
  }

  completion(worker? : Creep) : number {
    const completion = this._site.progress/this._site.progressTotal;
    if (!worker || completion == 1.0) {
      return completion;
    }

    return 1.0 - worker.availableEnergy()/worker.carryCapacity;
  }

  baseWorkerBody() : BodyPartConstant[] {
    return [MOVE, WORK, CARRY];
  }

  satisfiesPrerequisite(prerequisite : JobPrerequisite) : boolean {
    if (prerequisite == JobPrerequisite.DELIVER_ENERGY) {
      return this.completion() < 1.0;
    }

    return false;
  }

  prerequisite(worker : Creep) : JobPrerequisite {
    if (worker.availableEnergy() == 0) {
      return JobPrerequisite.COLLECT_ENERGY;
    }

    return JobPrerequisite.NONE;
  }

  work(worker : Creep) : Operation[] {
    return [ build_site(this, worker, this._site) ];
  }
}


JobFactory.addBuilder(JobBuild.TYPE, (id: string): Job|undefined => {
  const frags = id.split('-');
  const site = <ConstructionSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  return new JobBuild(site);
});
