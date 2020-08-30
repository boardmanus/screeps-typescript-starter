import { Expert } from "./Expert";
import { Work } from "./Work";
import * as Job from "Job";
import { log } from "./ScrupsLogger";
import Executive from "Executive";
import BusinessEnergyMining from "BusinessEnergyMining";
import { Operation } from "./Operation";
import Cache from "Cache";
import u from "./Utility";

const ROADING_FIND_PATH_OPTIONS: PathFinderOpts = {
  plainCost: 1,
  swampCost: 1,
  maxRooms: 3,
  roomCallback: gen_roading_cost_matrix
};

const ROADING_MATRIX_CACHE: Cache = new Cache();

function gen_roading_cost_matrix(roomName: string): CostMatrix {
  return ROADING_MATRIX_CACHE.get(roomName, (): CostMatrix => {
    const room: Room = Game.rooms[roomName];
    const matrix = new PathFinder.CostMatrix();

    if (room) {
      _.each(room.find(FIND_STRUCTURES), (s: Structure) => {
        const cost = (u.is_passible_structure(s)) ? 1 : 0xff;
        matrix.set(s.pos.x, s.pos.y, cost);
      });
    }

    return matrix;
  });
}

function find_roading_route(from: RoomObject, to: RoomObject): RoomPosition[] {
  const path: PathFinderPath = PathFinder.search(from.pos, { pos: to.pos, range: 1 }, ROADING_FIND_PATH_OPTIONS);
  return path.path;
}

function find_controller_routes(room: Room): RoomPosition[] {
  const controller = room.controller;
  if (!controller) {
    return [];
  }

  const spawns: StructureSpawn[] = room.find(FIND_MY_SPAWNS);
  const paths = _.flatten(_.map(spawns, (spawn: StructureSpawn): RoomPosition[] => {
    return find_roading_route(controller, spawn);
  }));

  return paths;
}

function find_tower_routes(room: Room): RoomPosition[] {
  const towers: StructureTower[] = room.find<StructureTower>(FIND_MY_STRUCTURES, {
    filter: (s: Structure) => {
      return s.structureType == STRUCTURE_TOWER;
    }
  });
  if (towers.length == 0) {
    return [];
  }

  const storage: Structure[] = room.find(FIND_STRUCTURES, {
    filter: (s: Structure) => {
      return s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE;
    }
  });
  if (storage.length == 0) {
    return [];
  }

  const paths = _.flatten(_.map(storage, (store: Structure): RoomPosition[] => {
    return _.flatten(_.map(towers, (tower: StructureTower): RoomPosition[] => {
      return find_roading_route(store, tower);
    }));
  }));

  return paths;
}

function find_source_routes(ceos: Executive[]): (room: Room) => RoomPosition[] {
  return (room: Room) => {
    const sources: Source[] = _.map(_.filter(ceos,
      (ceo) => ceo.business instanceof BusinessEnergyMining),
      (ceo) => (<BusinessEnergyMining>ceo.business)._mine);

    const spawns: StructureSpawn[] = room.find(FIND_MY_SPAWNS);

    const paths = _.flatten(_.map(sources, (source: Source): RoomPosition[] => {
      return _.flatten(_.map(spawns, (spawn: StructureSpawn): RoomPosition[] => {
        return find_roading_route(source, spawn);
      }));
    }))

    return paths;
  };
}

function find_link_routes(room: Room): RoomPosition[] {
  const links: StructureLink[] = room.find<StructureLink>(FIND_MY_STRUCTURES, {
    filter: (s: Structure) => {
      return s.structureType == STRUCTURE_LINK;
    }
  });
  const spawns: StructureSpawn[] = room.find(FIND_MY_SPAWNS);

  const paths = _.flatten(_.map(links, (link: StructureLink): RoomPosition[] => {
    return _.flatten(_.map(spawns, (spawn: StructureSpawn): RoomPosition[] => {
      return find_roading_route(link, spawn);
    }));
  }));

  return paths;
}

function find_extractor_routes(room: Room): RoomPosition[] {

  const storage = room.storage;
  if (!storage) {
    return [];
  }

  const extractors: StructureExtractor[] = room.find<StructureExtractor>(FIND_MY_STRUCTURES, {
    filter: (s: Structure) => {
      return s.structureType == STRUCTURE_EXTRACTOR;
    }
  });

  const paths = _.flatten(_.map(extractors, (extractor: StructureExtractor): RoomPosition[] => {
    return find_roading_route(extractor, storage);
  }));

  return paths;
}

function look_for_road_filter(l: LookAtResult): boolean {
  if (l.type == LOOK_STRUCTURES) {
    return (l.structure && l.structure.structureType == STRUCTURE_ROAD) ? true : false;
  }
  else if (l.type == LOOK_CONSTRUCTION_SITES) {
    return (l.constructionSite) ? true : false;
  }

  return false;
}

