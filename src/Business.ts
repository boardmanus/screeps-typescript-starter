import * as Job from 'Job';
import Factory from 'Factory';

export interface Model {
  id(): string;
  site(): RoomObject;
  priority(): number;
  survey(): void;
  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[];
  permanentJobs(): Job.Model[];
  contractJobs(): Job.Model[];
}

export const factory = new Factory<Model>();

export function id(type: string, targetId: string): string {
  return `bus-${type}-${targetId}`;
}

export function buildId(type: string, targetId: string, priority: number): string {
  return `bus-${type}-${targetId}-${priority}`;
}
