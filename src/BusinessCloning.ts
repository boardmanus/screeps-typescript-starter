import * as Business from 'Business';
import * as Job from "Job";
import JobBuild from 'JobBuild';
import JobRepair from 'JobRepair';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';
import JobUnload from 'JobUnload';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [MOVE, CARRY];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;


export function find_building_sites<T extends Structure>(room: Room, type: StructureConstant): T[] {
  return room.find<T>(FIND_STRUCTURES, { filter: (s) => s.isActive && (s.structureType === type) });
}


function possible_extension_sites(spawn: StructureSpawn, numExtensions: number): RoomPosition[] {
  let radius = 1;
  let sites: RoomPosition[] = [];
  while (sites.length < numExtensions && radius++ < 5) {
    const viableSites = spawn.pos.surroundingPositions(radius, (site: RoomPosition) => {
      if ((site.x % 2) != (site.y % 2)) {
        return false;
      }

      const terrain = site.look();
      return _.reduce(terrain, (a: boolean, t: LookAtResult): boolean => {
        switch (t.type) {
          case LOOK_CONSTRUCTION_SITES:
          case LOOK_STRUCTURES:
            return false;
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
    sites = sites.concat(viableSites);
  }
  log.info(`found ${sites.length} viable extensions sites ${sites}`);
  return sites;
}

export default class BusinessCloning implements Business.Model {

  static readonly TYPE: string = 'clone';

  private readonly _priority: number;
  private readonly _room: Room;
  private readonly _spawns: StructureSpawn[];
  private readonly _extensions: StructureExtension[];

  constructor(room: Room, priority: number = 5) {
    this._priority = priority;
    this._room = room;
    this._spawns = find_building_sites(room, STRUCTURE_SPAWN);
    this._extensions = find_building_sites(room, STRUCTURE_EXTENSION);
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
    log.debug(`${this}: permanent ${jobs}`);
    return jobs;
  }

  contractJobs(): Job.Model[] {
    const extJobs: JobUnload[] = _.map(_.filter(this._extensions,
      (e) => e.freeSpace() > 0),
      (e) => new JobUnload(e, this._priority));

    const spawnJobs: JobUnload[] = _.map(_.filter(this._spawns,
      (s) => s.freeSpace() > 0),
      (s) => new JobUnload(s, this._priority));

    const contracts = [...extJobs, ...spawnJobs];
    log.debug(`${this}: contracts ... ${extJobs.length} exts, ${spawnJobs.length} spawns`);
    return contracts;
  }

  buildings(): BuildingWork[] {

    const numExtensions: number = u.find_num_building_sites(this._room, STRUCTURE_EXTENSION);
    const allowedNumExtensions = CONTROLLER_STRUCTURES.extension[this._room.controller?.level ?? 0];
    log.info(`${this}: current num extensions ${numExtensions} - allowed ${allowedNumExtensions}`)

    if (numExtensions == allowedNumExtensions) {
      log.info(`${this}: already have all the required extensions (${numExtensions}).`)
      return [];
    }

    if (numExtensions > allowedNumExtensions) {
      log.error(`${this}: have more extensions than allowed??? (${numExtensions} > ${allowedNumExtensions}`);
      return [];
    }

    const desiredNumExtensions = allowedNumExtensions - numExtensions;

    const extensionPos: RoomPosition[] = _.take(_.flatten(_.map(
      this._spawns,
      (spawn: StructureSpawn): RoomPosition[] => {
        return possible_extension_sites(spawn, desiredNumExtensions);
      })),
      desiredNumExtensions);

    return _.map(extensionPos, (pos) => {
      log.info(`${this}: creating new building work ${this._room} @ ${pos}`)
      return new BuildingWork(this._room, pos, STRUCTURE_EXTENSION);
    });
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
