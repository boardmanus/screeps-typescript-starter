/* eslint-disable max-classes-per-file */
import { Operation } from 'Operation';
import Work from 'Work';
import * as u from 'Utility';
import log from 'ScrupsLogger';

export class WorkTowerRepair implements Work {

  readonly tower: StructureTower;
  readonly site: Structure;

  constructor(tower: StructureTower, site: Structure) {
    this.tower = tower;
    this.site = site;
  }

  id() {
    return `work-tower-repair-${this.tower.pos.x}-${this.tower.pos.y}`;
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

export class WorkTowerHeal implements Work {

  readonly tower: StructureTower;
  readonly site: Creep;

  constructor(tower: StructureTower, site: Creep) {
    this.tower = tower;
    this.site = site;
  }

  id() {
    return `work-tower-heal-${this.site.name}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [() => {
      const res = this.tower.heal(this.site);
      switch (res) {
        case OK:
          log.info(`${this}: ${this.tower} healed ${this.site}`);
          break;
        default:
          log.error(`${this}: ${this.tower} failed to heal ${this.site} (${u.errstr(res)})`);
          break;
      }
    }];
  }
}

export class WorkTowerDefense implements Work {

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