function select_road_sites(room: Room, maxSites: number, name: string, defCounter: number, selector: (r: Room) => RoomPosition[]): RoomPosition[] {
  const counters = room.memory.architect.roading;
  const counter = (name in counters) ? counters[name] - 1 : defCounter;
  if (counter <= 0) {

    log.debug(`${room}: computing roads for ${name}`);
    const sites = _.take(_.filter(selector(room), (pos: RoomPosition) => {
      if (pos.x == 0 || pos.y == 0 || pos.x == 49 || pos.y == 49) {
        return false;
      }
      if (!Game.rooms[pos.roomName]) {
        log.error(`${room}: road pos ${pos} has unaccessable room`);
        return false;
      }
      const roadFound = _.find(pos.look(), look_for_road_filter);
      return !roadFound;
    }),
      maxSites);

    counters[name] = (sites.length == 0) ? defCounter : 0;

    return sites;
  }

  counters[name] = counter;
  return [];
}

function possible_road_sites(room: Room, ceos: Executive[], numAllowed: number): RoomPosition[] {
  const controller = room.controller;
  if (!controller) {
    return [];
  }

  const sourceRoutes = select_road_sites(room, numAllowed, 'sources', 17, find_source_routes(ceos));
  if (sourceRoutes.length > 0) {
    return sourceRoutes;
  }

  const controllerRoutes = select_road_sites(room, numAllowed, 'controller', 41, find_controller_routes);
  if (controllerRoutes.length > 0) {
    return controllerRoutes;
  }

  const linkRoutes = select_road_sites(room, numAllowed, 'links', 23, find_link_routes);
  if (linkRoutes.length > 0) {
    return linkRoutes;
  }

  const extractorRoutes = select_road_sites(room, numAllowed, 'extractors', 19, find_extractor_routes);
  if (extractorRoutes.length > 0) {
    return extractorRoutes;
  }

  const towerRoutes = select_road_sites(room, numAllowed, 'towers', 13, find_tower_routes);
  return towerRoutes;
}

