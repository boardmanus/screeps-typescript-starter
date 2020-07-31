import * as Business from 'Business';
import * as Job from "Job";
import JobHarvest from 'JobHarvest';
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import JobRepair from 'JobRepair';
import JobBuild from 'JobBuild';
import JobDrop from 'JobDrop';
import Worker from 'Worker';
import u from 'Utility';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';

type BuildingSpec = {
  structure: BuildableStructureConstant;
  pos: RoomPosition
};

const MIN_EMPLOYEE_BODY: BodyPartConstant[] = [WORK, WORK, WORK, WORK, WORK, MOVE, CARRY];
const IDEAL_EMPLOYEE_BODY: BodyPartConstant[] = [WORK, WORK, WORK, WORK, WORK, MOVE, CARRY, WORK, CARRY, MOVE];

function find_mine_structures(mine: Source): AnyStructure[] {
  return mine.room?.find(FIND_STRUCTURES, {
    filter: (s: Structure) => {
      return ((s.structureType == STRUCTURE_CONTAINER) && mine.pos.inRangeTo(s.pos, 1)
        || (s.structureType == STRUCTURE_LINK) && mine.pos.inRangeTo(s.pos, 2));
    }
  });
}

function find_mine_construction(mine: Source): ConstructionSite[] {
  return mine.room?.find(FIND_CONSTRUCTION_SITES, {
    filter: (s: ConstructionSite) => {
      return ((s.structureType == STRUCTURE_CONTAINER) && mine.pos.inRangeTo(s.pos, 1)
        || (s.structureType == STRUCTURE_LINK) && mine.pos.inRangeTo(s.pos, 2));
    }
  });
}

function can_build_container(source: Source): boolean {

  const controller = source.room.controller;
  if (!controller) {
    return false;
  }

  const rcl = controller.level;
  if (controller.my && rcl < 3) {
    return false;
  }

  const numContainers = u.find_num_building_sites(source.room, STRUCTURE_CONTAINER);
  const allowedNumContainers = CONTROLLER_STRUCTURES.container[rcl];
  log.debug(`${source}: can_build_container: ${numContainers} around, ${allowedNumContainers} allowed`)

  return ((allowedNumContainers - numContainers) > 0);
}

function can_build_link(source: Source): boolean {
  if (!source._container) {
    // Must have a container before a link can be built.
    return false;
  }

  const rcl = source.room.controller?.level ?? 0;
  const links = u.find_building_sites(source.room, STRUCTURE_LINK);
  const allowedNumContainers = CONTROLLER_STRUCTURES.container[rcl];
  if ((allowedNumContainers - links.length) < 1) {
    return false;
  }

  // Link to take energy must already be established.
  const haveSinkLink = _.find(links, (l: StructureLink) => l._isSink) ? true : false;
  return haveSinkLink;
}

