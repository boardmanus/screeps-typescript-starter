import * as Business from 'Business';
import * as Job from "Job";
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import JobRecycle from 'JobRecycle';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';
import u from 'Utility';
import BusinessExploring from 'BusinessExploring';
import { profile } from 'Profiler/Profiler'


const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [MOVE, CARRY];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;

function find_surrounding_recyclers(spawn: StructureSpawn): (StructureContainer | ConstructionSite)[] {
  const recyclers = spawn.room.find<StructureContainer>(FIND_STRUCTURES, {
    filter: (s) => (s.structureType == STRUCTURE_CONTAINER) && spawn.pos.inRangeTo(s.pos, 1)
  });
  if (recyclers.length > 0) {
    return recyclers;
  }

  return spawn.room.find(FIND_CONSTRUCTION_SITES, {
    filter: (cs) => (cs.structureType == STRUCTURE_CONTAINER) && spawn.pos.inRangeTo(cs.pos, 1)
  });
}


function update_spawns(spawns: StructureSpawn[]): void {
  _.each(spawns, (spawn) => {
    if (!spawn._recycler) {
      const recyclers = find_surrounding_recyclers(spawn)
      if (recyclers.length) {
        spawn._recycler = recyclers[0];
      }
    }
    if (spawn.spawning) {
      const creep = Game.creeps[spawn.spawning.name];
      if (creep && !creep.memory.home) {
        creep.memory.home = spawn.room.name;
      }
    }
  });
}

function find_active_building_sites<T extends Structure>(room: Room, type: StructureConstant): T[] {
  return room.find<T>(FIND_MY_STRUCTURES, { filter: (s) => s.isActive && (s.structureType === type) });
}

function find_new_ext_building_sites(spawns: StructureSpawn[], exts: StructureExtension[]): RoomPosition[] {

  if (spawns.length == 0) {
    return [];
  }

  const mainSpawn = spawns[0];
  const extConstruction = mainSpawn.room.find(FIND_CONSTRUCTION_SITES, {
    filter: (cs) => (cs.structureType == STRUCTURE_EXTENSION)
  });

  const numExtensions: number = exts.length + extConstruction.length;
  const rcl = mainSpawn.room.controller?.level ?? 0;
  const allowedNumExtensions = CONTROLLER_STRUCTURES.extension[rcl];
  log.info(`${mainSpawn}: current num extensions ${numExtensions} - allowed ${allowedNumExtensions} (rcl=${rcl})`)

  if (numExtensions == allowedNumExtensions) {
    log.info(`${mainSpawn}: already have all the required extensions (${numExtensions}).`)
    return [];
  }

  if (numExtensions > allowedNumExtensions) {
    log.error(`${mainSpawn}: have more extensions than allowed??? (${numExtensions} > ${allowedNumExtensions}`);
    return [];
  }

  const desiredNumExtensions = allowedNumExtensions - numExtensions;

  const extensionPos: RoomPosition[] = _.take(_.sortBy(
    possible_extension_sites(mainSpawn, desiredNumExtensions),
    (cs) => cs.findPathTo(mainSpawn).length),
    desiredNumExtensions);

  return extensionPos;
}

function find_new_recycle_sites(spawns: StructureSpawn[], exts: StructureExtension[]): RoomPosition[] {

  if (spawns.length == 0) {
    return [];
  }

  const mainSpawn = spawns[0];
  if (mainSpawn._recycler) {
    return [];
  }

  const rcl = mainSpawn.room.controller?.level ?? 0;
  if (rcl < 4) {
    return [];
  }

  const numContainers: number = u.find_num_building_sites(mainSpawn.room, STRUCTURE_CONTAINER);;
  const allowedContainers = CONTROLLER_STRUCTURES.container[mainSpawn.room.controller?.level ?? 0];
  if (numContainers >= allowedContainers) {
    return [];
  }

  const possibleSites = u.find_empty_surrounding_positions(mainSpawn.pos);
  if (possibleSites.length == 0) {
    return [];
  }

  return _.take(possibleSites, 1);
}


function possible_extension_sites(spawn: StructureSpawn, numExtensions: number): RoomPosition[] {
  let radius = 1;
  const viableSites = spawn.pos.surroundingPositions(10, (site: RoomPosition) => {
    if ((site.x % 2) != (site.y % 2)) {
      return false;
    }

    const terrain = site.look();
    return _.reduce(terrain, (a: boolean, t: LookAtResult): boolean => {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
        case LOOK_STRUCTURES:
          const type = t.constructionSite?.structureType ?? t.structure?.structureType;
          if (type != STRUCTURE_ROAD) {
            return false;
          }
          break;
        case LOOK_TERRAIN:
          if (t.terrain === 'wall') return false;
          break;
        default:
          break;
      }
      return a;
    },
      true);
  });

  log.info(`found ${viableSites.length} viable extensions sites ${viableSites}`);
  return viableSites;
}

