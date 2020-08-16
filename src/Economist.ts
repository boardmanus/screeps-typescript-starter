import Room$ from "RoomCache";
import Executive from "Executive";
import Worker from "Worker";
import u from "Utility";


function upgrade_expense_rate(upgrader: Creep): number {
  return upgrader.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER;
}

function spawn_cost(creep: Creep): number {
  return _.sum(creep.body, (b) => BODYPART_COST[b.type]);
}

function employee_spawn_cost(employees: Worker[]): number {
  return _.sum(employees, (e) => spawn_cost(e.creep));
}

function spawn_expense_rate(ceos: Executive[]): number {
  return _.sum(ceos, (ceo) => employee_spawn_cost(ceo.employees())) / CREEP_LIFE_TIME;
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
