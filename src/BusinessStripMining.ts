import * as Business from 'Business';
import * as Job from "Job";
import JobHarvest from 'JobHarvest';
import JobPickup from 'JobPickup';
import u from 'Utility';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';

type StripMine = Mineral | Deposit;

const MINER_EMPLOYEE_BODY: BodyPartConstant[] = [
  WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK,
  CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
  MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
];

function strip_mine_resource(mine: StripMine): ResourceConstant {
  return (mine instanceof Mineral) ? mine.mineralType : mine.depositType;
}

function pickup_priority(worker: Creep): number {
  return worker.available() / worker.capacity() * 9;
}

export default class BusinessStripMining implements Business.Model {

  static readonly TYPE: string = 'sm';

  private readonly _priority: number;
  readonly _mine: StripMine;

  constructor(mine: StripMine, priority: number = 5) {
    this._priority = priority;
    this._mine = mine;
  }

  id(): string {
    return Business.id(BusinessStripMining.TYPE, this._mine.id);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  canRequestEmployee(): boolean {
    return false;
  }

  needsEmployee(employees: Creep[]): boolean {
    log.debug(`${this}: ${this._mine} has ${this._mine.available()}`)
    return ((employees.length == 0)
      && (this._mine.available() >= 900));
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return MINER_EMPLOYEE_BODY;
  }

  permanentJobs(): Job.Model[] {
    const mine: StripMine = this._mine;
    const attackers = u.find_nearby_hostiles(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: [${attackers}] near mine - no permanent jobs!`);
      return [];
    }

    const jobs: Job.Model[] = [];

    log.debug(`${this}: ${mine} has ${mine.available()} resources of ${strip_mine_resource(mine)}`)
    if (mine.available() > 0) {
      jobs.push(new JobHarvest(mine, this._priority));
    }

    return jobs;
  }

  contractJobs(employees: Creep[]): Job.Model[] {
    const mine: StripMine = this._mine;
    const attackers = u.find_nearby_hostiles(mine);
    if (attackers.length > 0) {
      log.warning(`${this}: ${attackers} near mine - no contract jobs!`);
      return [];
    }

    let jobs: Job.Model[] = [];

    _.each(employees, (e) => jobs.push(new JobPickup(e, u.RESOURCE_ALL, pickup_priority(e))));

    return jobs;
  }

  buildings(): BuildingWork[] {
    return []
  }
}

Business.factory.addBuilder(BusinessStripMining.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const mine = <Mineral>Game.getObjectById(frags[2]);
  if (!mine) {
    return undefined;
  }
  return new BusinessStripMining(mine);
});


