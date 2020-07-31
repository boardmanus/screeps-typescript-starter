import * as Business from 'Business';
import * as Job from "Job";
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import Worker from 'Worker';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';


function can_build_terminal(room: Room): boolean {
  const rcl = room.controller?.level ?? 0;
  const numTerminals = u.find_num_building_sites(room, STRUCTURE_TERMINAL);
  const allowedNumTerminals = CONTROLLER_STRUCTURES.terminal[rcl];
  log.debug(`${room}: can_build_terminal: ${allowedNumTerminals} allowed, ${numTerminals} present`)
  return (allowedNumTerminals - numTerminals) > 0;
}

function possible_terminal_sites(room: Room): RoomPosition[] {
  const storage = room.storage;
  if (!storage) {
    return [];
  }

  const viableSites = storage.pos.surroundingPositions(5, (site: RoomPosition): boolean => {
    const terrain = site.look();
    for (const t of terrain) {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          return t.constructionSite?.structureType == STRUCTURE_ROAD;
        case LOOK_STRUCTURES:
          return t.structure?.structureType == STRUCTURE_ROAD;
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

  return viableSites;
}

function terminal_building_work(room: Room): BuildingWork[] {
  const viableSites = possible_terminal_sites(room);
  log.info(`${room}: ${viableSites.length} viable terminal sites`);
  if (viableSites.length == 0) {
    return [];
  }


  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    return -emptyPositions.length;
  });

  const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'dashed', stroke: 'purple' };

  let i = 0;
  for (const site of sortedSites) {
    style.opacity = 1.0 - i / sortedSites.length;
    room.visual.circle(site.x, site.y, style);
    ++i;
  }
  return [new BuildingWork(room, sortedSites[0], STRUCTURE_TERMINAL)];
}

function update_terminal(terminal: StructureTerminal): void {

}

export default class BusinessTrading implements Business.Model {

  static readonly TYPE: string = 'trade';

  private readonly _room: Room;
  private readonly _priority: number;
  private readonly _terminal: StructureTerminal | undefined;

  constructor(tradingRoom: Room, priority: number = 5) {
    this._room = tradingRoom;
    this._priority = priority;
    this._terminal = tradingRoom.terminal;

    if (this._terminal) {
      update_terminal(this._terminal);
    }
  }

  id(): string {
    return Business.id(BusinessTrading.TYPE, this._room.name);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  needsEmployee(employees: Worker[]): boolean {
    return false;
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return [];
  }

  permanentJobs(): Job.Model[] {
    // No permanent jobs for trading - everything is outsourced.
    return [];
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    if (!this._terminal) {
      return [];
    }

    const jobs: Job.Model[] = [];
    if (this._terminal.freeSpace() > 0) {
      jobs.push(new JobUnload(this._terminal, u.RESOURCE_MINERALS, 2));
    }

    if (this._room.storage
      && (this._room.storage.available(u.RESOURCE_MINERALS) > 0)
      && (this._terminal.available() / this._terminal.capacity() < 0.5)) {
      // Move any storage minerals into the terminal.
      jobs.push(new JobPickup(this._room.storage, u.RESOURCE_MINERALS, 2));
    }

    log.debug(`${this}: contractJobs: ${this._terminal.freeSpace()} t-fs, ${this._room.storage?.available(u.RESOURCE_MINERALS)}s-ma, ${this._terminal.available() / this._terminal.capacity()} t-f`)
    return jobs;
  }

  buildings(): BuildingWork[] {

    const work: BuildingWork[] = [];

    if (can_build_terminal(this._room)) {
      work.push(...terminal_building_work(this._room))
    }

    return work;
  }
}

Business.factory.addBuilder(BusinessTrading.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  if (!room) {
    return undefined;
  }
  return new BusinessTrading(room);
});



