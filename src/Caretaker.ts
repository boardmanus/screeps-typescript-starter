import { Expert } from "./Expert";
import { Work } from "./Work";
import * as Job from "Job";
import JobBuild from "./JobBuild";
import JobRepair from "./JobRepair";
import { Operation } from "./Operation";
import { FunctionCache } from "./Cache";
import u from "./Utility";
import { log } from './ScrupsLogger'


function repair_power(tower: StructureTower, site: Structure): number {
  const d = tower.pos.getRangeTo(site);
  if (d <= 5) {
    return TOWER_POWER_REPAIR;
  }
  else if (d >= 20) {
    return 150;
  }

  return 150 + (TOWER_POWER_REPAIR - 150) * (20 - d) / (20 - 5)
}

function damage_ratio(site: Structure): number {
  return (1.0 - site.hits / site.hitsMax);
}

function wall_rampart_damage_ratio(wr: Structure): number {
  const c = wr.room.controller;
  if (!c) {
    return 0;
  }
  const halfway = c.progress / c.progressTotal > 0.5;
  const rcl = c.level - (halfway ? 0 : 1);
  return 1.0 - wr.hits / RAMPART_HITS_MAX[rcl];
}

function road_repair_priority(road: StructureRoad): number {
  const decayAmount = ROAD_DECAY_AMOUNT * 5;
  if ((road.ticksToDecay < ROAD_DECAY_TIME) && (road.hits < decayAmount)) {
    return 8;
  }
  return 2 * damage_ratio(road);
}

function rampart_repair_priority(rampart: StructureRampart): number {
  if ((rampart.ticksToDecay < RAMPART_DECAY_TIME / 3)
    && (rampart.hits < 2 * RAMPART_DECAY_AMOUNT)) {
    return 9;
  }
  const damageRatio = wall_rampart_damage_ratio(rampart);
  return 1 * Math.pow(damageRatio, 10)
}

function wall_repair_priority(wall: StructureWall): number {
  return 1 * Math.pow(wall_rampart_damage_ratio(wall), 10);
}

function repair_priority(site: Structure): number {
  switch (site.structureType) {
    case STRUCTURE_ROAD: return road_repair_priority(<StructureRoad>site);
    case STRUCTURE_RAMPART: return rampart_repair_priority(<StructureRampart>site);
    case STRUCTURE_WALL: return wall_repair_priority(<StructureWall>site);
    default: return 8 * damage_ratio(site);
  }
}


function tower_repair_filter(tower: StructureTower[], site: Structure): boolean {
  if ((site instanceof OwnedStructure) && !(site as OwnedStructure).my) {
    return false;
  }

  switch (site.structureType) {
    case STRUCTURE_WALL:
    case STRUCTURE_RAMPART:
      return wall_rampart_damage_ratio(site) > 0.92;
    default:
      break;
  }

  const power: number = _.max(_.map(tower, (t: StructureTower): number => { return repair_power(t, site); }));
  return site.hitsMax - site.hits > power;
}

class TowerRepairWork implements Work {

  readonly tower: StructureTower;
  readonly site: Structure;

  constructor(tower: StructureTower, site: Structure) {
    this.tower = tower;
    this.site = site;
  }

  id() {
    return `work-repair-tower-${this.tower.pos.x}-${this.tower.pos.y}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [() => {
      const res = this.tower.repair(this.site);
      switch (res) {
        case OK:
          log.info(`${this}: ${this.tower} repaired ${this.site}`);
          break;
        default:
          log.error(`${this}: ${this.tower} failed to repair ${this.site} (${u.errstr(res)})`);
          break;
      }
    }];
  }
}


class TowerDefenseWork implements Work {

  readonly tower: StructureTower;
  readonly target: Creep;

  constructor(tower: StructureTower, target: Creep) {
    this.tower = tower;
    this.target = target;
  }

  id() {
    return `work-defense-${this.tower}-${this.target}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [() => {
      const res = this.tower.attack(this.target);
      switch (res) {
        case OK:
          log.debug(`INFO: ${this}: ${this.tower} attacked ${this.target}`);
          break;
        default:
          log.debug(`ERROR: ${this}: ${this.tower} failed to attack ${this.target} (${u.errstr(res)})`);
          break;
      }
    }];
  }
}


export class Caretaker implements Expert {

  private _room: Room;
  private _towers: StructureTower[];

  constructor(room: Room) {
    this._room = room;

    this._towers = room.find<StructureTower>(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => {
        if (s.structureType != STRUCTURE_TOWER) {
          return false;
        }
        return s.available() > 0;
      }
    });
  }

  id(): string {
    return `caretaker-${this._room.name}`
  }

  toString(): string {
    return this.id();
  }

  survey(): void {
    log.debug(`${this} surveying...`);
  }

  repair(): Work[] {

    if (this._towers.length == 0) {
      return [];
    }

    // Don't perform tower repair if hostile creeps are around.
    const room = this._room;
    let work: Work[] = [];
    const foes = room.find(FIND_HOSTILE_CREEPS);
    if (foes.length > 0) {
      for (let i = 0; i < this._towers.length; ++i) {
        const t = this._towers[i];
        if (t.available() < TOWER_ENERGY_COST) continue;
        const f = t.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        log.info(`${this}: creating new tower defense work ${t} => ${f} ...`);
        if (f) {
          work.push(new TowerDefenseWork(t, f));
        }
      }

      return work;
    }

    const repairSites = room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => {
        return tower_repair_filter(this._towers, s);
      }
    });

    if (repairSites.length == 0) {
      return [];
    }

    for (let i = 0; i < this._towers.length; ++i) {
      const t = this._towers[i];
      if (t.available() < TOWER_CAPACITY / 3) continue;

      const sortedSites = _.sortBy(repairSites, (s: Structure) => {
        return -repair_priority(s) * repair_power(t, s);
      });

      log.debug(`Top 5 Tower Repair Sites:`)
      _.each(_.take(sortedSites, 5), (s) => log.debug(`${this}: ${t}>>>${s} ${repair_priority(s)}*${repair_power(t, s)}`))
      log.info(`${this}: creating new tower repair work ${t} => ${sortedSites[0]} ...`)
      work.push(new TowerRepairWork(t, sortedSites[0]));
    }

    return work;
  }

  schedule(): Job.Model[] {

    const room = this._room;
    return [];
  }

  report(): string[] {
    let r = new Array<string>();
    r.push(`*** Caretaker report by ${this}`);
    return r;
  }

  save(): void { }
}
