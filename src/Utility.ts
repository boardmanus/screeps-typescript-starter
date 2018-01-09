import { log } from "./lib/logger/log";

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
}

export default u;
