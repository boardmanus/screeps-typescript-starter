import Room$ from "RoomCache";
import Executive from "Executive";
import u from "Utility";


function upgrade_expense_rate(upgrader: Creep): number {
  return upgrader.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER;
}

function spawn_cost(creep: Creep): number {
  return _.sum(creep.body, (b) => BODYPART_COST[b.type]);
}

function employee_spawn_cost(employees: Creep[]): number {
  return _.sum(employees, (e) => spawn_cost(e));
}

function spawn_expense_rate(ceos: Executive[]): number {
  return _.sum(ceos, (ceo) => employee_spawn_cost(ceo.employees())) / CREEP_LIFE_TIME;
}

// hits/s
function road_decay_rate(roads: StructureRoad[]): number {
  return roads.length * ROAD_DECAY_AMOUNT / ROAD_DECAY_TIME;
}

function rampart_decay_rate(ramparts: StructureRampart[]): number {
  return ramparts.length * RAMPART_DECAY_AMOUNT / RAMPART_DECAY_TIME;
}

// energy/s
function road_repair_expense_rate(roads: StructureRoad[]): number {
  return road_decay_rate(roads) * TOWER_ENERGY_COST / u.tower_repair_power(20);
}

function rampart_repair_expense_rate(ramparts: StructureRampart[]): number {
  return rampart_decay_rate(ramparts) * TOWER_ENERGY_COST / u.tower_repair_power(20);
}

function tower_repair_expense_rate(room: Room) {
  return road_repair_expense_rate(Room$(room).roads) + rampart_repair_expense_rate(Room$(room).ramparts);
}

function construction_build_energy(construction: ConstructionSite[]): number {
  return _.sum(construction, (c) => c.progressTotal - c.progress);
}


export enum Expense {
  EXPENSE_UPGRADE,
  EXPENSE_SPAWN,
  EXPENSE_TOWER_REPAIR,
  EXPENSE_CONSTRUCTION
};


export default class Economist {

  readonly room: Room;
  readonly incomeRate: number;
  //readonly expenseRate: number;
  constructor(room: Room) {
    this.room = room;
    this.incomeRate = _.sum(Room$(room).sources, (s) => s.energyCapacity) / ENERGY_REGEN_TIME;

    //this.expenseRate = spawn_expense_rate(Room$(room).executives);
  }

}
