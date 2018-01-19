import { log } from "./lib/logger/log";
import { FunctionCache } from "./Cache";

namespace u {
  export function map_valid<T, U>(objs : T[], f : (obj : T) => U|undefined|null) : U[] {
    if (!objs) return [];
    return _.reduce(
      objs,
      (accum : U[], inObj : T) : U[] => {
        const outObj : U|undefined|null = f(inObj);
        if (outObj) accum.push(outObj);
        return accum;
      },
      []);
  }

  export function map_valid_creeps(creepIds : string[]) : Creep[] {
    return map_valid(
      creepIds,
      (creepId : string) : Creep|null => { return Game.getObjectById(creepId); });
  }

  export function errstr(screepsErr : number) : string {
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

  export const MIN_BODY : BodyPartConstant[] = [ WORK, CARRY, MOVE ];
  export const MIN_BODY_COST = body_cost(MIN_BODY);

  export function body_cost(parts : BodyPartConstant[]) : number {
    return _.sum(parts, (c : BodyPartConstant) : number => { return BODYPART_COST[c]; });
  }

  export function generate_body(bodyExtension : BodyPartConstant[], funds : number) : BodyPartConstant[] {

    const body : BodyPartConstant[] = [];
    const bodyTemplate : BodyPartConstant[] = MIN_BODY.concat(bodyExtension);
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

    log.debug(`generate_body: newBody=${body}=${body_cost(body)} => remainingFunds=${funds}`)
    return body;
  }

  export function time_to_spawn(body : BodyPartConstant[]) : number {
    return body.length * CREEP_SPAWN_TIME;
  }

  export function find_num_building_sites(room : Room, type : StructureConstant) : number {
    const numConstuctionSites =
      room.find(FIND_CONSTRUCTION_SITES, { filter: (c : ConstructionSite) => { return c.structureType == type }}).length;
    const numStructures =
      room.find(FIND_STRUCTURES, { filter: (s : AnyStructure) => { return s.structureType == type }}).length;

    return numConstuctionSites + numStructures;
  }

  export function is_passible_structure(s : Structure|ConstructionSite) : boolean {
    return (s.structureType == STRUCTURE_ROAD
          || s.structureType == STRUCTURE_CONTAINER
          || (s.structureType == STRUCTURE_RAMPART && (s as StructureRampart|ConstructionSite).my));
  }

  export function terrain_cost(pos : RoomPosition|null) : number {
    if (!pos) {
      return 100000;
    }

    const structures = pos.lookFor(LOOK_STRUCTURES);
    if (_.find(structures, (s : Structure) => { return s.structureType == STRUCTURE_ROAD; })) {
      return 1;
    }

    const terrain = pos.lookFor(LOOK_TERRAIN)[0];
    switch (terrain) {
      case "plain" : return 2;
      case "swamp" : return 10;
      default:
      case "wall" : return 1000000;
    }
  }

  export type Site = Creep|Structure|Resource|Source|Mineral|ConstructionSite;

  export function movement_time(worker : Creep, site : Site) : number {
    const [m, c] = _.reduce(
      worker.body,
      ([n, c], b : BodyPartDefinition) : [number, number] => {
        return [ (b.type == MOVE)? n+1 : n, (b.type == CARRY)? c+1 : c ];
      },
      [0, 0]);

    const path = get_path(worker, site);
    const w = worker.body.length - m - c*(worker.freeSpace()/worker.carryCapacity);
    const f = _.sum(path, (p : PathStep) : number => {
      const t = terrain_cost(worker.room.getPositionAt(p.x, p.y));
      return w*t - 2*m;
    });

    // time waiting for fatigue
    const t_f = f/(2*m);

    // total time is waiting time + traversal time
    return t_f + path.length;
  }

  const _pathCache : FunctionCache<PathStep[]> = new FunctionCache();
  export function get_path(from : Site, to : Site) : PathStep[] {
    return _pathCache.getValue(`${from.id}-${to.id}`, () => { return from.pos.findPathTo(to); });
  }

  export function work_efficiency(worker : Creep, site : Site, energy : number, energyPerPart : number) : number {
    const numWorkerParts = _.sum(worker.body, (b : BodyPartDefinition) : number => { return (b.type == WORK)? 1 : 0; });
    const workEnergyPerTick = Math.max(1, numWorkerParts)*energyPerPart;
    const timeToBuild = energy/workEnergyPerTick;
    const timeToMove = u.movement_time(worker, site);

    // Efficiency is the energy exchange per second from where the creep is.
    const t = Math.max(1, timeToBuild + timeToMove);
    const e = energy / t;
    log.debug(`worker_efficiency: ${worker}-${site} efficiency=${e} (energy=${energy}, time=~${t}ticks)`);
    return e;
  }
}

export default u;
