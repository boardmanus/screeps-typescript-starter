import * as Job from 'Job';
import { Expert } from 'Expert';
import Work from 'Work';
import { WorkTowerRepair, WorkTowerDefense, WorkTowerHeal } from 'WorkTower';
import * as u from 'Utility';
import log from 'ScrupsLogger';

const MAX_RAMPART_WALL = 1000000;
const MAX_RCL = 8;

function damage_ratio(site: Structure): number {
  return (1.0 - site.hits / site.hitsMax);
}

function wall_rampart_desired_hits(room: Room): number {
  const c = room.controller;
  if (!c) {
    return 0;
  }

  const progress = c.progress / c.progressTotal;
  const rcl = c.level + progress;

  return (MAX_RAMPART_WALL / (MAX_RCL * MAX_RCL)) * (rcl * rcl);
}

function wall_rampart_damage_ratio(wr: Structure): number {
  return 1.0 - wr.hits / wall_rampart_desired_hits(wr.room);
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
  return 2 * damageRatio;
}

function wall_repair_priority(wall: StructureWall): number {
  const damageRatio = wall_rampart_damage_ratio(wall);
  return 2 * damageRatio;
}

function repair_priority(site: Structure): number {
  switch (site.structureType) {
    case STRUCTURE_ROAD: return road_repair_priority(site as StructureRoad);
    case STRUCTURE_RAMPART: return rampart_repair_priority(site as StructureRampart);
    case STRUCTURE_WALL: return wall_repair_priority(site as StructureWall);
    default: return 8 * damage_ratio(site);
  }
}

function tower_repair_filter(tower: StructureTower[], site: Structure, minPriority: number): boolean {
  if ((site instanceof OwnedStructure) && !(site).my) {
    return false;
  }

  const repairPriority = repair_priority(site);
  if (repairPriority < minPriority) {
    return false;
  }

  const flags = site.room.lookForAt(LOOK_FLAGS, site);
  if (_.find(flags, (f) => f.name.startsWith('dismantle'))) {
    return false;
  }

  const power: number = _.max(_.map(tower, (t) => u.tower_repair_power(t.pos.getRangeTo(site))));
  return site.hitsMax - site.hits > power;
}

export default class Caretaker implements Expert {

  private _room: Room;
  private _towers: StructureTower[];

  constructor(room: Room) {
    this._room = room;

    this._towers = room.find<StructureTower>(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => {
        if (s.structureType !== STRUCTURE_TOWER) {
          return false;
        }
        return s.available(RESOURCE_ENERGY) > 0;
      }
    });
  }

  id(): string {
    return `caretaker-${this._room.name}`;
  }

  toString(): string {
    return this.id();
  }

  survey(): void {
    log.debug(`${this} surveying...`);
  }

  repair(): Work[] {

    if (this._towers.length === 0) {
      return [];
    }

    // Don't perform tower repair if hostile creeps are around.
    const room = this._room;
    const work: Work[] = [];
    const foes = room.find(FIND_HOSTILE_CREEPS);
    if (foes.length > 0) {
      _.each(this._towers, (t) => {
        if (t.available(RESOURCE_ENERGY) < TOWER_ENERGY_COST) {
          return;
        }
        const f = t.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        log.info(`${this}: creating new tower defense work ${t} => ${f} ...`);
        if (f) {
          const damage = u.tower_attack_power(t.pos.getRangeTo(f));
          const shield = u.creep_shield_power(f);
          log.debug(`${this}: ${t} >> ${f} => (${damage} - ${shield} = ${damage - shield})`);
          if (damage > shield) {
            work.push(new WorkTowerDefense(t, f));
          }
        }
      });

      return work;
    }

    log.info(`${this}: ${wall_rampart_desired_hits(this._room)} desired wall/rampart hits`);
    const cloneHealth = 1.0 - this._room.energyAvailable / this._room.energyCapacityAvailable;
    const minPriority = 4.0 * cloneHealth;

    const repairSites = room.find(FIND_STRUCTURES, { filter: (s: Structure) => tower_repair_filter(this._towers, s, minPriority) });

    const healSites = room.find(FIND_MY_CREEPS, { filter: (c) => c.hits < c.hitsMax && ((c.ticksToLive ?? 0) > 500) });

    log.debug(`${this}: ${repairSites.length} repair sites, ${healSites.length} heal sites`);
    if (repairSites.length === 0 && healSites.length === 0) {
      return [];
    }

    _.each(this._towers, (t) => {
      if (t.available(RESOURCE_ENERGY) < TOWER_CAPACITY / 3) {
        return;
      }
      const sortedSites = _.sortBy(repairSites, (s: Structure) => -repair_priority(s) * u.tower_repair_power(t.pos.getRangeTo(s)));

      log.debug(`Top 5 ${t} Repair Sites:`);
      _.each(_.take(sortedSites, 5), (s) => log.debug(`${this}: ${t}>>>${s} ${repair_priority(s)}*${u.tower_repair_power(t.pos.getRangeTo(s))}`));

      _.each(healSites, (h) => work.push(new WorkTowerHeal(t, h)));

      log.info(`${this}: creating new tower repair work ${t} => ${sortedSites[0]} ...`);
      work.push(new WorkTowerRepair(t, sortedSites[0]));
    });

    return work;
  }

  schedule(): Job.Model[] {
    return [];
  }

  report(): string[] {
    const r = new Array<string>();
    r.push(`*** Caretaker report by ${this}`);
    return r;
  }

  save(): void { }
}
