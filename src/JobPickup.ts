import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'


function withdraw_from_site(job: JobPickup, worker: Creep, site: Structure | Tombstone): Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'green' });
    let res: number = worker.withdraw(site, RESOURCE_ENERGY);
    switch (res) {
      default:
        log.error(`${job}: unexpected error while ${worker} tried withdrawing from ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE:
        res = worker.jobMoveTo(site, 1, <LineStyle>{ opacity: .4, stroke: 'green' });
        if (res == OK) {
          log.info(`${job}: ${worker} moved towards ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          log.warning(`${job}: ${worker} failed moving to ${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} withdrew resources from ${site}`);
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
        log.info(`${job}: ${worker} picked up resources from ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = worker.jobMoveTo(site, 1, <LineStyle>{ opacity: .4, stroke: 'green' });
        if (res == OK) {
          log.info(`${job}: ${worker} moved towards ${site} (${worker.pos.getRangeTo(site)} sq)`);
          if (worker.pickup(site) == OK) {
            log.info(`${job}: ... and ${worker} picked up resources from ${site}`);
          }
        }
        else {
          log.warning(`${job}: ${worker} failed moving to ${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried picking up resources-${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobPickup implements Job.Model {

  static readonly TYPE = 'pickup';

  readonly _site: PickupSite;
  readonly _priority: number;

  constructor(site: PickupSite, priority?: number) {
    this._site = site;
    this._priority = (priority !== undefined) ? priority : 4;
  }

  id(): string {
    return `job-${JobPickup.TYPE}-${this._site.id}`;
  }

  type(): string {
    return JobPickup.TYPE;
  }

  toString(): string {
    return this.id();
  }

  priority(workers?: Creep[]): number {
    if (!workers) return this._priority;
    return this._priority;
  }

  efficiency(worker: Creep): number {
    let booster = 1;
    if (worker.getLastJobSite() === this._site) {
      return 0;
    }

    if (u.find_nearby_attackers(this._site).length > 0) {
      return 0;
    }

    return u.taxi_efficiency(worker, this._site, Math.min(worker.freeSpace(), this._site.available()));
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    const space = _.sum(workers, (w: Creep): number => { return w.freeSpace(); });
    return this._site.available() < space;
  }

  completion(worker?: Creep): number {

    const available = this._site.available();
    if (available == 0) {
      return 1.0;
    }

    if (worker) {
      if (worker.freeSpace() == 0) {
        return 1.0;
      }
      return worker.holding() / worker.capacity();
    }

    return 0.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  satisfiesPrerequisite(prerequisite: Job.Prerequisite): boolean {
    if (prerequisite == Job.Prerequisite.COLLECT_ENERGY) {
      return this._site.available() > 0;
    }

    return false;
  }

  prerequisite(worker: Creep): Job.Prerequisite {
    if (worker.carry.getUsedCapacity() == worker.carryCapacity) {
      return Job.Prerequisite.DELIVER_ENERGY;
    }

    return Job.Prerequisite.NONE;
  }

  work(worker: Creep): Operation[] {
    if (this._site instanceof Resource) {
      return [pickup_at_site(this, worker, this._site)];
    }
    else {
      return [withdraw_from_site(this, worker, this._site)];
    }
  }
}


Job.factory.addBuilder(JobPickup.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <PickupSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobPickup(site);
});
