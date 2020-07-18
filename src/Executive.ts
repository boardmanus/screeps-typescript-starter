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


function find_best_job(creep: Creep, jobs: Job.Model[]) {

  const needsEnergy = (creep.available() < creep.capacity() / 2.0);
  let jobPrerequisite: Job.Prerequisite;
  if (creep.available() == 0) {
    jobPrerequisite = Job.Prerequisite.COLLECT_ENERGY;
  }
  else if (creep.freeSpace() == 0) {
    jobPrerequisite = Job.Prerequisite.DELIVER_ENERGY;
  }
  else {
    jobPrerequisite = Job.Prerequisite.NONE;
  }

  const viableJobs = (jobPrerequisite == Job.Prerequisite.NONE)
    ? jobs
    : _.filter(jobs, (job) => job.satisfiesPrerequisite(jobPrerequisite));

  const orderedJobs = _.sortBy(viableJobs, (job) => -job.priority([creep]) * job.efficiency(creep));
  _.each(orderedJobs, (j) => log.error(`${creep}: ${j.priority([creep])}*${j.efficiency(creep)} e/s for ${j}`))

  if (orderedJobs.length == 0) {
    return undefined;
  }

  return orderedJobs[0];
}


export default class Executive implements Work {

  readonly business: Business.Model;
  private _employees: Worker[];
  private _resumes: string[];

  static fromMemory(memory: ExecutiveMemory): Executive | undefined {
    const business = Business.factory.build(memory.business);
    if (!business) {
      return undefined;
    }

    const employees = map_valid_workers(memory.employees);
    const resumes = memory.resumes;

    return new Executive(business, employees, resumes);
  }

  toMemory(): ExecutiveMemory {
    const memory = <ExecutiveMemory>{
      business: `${this.business.id()}-${this.priority()}`,
      employees: _.map(this._employees, (worker) => worker.toMemory()),
      resumes: this._resumes
    };
    return memory;
  }

  constructor(business: Business.Model, employees?: Worker[], resumes?: string[]) {
    this.business = business;
    this._employees = employees ?? [];
    this._resumes = [];

    if (resumes) {
      this._employees.push(...map_valid_resumes(resumes));
    }
  }

  id(): string {
    return `ceo-${this.business.id()}`;
  }

  toString(): string {
    return this.id();
  }

  hasEmployee(): boolean {
    return this._employees.length != 0;
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
    if (this._employees.length) {
      return this.business.contractJobs();
    }
    // When no employees, permanent jobs are also carried out by contractors.
    return this.business.permanentJobs().concat(this.business.contractJobs());
  }

  survey(): void {
    this.business.survey();

    const jobs = this.business.permanentJobs();

    const lazyWorkers = _.filter(this._employees, (worker) => !worker.hasJob());
    if (lazyWorkers.length == 0) {
      log.debug(`${this}: no lazy employees (${this._employees.length} active)`);
      return;
    }

    for (const worker of lazyWorkers) {
      const bestJob = find_best_job(worker.creep, jobs);
      if (bestJob) {
        log.info(`${this}: assigning ${bestJob} to ${worker}`);
        worker.assignJob(bestJob);
      }
    }
  }

  work(): Operation[] {
    const executiveOperations = _.flatten(_.map(this._employees, (worker) => worker.work()));
    log.debug(`${this}: ${executiveOperations.length} operations`);
    return executiveOperations;
  }
}