function adjacent_positions(roomName: string, step: PathStep): RoomPosition[] {
  switch (step.direction) {
    case RIGHT:
    case LEFT: return [
      new RoomPosition(step.x, step.y + 1, roomName), new RoomPosition(step.x, step.y - 1, roomName)
    ];
    case BOTTOM:
    case TOP: return [
      new RoomPosition(step.x + 1, step.y, roomName), new RoomPosition(step.x - 1, step.y, roomName)
    ];
    case TOP_RIGHT:
    case BOTTOM_LEFT: return [
      new RoomPosition(step.x + 1, step.y + 1, roomName), new RoomPosition(step.x - 1, step.y - 1, roomName)
    ];
    case TOP_LEFT:
    case BOTTOM_RIGHT: return [
      new RoomPosition(step.x + 1, step.y - 1, roomName), new RoomPosition(step.x - 1, step.y + 1, roomName)
    ];
  }
}

function possible_storage_sites(spawn: StructureSpawn): RoomPosition[] {
  const controller = spawn.room.controller;
  if (!controller) {
    log.warning(`${spawn}: no controller => no viable storage sites`);
    return [];
  }

  const room = spawn.room;
  const path = spawn.pos.findPathTo(controller.pos, { ignoreCreeps: true });
  room.visual.poly(_.map(path, (p) => [p.x, p.y]));
  const sites = _.flatten(_.map(path, (step) => adjacent_positions(room.name, step)));

  const viableSites = _.filter(sites, (pos) => {
    const terrain = pos.look();
    return _.reduce(terrain,
      (a: boolean, t: LookAtResult): boolean => {
        switch (t.type) {
          case LOOK_CONSTRUCTION_SITES:
          case LOOK_STRUCTURES:
            room.visual.circle(pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'red' })
            return false;
          case LOOK_TERRAIN:
            if (t.terrain === 'wall') {
              room.visual.circle(pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'red' })
              return false;
            }
            break;
          default:
            break;
        }
        return a;
      },
      true)
  });

  log.info(`${spawn}: found ${viableSites.length} viable storage sites ${viableSites}`);
  _.each(viableSites, (vs) => room.visual.circle(vs, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'green' }));
  return viableSites;
}

function storage_site_viability(spawn: StructureSpawn, pos: RoomPosition): number {
  const spacialViability = _.reduce(
    pos.surroundingPositions(1),
    (a: number, p: RoomPosition): number => {

      const terrain = p.look();
      let viability = 1;
      for (const t of terrain) {
        switch (t.type) {
          case LOOK_SOURCES:
          case LOOK_MINERALS:
            return -2;
          case LOOK_CONSTRUCTION_SITES:
            if (t.constructionSite) {
              if (!u.is_passible_structure(t.constructionSite)) {
                return -1;
              }
              else if (t.constructionSite.structureType == STRUCTURE_ROAD) {
                viability += 0.5;
              }
              else {
                viability -= 0.5;
              }
            }
            break;
          case LOOK_STRUCTURES:
            if (t.structure) {
              if (!u.is_passible_structure(t.structure)) {
                return -1;
              }
              else if (t.structure.structureType == STRUCTURE_ROAD) {
                viability += 0.5;
              }
              else {
                viability -= 0.5;
              }
            }
            break;
          case LOOK_TERRAIN:
            if (t.terrain == 'wall') {
              return -1;
            }
            break;
          default:
            break;
        }
      }
      return a + viability;
    },
    0);

  const linearViability = 1.0 / spawn.pos.getRangeTo(pos);
  // Want positions with lots of space around, and closer to spawns
  return spacialViability + linearViability;
}

function find_new_storage_sites(spawn: StructureSpawn): RoomPosition[] {
  const room = spawn.room;
  const rcl = room.controller?.level ?? 0;
  const numStorage = u.find_num_building_sites(room, STRUCTURE_STORAGE);
  const allowedNumStorage = CONTROLLER_STRUCTURES.storage[rcl];
  log.info(`${spawn}: current num storage ${numStorage} - allowed ${allowedNumStorage}`)

  if (numStorage == allowedNumStorage) {
    log.info(`${spawn}: already have all the required storage (${numStorage}).`)
    return [];
  }

  if (numStorage > allowedNumStorage) {
    log.error(`${spawn}: have more storage than allowed??? (${numStorage} > ${allowedNumStorage}`);
    return [];
  }

  // Currently only one storage allowed - it goes next to the controller
  if (numStorage != 0) {
    log.error(`${spawn}: only expected one storage to be available - update code!`);
    return [];
  }

  const storagePos: RoomPosition[] = _.take(_.sortBy(
    possible_storage_sites(spawn),
    (rp) => -storage_site_viability(spawn, rp)),
    1);

  log.debug(`${spawn}: ${storagePos.length} storage pos ${storagePos}`)
  room.visual.circle(storagePos[0], { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'purple' })
  return storagePos;
}

