import * as Job from 'Job';
import { Operation } from 'Operation';
import log from 'ScrupsLogger';
import * as u from 'Utility';

type HarvestSite = Source | Mineral | Deposit;

/**
 * Gets the worker to pickup resources from the job site.
 * @param {Creep} worker to perform the repairSite
 * @return {boolean} whether the worker did something useful
 */
function harvest_from_site(job: JobHarvest, worker: Creep): Operation {
  return () => {
    const site = job.harvestSite;
    Job.visualize(job, worker);
    const container = site._container;
    if (container
      && !worker.pos.inRangeTo(container.pos, 0)
      && _.filter(container.pos.lookFor(LOOK_CREEPS), (c) => c.name !== worker.name).length === 0) {
      Job.moveTo(job, worker, 0, container);
      return;
    }

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
        res = Job.moveTo(job, worker, 1);
        break;
      case ERR_TIRED:
        // Mining minerals is pretty tiring...
        log.info(`${job}: ${worker} tired after harvesting from ${site}`);
        break;
      case OK:
        log.info(`${job}: ${worker} is harvesting at ${site}`);
        break;
    }
  };
}
/*
function harvest_per_tick(workers: Creep[]): number {
  const workParts = _.reduce(
    workers,
    (sum: number, worker: Creep): number => _.filter(
      worker.body,
      (bodypart: BodyPartDefinition): boolean => bodypart.type === WORK).length + sum,
    0);

  return workParts * 2;
}
*/
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
          return (t.terrain !== 'wall');
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
  if (source.energy === 0) {
    return true;
  }

  if (workers.length === 0) {
    return false;
  }

  const remainingEnergy = source.energy - _.sum(workers, (w: Creep): number => w.freeSpace());
  return remainingEnergy <= 0;
}

function is_mineral_harvesting_satisfied(mineral: Mineral | Deposit, workers: Creep[]): boolean {
  if (mineral.available() === 0) {
    return true;
  }
  return workers.length >= 1;
  /*
  if (workers.length === 0) {
    return false;
  }

  const remaining = mineral.mineralAmount - _.sum(workers, (w: Creep): number => { return w.freeSpace(); });
  return remaining <= 0;
  */
}

/*
function mineral_capacity(mineral: Mineral): number {
  switch (mineral.density) {
    case DENSITY_LOW: return 15000;
    case DENSITY_MODERATE: return 35000;
    case DENSITY_HIGH: return 70000;
    case DENSITY_ULTRA: return 100000;
    default:
      break;
  }
  return 100000;
}
*/

export default class JobHarvest implements Job.Model {

  static readonly TYPE: string = 'harvest';

  readonly harvestSite: HarvestSite;
  readonly harvestPriority: number;

  constructor(site: HarvestSite, priority = 5) {
    this.harvestSite = site;
    this.harvestPriority = priority;
  }

  id(): string {
    return `job-${JobHarvest.TYPE}-${this.harvestSite.id}`;
  }

  type(): string {
    return JobHarvest.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '⛏️';
  }

  styleColour(): string {
    return 'green';
  }

  priority(workers?: Creep[]): number {
    if (!workers) return this.harvestPriority;
    return this.harvestPriority / (workers.length + 1);
  }

  site(): RoomObject {
    return this.harvestSite;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [WORK, CARRY, MOVE, MOVE];
  }

  efficiency(worker: Creep): number {
    if (worker.freeSpace() <= u.work_energy(worker, 2) || this.harvestSite.available() === 0) {
      return 0.0;
    }

    return u.work_efficiency(worker, this.harvestSite, worker.freeSpace(), HARVEST_POWER);
  }

  isSatisfied(workers: Creep[]): boolean {

    const positions = harvest_spaces(this.harvestSite);
    if (workers.length >= positions.length) {
      return true;
    }

    if (this.harvestSite instanceof Source) {
      return is_energy_harvesting_satisfied(this.harvestSite, workers);
    }

    log.debug(`is_mineral_harvesting_satisfied? ${is_mineral_harvesting_satisfied(this.harvestSite, workers)}`);
    return is_mineral_harvesting_satisfied(this.harvestSite, workers);
  }

  completion(worker?: Creep): number {
    const avail: number = this.harvestSite.available();
    if (avail === 0) {
      return 1.0;
    }

    if (worker) {
      const maxHolding = worker.capacity() - u.work_energy(worker, 2);
      if (worker.available() >= maxHolding) {
        return 1.0;
      }
      return worker.available() / maxHolding;
    }

    return 1.0 - avail / this.harvestSite.capacity();
  }

  work(worker: Creep): Operation[] {
    if (this.completion(worker) === 1.0) {
      return [];
    }

    return [harvest_from_site(this, worker)];
  }
}
