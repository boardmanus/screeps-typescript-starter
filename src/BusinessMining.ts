import * as Business from 'Business';
import * as Job from "Job";
import { JobHarvest } from 'JobHarvest';
import { JobUnload } from 'JobUnload';
import { JobPickup } from 'JobPickup';
import { JobRepair } from 'JobRepair';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';
import { object, min } from 'lodash';
import { JobBuild } from 'JobBuild';

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

function find_nearby_attackers(mine: Source): Creep[] {
  return mine.pos.findInRange(FIND_HOSTILE_CREEPS, 5, {
    filter: (creep: Creep) => {
      return ((creep.getActiveBodyparts(ATTACK) > 0)
        || (creep.getActiveBodyparts(RANGED_ATTACK) > 0));
    }
  });
}

function can_build_container(source: Source): boolean {
  const rcl = source.room.controller?.level ?? 0;
  if (rcl < 3) {
    return false;
  }

  const numContainers = u.find_num_building_sites(source.room, STRUCTURE_CONTAINER);
  const allowedNumContainers = CONTROLLER_STRUCTURES.container[rcl];

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


function container_building_work(source: Source): BuildingWork {
  return new BuildingWork(source.room, source.pos, STRUCTURE_CONTAINER)
}

function link_building_work(source: Source): BuildingWork {
  return new BuildingWork(source.room, source.pos, STRUCTURE_LINK)
}

export default class BusinessEnergyMining implements Business.Model {

  static readonly TYPE: string = 'em';

  private readonly _priority: number;
  private readonly _mine: Source;

  constructor(mine: Source, priority: number) {
    this._priority = priority;
    this._mine = mine;
  }

  id(): string {
    return Business.id(BusinessEnergyMining.TYPE, this._mine.id);
  }

  toString(): string {
    return this.id();
  }

  site(): RoomObject {
    return this._mine;
  }

  priority(): number {
    return this._priority;
  }

  survey() {
    const mine = this._mine;
    if (!mine._container || !mine._link) {
      const sites = find_mine_structures(mine);
      for (const site of sites) {
        if (!mine._link && (site instanceof StructureLink)) {
          mine._link = site;
          mine._link._isSink = false;
          log.info(`${mine}: updated link to ${site}`);
        }
        else if (!mine._container && (site instanceof StructureContainer)) {
          mine._container = site;
          log.info(`${mine}: updated container to ${site}`);
        }
      }
    }
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
    const attackers = find_nearby_attackers(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: [${attackers}] near mine - no permanent jobs!`);
      return [];
    }

    const jobs: Job.Model[] = [];
    if (mine._link || mine._container) {
      jobs.push(new JobHarvest(mine, this._priority));
    }
    if (mine._link) {
      jobs.push(new JobUnload(mine._link, this._priority - 0.1));
    }
    if (mine._container) {
      jobs.push(new JobRepair(mine._container, this._priority - 0.2));
      jobs.push(new JobUnload(mine._container, this._priority - 0.3));
    }

    // Get employees to build their own structures
    const buildsites = find_mine_construction(this._mine);
    _.each(buildsites, (s) => jobs.push(new JobBuild(s, this._priority)));

    log.debug(`${this}: permanentJobs-${jobs}`);

    return jobs;
  }

  contractJobs(): Job.Model[] {
    const mine: Source = this._mine;
    const attackers = find_nearby_attackers(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: ${attackers} near mine - no contract jobs!`);
      return [];
    }

    let jobs: Job.Model[] = [];

    if (!mine._link && !mine._container) {
      // When no link or container, use contractors for harvesting.
      jobs.push(new JobHarvest(mine, this._priority));
    }

    let pickupJobs
    if (mine._container) {
      // Always use a contractor to clear the container
      jobs.push(new JobPickup(mine._container));
    }

    log.debug(`${this}: contractJobs-${jobs}`);
    return jobs;
  }

  buildings(): BuildingWork[] {
    const mine: Source = this._mine;
    const work: BuildingWork[] = [];

    if (!mine._container && can_build_container(mine)) {
      work.push(container_building_work(mine));
    }

    if (!mine._link && can_build_link(mine)) {
      work.push(link_building_work(mine));
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
  const priority = Number(frags[3]);
  return new BusinessEnergyMining(mine, priority);
});


