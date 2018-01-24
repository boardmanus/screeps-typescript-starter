import { Operation } from "./Operation";
import { JobFactory, JobPrerequisite } from "./Job";
import { Job } from "./Job";
import { log } from "./lib/logger/log";
import u from "./Utility"


/**
 * Gets the worker to pickup resources from the job site.
 * @param {Creep} worker to perform the repairSite
 * @return {boolean} whether the worker did something useful
 */
function harvest_energy_from_site(job : JobHarvest, worker : Creep, site : Source|Mineral) : Operation {
  return  () => {
    let res : number = worker.harvest(site);
    switch (res) {
      case ERR_NOT_OWNER:
      case ERR_INVALID_TARGET:
      case ERR_NO_BODYPART:
      case ERR_BUSY:
      default:
        log.error(`${job}: unexpected failure when ${worker} tried withdrawing energy from ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_ENOUGH_RESOURCES:
        // The site is empty - this job is complete
        log.warning(`${job}: ${site.id} doesn't have any energy for ${worker} to harvest (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE:
        res = worker.moveTo(site);
        if (res == OK) {
          log.info(`${job}: ${worker} is moving to harvest at ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          log.warning(`${job}: ${worker} failed to move to ${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      case OK:
        log.info(`${job}: ${worker} is harvesting at ${site}`);
        break;
    }
  }
}


function harvest_per_tick(workers : Creep[]) : number {
  const workParts = _.reduce(
    workers,
    (sum : number, worker : Creep) : number => {
      return _.filter(
        worker.body,
        (bodypart : BodyPartDefinition) : boolean => {
          return bodypart.type == WORK;
        }).length + sum;
    },
    0);

  return workParts * 2;
}


function harvest_spaces(source : HarvestSite) : RoomPosition[] {
  const positions = source.pos.surroundingPositions(1, (p : RoomPosition) : boolean => {
    const terrain = p.look();
    return _.reduce(terrain, (a : boolean, t : LookAtResult) : boolean => {
      if (!a) {
        return false;
      }
      switch (t.type) {
        case LOOK_STRUCTURES:
          return !t.structure || u.is_passible_structure(t.structure);
        case LOOK_TERRAIN:
          return (t.terrain != 'wall');
        default:
          break;
      }
      return true;
    },
    true);
  });

  return positions;
}

function is_energy_harvesting_satisfied(source : Source, workers : Creep[]) : boolean {
  if (source.energy == 0) {
    return true;
  }

  if (workers.length == 0) {
    return false;
  }

  const remainingEnergy = source.energy - _.sum(workers, (w : Creep) : number => { return w.freeSpace(); });
  log.debug(`is_energy_harvesting_satisfied: ${source} => remainingEnergy=${remainingEnergy}`);
  return remainingEnergy <= 0;
}

function is_mineral_harvesting_satisfied(mineral : Mineral, workers : Creep[]) : boolean {
  if (mineral.mineralAmount == 0) {
    return true;
  }

  if (workers.length == 0) {
    return false;
  }

  const remaining = mineral.mineralAmount - _.sum(workers, (w : Creep) : number => { return w.freeSpace(); });
  return remaining <= 0;
}

function mineral_capacity(mineral : Mineral) : number {
  switch (mineral.density) {
    case DENSITY_LOW: return 15000;
    case DENSITY_MODERATE: return 35000;
    case DENSITY_HIGH: return 70000;
    case DENSITY_ULTRA: return 100000;
  }
  return 100000;
}


type HarvestSite = Source|Mineral;
export class JobHarvest implements Job {

  static readonly TYPE : string = 'harvest';

  readonly _site : HarvestSite;
  readonly _priority : number;

  constructor(site : HarvestSite, priority? : number) {
    this._site = site;
    this._priority = (priority !== undefined)? priority : 5;
  }

  id() : string {
    return `job-${JobHarvest.TYPE}-${this._site.id}-${this._priority}`;
  }

  toString() : string {
    return this.id();
  }

  priority(workers : Creep[]) : number {
    return this._priority*2/(workers.length + 1);
  }

  site() : RoomObject {
    return this._site;
  }

  baseWorkerBody() : BodyPartConstant[] {
    return [WORK, CARRY, WORK, CARRY];
  }

  satisfiesPrerequisite(prerequisite : JobPrerequisite) : boolean {
    if (prerequisite == JobPrerequisite.COLLECT_ENERGY) {
      return this._site.availableEnergy() > 0;
    }

    return false;
  }


  efficiency(worker : Creep) : number {
    return u.work_efficiency(worker, this._site, worker.freeSpace(), HARVEST_POWER);
  }


  prerequisite(worker : Creep) : JobPrerequisite {
    if (_.sum(worker.carry) == worker.carryCapacity) {
      return JobPrerequisite.DELIVER_ENERGY;
    }

    return JobPrerequisite.NONE;
  }

  isSatisfied(workers : Creep[]) : boolean {

    const positions = harvest_spaces(this._site);
    log.debug(`${this}: has ${positions.length} harvest spots`);
    if (workers.length >= positions.length) {
      return true;
    }

    if (this._site instanceof Source) {
      return is_energy_harvesting_satisfied(this._site, workers);
    }

    return is_mineral_harvesting_satisfied(this._site, workers);
  }

  completion(worker? : Creep) : number {
    if (worker) {
      const c = _.sum(worker.carry)/worker.carryCapacity;
      log.debug(`${this}: completion of ${worker} => ${c}`);
      return c;
    }

    if (this._site instanceof Source) {
      return 1.0 - this._site.energy/this._site.energyCapacity;
    }

    return this._site.mineralAmount/mineral_capacity(this._site);
  }

  work(worker : Creep) : Operation[] {
    if (this.completion(worker) == 1.0) {
      worker.setEmployed(false);
      return [];
    }

    return [ harvest_energy_from_site(this, worker, this._site) ];
  }
}


JobFactory.addBuilder(JobHarvest.TYPE, (id: string) : Job|undefined => {
  const frags = id.split('-');
  const site : HarvestSite = <HarvestSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobHarvest(site, priority);
});