@profile
export default class BusinessCloning implements Business.Model {

  static readonly TYPE: string = 'clone';

  private readonly _priority: number;
  private readonly _room: Room;
  private readonly _spawns: StructureSpawn[];
  private readonly _extensions: StructureExtension[];
  private readonly _workerHealthRatio: number;
  private readonly _unloadJobs: Job.Model[];

  constructor(room: Room, priority: number = 5) {
    this._priority = priority;
    this._room = room;
    this._spawns = find_active_building_sites(room, STRUCTURE_SPAWN);
    this._extensions = find_active_building_sites(room, STRUCTURE_EXTENSION);

    const creeps = room.find(FIND_MY_CREEPS);
    const nearlyDeadWorkers = _.filter(creeps, (c) => c.ticksToLive && c.ticksToLive < 200).length;
    const maxWorkers = 8;
    this._workerHealthRatio = (creeps.length - nearlyDeadWorkers) / maxWorkers;

    const numHarvesters = _.sum(creeps, (c) => c.name.startsWith(`${BusinessExploring.TYPE}`) ? 1 : 0);

    const roomHealth = Math.min(this._workerHealthRatio, this._room.energyAvailable / this._room.energyCapacityAvailable);
    log.debug(`${this}: roomHealth=${roomHealth}`)
    const extPriority = 6 + (1.0 - roomHealth) * this._priority;
    const extJobs: JobUnload[] = _.map(_.take(_.sortBy(_.filter(this._extensions,
      (e) => e.freeSpace() > 0),
      (e) => e.pos.x * e.pos.x + e.pos.y * e.pos.y - e.freeSpace()),
      5),
      (e) => new JobUnload(e, RESOURCE_ENERGY, extPriority));

    if (extJobs.length < 5) {
      const spawnPriority = 5 + (1.0 - roomHealth) * this._priority;
      const spawnJobs: JobUnload[] = _.map(_.filter(this._spawns,
        (s) => s.freeSpace() > 0),
        (s) => new JobUnload(s, RESOURCE_ENERGY, spawnPriority));
      extJobs.push(...spawnJobs);
    }

    this._unloadJobs = extJobs;

    update_spawns(this._spawns);
  }

  id(): string {
    return Business.id(BusinessCloning.TYPE, this._room.name);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  canRequestEmployee(): boolean {
    return false;
  }

  needsEmployee(employees: Creep[]): boolean {
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
    const jobs: Job.Model[] = [];
    /*
    const storage = this._room.storage;
    if (storage) {
      jobs.push(new JobPickup(storage));
    }*/
    jobs.push(...this._unloadJobs);
    return jobs;
  }

  contractJobs(employees: Creep[]): Job.Model[] {

    const extJobs = this._unloadJobs;

    const pickupJobs: JobPickup[] = _.map(_.filter(this._spawns,
      (s) => { const r = s.recycler(); return r?.available() ?? false }),
      (s) => new JobPickup(s.recycler() ?? s, u.RESOURCE_ALL, this._priority));

    const contracts: Job.Model[] = [...extJobs, ...pickupJobs];

    if (this._spawns.length > 0) {
      const recycle = new JobRecycle(this._spawns[0]);
      contracts.push(recycle);
    }

    log.debug(`${this}: ${contracts.length} contracts (${extJobs.length} exts)`)

    return contracts;
  }

  buildings(): BuildingWork[] {

    const extWork = _.map(
      find_new_ext_building_sites(this._spawns, this._extensions),
      (pos) => {
        log.info(`${this}: creating new building work ${this._room} @ ${pos}`)
        return new BuildingWork(pos, STRUCTURE_EXTENSION);
      });

    const recycleWork = _.map(
      find_new_recycle_sites(this._spawns, this._extensions),
      (pos) => {
        log.info(`${this}: creating new recycle container work @ ${pos}`);
        return new BuildingWork(pos, STRUCTURE_CONTAINER);
      });

    const buildings = [...extWork, ...recycleWork];
    return buildings;
  }
}

Business.factory.addBuilder(BusinessCloning.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = <Room>Game.rooms[frags[2]];
  if (!room) {
    return undefined;
  }
  return new BusinessCloning(room);
});