function possible_container_sites(source: Source): RoomPosition[] {
  let haveContainer: boolean = false;
  const viableSites = source.pos.surroundingPositions(1, (site: RoomPosition): boolean => {
    if (haveContainer) {
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

function best_container_site(source: Source): RoomPosition {
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
  _.each(sites, (s) => room.visual.circle(s.x, s.y, style));
  return sortedSites[0];
}

function possible_link_sites(linkNeighbour: RoomObject): RoomPosition[] {
  let haveLink: boolean = false;
  log.debug(`${linkNeighbour}: looking for link positions around`)
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

  log.debug(`${linkNeighbour}: ${viableSites.length} viable sites (haveLink=${haveLink})`)

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

function best_link_pos(source: Source) {
  const linkSite = source._container ?? source;
  return possible_link_sites(linkSite)[0];
}

function pickup_priority(container: StructureContainer): number {
  const fullness = 1.0 - container.freeSpace() / container.capacity();
  return fullness * 9;
}

function container_building_work(source: Source): BuildingWork | undefined {
  const bestSite = best_container_site(source)
  log.debug(`${source}: best_container_site=${bestSite}`)
  if (!bestSite) {
    return undefined;
  }
  return new BuildingWork(source.room, bestSite, STRUCTURE_CONTAINER)
}

function link_building_work(source: Source): BuildingWork {
  return new BuildingWork(source.room, best_link_pos(source), STRUCTURE_LINK)
}

function update_mine(mine: Source): void {

  mine._link = undefined;
  mine._container = undefined;

  // Load information from storage, if possible
  const allSourceMem: SourceMemory[] = mine.room.memory.sources ?? [];
  let sourceMem = _.find(allSourceMem, (sm) => sm.id === mine.id);
  if (!sourceMem) {
    sourceMem = <SourceMemory>{ id: mine.id, container: undefined, link: undefined };
    allSourceMem.push(sourceMem);
  }

  if (sourceMem.link) {
    mine._link = Game.getObjectById<StructureLink>(sourceMem.link) ?? undefined;
  }
  if (sourceMem.container) {
    mine._container = Game.getObjectById<StructureContainer>(sourceMem.container) ?? undefined;
  }

  if (!mine._container || !mine._link) {
    const sites: (AnyStructure | ConstructionSite)[] = find_mine_structures(mine);
    sites.push(...find_mine_construction(mine));
    for (const site of sites) {
      if (!mine._link && site.structureType === STRUCTURE_LINK) {
        mine._link = site;
      }
      else if (!mine._container && (site.structureType === STRUCTURE_CONTAINER)) {
        mine._container = site;
      }
    }
  }

  if (mine._link instanceof StructureLink) {
    mine._link._isSink = false;
  }

  // Update storage
  sourceMem.link = mine._link?.id;
  sourceMem.container = mine._container?.id;
}

export default class BusinessEnergyMining implements Business.Model {

  static readonly TYPE: string = 'em';

  private readonly _priority: number;
  readonly _mine: Source;

  constructor(mine: Source, priority: number = 5) {
    this._priority = priority;
    this._mine = mine;
  }

  id(): string {
    return Business.id(BusinessEnergyMining.TYPE, this._mine.id);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  needsEmployee(employees: Worker[]): boolean {
    return (employees.length == 0) && (this._mine.available() > 0);
  }

  survey() {
    update_mine(this._mine);
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
    const mine: Source = this._mine;
    const attackers = u.find_nearby_attackers(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: [${attackers}] near mine - no permanent jobs!`);
      return [];
    }

    const jobs: Job.Model[] = [];
    const link = mine.link();
    const container = mine.container();
    if (mine.available(RESOURCE_ENERGY) > 0 && (mine._link || mine._container)) {
      jobs.push(new JobHarvest(mine, this._priority));

      if (this._mine.room.storage) {
        jobs.push(new JobUnload(this._mine.room.storage, u.RESOURCE_MINERALS, 9));
      }

      if (link) {
        jobs.push(new JobUnload(link, RESOURCE_ENERGY, this._priority - 1));
      }

      if (container) {
        jobs.push(new JobUnload(container, u.RESOURCE_ALL, this._priority - 2));
        jobs.push(new JobDrop(container, this._priority - 3));
      }
    }

    // Allow the employee to repair the container, even if no energy
    // in mine.
    if (container && container.hits < container.hitsMax) {
      jobs.push(new JobRepair(container, this._priority));
    }

    // Get employees to build their own structures
    if (mine._link && !link) {
      jobs.push(new JobBuild(<ConstructionSite>mine._link, this._priority));
    }

    if (mine._container && !container) {
      jobs.push(new JobBuild(<ConstructionSite>mine._container, this._priority));
    }

    return jobs;
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    const mine: Source = this._mine;
    const attackers = u.find_nearby_attackers(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: ${attackers} near mine - no contract jobs!`);
      return [];
    }

    let jobs: Job.Model[] = [];

    const link = mine.link();
    const container = mine.container();

    if ((employees.length == 0) || (!mine._link && !mine._container)) {
      // When no employees, link and container, use contractors for harvesting.
      log.debug(`${this}: adding harvest job cos ${employees.length} emps, ${mine._link} & ${mine._container}`)
      jobs.push(new JobHarvest(mine));
    }

    if (container) {
      // Always use a contractor to clear the container
      if (container.available()) {
        const pickup = new JobPickup(container, u.RESOURCE_ALL, pickup_priority(container));
        jobs.push(pickup);
      }
    }

    return jobs;
  }

  buildings(): BuildingWork[] {
    const mine: Source = this._mine;
    const work: BuildingWork[] = [];

    if (!mine._container && can_build_container(mine)) {
      const buildingWork = container_building_work(mine);
      if (buildingWork) {
        work.push(buildingWork);
      }
    }

    if (!mine._link && can_build_link(mine)) {
      work.push(link_building_work(mine));
    }

    if (work.length) {
      log.debug(`${this}: buildings ${work}`);
    }
    return work;
  }
}

Business.factory.addBuilder(BusinessEnergyMining.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const mine = <Source>Game.getObjectById(frags[2]);
  if (!mine) {
    return undefined;
  }
  return new BusinessEnergyMining(mine);
});


