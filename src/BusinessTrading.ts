import * as Business from 'Business';
import * as Job from 'Job';
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import WorkBuilding from 'WorkBuilding';
import * as u from 'Utility';
import log from 'ScrupsLogger';

function can_build_terminal(room: Room): boolean {
  const rcl = room.controller?.level ?? 0;
  const numTerminals = u.find_num_building_sites(room, STRUCTURE_TERMINAL);
  const allowedNumTerminals = CONTROLLER_STRUCTURES.terminal[rcl];
  log.debug(`${room}: can_build_terminal: ${allowedNumTerminals} allowed, ${numTerminals} present`);
  return (allowedNumTerminals - numTerminals) > 0;
}

function possible_terminal_sites(room: Room): RoomPosition[] {
  const { storage } = room;
  if (!storage) {
    return [];
  }

  const viableSites = storage.pos.surroundingPositions(5, (site: RoomPosition): boolean => {
    const terrain = site.look();
    return _.all(terrain, (t) => {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          return t.constructionSite?.structureType === STRUCTURE_ROAD;
        case LOOK_STRUCTURES:
          return t.structure?.structureType === STRUCTURE_ROAD;
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

  return viableSites;
}

function terminal_building_work(room: Room): WorkBuilding[] {
  const viableSites = possible_terminal_sites(room);
  log.info(`${room}: ${viableSites.length} viable terminal sites`);
  if (viableSites.length === 0) {
    return [];
  }

  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    return -emptyPositions.length;
  });

  const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'dashed', stroke: 'purple' };

  let i = 0;
  _.each(sortedSites, (site) => {
    style.opacity = 1.0 - i++ / sortedSites.length;
    room.visual.circle(site.x, site.y, style);
  });
  return [new WorkBuilding(sortedSites[0], STRUCTURE_TERMINAL)];
}

function update_terminal(_terminal: StructureTerminal): void {

}

export default class BusinessTrading implements Business.Model {

  static readonly TYPE: string = 'trade';

  private readonly room: Room;
  private readonly terminal: StructureTerminal | undefined;
  private readonly tradingPriority: number;

  constructor(tradingRoom: Room, priority = 5) {
    this.room = tradingRoom;
    this.tradingPriority = priority;
    this.terminal = tradingRoom.terminal;

    if (this.terminal) {
      update_terminal(this.terminal);
    }
  }

  id(): string {
    return Business.id(BusinessTrading.TYPE, this.room.name);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this.tradingPriority;
  }

  canRequestEmployee(): boolean {
    return false;
  }

  needsEmployee(_employees: Creep[]): boolean {
    return false;
  }

  survey() {
  }

  employeeBody(_availEnergy: number, _maxEnergy: number): BodyPartConstant[] {
    return [];
  }

  permanentJobs(): Job.Model[] {
    // No permanent jobs for trading - everything is outsourced.
    return [];
  }

  contractJobs(_employees: Creep[]): Job.Model[] {
    if (!this.terminal) {
      return [];
    }

    const jobs: Job.Model[] = [];
    if (this.terminal.freeSpace() > 0) {
      const resource = (this.terminal.available(RESOURCE_ENERGY) < 10000) ? u.RESOURCE_ALL : u.RESOURCE_MINERALS;
      jobs.push(new JobUnload(this.terminal, resource, 2));
    }

    if (this.room.storage
      && (this.room.storage.available(u.RESOURCE_MINERALS) > 0)
      && (this.terminal.available() / this.terminal.capacity() < 0.5)) {
      // Move any storage minerals into the terminal.
      jobs.push(new JobPickup(this.room.storage, u.RESOURCE_MINERALS, 2));
    }

    return jobs;
  }

  buildings(): WorkBuilding[] {

    const work: WorkBuilding[] = [];

    if (can_build_terminal(this.room)) {
      work.push(...terminal_building_work(this.room));
    }

    return work;
  }
}
