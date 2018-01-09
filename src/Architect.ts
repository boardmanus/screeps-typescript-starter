import { Expert } from "./Expert";
import { City } from "./City";
import { Work } from "./Work";
import { Job } from "./Job";
import { log } from "./lib/logger/log";
import { JobBuild } from "./JobBuild";
import { JobRepair } from "./JobRepair";
import { Operation } from "./Operation";
import u from "./Utility";
/*
function find_controller_paths(room : Room) : PathStep[][] {
  const controller = room.controller;
  if (!controller) {
    return [[]];
  }

  const spawns : Spawn[]= room.find(FIND_MY_SPAWNS);
  const paths = _.map(spawns, (spawn : Spawn) : PathStep[] => {
      return room.findPath(controller.pos, spawn.pos);
  });

  return paths;
}

function find_source_paths(room : Room, sources : Source[]) : PathStep[][] {
  const spawns : Spawn[] = room.find(FIND_MY_SPAWNS);

  const paths = _.reduce(
    spawns,
    (a : PathStep[][], spawn : Spawn) : PathStep[][] => {
      return a.concat(_.map(sources, (source : Source) : PathStep[] => {
        return room.findPath(source.pos, spawn.pos);
      }));
    },
    [[]]);

  return paths;
}

function surrounding_positions(pos : RoomPosition, radius : number) : RoomPosition[] {
  const minx = Math.max(0, pos.x - radius);
  const maxx = Math.min(pos.x + radius, 50);
  const miny = Math.max(0, pos.y - radius);
  const maxy = Math.min(pos.y + radius, 50);
  const positions = [];
  for (let x = minx; x <= maxx; ++x) {
    for (let y = miny; y <= maxy; ++y) {
      positions.push(new RoomPosition(x, y, pos.roomName));
    }
  }

  return positions;
}
*/

