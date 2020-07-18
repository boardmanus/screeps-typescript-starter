import * as Job from "Job";
import { Operation } from "./Operation";
import { log } from './ScrupsLogger';
import u from "./Utility";


type HarvestSite = Source | Mineral;


function unload_at_site(job: JobHarvest, worker: Creep, site: StructureLink | StructureContainer): void {
  if ((worker.available() == 0) || (site.freeSpace() == 0)) {
    return;
  }

  let res: number = worker.transfer(site, RESOURCE_ENERGY);
  switch (res) {
    case OK:
      // Finished job.
      log.info(`${job}: ${worker} transferred energy to ${site}`);
      break;
    default:
      log.warning(`${job}: ${worker} failed to transfer ${worker.store[RESOURCE_ENERGY]} energy to ${site} (${u.errstr(res)})`);
      break;
  }
}

/**
 * Gets the worker to pickup resources from the job site.
 * @param {Creep} worker to perform the repairSite
 * @return {boolean} whether the worker did something useful
 */
function harvest_energy_from_site(job: JobHarvest, worker: Creep, site: HarvestSite): Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'green' });
    worker.say('⛏️');
    let res: number = worker.harvest(site);
    switch (res) {
      case ERR_NOT_OWNER:
      case ERR_INVALID_TARGET:
      case ERR_NO_BODYPART:
      default:
        log.error(`${job}: unexpected failure when ${worker} tried withdrawing energy from ${site} (${u.errstr(res)})`);
        break;

      case ERR_BUSY:
        log.warning(`${job}: ${worker} still spawning (${u.errstr(res)})`);
        break;
      case ERR_NOT_ENOUGH_RESOURCES:
        // The site is empty - this job is complete
        log.warning(`${job}: ${site.id} doesn't have any energy for ${worker} to harvest (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE:
        res = worker.jobMoveTo(site, 1, <LineStyle>{ opacity: .4, stroke: 'green' });
        if (res == OK) {
          log.info(`${job}: ${worker} is moving to harvest at ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          log.error(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      case ERR_TIRED:
        // Mining minerals is pretty tiring...
        log.info(`${job}: ${worker} tired after harvesting from ${site}`);
        break;
      case OK:
        log.info(`${job}: ${worker} is harvesting at ${site}`);
        break;
    }
  }
}


function harvest_per_tick(workers: Creep[]): number {
  const workParts = _.reduce(
    workers,
    (sum: number, worker: Creep): number => {
      return _.filter(
        worker.body,
        (bodypart: BodyPartDefinition): boolean => {
          return bodypart.type == WORK;
        }).length + sum;
    },
    0);

  return workParts * 2;
}


function harvest_spaces(source: HarvestSite): RoomPosition[] {
  const positions = source.pos.surroundingPositions(1, (p: RoomPosition): boolean => {
    const terrain = p.look();
    return _.reduce(terrain, (a: boolean, t: LookAtResult): boolean => {
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

function is_energy_harvesting_satisfied(source: Source, workers: Creep[]): boolean {
  if (source.energy == 0) {
    return true;
  }

  if (workers.length == 0) {
    return false;
  }

  const remainingEnergy = source.energy - _.sum(workers, (w: Creep): number => { return w.freeSpace(); });
  return remainingEnergy <= 0;
}

function is_mineral_harvesting_satisfied(mineral: Mineral, workers: Creep[]): boolean {
  if (mineral.mineralAmount == 0) {
    return true;
  }
  return workers.length >= 1;
  /*
  if (workers.length == 0) {
    return false;
  }

  const remaining = mineral.mineralAmount - _.sum(workers, (w: Creep): number => { return w.freeSpace(); });
  return remaining <= 0;
  */
}

function mineral_capacity(mineral: Mineral): number {
  switch (mineral.density) {
    case DENSITY_LOW: return 15000;
    case DENSITY_MODERATE: return 35000;
    case DENSITY_HIGH: return 70000;
    case DENSITY_ULTRA: return 100000;
  }
  return 100000;
}


export default class JobHarvest implements Job.Model {

  static readonly TYPE: string = 'harvest';

  readonly _site: HarvestSite;
  readonly _priority: number;

  constructor(site: HarvestSite, priority: number = 5) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobHarvest.TYPE}-${this._site.id}`;
  }

  type(): string {
    return JobHarvest.TYPE;
  }

  toString(): string {
    return this.id();
  }

  priority(workers?: Creep[]): number {
    if (!workers) return this._priority;
    return this._priority / (workers.length + 1);
  }

  site(): RoomObject {
    return this._site;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [WORK, CARRY, MOVE, MOVE];
  }

  satisfiesPrerequisite(prerequisite: Job.Prerequisite): boolean {
    if (prerequisite == Job.Prerequisite.COLLECT_ENERGY) {
      return this._site.available() > 0;
    }

    return false;
  }


  efficiency(worker: Creep): number {
    if (worker.freeSpace() == 0 || this._site.available() == 0) {
      return 0.0;
    }

    return u.work_efficiency(worker, this._site, worker.freeSpace(), HARVEST_POWER);
  }


  prerequisite(worker: Creep): Job.Prerequisite {
    if (worker.carry.getUsedCapacity() == worker.carryCapacity) {
      return Job.Prerequisite.DELIVER_ENERGY;
    }

    return Job.Prerequisite.NONE;
  }

  isSatisfied(workers: Creep[]): boolean {

    const positions = harvest_spaces(this._site);
    if (workers.length >= positions.length) {
      return true;
    }

    if (this._site instanceof Source) {
      return is_energy_harvesting_satisfied(this._site, workers);
    }

    log.debug(`is_mineral_harvesting_satisfied? ${is_mineral_harvesting_satisfied(this._site, workers)}`);
    return is_mineral_harvesting_satisfied(this._site, workers);
  }

  completion(worker?: Creep): number {
    const emptiness: number = (this._site instanceof Source)
      ? 1.0 - this._site.energy / this._site.energyCapacity
      : 1.0 - this._site.mineralAmount / mineral_capacity(this._site);

    return worker
      ? Math.max(emptiness, worker.carry.getUsedCapacity() / worker.carryCapacity)
      : emptiness;
  }

  work(worker: Creep): Operation[] {
    if (this.completion(worker) == 1.0) {
      return [];
    }

    return [harvest_energy_from_site(this, worker, this._site)];
  }
}


Job.factory.addBuilder(JobHarvest.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site: HarvestSite = <HarvestSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobHarvest(site);
});
