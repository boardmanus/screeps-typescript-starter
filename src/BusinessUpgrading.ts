import * as Business from 'Business';
import * as Job from "Job";
import JobUpgrade from 'JobUpgrade';
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import JobRepair from 'JobRepair';
import Worker from 'Worker';
import u from 'Utility';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, MOVE, CARRY, CARRY, WORK, WORK, WORK, WORK, WORK, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [MOVE, WORK, WORK, WORK];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;

function find_controller_structures(controller: StructureController): AnyStructure[] {
  return controller.room.find(FIND_STRUCTURES, {
    filter: (s: Structure) => {
      return ((s.structureType == STRUCTURE_CONTAINER) && controller.pos.inRangeTo(s.pos, 3));
    }
  });
}

function find_controller_construction(controller: StructureController): ConstructionSite[] {
  return controller.room?.find(FIND_CONSTRUCTION_SITES, {
    filter: (s: ConstructionSite) => {
      return ((s.structureType == STRUCTURE_CONTAINER) && controller.pos.inRangeTo(s.pos, 3));
    }
  });
}

function can_build_container(controller: StructureController): boolean {
  const rcl = controller.level;
  if (rcl < 3) {
    return false;
  }

  const numContainers = u.find_num_building_sites(controller.room, STRUCTURE_CONTAINER);
  const allowedNumContainers = CONTROLLER_STRUCTURES.container[rcl];

  return ((allowedNumContainers - numContainers) > 0);
}

function possible_container_sites(controller: RoomObject): RoomPosition[] {
  let haveContainer: boolean = false;
  const viableSites = controller.pos.surroundingPositions(3, (site: RoomPosition): boolean => {
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

  if (haveContainer) {
    return [];
  }

  return viableSites;
}

function best_container_site(controller: StructureController): RoomPosition | undefined {
  const viableSites = possible_container_sites(controller);
  log.info(`found ${viableSites.length} viable container sites ${viableSites}`);
  if (viableSites.length == 0) {
    return undefined;
  }
  const room = controller.room;
  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    let val = -emptyPositions.length;
    if (room && room.storage) {
      val += 1 / site.getRangeTo(room.storage);
    }
    return val;
  });

  return viableSites[0];
}

function container_building_work(controller: StructureController): BuildingWork | undefined {
  const site = best_container_site(controller);
  if (site) {
    return new BuildingWork(controller.room, site, STRUCTURE_CONTAINER)
  }
  return undefined;
}

function update_controller(controller: StructureController): void {
  if (!controller._container) {
    const sites = find_controller_structures(controller);
    for (const site of sites) {
      const sites: (AnyStructure | ConstructionSite)[] = find_controller_structures(controller);
      sites.push(...find_controller_construction(controller));
      for (const site of sites) {
        if (!controller._container && (site.structureType === STRUCTURE_CONTAINER)) {
          controller._container = site;
        }
      }
    }
  }
}

export default class BusinessUpgrading implements Business.Model {

  static readonly TYPE: string = 'upg';

  private readonly _priority: number;
  private readonly _controller: StructureController;

  constructor(controller: StructureController, priority: number = 5) {
    this._priority = priority;
    this._controller = controller;
  }

  id(): string {
    return Business.id(BusinessUpgrading.TYPE, this._controller.id);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  needsEmployee(employees: Worker[]): boolean {
    return employees.length == 0;
  }

  survey() {
    update_controller(this._controller);
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
    const controller: StructureController = this._controller;
    const attackers = u.find_nearby_attackers(controller);
    if (attackers.length > 0) {
      log.warning(`${this}: [${attackers}] near controller - no permanent jobs!`);
      return [];
    }

    const jobs: Job.Model[] = [];
    const container = controller.container();
    if (container) {
      jobs.push(new JobUpgrade(controller));
      jobs.push(new JobRepair(container, this._priority));
      jobs.push(new JobPickup(container, RESOURCE_ENERGY, 1));
    }

    return jobs;
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    const controller: StructureController = this._controller;
    const attackers = u.find_nearby_attackers(controller);
    if (attackers.length > 0) {
      log.warning(`${this}: ${attackers} near controller - no contract jobs!`);
      return [];
    }

    let jobs: Job.Model[] = [];
    jobs.push(new JobUpgrade(controller));

    const container = controller.container();
    if (_.find(employees, (e) => !e.creep.spawning)) {
      if (container && container.freeSpace() > 500) {
        const urgency = container.freeSpace() / container.capacity();
        jobs.push(new JobUnload(container, RESOURCE_ENERGY, urgency * 9));
      }
    }
    else {
      if (container && container.available()) {
        jobs.push(new JobPickup(container));
      }
    }

    return jobs;
  }

  buildings(): BuildingWork[] {
    const controller: StructureController = this._controller;
    const work: BuildingWork[] = [];

    if (!controller._container && can_build_container(controller)) {
      const buildingWork = container_building_work(controller);
      if (buildingWork) {
        work.push(buildingWork);
      }
    }

    return work;
  }
}

Business.factory.addBuilder(BusinessUpgrading.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const controller = <StructureController>Game.getObjectById(frags[2]);
  if (!controller) {
    return undefined;
  }
  return new BusinessUpgrading(controller);
});