function possible_extension_sites(spawn : Spawn, numExtensions : number) : RoomPosition[] {
  let radius = 1;
  let sites : RoomPosition[] = [];
  while (sites.length < numExtensions && radius++ < 5) {
    const viableSites = spawn.pos.surroundingPositions(radius, (site : RoomPosition) => {
      if ((site.x % 2) || (site.y % 2)) {
        return false;
      }

      const terrain = site.look();
      return _.reduce(terrain, (a : boolean, t : LookAtResult) : boolean => {
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

function possible_container_sites(source : Source) : RoomPosition[] {
  let haveContainer : boolean = false;
  const viableSites = source.pos.surroundingPositions(1, (site : RoomPosition) : boolean => {
    if (haveContainer) {
      return false;
    }
    const terrain = site.look();
    for (const t of terrain) {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          if (t.constructionSite && t.constructionSite.structureType == STRUCTURE_CONTAINER) {
            haveContainer = true;
          }
          return false;
        case LOOK_STRUCTURES:
          if (t.structure && t.structure.structureType == STRUCTURE_CONTAINER) {
            haveContainer = true;
          }
          return false;
        case LOOK_TERRAIN:
          if (t.terrain == 'wall') {
            return false;
          }
          break;
        default:
          break;
      }
    }
    return true;
  });

  log.info(`found ${viableSites.length} viable container sites ${viableSites}`);
  return haveContainer? [] : viableSites.slice(0, 1);
}

class BuildingWork implements Work {

  readonly site : RoomPosition;
  readonly type : StructureConstant;
  readonly room : Room;

  constructor(room : Room, pos : RoomPosition, type : StructureConstant) {
    this.site = pos
    this.type = type;
    this.room = room;
  }

  id() {
    return `work-build-${this.type}-${this.site.x}-${this.site.y}`;
  }

  priority() : number {
    return 0;
  }

  work() : Operation[] {
    return [ () => {
      const res = this.room.createConstructionSite(this.site.x, this.site.y, this.type);
      switch (res) {
        case OK:
          log.info(`${this.id()}: created construction site`);
          break;
        default:
          log.error(`${this.id()}: failed to create construction site (${u.errstr(res)})`);
          break;
      }
    } ];
  }
}

export class Architect implements Expert {

  private _city: City;

  constructor(city: City) {
    this._city = city;
  }

  id() : string {
    return `architect-${this._city.name}`
  }

  toString() : string {
    return this.id();
  }

  survey() : void {
    log.debug(`${this.id()} surveying...`);
  }

  designExtensions() : Work[] {
    const room = this._city.room;
    const controller = room.controller;
    if (!controller) return [];

    const numExtensions =
      room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_EXTENSION } }).length +
      room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }).length;

    const allowedNumExtensions = CONTROLLER_STRUCTURES.extension[controller.level];
    log.info(`${this.id()}: current num extensions ${numExtensions} - allowed ${allowedNumExtensions}`)

    if (numExtensions == allowedNumExtensions) {
      log.info(`${this.id()}: already have all the required extensions (${numExtensions}).`)
      return [];
    }

    if (numExtensions > allowedNumExtensions) {
      log.error(`${this.id()}: have more extensions than allowed??? (${numExtensions} > ${allowedNumExtensions}`);
      return [];
    }

    const desiredNumExtensions = allowedNumExtensions - numExtensions;

    const extensionPos : RoomPosition[] = _.take(_.flatten(_.map(
      room.find<Spawn>(FIND_MY_SPAWNS),
      (spawn : Spawn) : RoomPosition[] => {
        return possible_extension_sites(spawn, desiredNumExtensions);
      })),
      desiredNumExtensions);

    return _.map(extensionPos, (pos : RoomPosition) : Work => {
      log.info(`${this.id()}: creating new building work ${room} ... ${pos}`)
      return new BuildingWork(room, pos, STRUCTURE_EXTENSION);
    });
  }

  designContainers() : Work[] {
    const room = this._city.room;
    const controller = room.controller;
    if (!controller) return [];

    const numContainers =
      room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_CONTAINER } }).length +
      room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } }).length;

    const allowedNumContainers = CONTROLLER_STRUCTURES.container[controller.level];
    log.info(`${this.id()}: current num containers ${numContainers} - allowed ${allowedNumContainers}`)

    if (numContainers == allowedNumContainers) {
      log.info(`${this.id()}: already have all the required containers (${numContainers}).`)
      return [];
    }

    if (numContainers > allowedNumContainers) {
      log.error(`${this.id()}: have more containers than allowed??? (${numContainers} > ${allowedNumContainers}`);
      return [];
    }

    const containerPos : RoomPosition[] = _.flatten(_.map(
      room.find<Source>(FIND_SOURCES),
      (source : Source) : RoomPosition[] => {
        return possible_container_sites(source);
      }));

    return _.map(containerPos, (pos : RoomPosition) : Work => {
      log.info(`${this.id()}: creating new building work ${room} ... ${pos}`)
      return new BuildingWork(room, pos, STRUCTURE_CONTAINER);
    });
  }

  design() : Work[] {
    const extensionWorks : Work[] = this.designExtensions();
    const containerWorks : Work[] = this.designContainers();
    return extensionWorks.concat(containerWorks);
  }

  schedule() : Job[] {
    log.debug(`${this.id()} scheduling...`);

    const room = this._city.room;

    const constructionSites : ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES);
    const constructionJobs = _.map(constructionSites, (site : ConstructionSite) : Job => {
      return new JobBuild(site);
    });

    const repairSites : Structure[] = room.find(FIND_STRUCTURES, { filter: (s : Structure) => {
      return s.structureType == STRUCTURE_CONTAINER && s.hits/s.hitsMax < 0.8;
    }});

    const repairJobs : JobRepair[] = _.map(repairSites, (site : Structure) : JobRepair => {
      return new JobRepair(site, (1.0 - site.hits/site.hitsMax)*8.0);
    })

    return constructionJobs.concat(repairJobs);
  }

  report() : string[] {
    let r = new Array<string>();
    r.push(`*** Architectural report by ${this.id()}`);
    return r;
  }

  save() : void {}
}
