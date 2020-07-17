import * as Business from 'Business';
import * as Job from "Job";
import JobBuild from 'JobBuild';
import JobRepair from 'JobRepair';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CARRY, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [WORK, MOVE, CARRY, WORK, MOVE, WORK, MOVE];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;
const MAX_BUILD_JOBS = 5;
const MAX_REPAIR_JOBS = 5;

export function construction_priority(site: ConstructionSite): number {
  switch (site.structureType) {
    case STRUCTURE_EXTENSION: return 6;
    case STRUCTURE_STORAGE: return 3;
    case STRUCTURE_CONTAINER: return 2;
    default: break;
  }
  return 1;
}

function repair_priority(site: Structure): number {
  const damageRatio = (1.0 - site.hits / site.hitsMax);
  switch (site.structureType) {
    case STRUCTURE_ROAD: return 2 * damageRatio;
    case STRUCTURE_RAMPART: return 1 * Math.pow(damageRatio, 10);
    case STRUCTURE_WALL: return 1 * Math.pow(damageRatio, 20);
    default: return 8 * damageRatio;
  }
}

function worker_repair_filter(site: Structure): boolean {
  if ((site instanceof OwnedStructure) && !(site as OwnedStructure).my) {
    return false;
  }

  const healthRatio = site.hits / site.hitsMax;
  let badHealth;

  const rcl = site.room.controller?.level ?? 0;

  switch (site.structureType) {
    case STRUCTURE_WALL:
      badHealth = (rcl < 3) || (site.hits / 3000000 < 0.2);
      break;
    case STRUCTURE_RAMPART:
      badHealth = (rcl < 3) || (healthRatio < 0.2);
      break;
    case STRUCTURE_ROAD:
      badHealth = healthRatio < 0.5;
      break;
    default:
      badHealth = healthRatio < 0.7;
      break;
  }

  if (badHealth) {
    return !badHealth;
  }

  return u.find_nearby_attackers(site).length == 0;
}

function worker_construction_filter(site: Structure): boolean {
  return u.find_nearby_attackers(site).length == 0;
}


export default class BusinessConstruction implements Business.Model {

  static readonly TYPE: string = 'cons';

  private readonly _priority: number;
  private readonly _controller: StructureController;

  constructor(controller: StructureController, priority: number = 5) {
    this._priority = priority;
    this._controller = controller;
  }

  id(): string {
    return Business.id(BusinessConstruction.TYPE, this._controller.id);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {

    if (availEnergy < IDEAL_CLONE_ENERGY && maxEnergy > IDEAL_CLONE_ENERGY) {
      // Wait for more energy
      return [];
    }

    const energyToUse = Math.min(availEnergy, MAX_CLONE_ENERGY);
    return u.generate_body(EMPLOYEE_BODY_BASE, EMPLOYEE_BODY_TEMPLATE, energyToUse);
  }

  permanentJobs(): Job.Model[] {
    return [];
  }

  contractJobs(): Job.Model[] {

    const room = this._controller.room;

    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: worker_construction_filter });
    const constructionJobs = _.take(_.sortBy(_.map(constructionSites,
      (site) => new JobBuild(site, construction_priority(site))),
      (job) => -job.priority()), MAX_BUILD_JOBS);

    const repairSites = room.find(FIND_STRUCTURES, { filter: worker_repair_filter });
    const repairJobs: JobRepair[] = _.take(_.sortBy(_.map(repairSites,
      (site) => new JobRepair(site, repair_priority(site))),
      (job) => -job.priority()), MAX_REPAIR_JOBS);

    log.debug(`${this}: contracts ${constructionJobs.length} construct, ${repairJobs.length} repair`);

    return [...constructionJobs, ...repairJobs];
  }

  buildings(): BuildingWork[] {
    return [];
  }
}

Business.factory.addBuilder(BusinessConstruction.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const controller = <StructureController>Game.getObjectById(frags[2]);
  if (!controller) {
    return undefined;
  }
  const priority = Number(frags[3]);
  return new BusinessConstruction(controller, priority);
});
