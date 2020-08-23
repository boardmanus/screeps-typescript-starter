import * as Business from 'Business';
import * as Job from "Job";
import JobHarvest from 'JobHarvest';
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import JobDrop from 'JobDrop';
import u from 'Utility';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';

type BuildingSpec = {
  structure: BuildableStructureConstant;
  pos: RoomPosition
};

const MIN_EMPLOYEE_BODY: BodyPartConstant[] = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, CARRY];
const IDEAL_EMPLOYEE_BODY: BodyPartConstant[] = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, CARRY, WORK, CARRY, MOVE];

function is_mineral_structure(mine: Mineral): (s: Structure) => boolean {
  return (s) => {
    return (s.structureType == STRUCTURE_EXTRACTOR) || (s.structureType == STRUCTURE_CONTAINER);
  }
}

function find_mine_structures(mine: Mineral): AnyStructure[] {
  return mine.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: is_mineral_structure(mine)
  }) ?? [];
}

function find_mine_construction(mine: Mineral): ConstructionSite[] {
  return mine.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
    filter: is_mineral_structure(mine)
  }) ?? [];
}

function can_build_extractor(mine: Mineral): boolean {
  const room = mine.room;
  const controller = room?.controller;
  if (!room || !controller) {
    return false;
  }

  const rcl = controller.level;
  if (controller.my && rcl < 6) {
    return false;
  }

  if (mine._extractor) {
    return false;
  }

  return true;
}

function can_build_container(mine: Mineral): boolean {
  log.debug(`${mine}: can_build_container: ${mine}`)

  const room = mine.room;
  const controller = room?.controller;
  if (!room || !controller) {
    return false;
  }

  const rcl = controller.level;
  if (controller.my && rcl < 6) {
    return false;
  }

  const numContainers = u.find_num_building_sites(room, STRUCTURE_CONTAINER);
  const allowedNumContainers = CONTROLLER_STRUCTURES.container[rcl];
  log.debug(`${mine}: can_build_container: ${numContainers} around, ${allowedNumContainers} allowed`)

  return ((allowedNumContainers - numContainers) > 0);
}

