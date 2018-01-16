import { Operation } from "./Operation";
import { Job, JobFactory, JobPrerequisite } from "./Job";
import { log } from "./lib/logger/log"
import u from "./Utility"

export type PickupSite = Resource|StructureContainer|StructureStorage|StructureLink|StructureExtension|StructureSpawn;


function withdraw_from_site(job : JobPickup, worker : Creep, site : Structure) : Operation {
  return () => {
    let res = worker.withdraw(site, RESOURCE_ENERGY);
    switch (res) {
      default:
        log.error(`${job}: unexpected error while ${worker} tried withdrawing from ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE: {
        const res = worker.moveTo(site);
          if (res == OK) {
            log.info(`${job}: ${worker} moved towards ${site} (${worker.pos.getRangeTo(site)} sq)`);
          }
          else {
            log.warning(`${job}: ${worker} failed to move towards ${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
          }
        }
        break;
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} withdrew resources from ${site}`);
        break;
    }
  }
}

function pickup_at_site(job : JobPickup, worker : Creep, site : Resource) : Operation {
  return () => {
    let res = worker.pickup(site);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} picked up resources from ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        let res = worker.moveTo(site);
        if (res == OK) {
          log.info(`${job}: ${worker} moved towards resources-${site} (${worker.pos.getRangeTo(site)} sq)`);
          if (worker.pickup(site) == OK) {
            log.info(`${job}: ... and ${worker} picked up resources from ${site}`);
          }
        }
        else {
          log.warning(`${job}: ${worker} failed moving to resources-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried picking up resources-${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export class JobPickup implements Job {

  static readonly TYPE = 'pickup';

  readonly _site : PickupSite;
  readonly _priority : number;

  constructor(site : PickupSite, priority? : number) {
    this._site = site;
    this._priority = (priority !== undefined)? priority : 4;
  }

  id() : string {
    return `job-${JobPickup.TYPE}-${this._site.id}-${this._priority}`;
  }


  toString() : string {
    return this.id();
  }

  priority(workers : Creep[]) : number {
    return this._priority;
  }

  efficiency(worker : Creep) : number {
    return u.work_efficiency(worker, this._site, worker.freeSpace(), 10000);
  }

  site() : RoomObject {
    return this._site;
  }

  isSatisfied(workers : Creep[]) : boolean {
    const space = _.sum(workers, (w : Creep) : number => { return w.freeSpace(); });
    return this._site.availableEnergy() < space;
  }

  completion(worker? : Creep) : number {

    if (worker) {
      return _.sum(worker.carry)/worker.carryCapacity;
    }

    return this._site.availableEnergy() > 0? 0.0 : 1.0;
  }

  baseWorkerBody() : BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  satisfiesPrerequisite(prerequisite : JobPrerequisite) : boolean {
    if (prerequisite == JobPrerequisite.COLLECT_ENERGY) {
      return this._site.availableEnergy() > 0;
    }

    return false;
  }

  prerequisite(worker : Creep) : JobPrerequisite {
    if (_.sum(worker.carry) == worker.carryCapacity) {
      return JobPrerequisite.DELIVER_ENERGY;
    }

    return JobPrerequisite.NONE;
  }

  work(worker : Creep) : Operation[] {

    if (this._site instanceof Structure) {
      return [ withdraw_from_site(this, worker, this._site) ];
    }

    else if (this._site instanceof Resource) {
      return [ pickup_at_site(this, worker, this._site) ];
    }

    return [];
  }
}


JobFactory.addBuilder(JobPickup.TYPE, (id: string): Job|undefined => {
  const frags = id.split('-');
  const site = <PickupSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobPickup(site, priority);
});
