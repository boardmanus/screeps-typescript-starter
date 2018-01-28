import { Expert } from "./Expert";
import { City } from "./City";
import { Work } from "./Work";
import { Job } from "./Job";
import { log } from "./lib/logger/log";
import { JobBuild } from "./JobBuild";
import { Operation } from "./Operation";
import { FunctionCache } from "./Cache";
import u from "./Utility";

const ROADING_FIND_PATH_OPTIONS : PathFinderOpts = {
  plainCost: 1,
  swampCost: 1,
  maxRooms: 1,
  roomCallback: gen_roading_cost_matrix
};

const ROADING_MATRIX_CACHE : FunctionCache<CostMatrix> = new FunctionCache();

function gen_roading_cost_matrix(roomName : string) : CostMatrix {
  return ROADING_MATRIX_CACHE.getValue(roomName, () : CostMatrix => {
    const room : Room = Game.rooms[roomName];
    const matrix = new PathFinder.CostMatrix();

    _.each(room.find(FIND_STRUCTURES), (s : Structure) => {
      const cost = (u.is_passible_structure(s))? 1 : 0xff;
      matrix.set(s.pos.x, s.pos.y, cost);
    });

    return matrix;
  });
}

function find_roading_route(from : RoomObject, to : RoomObject) : RoomPosition[] {
  const path : PathFinderPath = PathFinder.search(from.pos, { pos: to.pos, range: 1 }, ROADING_FIND_PATH_OPTIONS);
  log.debug(`Roading route from ${from} to ${to}: ${path.path.length} sq`);
  return path.path;
}

function find_controller_routes(room : Room) : RoomPosition[] {
  const controller = room.controller;
  if (!controller) {
    return [];
  }

  const spawns : StructureSpawn[]= room.find(FIND_MY_SPAWNS);
  const paths = _.flatten(_.map(spawns, (spawn : StructureSpawn) : RoomPosition[] => {
      return find_roading_route(controller, spawn);
    }));

  return paths;
}

function find_tower_routes(room : Room) : RoomPosition[] {
  const towers : StructureTower[] = room.find<StructureTower>(FIND_MY_STRUCTURES, { filter: (s : Structure) => {
    return s.structureType == STRUCTURE_TOWER;
  }});
  if (towers.length == 0) {
    return [];
  }

  const storage : Structure[] = room.find(FIND_STRUCTURES, { filter: (s : Structure) => {
    return s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE;
  }});
  if (storage.length == 0) {
    return [];
  }

  const paths = _.flatten(_.map(storage, (store : Structure) : RoomPosition[] => {
    return _.flatten(_.map(towers, (tower : StructureTower) : RoomPosition[] => {
      return find_roading_route(store, tower);
    }));
  }));

  return paths;
}

function find_source_routes(room : Room) : RoomPosition[] {
  const sources : Source[] = room.find(FIND_SOURCES);
  const spawns : StructureSpawn[] = room.find(FIND_MY_SPAWNS);

  const paths = _.flatten(_.map(sources, (source : Source) : RoomPosition[] => {
    return _.flatten(_.map(spawns, (spawn : StructureSpawn) : RoomPosition[] => {
      return find_roading_route(source, spawn);
    }));
  }));

  return paths;
}

function look_for_road_filter(l : LookAtResult) : boolean {
  if (l.type == LOOK_STRUCTURES) {
    return (l.structure && l.structure.structureType == STRUCTURE_ROAD)? true : false;
  }
  else if (l.type == LOOK_CONSTRUCTION_SITES) {
    return (l.constructionSite && l.constructionSite.structureType == STRUCTURE_ROAD)? true : false;
  }

  return false;
}

function select_road_sites(room : Room, maxSites : number, selector: (r : Room) => RoomPosition[]) : RoomPosition[] {
  return _.take(_.filter(selector(room), (pos : RoomPosition) => {
      const lookies = room.lookAt(pos);
      const roadFound = _.find(lookies, look_for_road_filter);
      return !roadFound;
    }),
    maxSites);
}

function possible_road_sites(room : Room, numAllowed : number) : RoomPosition[] {
  const controller = room.controller;
  if (!controller) {
    return [];
  }


  const sourceRoutes = select_road_sites(room, numAllowed, find_source_routes);
  if (sourceRoutes.length > 0) {
    return sourceRoutes;
  }

  const controllerRoutes = select_road_sites(room, numAllowed, find_controller_routes);
  if (controllerRoutes.length > 0) {
    return controllerRoutes;
  }

  const towerRoutes = select_road_sites(room, numAllowed, find_tower_routes);
  return towerRoutes;
}

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

