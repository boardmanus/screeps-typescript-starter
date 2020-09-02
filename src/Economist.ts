import Room$ from 'RoomCache';
import Executive from 'Executive';
import * as u from 'Utility';

/*
function upgrade_expense_rate(upgrader: Creep): number {
  return upgrader.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER;
}
*/

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
const ROAD_DECAY_RATE = ROAD_DECAY_AMOUNT / ROAD_DECAY_TIME;
const RAMPART_DECAY_RATE = RAMPART_DECAY_AMOUNT / RAMPART_DECAY_TIME;
const CONTAINER_DECAY_RATE = CONTAINER_DECAY / CONTAINER_DECAY_TIME;

// energy/s
function tower_repair_expense_rate(room: Room) {
  const avgEnergyPerHit = TOWER_ENERGY_COST / u.tower_repair_power(20);
  const roadDecayRate = Room$(room).roads.length * ROAD_DECAY_RATE;
  const rampartDecayRate = Room$(room).ramparts.length * RAMPART_DECAY_RATE;
  const containerDecayRate = Room$(room).containers.length * CONTAINER_DECAY_RATE;
  return (roadDecayRate + rampartDecayRate + containerDecayRate) * avgEnergyPerHit;
}

/*
function construction_build_hits(construction: ConstructionSite[]): number {
  return _.sum(construction, (c) => c.progressTotal - c.progress);
}
*/

// energy/s
function harvest_income_rate(room: Room): number {
  return _.sum(Room$(room).sources, (s) => s.energyCapacity) / ENERGY_REGEN_TIME;
}

export default class Economist {

  readonly room: Room;
  readonly incomeRate: number;
  readonly expenseRate: number;
  readonly decayExpenseRate: number;
  readonly spawnExpenseRate: number;

  // readonly expenseRate: number;
  constructor(room: Room, ceos: Executive[]) {
    this.room = room;
    this.incomeRate = harvest_income_rate(room);
    this.decayExpenseRate = tower_repair_expense_rate(room);
    this.spawnExpenseRate = spawn_expense_rate(ceos);
    this.expenseRate = this.decayExpenseRate + this.spawnExpenseRate;
  }
}
