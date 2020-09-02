import * as Job from 'Job';
import { Operation } from 'Operation';
import Work from 'Work';
import Boss from 'Boss';
import * as Business from 'Business';
import log from 'ScrupsLogger';
import { profile } from 'Profiler/Profiler';

function find_best_boss(creep: Creep, busyWorkers: Creep[], bosses: Boss[]): Boss | undefined {

  const viableBosses = _.filter(bosses, (boss) => boss.job.efficiency(creep) > 0.0);
  const workableJobs = _.filter(viableBosses, (boss) => {
    const workers: Creep[] = _.filter(busyWorkers, (w) => boss.job.id() === w.getJob()?.id());
    return !boss.job.isSatisfied(workers);
  });

  const orderedBosses = _.sortBy(workableJobs, (boss) => -boss.job.priority([creep]) * boss.job.efficiency(creep));

  if (orderedBosses.length === 0) {
    return undefined;
  }

  return orderedBosses[0];
}

@profile
export default class Executive implements Work {

  readonly business: Business.Model;
  private readonly _bosses: Boss[];
  private readonly _employees: Creep[];

  constructor(business: Business.Model) {
    this.business = business;
    this._employees = [];
    this._bosses = _.map(this.business.permanentJobs(), (j) => new Boss(j));
  }

  id(): string {
    return `ceo-${this.business.id()}`;
  }

  toString(): string {
    return this.id();
  }

  bosses(): Boss[] {
    return this._bosses;
  }

  employees(): Creep[] {
    return this._employees;
  }

  hasEmployee(): boolean {
    return this._employees.length !== 0;
  }

  needsEmployee(): boolean {
    return this.business.needsEmployee(this._employees);
  }

  canRequestEmployee(): boolean {
    return this.needsEmployee() && this.business.canRequestEmployee();
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return this.business.employeeBody(availEnergy, maxEnergy);
  }

  addEmployee(creep: Creep) {
    if (_.find(this._employees, (worker) => worker.id === creep.id)) {
      log.error(`${this}: tried to add the same worker (${creep}) twice!`);
      return;
    }

    this._employees.push(creep);
    creep.setBusiness(this.business);
  }

  priority(): number {
    return this.business.priority();
  }

  contracts(): Job.Model[] {
    return this.business.contractJobs(this._employees);
  }

  survey(): void {
    this.business.survey();
    if (this._bosses.length === 0) {
      return;
    }

    const [lazyWorkers, busyWorkers] = _.partition(this._employees, (worker) => !worker.getJob() && !worker.spawning);
    if (lazyWorkers.length === 0) {
      log.debug(`${this}: no lazy employees (${this._employees.length} active)`);
      return;
    }

    _.each(lazyWorkers, (worker) => {
      const bestBoss = find_best_boss(worker, busyWorkers, this._bosses);
      if (bestBoss) {
        worker.setJob(bestBoss.job);
      } else {
        log.warning(`${this}: no job for ${worker}! (${this._bosses.length} possible)`);
      }
    });
  }

  work(): Operation[] {
    // const executiveOperations = _.flatten(_.map(this._employees, (worker) => worker.getJob()?.work(worker) ?? []));
    // log.info(`${this}: work (${executiveOperations.length} operations)`)
    return [];// executiveOperations;
  }
}
