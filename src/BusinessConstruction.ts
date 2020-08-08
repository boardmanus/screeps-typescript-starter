import * as Business from 'Business';
import * as Job from "Job";
import JobBuild from 'JobBuild';
import JobRepair from 'JobRepair';
import Worker from 'Worker';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';
import JobUnload from 'JobUnload';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [WORK, MOVE, CARRY];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;
const MAX_BUILD_JOBS = 5;
const MAX_REPAIR_JOBS = 5;
const WORK_PER_EMPLOYEE = 50001;

const MAX_RAMPART_WALL = 1000000;
const MAX_RCL = 8;


export function construction_priority(site: ConstructionSite): number {
  switch (site.structureType) {
    case STRUCTURE_EXTENSION:
      const energyAvail = site.room?.energyCapacityAvailable ?? 0;
      return (energyAvail > 1000) ? 3 : 6;
    case STRUCTURE_SPAWN: return 6;
    case STRUCTURE_STORAGE: return 3;
    case STRUCTURE_CONTAINER: return 2;
    default: break;
  }
  return 1;
}


function damage_ratio(site: Structure): number {
  return (1.0 - site.hits / desired_hits(site));
}

function wall_rampart_desired_hits(room: Room): number {
  const c = room.controller;
  if (!c) {
    return 0;
  }

  const progress = c.progress / c.progressTotal;
  const rcl = c.level + progress;

  return MAX_RAMPART_WALL * rcl / MAX_RCL;
}

function desired_hits(site: Structure) {
  switch (site.structureType) {
    case STRUCTURE_WALL:
    case STRUCTURE_RAMPART: return wall_rampart_desired_hits(site.room);
    default: return site.hitsMax;
  }
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
  const damageRatio = damage_ratio(rampart);
  return 2 * damageRatio;
}

function wall_repair_priority(wall: StructureWall): number {
  const damageRatio = damage_ratio(wall);
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

  const healthRatio = site.hits / desired_hits(site);
  let badHealth;

  switch (site.structureType) {
    case STRUCTURE_ROAD:
      badHealth = healthRatio < 0.5;
      break;
    default:
      badHealth = healthRatio < 0.7;
      break;
  }

  return badHealth && u.find_nearby_attackers(site).length == 0;
}

function worker_construction_filter(site: Structure): boolean {
  return u.find_nearby_attackers(site).length == 0;
}


export default class BusinessConstruction implements Business.Model {

  static readonly TYPE: string = 'cons';

  private readonly _priority: number;
  private readonly _controller: StructureController;
  private readonly _remoteRooms: Room[];
  private readonly _allJobs: Job.Model[];
  private readonly _repairJobs: JobRepair[];
  private readonly _buildJobs: JobBuild[];
  private readonly _allConstructionSites: ConstructionSite[];

  constructor(controller: StructureController, remoteRooms: Room[], priority: number = 4) {
    this._priority = priority;
    this._controller = controller;
    this._remoteRooms = remoteRooms;

    const rooms = [this._controller.room, ...this._remoteRooms];

    this._allConstructionSites = _.flatten(_.map(rooms, (room) => room.find(FIND_MY_CONSTRUCTION_SITES, { filter: worker_construction_filter })));

    this._buildJobs = _.take(_.sortBy(_.map(this._allConstructionSites,
      (site) => new JobBuild(site, construction_priority(site))),
      (job) => -job.priority()), MAX_BUILD_JOBS);

    const repairSites = _.flatten(_.map(rooms, (room) => room.find(FIND_STRUCTURES, { filter: worker_repair_filter })));
    this._repairJobs = _.take(_.sortBy(_.map(repairSites,
      (site) => new JobRepair(site, repair_priority(site))),
      (job) => -job.priority()), MAX_REPAIR_JOBS);

    this._allJobs = [...this._buildJobs, ...this._repairJobs];

    log.debug(`Top 5 Buiding Jobs:`);
    _.each(_.take(this._buildJobs, 5), (j) => log.debug(`${j}: ${j.site()}, p=${j.priority()}`))
    log.debug(`Top 5 Repair Jobs:`);
    _.each(_.take(this._repairJobs, 5), (j) => log.debug(`${j}: ${j.site()}, p=${j.priority()}`))
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
    let workRequired = _.sum(this._allConstructionSites, (cs) => cs.progressTotal - cs.progress);
    workRequired += _.sum(_.filter(_.map(this._repairJobs,
      (j) => <Structure>j.site()),
      (s) => !(s instanceof StructureWall) && !(s instanceof StructureRampart)),
      (s) => s.hitsMax - s.hits);

    let desiredEmployees = Math.min(3, Math.ceil(workRequired / WORK_PER_EMPLOYEE));
    log.debug(`${this}: ${desiredEmployees} desired construction employees (${workRequired}/${WORK_PER_EMPLOYEE})`)

    return employees.length < desiredEmployees;
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
    const contracts = [...this._allJobs];

    _.each(employees, (worker) => {
      if (!worker.creep.spawning
        && worker.creep.freeSpace() > 100
        && worker.job()?.type() === JobBuild.TYPE) {
        contracts.push(new JobUnload(worker.creep, RESOURCE_ENERGY));
      }
    });
    return contracts;
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
