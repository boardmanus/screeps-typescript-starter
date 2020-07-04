import * as Business from 'Business';
import * as Job from "Job";
import { JobHarvest } from 'JobHarvest';
import { JobUnload } from 'JobUnload';
import { JobPickup } from 'JobPickup';
import { JobRepair } from 'JobRepair';
import { BuildingWork } from 'Architect';
import u from 'Utility';

type BuildingSpec = {
  structure: BuildableStructureConstant;
  pos: RoomPosition
};

function can_build_container(source: Source): boolean {
  const rcl = source.room.controller?.level ?? 0;
  const numContainers = u.find_num_building_sites(source.room, STRUCTURE_CONTAINER);
  const allowedNumContainers = CONTROLLER_STRUCTURES.container[rcl];
  return ((rcl > 1) && ((allowedNumContainers - numContainers) > 0));
}

function container_building_work(source: Source): BuildingWork {
  return new BuildingWork(source.room, source.pos, STRUCTURE_CONTAINER)
}

function link_building_work(source: Source): BuildingWork {
  return new BuildingWork(source.room, source.pos, STRUCTURE_LINK)
}

function harvest_spaces(source: Source): RoomPosition[] {
  const positions = source.pos.surroundingPositions(1, (p: RoomPosition): boolean => {
    const terrain = p.look();
    return _.reduce(terrain, (a: boolean, t: LookAtResult): boolean => {
      if (!a) {
        return false;
      }
      switch (t.type) {
        case LOOK_STRUCTURES:
          return !t.structure || u.is_passible_structure(t.structure);
        case LOOK_TERRAIN:
          return (t.terrain != 'wall');
        default:
          break;
      }
      return true;
    },
      true);
  });

  return positions;
}

function harvest_contracts(mine: Source, priority: number): JobHarvest[] {
  const jobs = _.map(harvest_spaces(mine), (pos: RoomPosition) => {
    return new JobHarvest(mine, priority++);
  });
  return jobs;
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
    return Business.id(BusinessEnergyMining.TYPE, this._mine.id, this._priority);
  }

  site(): RoomObject {
    return this._mine;
  }

  priority(): number {
    return this._priority;
  }

  permanentJobs(): Job.Model[] {
    const mine: Source = this._mine;
    const jobs: Job.Model[] = [];
    if (mine._link || mine._container) {
      jobs.push(new JobHarvest(mine, this._priority));
    }
    if (mine._link) {
      jobs.push(new JobUnload(mine._link, this._priority + 1));
    }
    if (mine._container) {
      jobs.push(new JobRepair(mine._container, this._priority + 2));
      jobs.push(new JobUnload(mine._container, this._priority + 3));
    }
    return jobs;
  }

  contractJobs(): Job.Model[] {
    const mine: Source = this._mine;
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

    return jobs;
  }

  buildings(): BuildingWork[] {
    const mine: Source = this._mine;
    const work: BuildingWork[] = [];

    if (!mine._container && can_build_container(mine)) {
      work.push(container_building_work(mine));
    }

    if (!mine._link) {
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
