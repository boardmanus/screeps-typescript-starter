import { Operation } from 'Operation';
import * as Job from 'Job';
import * as u from 'Utility';
import log from 'ScrupsLogger';
import Room$ from 'RoomCache';

function find_best_targets(attacker: Creep): Creep[] {
  const hostiles = u.find_nearby_hostiles(attacker, 15);
  return _.sortBy(hostiles, (h) => {
    const range = attacker.pos.getRangeTo(h);
    return range * range - u.creep_invigoration(attacker);
  });
}

function attack_at_site(job: JobAttack, worker: Creep): Operation {
  return () => {
    const targets = find_best_targets(worker);
    if (targets.length === 0) {
      Job.visualize(job, worker);
      Job.moveTo(job, worker, 0);
      if (worker.hits < worker.hitsMax) {
        worker.heal(worker);
      }
      return;
    }

    let target = _.first(targets);
    Job.visualize(job, worker, target);
    Job.moveTo(job, worker, 0, target);

    // look for hostiles in zap range (sort by invigoration)
    const zappees = _.sortBy(_.filter(targets,
      (t) => t.pos.getRangeTo(worker) <= 3),
      (t) => -u.creep_invigoration(t));
    if (zappees.length > 0) {
      target = _.first(zappees);
      const res = worker.rangedAttack(_.first(zappees));
      switch (res) {
        case OK:
          log.info(`${job}: ${worker} fired laser at ${target}`);
          break;
        case ERR_NO_BODYPART:
          break;
        default:
          log.error(`${job}: ${worker} failed to fire lazer at ${target} (${u.errstr(res)})`);
          break;
      }

      // look for hostiles in attack range (sort by hits, then invigoration)
      const stabbees = _.sortBy(_.filter(zappees,
        (t) => t.pos.getRangeTo(worker) === 1),
        (t) => t.hits * 100 - u.creep_invigoration(t));
      if (stabbees.length > 0) {
        target = _.first(stabbees);
        const attackRes = worker.attack(_.first(stabbees));
        switch (attackRes) {
          case OK:
            log.info(`${job}: ${worker} stabbed ${target}`);
            break;
          case ERR_NO_BODYPART:
            break;
          default:
            log.error(`${job}: ${worker} failed to stab ${target} (${u.errstr(res)})`);
            break;
        }
      } else {
        const healRes = worker.heal(worker);
        switch (healRes) {
          case OK:
            log.info(`${job}: ${worker} healed`);
            break;
          case ERR_NO_BODYPART:
            break;
          default:
            log.error(`${job}: ${worker} failed to heal (${u.errstr(res)})`);
            break;
        }
      }
    }
  };
}

export default class JobAttack implements Job.Model {

  static readonly TYPE = 'attacker';

  readonly _site: Creep | Flag;
  readonly _priority: number;

  constructor(site: Creep | Flag, priority = 7) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobAttack.TYPE}-${this._site.name}`;
  }

  type(): string {
    return JobAttack.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🗡️';
  }

  styleColour(): string {
    return 'red';
  }

  priority(_workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(_worker: Creep): number {
    // Scouts should hold nothing
    return 1.0;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    // The job is satisfied if it has a worker
    return workers.length > 0;
  }

  completion(worker?: Creep): number {

    if (worker && this._site instanceof Flag) {
      if (!this._site.room) {
        return 0.0;
      }

      if (Room$(this._site.room).hostiles.length === 0) {
        return worker.pos.inRangeTo(this._site, 0) ? 1.0 : 0.0;
      }
    }

    return (this._site ? 0.0 : 1.0);
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, MOVE, ATTACK, ATTACK];
  }

  work(worker: Creep): Operation[] {

    return [attack_at_site(this, worker)];
  }
}
