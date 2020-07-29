import * as Job from "Job";
import { Operation } from "Operation";
import Worker from "Worker";
import { Work } from "./Work";
import * as Business from "Business";
import u from "./Utility";
import { log } from './ScrupsLogger';


function map_valid_workers(workerMem: WorkerMemory[]): Worker[] {
  return u.map_valid(workerMem, (worker) => Worker.fromMemory(worker));
}

function map_valid_resumes(resumes: string[]): Worker[] {
  return _.map(u.map_valid(resumes, (resume) => Game.creeps[resume]), (creep) => new Worker(creep));
}


function find_best_job(creep: Creep, busyWorkers: Worker[], jobs: Job.Model[]) {

  const viableJobs = _.filter(jobs, (job) => job.efficiency(creep) > 0);

  const workableJobs = _.filter(viableJobs, (job) => {
    const workers: Creep[] = _.map(_.filter(busyWorkers, (w) => job.id() == w.job()?.id()), (w) => w.creep);
    return !job.isSatisfied(workers);
  });

  const orderedJobs = _.sortBy(workableJobs, (job) => -job.priority([creep]) * job.efficiency(creep));

  if (orderedJobs.length == 0) {
    return undefined;
  }

  return orderedJobs[0];
}


export default class Executive implements Work {

  readonly business: Business.Model;
  private _employees: Worker[];
  private _resumes: string[];

  static fromMemory(memory: ExecutiveMemory, businessMap: Business.Map): Executive | undefined {
    const business = businessMap[memory.business] ?? Business.factory.build(memory.business);
    if (!business) {
      return undefined;
    }

    const employees = map_valid_workers(memory.employees);
    const resumes = memory.resumes;

    return new Executive(business, employees, resumes);
  }

  toMemory(): ExecutiveMemory {
    const memory = <ExecutiveMemory>{
      business: this.business.id(),
      employees: _.map(this._employees, (worker) => worker.toMemory()),
      resumes: this._resumes
    };
    return memory;
  }

  constructor(business: Business.Model, employees?: Worker[], resumes?: string[]) {
    this.business = business;
    this._employees = employees ?? [];
    this._resumes = [];

    if (resumes && resumes.length > 0) {
      //log.debug(`${this}: resumes=${resumes}`)
      this._employees.push(...map_valid_resumes(resumes));
    }
  }

  id(): string {
    return `ceo-${this.business.id()}`;
  }

  toString(): string {
    return this.id();
  }

  employees(): Worker[] {
    return this._employees;
  }

  hasEmployee(): boolean {
    return this._employees.length != 0;
  }

  needsEmployee(): boolean {
    return this.business.needsEmployee(this._employees);
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return this.business.employeeBody(availEnergy, maxEnergy);
  }

  addEmployee(creep: Creep) {
    if (!_.find(this._employees, (worker) => worker.creep.id == creep.id)) {
      this._employees.push(new Worker(creep));
    }
  }

  addEmployeeResume(creepName: string) {
    this._resumes.push(creepName);
  }

  priority(): number {
    return this.business.priority();
  }

  contracts(): Job.Model[] {
    return this.business.contractJobs(this._employees);
  }

  survey(): void {
    this.business.survey();

    const jobs = this.business.permanentJobs();
    if (jobs.length == 0) {
      return;
    }

    const [lazyWorkers, busyWorkers] = _.partition(this._employees, (worker) => !worker.hasJob() && !worker.creep.spawning);
    if (lazyWorkers.length == 0) {
      log.debug(`${this}: no lazy employees (${this._employees.length} active)`);
      return;
    }

    for (const worker of lazyWorkers) {
      const bestJob = find_best_job(worker.creep, busyWorkers, jobs);
      if (bestJob) {
        log.info(`${this}: assigning ${bestJob} to ${worker}`);
        worker.assignJob(bestJob);
      }
      else {
        log.warning(`${this}: no job for ${worker.creep}! (${jobs.length} possible)`)
      }
    }
  }

  work(): Operation[] {
    const executiveOperations = _.flatten(_.map(this._employees, (worker) => worker.work()));
    return executiveOperations;
  }
}