function possible_tower_sites(protectionSite: RoomObject): RoomPosition[] {
  let haveTower: boolean = false;
  const room = protectionSite.room;
  if (!room) {
    return [];
  }
  const viableSites = protectionSite.pos.surroundingPositions(5, (site: RoomPosition): boolean => {
    if (haveTower) {
      return false;
    }

    if (site.x < 6 || site.y < 6 || site.x > 44 || site.y > 44) {
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
  return viableSites;
}

function possible_link_sites(linkNeighbour: Structure): RoomPosition[] {
  let haveLink: boolean = false;
  const room = linkNeighbour.room;
  if (!room) {
    return [];
  }
  const viableSites = linkNeighbour.pos.surroundingPositions(1, (site: RoomPosition): boolean => {
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
  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    let val = -emptyPositions.length;
    if (room.storage) {
      val += 1 / site.getRangeTo(room.storage);
    }
    return val;
  });

  return _.take(sortedSites, 1);
}
/*
function possible_extractor_sites(room: Room): RoomPosition[] {
  const minerals = room.find(FIND_MINERALS);
  const viableSites: RoomPosition[] = _.map(minerals, (m: Mineral): RoomPosition => { return m.pos; });

  log.info(`found ${viableSites.length} viable extrator sites ${viableSites}`);
  return viableSites;
}
*/
export class BuildingWork implements Work {

  readonly site: RoomPosition;
  readonly type: BuildableStructureConstant;
  readonly room: Room;

  constructor(pos: RoomPosition, type: BuildableStructureConstant) {
    this.site = pos
    this.type = type;
    this.room = Game.rooms[pos.roomName];
  }

  id() {
    return `work-build-${this.type}-${this.site?.x}-${this.site?.y}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [() => {
      if (!this.site) {
        log.error(`${this}: ${this.type} site undefined!`)
        return;
      }

      if (!this.room) {
        log.warning(`${this}: ${this.site} room not visible!`);
        return;
      }

      const res = this.room.createConstructionSite(this.site.x, this.site.y, this.type);
      switch (res) {
        case OK:
          log.info(`${this}: created construction site`);
          break;
        default:
          log.error(`${this}: failed to create construction site (${u.errstr(res)})`);
          break;
      }
    }];
  }
}

const PRIORITY_BY_LEVEL: number[] = [
  1,
  1,
  1,
  2,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
];

export class Architect implements Expert {

  private _room: Room;

  constructor(room: Room) {
    this._room = room;
  }

  id(): string {
    return `architect-${this._room.name}`
  }

  toString(): string {
    return this.id();
  }

  survey(): void {
    log.debug(`${this} surveying...`);

  }
  /*
    designContainers(): Work[] {
      const room = this._room;
      const controller = room.controller;
      if (!controller) {
        return [];
      }
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

      return [];
    }
  */
  designTowers(): Work[] {
    const room = this._room;
    const controller = room.controller;
    if (!controller) return [];

    const numTowers = u.find_num_building_sites(room, STRUCTURE_TOWER);
    const allowedNumTowers = CONTROLLER_STRUCTURES.tower[controller.level];
    log.info(`${this}: current num towers ${numTowers} - allowed ${allowedNumTowers}`)

    if (numTowers >= allowedNumTowers) {
      log.info(`${this}: already have all the required towers (${numTowers}).`)
      return [];
    }

    let protectionSites: RoomObject[] = room.find(FIND_SOURCES);
    if (room.storage) {
      protectionSites.push(room.storage);
    }

    const exits = room.find(FIND_EXIT);
    const allTowerPositions = _.sortBy(_.flatten(_.map(
      protectionSites,
      (obj: RoomObject): RoomPosition[] => {
        return possible_tower_sites(obj);
      })),
      (pos) => {
        const towerCloseness = _.min(_.map(
          room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_TOWER }),
          (t) => t.pos.getRangeTo(pos)));

        const exitCloseness = _.min(_.map(exits,
          (ep: RoomPosition): number => {
            const range = pos.getRangeTo(ep);
            return ((range < 10) ? 1000 : (Math.trunc(range / 10) + 1));
          }));

        // Want to be a nice compromise of close to an exit, but far from another tower.
        return exitCloseness / towerCloseness;
      });

    const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'dashed', stroke: 'purple' };
    let i = 0;
    for (const site of allTowerPositions) {
      style.opacity = (i == 0) ? 1.0 : 0.5 - i / allTowerPositions.length / 2;
      room.visual.circle(site.x + 1.5, site.y + 1.5, style);
      ++i;
    }

    const towerPositions = _.take(allTowerPositions, allowedNumTowers - numTowers);

    return _.map(towerPositions, (pos: RoomPosition): Work => {
      log.info(`${this}: creating new tower build work at ${pos} ...`);
      return new BuildingWork(pos, STRUCTURE_TOWER);
    });
  }
  /*
    designExtractors(): Work[] {
      const room = this._room;
      const controller = room.controller;
      if (!controller) return [];

      const numExtractors = u.find_num_building_sites(room, STRUCTURE_EXTRACTOR);
      const allowedNumExtractors = CONTROLLER_STRUCTURES.extractor[controller.level];
      log.info(`${this}: current num extractors ${numExtractors} - allowed ${allowedNumExtractors}`)

      if (numExtractors >= allowedNumExtractors) {
        log.info(`${this}: already have all the required extractors (${numExtractors})`);
        return [];
      }

      const extractorPositions = _.take(possible_extractor_sites(room), allowedNumExtractors - numExtractors);
      return _.map(extractorPositions, (pos: RoomPosition): Work => {
        log.info(`${this}: creating new extractor build work at ${pos} ...`);
        return new BuildingWork(room, pos, STRUCTURE_EXTRACTOR);
      });
    }
  */
  designRoads(rooms: Room[], ceos: Executive[]): Work[] {
    if (rooms.length == 0) {
      return [];
    }

    const numRoadConstructionSites = _.sum(rooms, (room) => {
      const cs = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (cs) => cs.structureType == STRUCTURE_ROAD });
      log.debug(`${this}: ${cs.length} cs in ${room.name}`);
      return cs.length;
    });

    if (numRoadConstructionSites >= 10) {
      log.info(`${this}: already have all the allowed road construction sites (${numRoadConstructionSites}).`)
      return [];
    }

    const room = rooms[0];
    if (!room.memory.architect) {
      room.memory.architect = <ArchitectMemory>{ roading: {} };
    }

    const numAllowed = 10 - numRoadConstructionSites;
    log.debug(`${this}: allowing ${numAllowed} road construction sites`);

    const roadPos: RoomPosition[] = possible_road_sites(room, ceos, numAllowed);
    return u.map_valid(roadPos, (pos) => {
      const roadRoom: Room = Game.rooms[pos.roomName];
      if (!roadRoom) {
        return undefined;
      }
      log.info(`${this}: creating new road build work ${roadRoom} ... ${pos}`)
      return new BuildingWork(pos, STRUCTURE_ROAD);
    });
  }

  design(rooms: Room[], ceos: Executive[]): Work[] {
    const businessWorks: Work[] = _.flatten(_.map(ceos, (ceo) => ceo.business.buildings()));
    const roadWorks: Work[] = this.designRoads(rooms, ceos);
    const towerWorks: Work[] = this.designTowers();
    //const extractorWorks: Work[] = this.designExtractors();
    //const containerWorks: Work[] = this.designContainers();
    return businessWorks.concat(roadWorks, towerWorks);
  }

  schedule(): Job.Model[] {
    return [];
  }

  report(): string[] {
    let r = new Array<string>();
    r.push(`*** Architectural report by ${this}`);
    return r;
  }

  save(): void {
    const room = this._room;

    room.memory.sources = _.map(
      room.find(FIND_SOURCES),
      (s: Source): SourceMemory => {
        const sm: SourceMemory = {
          id: s.id,
          container: s._container ? s._container.id : undefined,
          link: s._link ? s._link.id : undefined
        };
        return sm;
      });
  }
}
