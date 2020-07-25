import * as Business from 'Business';
import * as Job from "Job";
import JobBuild from 'JobBuild';
import JobRepair from 'JobRepair';
import Worker from 'Worker';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [WORK, MOVE, CARRY];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;
const MAX_BUILD_JOBS = 5;
const MAX_REPAIR_JOBS = 5;

export function construction_priority(site: ConstructionSite): number {
  const energyAvail = site.room?.energyCapacityAvailable ?? 0;
  switch (site.structureType) {
    case STRUCTURE_EXTENSION: return (energyAvail > 1000) ? 3 : 6;
    case STRUCTURE_STORAGE: return 3;
    case STRUCTURE_CONTAINER: return 2;
    default: break;
  }
  return 1;
}


function damage_ratio(site: Structure): number {
  return (1.0 - site.hits / site.hitsMax);
}

function wall_rampart_damage_ratio(wr: Structure): number {
  const c = wr.room.controller;
  if (!c) {
    return 0;
  }
  const progress = c.progress / c.progressTotal;
  const rcl = c.level;
  const nextRcl = Math.min(rcl + 1, 8);
  const dHits = RAMPART_HITS_MAX[nextRcl] - RAMPART_HITS_MAX[rcl];
  return 1.0 - 10.0 * wr.hits / (RAMPART_HITS_MAX[rcl] + progress * dHits);
}

function road_repair_priority(road: StructureRoad): number {
  const decayAmount = ROAD_DECAY_AMOUNT * 5;
  if ((road.ticksToDecay < ROAD_DECAY_TIME) && (road.hits < decayAmount)) {
    return 8;
  }
  return 2 * damage_ratio(road);
}

function rampart_repair_priority(rampart: StructureRampart): number {
  if ((rampart.ticksToDecay < RAMPART_DECAY_TIME / 3)
    && (rampart.hits < 2 * RAMPART_DECAY_AMOUNT)) {
    return 9;
  }
  const damageRatio = wall_rampart_damage_ratio(rampart);
  return 2 * damageRatio;
}

function wall_repair_priority(wall: StructureWall): number {
  const damageRatio = wall_rampart_damage_ratio(wall);
  return 2 * damageRatio;
}

function repair_priority(site: Structure): number {
  switch (site.structureType) {
    case STRUCTURE_ROAD: return road_repair_priority(<StructureRoad>site);
    case STRUCTURE_RAMPART: return rampart_repair_priority(<StructureRampart>site);
    case STRUCTURE_WALL: return wall_repair_priority(<StructureWall>site);
    default: return 5 * damage_ratio(site);
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
  private readonly _remoteRooms: Room[];
  private readonly _allJobs: Job.Model[]

  constructor(controller: StructureController, remoteRooms: Room[], priority: number = 5) {
    this._priority = priority;
    this._controller = controller;
    this._remoteRooms = remoteRooms;

    const rooms = [this._controller.room, ...this._remoteRooms];
    const constructionSites = _.flatten(_.map(rooms, (room) => room.find(FIND_MY_CONSTRUCTION_SITES/*, { filter: worker_construction_filter }*/)));
    const constructionJobs = _.take(_.sortBy(_.map(constructionSites,
      (site) => new JobBuild(site, construction_priority(site))),
      (job) => -job.priority()), MAX_BUILD_JOBS);

    const repairSites = _.flatten(_.map(rooms, (room) => room.find(FIND_STRUCTURES, { filter: worker_repair_filter })));
    const repairJobs: JobRepair[] = _.take(_.sortBy(_.map(repairSites,
      (site) => new JobRepair(site, repair_priority(site))),
      (job) => -job.priority()), MAX_REPAIR_JOBS);

    this._allJobs = [...constructionJobs, ...repairJobs];
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

  needsEmployee(employees: Worker[]): boolean {
    return employees.length == 0;
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
    return this._allJobs;
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    return this._allJobs;
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
  return new BusinessConstruction(controller, []);
});