function find_site<S extends Structure>(obj : RoomObject, type : StructureConstant, radius : number) : S|null {
  let site : Structure|null = null;
  const viableSites = obj.pos.surroundingPositions(radius, (pos : RoomPosition) : boolean => {
    if (site) return false;
    const structures = pos.lookFor(LOOK_STRUCTURES);
    for (const s of structures) {
      site = (s && s.structureType == type)? s  : null;
      if (site) return true;
    }
    return false;
  });

  return site;
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

function possible_tower_sites(protectionSite : RoomObject) : RoomPosition[] {
  let haveTower : boolean = false;
  const room = protectionSite.room;
  if (!room) {
    return [];
  }
  const viableSites = protectionSite.pos.surroundingPositions(5, (site : RoomPosition) : boolean => {
    if (haveTower) {
      return false;
    }
    const terrain = site.look();
    for (const t of terrain) {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          if (t.constructionSite && t.constructionSite.structureType == STRUCTURE_TOWER) {
            haveTower = true;
          }
          return false;
        case LOOK_STRUCTURES:
          if (t.structure && t.structure.structureType == STRUCTURE_TOWER) {
            haveTower = true;
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

  if (haveTower) {
    return [];
  }

  log.info(`found ${viableSites.length} viable tower sites ${viableSites} for ${protectionSite}`);
  const exits = room.find(FIND_EXIT);
  const orderedSites = _.sortBy(viableSites, (p : RoomPosition) : number => {
    return _.min(_.map(exits, (ep : RoomPosition) : number => {
      const range = p.getRangeTo(ep);
      return (range < 4)? 1000 : range;
    }))
  });

  return _.take(orderedSites, 1);
}

function possible_link_sites(linkNeighbour : Structure) : RoomPosition[] {
  let haveLink : boolean = false;
  const room = linkNeighbour.room;
  if (!room) {
    return [];
  }
  const viableSites = linkNeighbour.pos.surroundingPositions(1, (site : RoomPosition) : boolean => {
    if (haveLink) {
      return false;
    }
    const terrain = site.look();
    for (const t of terrain) {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          if (t.constructionSite && t.constructionSite.structureType == STRUCTURE_LINK) {
            haveLink = true;
          }
          return false;
        case LOOK_STRUCTURES:
          if (t.structure && t.structure.structureType == STRUCTURE_LINK) {
            haveLink = true;
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

  if (haveLink) {
    return [];
  }

  log.info(`found ${viableSites.length} viable link sites for ${linkNeighbour}`);
  return _.take(viableSites, 1);
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
            if (t.constructionSite && !u.is_passible_structure(t.constructionSite)) {
              viability = 0;
            }
            break;
          case LOOK_STRUCTURES:
            if (t.structure && !u.is_passible_structure(t.structure)) {
              viability = 0;
            }
            break;
          case LOOK_TERRAIN:
            if (t.terrain == 'wall') {
              return 0;
            }
            else if (t.terrain == 'swamp') {
              viability *= 1.0;
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

  toString() : string {
    return this.id();
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
    this.load();
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

  designTowers() : Work[] {
    const room = this._city.room;
    const controller = room.controller;
    if (!controller) return [];

    const numTowers = u.find_num_building_sites(room, STRUCTURE_TOWER);
    const allowedNumTowers = CONTROLLER_STRUCTURES.tower[controller.level];
    log.info(`${this}: current num towers ${numTowers} - allowed ${allowedNumTowers}`)

    if (numTowers >= allowedNumTowers) {
      log.info(`${this}: already have all the required towers (${numTowers}).`)
      return [];
    }

    let protectionSites : RoomObject[] = room.find(FIND_SOURCES);
    if (room.storage) {
      protectionSites.push(room.storage);
    }

    const towerPositions = _.take(_.flatten(_.map(
      protectionSites,
      (obj : RoomObject) : RoomPosition[] => {
        return possible_tower_sites(obj);
      })),
      allowedNumTowers - numTowers);

    return _.map(towerPositions, (pos : RoomPosition) : Work => {
      log.info(`${this}: creating new tower build work at ${pos} ...`);
      return new BuildingWork(room, pos, STRUCTURE_TOWER);
    });
  }

  designLinks() : Work[] {
    const room = this._city.room;
    const controller = room.controller;
    if (!controller) return [];

    const numLinks = u.find_num_building_sites(room, STRUCTURE_LINK);
    const allowedNumLinks = CONTROLLER_STRUCTURES.link[controller.level];
    log.info(`${this}: current num links ${numLinks} - allowed ${allowedNumLinks}`)

    if (numLinks >= allowedNumLinks) {
      log.info(`${this}: already have all the required towers (${numLinks}).`)
      return [];
    }

    const storage : Structure|undefined = room.storage;
    if (!storage) {
      // Don't build links if a storage site isn't available
      return [];
    }

    // Get all the containers
    const containers : Structure[] = _.sortBy(u.map_valid(
      room.find(FIND_SOURCES, { filter: (s : Source) => { return !s._link; }}),
      (s : Source) : Structure|null => { return s._container; }),
      (s : Structure) => { return -s.pos.getRangeTo(storage); });

    const spawns : Structure[] = room.find(FIND_MY_SPAWNS, { filter: (s : StructureSpawn) => { return !s._link; }});

    const linkNeighbours = [storage].concat(containers, spawns);

    const linkPositions = _.take(_.flatten(_.map(
      linkNeighbours,
      (s : Structure) : RoomPosition[] => {
        return possible_link_sites(s);
      })),
      allowedNumLinks - numLinks);

    return _.map(linkPositions, (pos : RoomPosition) : Work => {
      log.info(`${this}: creating new link build work at ${pos} ...`);
      return new BuildingWork(room, pos, STRUCTURE_LINK);
    });
  }

  designRoads() : Work[] {
    const room = this._city.room;
    const numRoadConstructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (cs : ConstructionSite) => {
      return cs.structureType == STRUCTURE_ROAD;
    }}).length;

    if (numRoadConstructionSites >= 10) {
      log.info(`${this}: already have all the allowed road construction sites (${numRoadConstructionSites}).`)
      return [];
    }

    const numAllowed = 10 - numRoadConstructionSites;
    log.debug(`${this}: allowing ${numAllowed} road construction sites`);

    const roadPos : RoomPosition[] = possible_road_sites(room, numAllowed);

    return _.map(roadPos, (pos : RoomPosition) : Work => {
      log.info(`${this}: creating new road build work ${room} ... ${pos}`)
      return new BuildingWork(room, pos, STRUCTURE_ROAD);
    });
  }

  design() : Work[] {
    const extensionWorks : Work[] = this.designExtensions();
    const containerWorks : Work[] = this.designContainers();
    const storageWorks : Work[] = this.designStorage();
    const roadWorks : Work[] = this.designRoads();
    const towerWorks : Work[] = this.designTowers();
    const linkWorks : Work[] = this.designLinks();
    return extensionWorks.concat(containerWorks, storageWorks, roadWorks, towerWorks, linkWorks);
  }

  schedule() : Job[] {

    const room = this._city.room;

    const constructionSites : ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES);
    const constructionJobs = _.map(constructionSites, (site : ConstructionSite) : Job => {
      return new JobBuild(site, 5);
    });

    log.debug(`${this} scheduling ${constructionJobs.length}...`);
    return constructionJobs;
  }

  report() : string[] {
    let r = new Array<string>();
    r.push(`*** Architectural report by ${this}`);
    return r;
  }

  load() : void {
    const room = this._city.room;
    const sources = room.find(FIND_SOURCES);
    const sourceMem = room.memory.sources;
    if (sourceMem) {
      _.each(sourceMem, (sm : SourceMemory) => {
        const source : Source|null = Game.getObjectById<Source>(sm.id);
        if (!source) return;

        const container = Game.getObjectById<StructureContainer>(sm.container);
        if (container) {
          source._container = container;
        }
        else {
          source._container = find_site(source, STRUCTURE_CONTAINER, 1);
          log.warning(`${this}: found ${source} container => ${source._container}`);
        }

        const tower = Game.getObjectById<StructureTower>(sm.tower);
        if (tower) {
          source._tower = tower;
        }
        else {
          source._tower = find_site(source, STRUCTURE_TOWER, 5);
          log.warning(`${this}: found ${source} tower => ${source._tower}`);
        }

        const link = Game.getObjectById<StructureLink>(sm.link);
        if (link) {
          source._link = link;
        }
        else {
          if (source._container) {
            source._link = find_site(source._container, STRUCTURE_LINK, 1);
            log.warning(`${this}: found ${source} link => ${source._link}`);
          }
        }
      });
    }

    const storage = room.storage;
    const storageMem = room.memory.storage;
    if (storage && storageMem) {
      const link = Game.getObjectById<StructureLink>(storageMem.link);
      if (link) {
        storage._link = link;
      }
      else {
        storage._link = find_site(storage, STRUCTURE_LINK, 1);
        log.warning(`${this}: found ${storage} link => ${storage._link}`);
      }
    }
  }

  save() : void {
    const room = this._city.room;

    room.memory.sources = _.map(
      room.find(FIND_SOURCES),
      (s : Source) : SourceMemory => {
        const sm : SourceMemory = {
          id: s.id,
          container: s._container? s._container.id : undefined,
          tower: s._tower? s._tower.id : undefined,
          link: s._link? s._link.id : undefined
        };
        return sm;
      });

    if (room.storage) {
      const s = room.storage;
      room.memory.storage =
        <StorageMemory>{
          id: s.id,
          link: s._link? s._link.id : undefined
        };
    }
  }
}
