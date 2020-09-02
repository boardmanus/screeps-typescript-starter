import * as Job from 'Job';
import WorkBuilding from 'WorkBuilding';

export interface Model {
  id(): string;
  priority(): number;
  survey(): void;
  needsEmployee(employees: Creep[]): boolean;
  canRequestEmployee(): boolean;
  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[];
  permanentJobs(): Job.Model[];
  contractJobs(employees: Creep[]): Job.Model[];
  buildings(): WorkBuilding[];
}

export type Map = { [id: string]: Model };

export function id(type: string, targetId: string): string {
  return `bus-${type}-${targetId}`;
}

export function buildId(type: string, targetId: string, priority: number): string {
  return `bus-${type}-${targetId}-${priority}`;
}
