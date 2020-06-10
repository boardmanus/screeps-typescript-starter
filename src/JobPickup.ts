import { Operation } from "./Operation";
import { Job, JobFactory, JobPrerequisite } from "./Job";
import u from "./Utility"

export type PickupSite = Resource | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;


function withdraw_from_site(job: JobPickup, worker: Creep, site: Structure): Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'green' });
    let res: number = worker.withdraw(site, RESOURCE_ENERGY);
    switch (res) {
      default:
        console.log(`ERROR: ${job}: unexpected error while ${worker} tried withdrawing from ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = worker.jobMoveTo(site, 1, <LineStyle>{ opacity: .4, stroke: 'green' });
        if (res == OK) {
          console.log(`INFO: ${job}: ${worker} moved towards ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          console.log(`ERROR: ${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
      }
        break;
      case OK:
        // Finished job.
        console.log(`INFO: ${job}: ${worker} withdrew resources from ${site}`);
        break;
    }
  }
}

function pickup_at_site(job: JobPickup, worker: Creep, site: Resource): Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'green' });
    worker.say('🚑');
    let res: number = worker.pickup(site);
    switch (res) {
      case OK:
        // Finished job.
        console.log(`INFO: ${job}: ${worker} picked up resources from ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = worker.jobMoveTo(site, 1, <LineStyle>{ opacity: .4, stroke: 'green' });
        if (res == OK) {
          console.log(`INFO: ${job}: ${worker} moved towards resources-${site} (${worker.pos.getRangeTo(site)} sq)`);
          if (worker.pickup(site) == OK) {
            console.log(`INFO: ${job}: ... and ${worker} picked up resources from ${site}`);
          }
        }
        else {
          console.log(`WARN: ${job}: ${worker} failed moving to resources-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      }
      default:
        console.log(`ERROR: ${job}: unexpected error while ${worker} tried picking up resources-${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export class JobPickup implements Job {

  static readonly TYPE = 'pickup';

  readonly _site: PickupSite;
  readonly _priority: number;

  constructor(site: PickupSite, priority?: number) {
    this._site = site;
    this._priority = (priority !== undefined) ? priority : 4;
  }

  id(): string {
    return `job-${JobPickup.TYPE}-${this._site.id}-${this._priority}`;
  }


  toString(): string {
    return this.id();
  }

  priority(workers: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {
    let booster = 1;
    if (worker.getLastJobSite() === this._site) {
      return 0;
    }

    if (this._site instanceof StructureLink) {
      const distance = this._site.pos.getRangeTo(worker);
      if (distance < 5) {
        booster = 2;
      }
    }
    return booster * u.work_efficiency(worker, this._site, Math.min(worker.freeSpace(), this._site.available()), 10000);
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    const space = _.sum(workers, (w: Creep): number => { return w.freeSpace(); });
    return this._site.available() < space;
  }

  completion(worker?: Creep): number {

    if (worker) {
      return worker.carry.getUsedCapacity() / worker.carryCapacity;
    }

    return this._site.available() > 0 ? 0.0 : 1.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  satisfiesPrerequisite(prerequisite: JobPrerequisite): boolean {
    if (prerequisite == JobPrerequisite.COLLECT_ENERGY) {
      return this._site.available() > 0;
    }

    return false;
  }

  prerequisite(worker: Creep): JobPrerequisite {
    if (worker.carry.getUsedCapacity() == worker.carryCapacity) {
      return JobPrerequisite.DELIVER_ENERGY;
    }

    return JobPrerequisite.NONE;
  }

  work(worker: Creep): Operation[] {

    if (this._site instanceof Structure) {
      return [withdraw_from_site(this, worker, this._site)];
    }

    else if (this._site instanceof Resource) {
      return [pickup_at_site(this, worker, this._site)];
    }

    return [];
  }
}


JobFactory.addBuilder(JobPickup.TYPE, (id: string): Job | undefined => {
  const frags = id.split('-');
  const site = <PickupSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobPickup(site, priority);
});
