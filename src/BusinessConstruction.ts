import * as Business from 'Business';
import * as Job from "Job";
import JobBuild from 'JobBuild';
import JobRepair from 'JobRepair';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';
import JobUnload from 'JobUnload';
import JobDismantle from 'JobDismantle';
import Room$ from 'RoomCache';
import { profile } from 'Profiler/Profiler'


const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [WORK, MOVE, CARRY];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;
const MAX_BUILD_JOBS = 5;
const MAX_REPAIR_JOBS = 5;
const WORK_PER_EMPLOYEE = 50001;

export function construction_priority(site: ConstructionSite): number {
  switch (site.structureType) {
    case STRUCTURE_EXTENSION:
      const energyAvail = site.room?.energyCapacityAvailable ?? 0;
      return (energyAvail > 1000) ? 3 : 6;
    case STRUCTURE_SPAWN: return 6;
    case STRUCTURE_STORAGE: return 3;
    case STRUCTURE_EXTRACTOR: return 3;
    case STRUCTURE_CONTAINER: return 2;
    default: break;
  }
  return 1;
}


function damage_ratio(site: Structure): number {
  return (1.0 - site.hits / u.desired_hits(site));
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

  const healthRatio = site.hits / u.desired_hits(site);
  let badHealth;

  switch (site.structureType) {
    case STRUCTURE_ROAD:
      badHealth = healthRatio < 0.5;
      break;
    default:
      badHealth = healthRatio < 0.7;
      break;
  }

  return badHealth && u.find_nearby_hostiles(site).length == 0;
}

function worker_construction_filter(site: Structure): boolean {
  return u.find_nearby_hostiles(site).length == 0;
}


@profile
export default class BusinessConstruction implements Business.Model {

  static readonly TYPE: string = 'cons';

  private readonly _priority: number;
  private readonly _controller: StructureController;
  private readonly _remoteRooms: Room[];
  private readonly _allJobs: Job.Model[];
  private readonly _repairJobs: JobRepair[];
  private readonly _buildJobs: JobBuild[];
  private readonly _dismantleJobs: JobDismantle[];
  private readonly _allConstructionSites: ConstructionSite[];

  constructor(controller: StructureController, remoteRooms: Room[], priority: number = 4) {
    this._priority = priority;
    this._controller = controller;
    this._remoteRooms = remoteRooms;

    const room = this._controller.room;

    this._dismantleJobs = _.map(u.map_valid(room.find(FIND_FLAGS,
      { filter: (f) => f.name.startsWith('dismantle') }),
      (f) => {
        const s = room.lookForAt(LOOK_STRUCTURES, f.pos);
        if (s.length == 0) {
          f.remove();
          return undefined;
        }
        return s[0];
      }),
      (site) => new JobDismantle(site));

    const rooms = [room, ...this._remoteRooms];

    this._allConstructionSites = _.flatten(_.map(rooms,
      (room) => _.filter(Room$(room).constructionSites, worker_construction_filter)));

    this._buildJobs = _.take(_.sortBy(_.map(this._allConstructionSites,
      (site) => new JobBuild(site, construction_priority(site))),
      (job) => -job.priority()), MAX_BUILD_JOBS);

    const repairSites = _.flatten(_.map(rooms, (room) => room.find(FIND_STRUCTURES, { filter: worker_repair_filter })));

    this._repairJobs = _.take(_.sortBy(_.map(repairSites,
      (site) => new JobRepair(site, repair_priority(site))),
      (job) => -job.priority()), MAX_REPAIR_JOBS);

    this._allJobs = [...this._buildJobs, ...this._repairJobs, ...this._dismantleJobs];

    log.info(`Top 5 Buiding Jobs:`);
    _.each(this._buildJobs, (j) => log.info(`${j}: ${j.site()}, p=${j.priority()}`))
    log.info(`Top 5 Repair Jobs:`);
    _.each(this._repairJobs, (j) => log.info(`${j}: ${j.site()}, p=${j.priority()}`))
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

  canRequestEmployee(): boolean {
    const rcl = this._controller.level ?? 0;
    return rcl < 4;
  }

  needsEmployee(employees: Creep[]): boolean {
    let workRequired = _.sum(this._allConstructionSites, (cs) => cs.progressTotal - cs.progress);
    workRequired += _.sum(_.filter(_.map(this._repairJobs,
      (j) => <Structure>j.site()),
      (s) => !(s instanceof StructureWall) && !(s instanceof StructureRampart)),
      (s) => s.hitsMax - s.hits);

    let desiredEmployees = Math.min(3, Math.ceil(workRequired / WORK_PER_EMPLOYEE));
    log.info(`${this}: Have ${employees.length} of ${desiredEmployees} desired construction employees (${workRequired}/${WORK_PER_EMPLOYEE})`)

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

  contractJobs(employees: Creep[]): Job.Model[] {
    const contracts = [...this._allJobs];

    _.each(employees, (worker) => {
      if (!worker.spawning
        && worker.freeSpace() > 100
        && (worker.getJob()?.type() === JobBuild.TYPE)) {
        contracts.push(new JobUnload(worker, RESOURCE_ENERGY));
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
