import * as Job from 'Job';
import Factory from 'Factory';

export interface Model {
  id(): string;
  site(): RoomObject;
  priority(): number;
  permanentJobs(): Job.Model[];
  contractJobs(): Job.Model[];
}

export const factory = new Factory<Model>();

export function id(type: string, targetId: string, priority: number): string {
  return `bus-${type}-${targetId}-${priority}`;
}
