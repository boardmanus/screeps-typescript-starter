import * as Job from "Job";
import { Operation } from "Operation";
import Boss from "Boss";
import { Work } from "./Work";
import * as Business from "Business";
import u from "./Utility";
import { log } from './ScrupsLogger';

/* Old filter used when restoring creep references from memory
_.filter(creeps: Creep[], (worker: Creep) => {
  if (job.completion(worker) < 1.0) {
    log.debug(`${job.id()}: not complete ${worker.id}`);
    worker.setEmployed(true);
    return true;
  }

  log.debug(`${job.id()}: complete!`);
  worker.setLastJobSite(job.site());
  worker.setEmployed(false);
  return false;
});
*/

function map_valid_bosses(jobs: Job.Model[], bossMem: BossMemory[]): Boss[] {
  return u.map_valid(bossMem, (boss): Boss | undefined => Boss.fromMemory(boss));
}

export default class Executive implements Work {

  readonly business: Business.Model;
  private _employees: Boss[];
  private _contractors: Boss[];

  static fromMemory(memory: ExecutiveMemory): Executive | undefined {
    const business = Business.factory.build(memory.business);
    if (!business) {
      return undefined;
    }

    const employees = map_valid_bosses(business.permanentJobs(), memory.employees);
    const contractors = map_valid_bosses(business.contractJobs(), memory.contractors);

    return new Executive(business, employees, contractors);
  }

  toMemory(): ExecutiveMemory {
    const memory = <ExecutiveMemory>{
      business: this.business.id(),
      employees: _.map(this._employees, (boss) => boss.toMemory()),
      contractors: _.map(this._contractors, (boss) => boss.toMemory())
    };

    //log.debug(`${this}: to boss memory <${memory.job}, ${memory.bosses}, ${memory.subcontractors}>`);
    return memory;
  }

  constructor(business: Business.Model, employees?: Boss[], contractors?: Boss[]) {
    this.business = business;
    this._employees = employees ?? [];
    this._contractors = contractors ?? [];
  }

  id(): string {
    return `ceo-${this.business.id()}`;
  }

  toString(): string {
    return this.id();
  }

  hasBoss(): boolean {
    return this._employees.length + this._contractors.length > 0;
  }

  priority(): number {
    return this.business.priority();
  }

  work(): Operation[] {
    const executiveOperations = _.flatten(_.map(
      this._employees.concat(this._contractors),
      (boss: Boss) => boss.work()));
    log.debug(`${this}: ${executiveOperations.length} operations`);
    return executiveOperations;
  }
}
