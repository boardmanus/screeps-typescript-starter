import { Operation } from "./Operation";
import { Job, JobPrerequisite, JobFactory } from "./Job";
import { log } from "./lib/logger/log"
import u from "./Utility";

function upgrade_site(job : JobUpgrade, worker : Creep, site : StructureController) : Operation {
  return () => {
    let res = worker.upgradeController(site);
    switch (res) {
      case ERR_NOT_OWNER:
      case ERR_INVALID_ARGS:
      case ERR_INVALID_TARGET:
      case ERR_NOT_ENOUGH_RESOURCES:
      case ERR_BUSY:
      default:
        log.error(`${job}: unexpected error while ${worker} upgraded ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE: {
        const res = worker.moveTo(site);
          if (res == OK) {
            log.info(`${job}: ${worker} moved towards controller ${site} (${worker.pos.getRangeTo(site)} sq)`);
          }
          else {
            log.warning(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
          }
        }
        break;
      case OK:
        log.info(`${job}: ${worker} upgraded controller ${site})`);
        break;
    }
  }
}

export class JobUpgrade implements Job {

  static readonly TYPE = 'upgrade';

  readonly _site : StructureController;
  readonly _priority : number;

  constructor(site : StructureController, priority? : number) {
    this._site = site;
    this._priority = (priority !== undefined)? priority : 5;
  }

  id() : string {
    return `job-${JobUpgrade.TYPE}-${this._site.id}-${this._priority}`;
  }

  toString() : string {
    return this.id();
  }

  priority(workers : Creep[]) : number {
    let priority : number;

    if (this._site.ticksToDowngrade < 100) {
      priority = this._priority+5;
    }
    else if (this._site.ticksToDowngrade < 1000) {
      priority = this._priority+4;
    }
    else if (this._site.ticksToDowngrade < 2000) {
      priority = this._priority+3;
    }
    else if (this._site.ticksToDowngrade < 5000) {
      priority = this._priority+1;
    }
    else {
      priority = this._priority;
    }

    log.debug(`${this}: ticks to controller downgrade = ${this._site.ticksToDowngrade}`)
    return this._priority/(workers.length + 1);
  }

  efficiency(worker : Creep) : number {
    return u.work_efficiency(worker, this._site, worker.availableEnergy(), UPGRADE_CONTROLLER_POWER);
  }

  site() : RoomObject {
    return this._site;
  }

  isSatisfied(_ : Creep[]) : boolean {
    return false;
  }

  completion(worker? : Creep) : number {
    if (worker) {
      return 1.0 - worker.availableEnergy()/worker.carryCapacity;
    }

    return 0.0;
  }

  satisfiesPrerequisite(_ : JobPrerequisite) : boolean {
    return false;
  }

  prerequisite(worker : Creep) : JobPrerequisite {
    if (worker.availableEnergy() == 0) {
      return JobPrerequisite.COLLECT_ENERGY;
    }
    return JobPrerequisite.NONE;
  }

  baseWorkerBody() : BodyPartConstant[] {
    return [WORK, CARRY, WORK, CARRY];
  }

  work(worker : Creep) : Operation[] {
    return [ upgrade_site(this, worker, this._site) ];
  }
}


JobFactory.addBuilder(JobUpgrade.TYPE, (id: string): Job|undefined => {
  const frags = id.split('-');
  const site = <StructureController>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobUpgrade(site, priority);
});
