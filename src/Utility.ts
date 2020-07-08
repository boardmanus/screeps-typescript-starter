import { log } from "./ScrupsLogger";
import { FunctionCache } from "./Cache";

namespace u {
  export function map_valid<T, U>(objs: T[], f: (obj: T) => U | undefined | null): U[] {
    if (!objs) return [];
    return _.reduce(
      objs,
      (accum: U[], inObj: T): U[] => {
        const outObj: U | undefined | null = f(inObj);
        if (outObj) accum.push(outObj);
        return accum;
      },
      []);
  }

  export function map_valid_creeps(creepIds: string[]): Creep[] {
    return map_valid(
      creepIds,
      (creepId: string): Creep | null => { return Game.getObjectById(creepId); });
  }

  export function errstr(screepsErr: number): string {
    switch (screepsErr) {
      case ERR_BUSY: return "ERR_BUSY";
      case ERR_FULL: return "ERR_FULL";
      case ERR_GCL_NOT_ENOUGH: return "ERR_GCL_NOT_ENOUGH";
      case ERR_INVALID_ARGS: return "ERR_INVALID_ARG";
      case ERR_INVALID_TARGET: return "ERR_INVALID_TARGET";
      case ERR_NAME_EXISTS: return "ERR_NAME_EXISTS";
      case ERR_NO_BODYPART: return "ERR_NO_BODYPART";
      case ERR_NO_PATH: return "ERR_NO_PATH";
      case ERR_NOT_ENOUGH_ENERGY: return "ERR_NOT_ENOUGH_ENERGY";
      case ERR_NOT_ENOUGH_EXTENSIONS: return "ERR_NOT_ENOUGH_EXTENSIONS";
      case ERR_RCL_NOT_ENOUGH: return "ERR_RCL_NOT_ENOUGH";
      case ERR_TIRED: return "ERR_TIRED";
      default: break;
    }

    return `ERR_${screepsErr}`;
  }

  export const MIN_BODY: BodyPartConstant[] = [WORK, CARRY, MOVE];
  export const MIN_BODY_COST = body_cost(MIN_BODY);

  export function body_cost(parts: BodyPartConstant[]): number {
    return _.sum(parts, (c: BodyPartConstant): number => { return BODYPART_COST[c]; });
  }

  export function generate_body(bodyExtension: BodyPartConstant[], funds: number): BodyPartConstant[] {

    const body: BodyPartConstant[] = [];
    const bodyTemplate: BodyPartConstant[] = MIN_BODY.concat(bodyExtension);
    if (funds < MIN_BODY_COST) {
      log.debug(`generate_body: funds=${funds} are less than minBody=${MIN_BODY}=${MIN_BODY_COST}`)
      return body;
    }

    let outOfFunds = false;
    do {
      for (const b of bodyTemplate) {
        const partCost = BODYPART_COST[b];

        outOfFunds = (partCost > funds);
        if (outOfFunds) {
          break;
        }

        body.push(b);
        funds -= partCost;
      }
    }
    while (!outOfFunds);

    log.info(`generate_body: newBody = ${body} = ${body_cost(body)} => remainingFunds = ${funds}`);
    return body;
  }

  export function time_to_spawn(body: BodyPartConstant[]): number {
    return body.length * CREEP_SPAWN_TIME;
  }

  export function find_construction_sites(room: Room, type: BuildableStructureConstant): ConstructionSite[] {
    return room.find(FIND_CONSTRUCTION_SITES, { filter: (s) => (s.structureType === type) });
  }

  export function find_building_sites(room: Room, type: StructureConstant): AnyStructure[] {
    return room.find(FIND_STRUCTURES, { filter: (s) => (s.structureType === type) });
  }

  export function find_num_building_sites(room: Room, type: StructureConstant | BuildableStructureConstant): number {
    const numConstuctionSites = find_construction_sites(room, type as BuildableStructureConstant).length;
    const numStructures = find_building_sites(room, type).length;
    return numConstuctionSites + numStructures;
  }

