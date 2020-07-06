import * as Job from "Job";
import { Operation } from "Operation";
import Boss from "Boss";
import { Work } from "./Work";
import * as Business from "Business";
import u from "./Utility";
import { log } from './ScrupsLogger';


function map_valid_bosses(bossMem: BossMemory[]): Boss[] {
  return u.map_valid(bossMem, (boss): Boss | undefined => Boss.fromMemory(boss));
}

export default class Executive implements Work {

  readonly business: Business.Model;
  private _employees: Boss[];

  static fromMemory(memory: ExecutiveMemory): Executive | undefined {
    const business = Business.factory.build(memory.business);
    if (!business) {
      return undefined;
    }

    const employees = map_valid_bosses(memory.employees);
    const contractors = map_valid_bosses(memory.contractors);

    return new Executive(business, employees, contractors);
  }

  toMemory(): ExecutiveMemory {
    const memory = <ExecutiveMemory>{
      business: `${this.business.id()}-${this.priority()}`,
      employees: _.map(this._employees, (boss) => boss.toMemory()),
    };

    //log.debug(`${this}: to boss memory <${memory.job}, ${memory.bosses}, ${memory.subcontractors}>`);
    return memory;
  }

  constructor(business: Business.Model, employees?: Boss[], contractors?: Boss[]) {
    this.business = business;
    this._employees = employees ?? [];
  }

  id(): string {
    return `ceo-${this.business.id()}`;
  }

  toString(): string {
    return this.id();
  }

  hasBoss(): boolean {
    return this._employees.length != 0;
  }

  priority(): number {
    return this.business.priority();
  }

  contracts(): Job.Model[] {
    if (this._employees.length) {
      return this.business.contractJobs();
    }
    // When no employees, permanent jobs are also carried out by contractors.
    return this.business.permanentJobs().concat(this.business.contractJobs());
  }

  work(): Operation[] {
    this.business.survey();
    const executiveOperations = _.flatten(_.map(this._employees, (boss: Boss) => boss.work()));
    log.debug(`${this}: ${executiveOperations.length} operations`);
    return executiveOperations;
  }
}
