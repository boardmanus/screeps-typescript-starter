import { Operation } from "./Operation";
import { Job, JobPrerequisite, JobFactory } from "./Job";
import { log } from "./lib/logger/log"
import u from "./Utility"

function unload_at_site(job : JobUnload, worker : Creep, site : UnloadSite) : Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'orange' });
    worker.say('🚑');
    let res : number = worker.transfer(site, RESOURCE_ENERGY);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} transferred energy to ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        res = worker.jobMoveTo(site, 1, <LineStyle>{opacity: .4, stroke: 'orange'});
        if (res == OK) {
          log.info(`${job}: ${worker} moved towards unload site ${site} (${worker.pos.getRangeTo(site)} sq)`);
          if (worker.transfer(site, RESOURCE_ENERGY) == OK) {
            log.info(`${job}: ... and ${worker} transferred energy to ${site}`);
          }
        }
        else {
          log.error(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      default:
        log.error(`${job}: unexpected error while ${worker} unloaded at ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export type UnloadSite = StructureExtension | StructureSpawn | StructureStorage | StructureContainer | StructureLink | StructureTower;
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

    if (worker.getLastJobSite() === this._site) {
      return 0;
    }

    switch (this._site.structureType) {
      case STRUCTURE_LINK:
      case STRUCTURE_CONTAINER:
      {
        const distance = this._site.pos.getRangeTo(worker);
        if (distance > 5) {
          return 0;
        }
        break;
      }
      default:
        break;
    }
    return u.work_efficiency(worker, this._site, worker.available(), 10000);
  }

  site() : RoomObject {
    return this._site;
  }

  isSatisfied(workers : Creep[]) : boolean {
    return this._site.freeSpace() - _.sum(workers, (w : Creep) : number => { return w.available(); }) <= 0;
  }

  completion(worker? : Creep) : number {
    if (this._site instanceof StructureTower) {
      if (this._site.freeSpace() <= TOWER_ENERGY_COST) {
        return 1.0;
      }
    }

    if (worker) {
      return worker.available() > 0? 0.0 : 1.0;
    }

    return 1.0 - this._site.freeSpace()/this._site.capacity();
  }

  satisfiesPrerequisite(p : JobPrerequisite) : boolean {
    return p == JobPrerequisite.DELIVER_ENERGY && this._site.freeSpace() > 0;
  }

  prerequisite(worker : Creep) : JobPrerequisite {
    if (worker.available() == 0) {
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