function possible_container_sites(source: Mineral): RoomPosition[] {
  let haveContainer: boolean = false;
  const viableSites = source.pos.surroundingPositions(1, (site: RoomPosition): boolean => {
    if (haveContainer) {
      return false;
    }

    if (site.x < 3 || site.x > 46 || site.y < 3 || site.y > 46) {
      return false;
    }

    const terrain = site.look();
    for (const t of terrain) {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          if (t.constructionSite) {
            switch (t.constructionSite.structureType) {
              case STRUCTURE_CONTAINER:
                haveContainer = true;
                return false;
              case STRUCTURE_ROAD:
                break;
              default:
                return false;
            }
          }
          break;
        case LOOK_STRUCTURES:
          if (t.structure) {

            switch (t.structure.structureType) {
              case STRUCTURE_CONTAINER:
                haveContainer = true;
                return false;
              case STRUCTURE_ROAD:
                break;
              default:
                return false;
            }
          }
          break;
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

  if (haveContainer) {
    return [];
  }

  log.info(`found ${viableSites.length} viable container sites ${viableSites}`);
  return viableSites;
}

function best_container_site(source: Mineral): RoomPosition {
  const sites = possible_container_sites(source);

  const room = source.room;
  const sortedSites = _.sortBy(sites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    let val = -emptyPositions.length;
    if (room && room.storage) {
      val += 1 / site.getRangeTo(room.storage);
    }
    return val;
  });

  const style: CircleStyle = { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'purple' };
  _.each(sites, (s) => room?.visual.circle(s.x, s.y, style));
  return sortedSites[0];
}

function pickup_priority(container: StructureContainer): number {
  const fullness = 1.0 - container.freeSpace() / container.capacity();
  return fullness * 9;
}

function container_building_work(mine: Mineral): BuildingWork | undefined {
  const bestSite = best_container_site(mine)
  if (!bestSite) {
    return undefined;
  }
  const room = mine.room;
  if (!room) {
    return undefined;
  }
  return new BuildingWork(bestSite, STRUCTURE_CONTAINER)
}

function update_mine(mine: Mineral): void {
  if (!mine._container) {
    const sites: (AnyStructure | ConstructionSite)[] = find_mine_structures(mine);
    sites.push(...find_mine_construction(mine));
    for (const site of sites) {
      if (site.structureType === STRUCTURE_CONTAINER) {
        mine._container = site;
      }
      else if (site.structureType == STRUCTURE_EXTRACTOR) {
        mine._extractor = site;
      }
    }
  }
}

export default class BusinessMineralMining implements Business.Model {

  static readonly TYPE: string = 'mm';

  private readonly _priority: number;
  readonly _mine: Mineral;

  constructor(mine: Mineral, priority: number = 5) {
    this._priority = priority;
    this._mine = mine;

    update_mine(this._mine);
  }

  id(): string {
    return Business.id(BusinessMineralMining.TYPE, this._mine.id);
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
    return ((employees.length == 0)
      && !(!this._mine.container() || !this._mine.extractor())
      && (this._mine.available(this._mine.mineralType) > 0));
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {

    log.debug(`${this}: employeeBody(${availEnergy}, ${maxEnergy})`)
    const minCost = _.sum(MIN_EMPLOYEE_BODY, (part: BodyPartConstant) => BODYPART_COST[part]);
    if (availEnergy < minCost) {
      log.debug(`${this}: employeeBody: minCost=${minCost}`)
      return [];
    }

    const idealCost = _.sum(IDEAL_EMPLOYEE_BODY, (part: BodyPartConstant) => BODYPART_COST[part]);
    if (availEnergy >= idealCost) {
      log.debug(`${this}: employeeBody: idealCost=${idealCost} ${IDEAL_EMPLOYEE_BODY}`)
      return IDEAL_EMPLOYEE_BODY;
    }
    else if (idealCost <= maxEnergy) {
      return [];
    }
    log.debug(`${this}: employeeBody: minCost=${minCost} ${MIN_EMPLOYEE_BODY}`)
    return MIN_EMPLOYEE_BODY;
  }

  permanentJobs(): Job.Model[] {
    const mine: Mineral = this._mine;
    const attackers = u.find_nearby_attackers(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: [${attackers}] near mine - no permanent jobs!`);
      return [];
    }

    const jobs: Job.Model[] = [];

    const extractor = mine.extractor();
    const container = mine.container();
    log.debug(`${this}: ${mine} has ${extractor}, ${container}, ${mine.available()} resources of ${mine.mineralType}`)
    if (mine.available() > 0 && container && extractor) {
      jobs.push(new JobHarvest(mine, this._priority));

      if (container.freeSpace()) {
        jobs.push(new JobUnload(container, mine.mineralType, this._priority));
      }
      else {
        jobs.push(new JobDrop(container, this._priority));
      }
    }

    return jobs;
  }

  contractJobs(employees: Creep[]): Job.Model[] {
    const mine: Mineral = this._mine;
    const attackers = u.find_nearby_attackers(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: ${attackers} near mine - no contract jobs!`);
      return [];
    }

    let jobs: Job.Model[] = [];

    const container = mine.container();

    if (container && container.available() > 0) {
      jobs.push(new JobPickup(container, u.RESOURCE_ALL, pickup_priority(container)));
    }

    return jobs;
  }

  buildings(): BuildingWork[] {
    const mine: Mineral = this._mine;
    const room = mine.room;
    const work: BuildingWork[] = [];

    if (!room) {
      return [];
    }

    if (!mine._container && can_build_container(mine)) {
      const buildingWork = container_building_work(mine);
      if (buildingWork) {
        work.push(buildingWork);
      }
    }

    if (!mine._extractor && can_build_extractor(mine)) {
      work.push(new BuildingWork(mine.pos, STRUCTURE_EXTRACTOR));
    }

    if (work.length) {
      log.debug(`${this}: buildings ${work}`);
    }

    return work;
  }
}

Business.factory.addBuilder(BusinessMineralMining.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const mine = <Mineral>Game.getObjectById(frags[2]);
  if (!mine) {
    return undefined;
  }
  return new BusinessMineralMining(mine);
});


