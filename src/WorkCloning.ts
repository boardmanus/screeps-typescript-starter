import { Operation } from 'Operation';
import Work from 'Work';
import * as Monarchy from 'Monarchy';
import log from 'ScrupsLogger';
import * as u from 'Utility';

function clone_a_worker(work: WorkCloning): Operation {
  return () => {
    const { room } = work.site;
    const res = work.site.spawnCreep(work.body, work.name);
    switch (res) {
      case ERR_NOT_OWNER:
      case ERR_NOT_ENOUGH_ENERGY:
      case ERR_INVALID_ARGS:
      case ERR_RCL_NOT_ENOUGH:
      case ERR_BUSY:
      default:
        // eslint-disable-next-line max-len
        log.warning(`${work}: failed to spawn creep ${work.name}:${work.body} (c=${u.body_cost(work.body)}, re=${room.energyAvailable}) (${u.errstr(res)})`);
        break;
      case OK:
        log.info(`${work}: started to clone ${work.name}:${work.body}`);
        if (work.req) {
          log.info(`${work}: got ${work.name} resume for employee of ${work.req.ceo}`);
          const memory: CreepMemory = Memory.creeps[work.name] ?? {};
          memory.home = work.req.home.name;
          memory.business = work.req.ceo.business.id();
          Memory.creeps[work.name] = memory;
        }
        break;
    }
  };
}

export default class WorkCloning implements Work {

  readonly site: StructureSpawn;
  readonly name: string;
  readonly body: BodyPartConstant[];
  readonly req: Monarchy.CloneRequest | undefined;

  constructor(site: StructureSpawn, name: string, body: BodyPartConstant[], req?: Monarchy.CloneRequest) {
    this.site = site;
    this.name = name;
    this.body = body;
    this.req = req;
  }

  id() {
    return `work-clone-${this.site.id}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [clone_a_worker(this)];
  }
}
