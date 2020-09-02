import * as Business from 'Business';
import * as Job from 'Job';
import JobUpgrade from 'JobUpgrade';
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import JobRepair from 'JobRepair';
import * as u from 'Utility';
import WorkBuilding from 'WorkBuilding';
import log from 'ScrupsLogger';
import JobBuild from 'JobBuild';
import JobSign from 'JobSign';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, MOVE, CARRY, CARRY, WORK, WORK, WORK, WORK, WORK, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [MOVE, WORK, WORK, WORK];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;

function find_controller_structures(controller: StructureController): AnyStructure[] {
  return controller.room.find(FIND_STRUCTURES,
    { filter: (s: Structure) => ((s.structureType === STRUCTURE_CONTAINER) && controller.pos.inRangeTo(s.pos, 3)) });
}

function find_controller_construction(controller: StructureController): ConstructionSite[] {
  return controller.room?.find(FIND_CONSTRUCTION_SITES,
    { filter: (s: ConstructionSite) => ((s.structureType === STRUCTURE_CONTAINER) && controller.pos.inRangeTo(s.pos, 3)) });
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
  let haveContainer = false;
  const viableSites = controller.pos.surroundingPositions(3, (site: RoomPosition): boolean => {
    if (haveContainer) {
      return false;
    }
    const terrain = site.look();
    return _.all(terrain, (t) => {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          if (t.constructionSite) {

            if (t.constructionSite.structureType === STRUCTURE_CONTAINER) {
              haveContainer = true;
              return false;
            }

            if (t.constructionSite.structureType !== STRUCTURE_ROAD) {
              return false;
            }
          }
          break;
        case LOOK_STRUCTURES:
          if (t.structure) {
            if (t.structure.structureType === STRUCTURE_CONTAINER) {
              haveContainer = true;
              return false;
            }
            if (t.structure.structureType !== STRUCTURE_ROAD) {
              return false;
            }
          }
          break;
        case LOOK_TERRAIN:
          if (t.terrain === 'wall') {
            return false;
          }
          break;
        default:
          break;
      }
      return true;
    });
  });

  if (haveContainer) {
    return [];
  }

  return viableSites;
}

function best_container_site(controller: StructureController): RoomPosition[] {
  const viableSites = possible_container_sites(controller);
  log.info(`found ${viableSites.length} viable container sites ${viableSites}`);
  if (viableSites.length === 0) {
    return [];
  }
  const { room } = controller;
  const testObj: RoomObject = room.storage ?? room.find(FIND_MY_SPAWNS)[0];
  log.error(`${controller}: finding container close to ${testObj}`);
  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    let val = -emptyPositions.length * emptyPositions.length;
    val += site.findPathTo(testObj).length;
    return val;
  });

  const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'solid', stroke: 'purple' };
  let i = 0;
  _.each(sortedSites, (site) => {
    if (i++ === 0) return;
    style.opacity = (0.25 - (i / sortedSites.length) / 4);
    room.visual.circle(site.x, site.y, style);
  });

  const bestSites = _.take(sortedSites, 1);
  const bestStyle: CircleStyle = { fill: 'green', radius: 0.6, lineStyle: 'solid', stroke: 'green' };
  _.each(bestSites, (site) => {
    room.visual.circle(site.x, site.y, bestStyle);
  });

  return bestSites;
}

function container_building_work(controller: StructureController): WorkBuilding | undefined {
  const sites = best_container_site(controller);
  if (sites.length > 0) {
    return new WorkBuilding(sites[0], STRUCTURE_CONTAINER);
  }
  return undefined;
}

function update_controller(controller: StructureController): void {
  if (!controller._container) {
    const sites: (AnyStructure | ConstructionSite)[] = find_controller_structures(controller);
    sites.push(...find_controller_construction(controller));
    _.each(sites, (site) => {
      if (!controller._container && (site.structureType === STRUCTURE_CONTAINER)) {
        controller._container = site;
      }
    });
  }
}

export default class BusinessUpgrading implements Business.Model {

  static readonly TYPE: string = 'upg';

  private readonly _priority: number;
  private readonly _controller: StructureController;

  constructor(controller: StructureController, priority = 5) {
    this._priority = priority;
    this._controller = controller;

    update_controller(this._controller);
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

  canRequestEmployee(): boolean {
    const rcl = this._controller?.level ?? 0;
    return rcl < 4;
  }

  needsEmployee(employees: Creep[]): boolean {
    return employees.length === 0;
  }

  survey() {
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
    const attackers = u.find_nearby_hostiles(controller);
    if (attackers.length > 0) {
      log.warning(`${this}: [${attackers}] near controller - no permanent jobs!`);
      return [];
    }

    const jobs: Job.Model[] = [];

    if (controller.sign?.username !== controller.owner?.username) {
      jobs.push(new JobSign(controller, 'MINE!'));
    }

    const container = controller.container();
    if (container) {
      jobs.push(new JobUpgrade(controller));
      jobs.push(new JobRepair(container, this._priority));
      jobs.push(new JobPickup(container, RESOURCE_ENERGY, 1));
    } else if (controller._container) {
      jobs.push(new JobBuild(controller._container as ConstructionSite));
    }

    return jobs;
  }

  contractJobs(employees: Creep[]): Job.Model[] {
    const controller: StructureController = this._controller;
    const attackers = u.find_nearby_hostiles(controller);
    if (attackers.length > 0) {
      log.warning(`${this}: ${attackers} near controller - no contract jobs!`);
      return [];
    }

    const jobs: Job.Model[] = [];
    jobs.push(new JobUpgrade(controller));

    const container = controller.container();
    if (_.find(employees, (e) => !e.spawning)) {
      const er = controller.room.energyAvailable / controller.room.energyCapacityAvailable;
      if (container) {
        if (container.freeSpace() > 500 && er > 0.5) {
          const urgency = container.freeSpace() / container.capacity();
          jobs.push(new JobUnload(container, RESOURCE_ENERGY, urgency * 7));
        }

        if (container.available(u.RESOURCE_MINERALS) > 0) {
          jobs.push(new JobPickup(container, u.RESOURCE_MINERALS));
        }
      } else {
        _.each(employees, (e) => {
          jobs.push(new JobUnload(e, RESOURCE_ENERGY));
        });
      }
    } else if (container && container.available()) {
      jobs.push(new JobPickup(container));
    }

    return jobs;
  }

  buildings(): WorkBuilding[] {
    const controller: StructureController = this._controller;
    const work: WorkBuilding[] = [];

    if (!controller._container && can_build_container(controller)) {
      const workBuilding = container_building_work(controller);
      if (workBuilding) {
        work.push(workBuilding);
      }
    }

    return work;
  }
}
