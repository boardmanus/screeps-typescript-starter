import { Operation } from "Operation";
import { log } from "lib/logger/log";
import u from "Utility";
import JobPickup from "JobPickup";


export enum Prerequisite {
  NONE,
  COLLECT_ENERGY,
  DELIVER_ENERGY
}


export interface Model {
  id(): string;
  type(): string;
  site(): RoomObject;
  say(): string;
  styleColour(): string;
  priority(workers: Creep[]): number;
  isSatisfied(workers: Creep[]): boolean;
  efficiency(worker: Creep): number;
  completion(worker?: Creep): number;
  work(worker: Creep): Operation[];
  satisfiesPrerequisite(prerequisite: Prerequisite): boolean;
  baseWorkerBody(): BodyPartConstant[];
}

export type Map = { [id: string]: Model };

export function visualize(job: Model, worker: Creep, subSite?: RoomObject) {
  worker.say(job.say());
  const site = subSite ?? job.site();
  const siteStyle = <CircleStyle>{ opacity: 0.6, fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: job.styleColour() }
  job.site().room?.visual.circle(site.pos.x, site.pos.y, siteStyle);
}

function jobMoveTo(job: Model, worker: Creep, pos: RoomPosition | RoomObject, range: number, style: LineStyle): number {

  if (worker.fatigue) {
    return ERR_TIRED;
  }

  if (worker.spawning) {
    return ERR_BUSY;
  }

  const lastPos = worker.memory.lastPosition ?? worker.pos;
  const stuck = worker.pos.inRangeTo(lastPos, 0) ? 1 : 0;
  const stuckCount = stuck ? (worker.memory.stuckCount ?? 0) + stuck : 0;
  const stalledCount = Math.max((worker.memory.stalledCount ?? 0) + (stuck ? 1 : - 0.2), 0);

  worker.memory.lastPosition = worker.pos;
  worker.memory.stuckCount = stuckCount;
  worker.memory.stalledCount = stalledCount;

  if (stuckCount < 2) {
    if (stalledCount) {
      log.debug(`${job}: ${worker} stuck-${stuckCount}/stalled-${stalledCount} @ ${pos}`);
    }

    const stalled = (stalledCount > 3);
    const ignoreCreeps = (stalledCount == 0);
    const reusePath = stalled ? 0 : 50;
    style.lineStyle = ignoreCreeps ? "dashed" : "solid";

    if (stalled) {
      worker.memory.stalledCount = 0;
      log.warning(`${job}: ${worker} stalled @ ${pos}`);
    }

    return worker.moveTo(pos, { ignoreCreeps: ignoreCreeps, range: range, reusePath: reusePath, visualizePathStyle: style });
  }

  // Re-evaluate the path, ensuring creeps aren't ignored worker time.
  log.warning(`${job}: ${worker} stuck-${stuckCount} @ ${pos}`);
  const reusePath = (stuckCount > 5) ? 0 : 5 - stuckCount;
  const res = worker.moveTo(pos, { ignoreCreeps: false, range: range, reusePath: reusePath, visualizePathStyle: style });

  return res;
}

export function moveTo(job: Model, worker: Creep, range: number, subSite?: RoomObject): number {
  const pathStyle = <LineStyle>{ opacity: .6, stroke: job.styleColour() };
  const site = subSite ?? job.site();
  const err = jobMoveTo(job, worker, site, range, pathStyle)
  if (err == OK) {
    log.info(`${job}: ${worker} moved towards ${job.site()} (${worker.memory._move.path.length} sq)`);
  }
  else {
    log.warning(`${job}: ${worker} failed moving to ${job.site()} (${worker.memory._move.path.length} sq) (${u.errstr(err)})`);
  }
  return err;
}

class Factory {

  private _builders: { [builderId: string]: (id: string) => Model | undefined };

  constructor() {
    this._builders = {};
  }

  build(id: string): Model | undefined {
    const builder = this._builders[this.builderId(id)];
    return builder(id);
  }

  addBuilder(builderId: string, builder: (id: string) => Model | undefined) {
    this._builders[builderId] = builder;
    log.info(`Added factory method for ${builderId}`)
  }

  builderId(id: string): string {
    const frags = id.split('-');
    if (frags.length < 2) {
      return '';
    }

    return frags[1];
  }
}


export const factory = new Factory();