  export function is_passible_structure(s: Structure | ConstructionSite): boolean {
    return (s.structureType == STRUCTURE_ROAD
      || s.structureType == STRUCTURE_CONTAINER
      || (s.structureType == STRUCTURE_RAMPART && (s as StructureRampart | ConstructionSite).my));
  }

  export function terrain_cost(pos: RoomPosition | null): number {
    if (!pos) {
      return 100000;
    }

    const structures = pos.lookFor(LOOK_STRUCTURES);
    if (_.find(structures, (s: Structure) => { return s.structureType == STRUCTURE_ROAD; })) {
      return 1;
    }

    const terrain = pos.lookFor(LOOK_TERRAIN)[0];
    switch (terrain) {
      case "plain": return 2;
      case "swamp": return 10;
      default:
      case "wall": return 1000000;
    }
  }

  export type Site = Creep | Structure | Resource | Source | Mineral | ConstructionSite;

  export function movement_time(weight: number, moveParts: number, path: RoomPosition[]) {
    // time waiting for fatigue
    const t_f = _.sum(path, (p: RoomPosition): number => {
      const t = terrain_cost(p);
      const f = 2 * (weight * t - moveParts);
      return (f > 0) ? Math.ceil(weight * t / moveParts) : 0;
    });

    // total time is waiting time + traversal time
    return t_f + path.length;
  }

  export function creep_movement_time(worker: Creep, site: Site): number {
    const [moveParts, carryParts] = _.reduce(
      worker.body,
      ([n, c], b: BodyPartDefinition): [number, number] => {
        return [(b.type == MOVE) ? n + 1 : n, (b.type == CARRY) ? c + 1 : c];
      },
      [0, 0]);

    const weight = worker.body.length - moveParts - carryParts * (worker.freeSpace() / worker.carryCapacity);

    const path = get_path(worker, site);
    if (path.length == 0) {
      return 0;
    }

    return movement_time(weight, moveParts, path);
  }

  const _pathCache: FunctionCache<RoomPosition[]> = new FunctionCache();
  export function get_path(from: Site, to: Site): RoomPosition[] {
    return _pathCache.getValue(`${from.id} - ${to.id}`, () => {
      const room = from.room;
      if (!room || from.pos.inRangeTo(to, 1)) {
        return [];
      }

      return _.map(room.findPath(from.pos, to.pos, { range: 1, ignoreCreeps: true }), (ps: PathStep) => {
        return room.getPositionAt(ps.x, ps.y) || new RoomPosition(ps.x, ps.y, room.name);
      });
    });
  }

  export function work_energy(worker: Creep, maxEnergyPerPart: number): number {
    return _.sum(worker.body, (b) => (b.type == WORK) ? maxEnergyPerPart : 0);
  }

  export function work_efficiency(worker: Creep, site: Site, energy: number, maxEnergyPerPart: number): number {
    const numWorkerParts = _.sum(worker.body, (b: BodyPartDefinition): number => { return (b.type == WORK) ? 1 : 0; });
    if (numWorkerParts == 0) {
      return 0;
    }

    const energyPerPart = Math.max(energy / numWorkerParts, maxEnergyPerPart);
    const workEnergyPerTick = numWorkerParts * energyPerPart;
    const timeToWork = Math.ceil(energy / workEnergyPerTick);
    const timeToMove = Math.ceil(u.creep_movement_time(worker, site));

    // Efficiency is the energy exchange per second from where the creep is.
    const t = Math.max(1, timeToMove + timeToWork);
    const e = energy / t;
    return e;
  }

  export function find_my_sites(obj: RoomObject, type: StructureConstant, radius: number): AnyOwnedStructure[] {
    const sites = obj.room?.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => (s.structureType == type) && obj.pos.inRangeTo(s.pos, radius)
    });
    return sites ?? [];
  }
}

export default u;
