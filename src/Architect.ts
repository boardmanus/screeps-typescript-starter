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
function possible_extension_sites(spawn : StructureSpawn, numExtensions : number) : RoomPosition[] {
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

function possible_storage_sites(controller : StructureController) : RoomPosition[] {
  const viableSites = controller.pos.surroundingPositions(2, (site : RoomPosition) : boolean => {
    const terrain = site.look();
    for (const t of terrain) {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          return false;
        case LOOK_STRUCTURES:
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

  log.info(`found ${viableSites.length} viable storage sites ${viableSites}`);
  return viableSites;
}

function storage_site_viability(pos : RoomPosition, room : Room) : number {
  const spacialViability = _.reduce(
    pos.surroundingPositions(1),
    (a : number, p : RoomPosition) : number => {

      const terrain = p.look();
      let viability = 1;
      for (const t of terrain) {
        switch (t.type) {
          case LOOK_SOURCES:
          case LOOK_MINERALS:
            viability = 0;
            break;
          case LOOK_CONSTRUCTION_SITES:
            if (t.constructionSite && !u.is_passible_structure(t.constructionSite.structureType)) {
              viability = 0;
            }
            break;
          case LOOK_STRUCTURES:
            if (t.structure && !u.is_passible_structure(t.structure.structureType)) {
              viability = 0;
            }
            break;
          case LOOK_TERRAIN:
            if (t.terrain == 'wall') {
              return 0;
            }
            else if (t.terrain == 'swamp') {
              viability *= 0.25;
            }
            break;
          default:
            break;
        }
      }
      return a + viability;
    },
    0);

  const spawners = room.find(FIND_MY_SPAWNS);
  if (spawners.length == 0) {
    return spacialViability;
  }
  const locationalViability = _.min(_.map(
    spawners,
    (s : StructureSpawn) : number => {
      return pos.getRangeTo(s);
  }));

  // Want positions with lots of space around, and closer to spawns
  return spacialViability - locationalViability;
}

class BuildingWork implements Work {

  readonly site : RoomPosition;
  readonly type : BuildableStructureConstant;
  readonly room : Room;

  constructor(room : Room, pos : RoomPosition, type : BuildableStructureConstant) {
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
          log.info(`${this}: created construction site`);
          break;
        default:
          log.error(`${this}: failed to create construction site (${u.errstr(res)})`);
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
    log.debug(`${this} surveying...`);
  }

  designExtensions() : Work[] {
    const room = this._city.room;
    const controller = room.controller;
    if (!controller) return [];

    const numExtensions = u.find_num_building_sites(room, STRUCTURE_EXTENSION);

    const allowedNumExtensions = CONTROLLER_STRUCTURES.extension[controller.level];
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

    const extensionPos : RoomPosition[] = _.take(_.flatten(_.map(
      room.find(FIND_MY_SPAWNS),
      (spawn : StructureSpawn) : RoomPosition[] => {
        return possible_extension_sites(spawn, desiredNumExtensions);
      })),
      desiredNumExtensions);

    return _.map(extensionPos, (pos : RoomPosition) : Work => {
      log.info(`${this}: creating new building work ${room} ... ${pos}`)
      return new BuildingWork(room, pos, STRUCTURE_EXTENSION);
    });
  }

  designContainers() : Work[] {
    const room = this._city.room;
    const controller = room.controller;
    if (!controller) return [];

    const numContainers = u.find_num_building_sites(room, STRUCTURE_CONTAINER);
    const allowedNumContainers = CONTROLLER_STRUCTURES.container[controller.level];
    log.info(`${this}: current num containers ${numContainers} - allowed ${allowedNumContainers}`)

    if (numContainers == allowedNumContainers) {
      log.info(`${this}: already have all the required containers (${numContainers}).`)
      return [];
    }

    if (numContainers > allowedNumContainers) {
      log.error(`${this}: have more containers than allowed??? (${numContainers} > ${allowedNumContainers}`);
      return [];
    }

    const containerPos : RoomPosition[] = _.flatten(_.map(
      room.find(FIND_SOURCES),
      (source : Source) : RoomPosition[] => {
        return possible_container_sites(source);
      }));

    return _.map(containerPos, (pos : RoomPosition) : Work => {
      log.info(`${this}: creating new container build work ${room} ... ${pos}`)
      return new BuildingWork(room, pos, STRUCTURE_CONTAINER);
    });
  }

  designStorage() : Work[] {
    const room = this._city.room;
    const controller = room.controller;
    if (!controller) return [];

    const numStorage = u.find_num_building_sites(room, STRUCTURE_STORAGE);
    const allowedNumStorage = CONTROLLER_STRUCTURES.storage[controller.level];
    log.info(`${this}: current num storage ${numStorage} - allowed ${allowedNumStorage}`)

    if (numStorage == allowedNumStorage) {
      log.info(`${this}: already have all the required storage (${numStorage}).`)
      return [];
    }

    if (numStorage > allowedNumStorage) {
      log.error(`${this}: have more storage than allowed??? (${numStorage} > ${allowedNumStorage}`);
      return [];
    }

    // Currently only one storage allowed - it goes next to the controller
    if (numStorage != 0) {
      log.error(`${this}: only expected one storage to be available - update code!`);
      return [];
    }

    const storagePos : RoomPosition[] = _.take(_.sortBy(
        possible_storage_sites(controller),
        (rp : RoomPosition) : number => { return -storage_site_viability(rp, room); }),
      1);

    return _.map(storagePos, (pos : RoomPosition) : Work => {
      log.info(`${this}: creating new storage build work ${room} ... ${pos}`)
      return new BuildingWork(room, pos, STRUCTURE_STORAGE);
    });
  }

  design() : Work[] {
    const extensionWorks : Work[] = this.designExtensions();
    const containerWorks : Work[] = this.designContainers();
    const storageWorks : Work[] = this.designStorage();
    return extensionWorks.concat(containerWorks).concat(storageWorks);
  }

  schedule() : Job[] {
    log.debug(`${this} scheduling...`);

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
    r.push(`*** Architectural report by ${this}`);
    return r;
  }

  save() : void {}
}
