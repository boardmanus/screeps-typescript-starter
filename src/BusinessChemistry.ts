import * as Business from 'Business';
import * as Job from "Job";
import Worker from 'Worker';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';

interface Frag {
  start: number, end: number
};

function possible_lab_sites(terminal: StructureTerminal): RoomPosition[] {
  const terrain = new Room.Terrain(terminal.room.name);
  for (let x = 0; x < 50; ++x) {
    let y1 = 0;
    while (y1 < 50 && terrain.get(x, y1) == 2) {
      ++y1;
    }
    let y2 = y1 + 1;
    while (y2 < 50 && terrain.get(x, y2) == 2) {
      ++y2;
    }
    const dy = y2 - y1;
    if (dy >= 4) {

    }
  }

  const viableSites = terminal.pos.surroundingPositions(5, (site: RoomPosition) => {

    const terrain = site.look();
    return _.reduce(terrain, (a: boolean, t: LookAtResult): boolean => {
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

  return viableSites;
}


function lab_building_work(terminal: StructureTerminal): BuildingWork[] {
  const viableSites = possible_lab_sites(terminal);
  log.info(`${terminal}: ${viableSites.length} viable lab sites`);
  if (viableSites.length == 0) {
    return [];
  }

  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    return -emptyPositions.length;
  });

  return [new BuildingWork(terminal.room, sortedSites[0], STRUCTURE_LAB)];
}

function update_labs(labs: StructureLab[]): void {

}

export default class BusinessChemistry implements Business.Model {

  static readonly TYPE: string = 'chem';

  private readonly _room: Room;
  private readonly _priority: number;
  private readonly _labs: StructureLab[];

  constructor(chemistryRoom: Room, priority: number = 5) {
    this._room = chemistryRoom;
    this._priority = priority;
    this._labs = chemistryRoom.find<StructureLab>(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_LAB });;

    if (this._labs.length) {
      update_labs(this._labs);
    }
  }

  id(): string {
    return Business.id(BusinessChemistry.TYPE, this._room.name);
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
    // No permanent jobs for chemistry - everything is outsourced.
    return [];
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    if (this._labs.length == 0) {
      return [];
    }

    return [];
  }

  buildings(): BuildingWork[] {

    const work: BuildingWork[] = [];

    if (this._room.terminal) {
      work.push(...lab_building_work(this._room.terminal))
    }

    return work;
  }
}

Business.factory.addBuilder(BusinessChemistry.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  if (!room) {
    return undefined;
  }
  return new BusinessChemistry(room);
});



