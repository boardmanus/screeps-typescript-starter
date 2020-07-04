import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility";
import { log } from './ScrupsLogger'

function upgrade_site(job: JobUpgrade, worker: Creep, site: StructureController): Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'orange' });
    worker.say('🏵️');
    let res: number = worker.upgradeController(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} upgraded controller ${site})`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = worker.jobMoveTo(site, 3, <LineStyle>{ opacity: .4, stroke: 'orange' });
        if (res == OK) {
          log.info(`${job}: ${worker} moved towards controller ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          log.error(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} upgraded ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export class JobUpgrade implements Job.Model {

  static readonly TYPE = 'upgrade';

  readonly _site: StructureController;
  readonly _priority: number;

  constructor(site: StructureController, priority?: number) {
    this._site = site;
    this._priority = (priority !== undefined) ? priority : 3;
  }

  id(): string {
    return `job-${JobUpgrade.TYPE}-${this._site.id}-${this._priority}`;
  }

  toString(): string {
    return this.id();
  }

  priority(workers: Creep[]): number {
    let priority: number;
    const downgrade = CONTROLLER_DOWNGRADE[this._site.level];
    if (this._site.ticksToDowngrade < downgrade / 5) {
      priority = this._priority + 5;
    }
    else if (this._site.ticksToDowngrade < downgrade / 4) {
      priority = this._priority + 4;
    }
    else if (this._site.ticksToDowngrade < downgrade / 3) {
      priority = this._priority + 3;
    }
    else if (this._site.ticksToDowngrade < downgrade / 2) {
      priority = this._priority + 1;
    }
    else {
      priority = this._priority;
    }

    return this._priority / (workers.length + 1);
  }

  efficiency(worker: Creep): number {
    return u.work_efficiency(worker, this._site, worker.available(), UPGRADE_CONTROLLER_POWER);
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(_: Creep[]): boolean {
    return false;
  }

  completion(worker?: Creep): number {
    if (worker) {
      return 1.0 - worker.available() / worker.carryCapacity;
    }

    return 0.0;
  }

  satisfiesPrerequisite(_: Job.Prerequisite): boolean {
    return false;
  }

  prerequisite(worker: Creep): Job.Prerequisite {
    if (worker.available() == 0) {
      return Job.Prerequisite.COLLECT_ENERGY;
    }
    return Job.Prerequisite.NONE;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [WORK, CARRY, WORK, CARRY];
  }

  work(worker: Creep): Operation[] {
    return [upgrade_site(this, worker, this._site)];
  }
}


Job.factory.addBuilder(JobUpgrade.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <StructureController>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobUpgrade(site, priority);
});
