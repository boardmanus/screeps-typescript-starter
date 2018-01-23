import { Operation } from "./Operation";
import { Job, JobPrerequisite, JobFactory } from "./Job";
import { log } from "./lib/logger/log"
import u from "./Utility"

function unload_at_site(job : JobUnload, worker : Creep, site : UnloadSite) : Operation {
  return () => {
    let res = worker.transfer(site, RESOURCE_ENERGY);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} transferred energy to ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        res = worker.moveTo(site);
        if (res == OK) {
          log.info(`${job}: ${worker} moved towards unload site ${site} (${worker.pos.getRangeTo(site)} sq)`);
          if (worker.transfer(site, RESOURCE_ENERGY) == OK) {
            log.info(`${job}: ... and ${worker} transferred energy to ${site}`);
          }
        }
        else {
          log.warning(`${job}: ${worker} failed moving to unload ${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      default:
        log.error(`${job}: unexpected error while ${worker} unloaded at ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export type UnloadSite = StructureExtension | StructureSpawn | StructureStorage | StructureContainer | StructureLink | StructureTower | Creep;
export class JobUnload implements Job {

  static readonly TYPE = 'unload';

  readonly _site : UnloadSite;
  readonly _priority : number;

  constructor(site : UnloadSite, priority? : number) {
    this._site = site;
    this._priority = (priority !== undefined)? priority : 1;
  }

  id() : string {
    return `job-${JobUnload.TYPE}-${this._site.id}-${this._priority}`;
  }

  toString() : string {
    return this.id();
  }

  priority(workers : Creep[]) : number {
    return this._priority;
  }

  efficiency(worker : Creep) : number {
    return u.work_efficiency(worker, this._site, worker.availableEnergy(), 10000);
  }

  site() : RoomObject {
    return this._site;
  }

  isSatisfied(workers : Creep[]) : boolean {
    return this._site.freeSpace() - _.sum(workers, (w : Creep) : number => { return w.availableEnergy(); }) <= 0;
  }

  completion(worker? : Creep) : number {
    if (this._site instanceof StructureTower) {
      if (this._site.freeSpace() <= TOWER_ENERGY_COST) {
        return 1.0;
      }
    }

    if (worker) {
      return worker.availableEnergy() > 0? 0.0 : 1.0;
    }

    return 1.0 - this._site.freeSpace()/this._site.capacity();
  }

  satisfiesPrerequisite(p : JobPrerequisite) : boolean {
    return p == JobPrerequisite.DELIVER_ENERGY && this._site.freeSpace() > 0;
  }

  prerequisite(worker : Creep) : JobPrerequisite {
    if (worker.availableEnergy() == 0) {
      return JobPrerequisite.COLLECT_ENERGY;
    }
    return JobPrerequisite.NONE;
  }

  baseWorkerBody() : BodyPartConstant[] {
    return [ CARRY, MOVE ];
  }

  work(worker : Creep) : Operation[] {
    return [ unload_at_site(this, worker, this._site) ];
  }
}


JobFactory.addBuilder(JobUnload.TYPE, (id: string): Job|undefined => {
  const frags = id.split('-');
  const site = <UnloadSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobUnload(site, priority);
});
