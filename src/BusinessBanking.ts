import * as Business from 'Business';
import * as Job from "Job";
import JobUnload from 'JobUnload';
import JobPickup from 'JobPickup';
import Worker from 'Worker';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';


const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [MOVE, CARRY];
const IDEAL_CLONE_ENERGY = 1000;
const MAX_CLONE_ENERGY = 2000;

function find_vault_structures(vault: StructureStorage): AnyStructure[] {
  return vault.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (s) => (s.structureType == STRUCTURE_LINK)
  });
}

function find_vault_construction(vault: StructureStorage): ConstructionSite[] {
  return vault.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
    filter: (s) => (s.structureType == STRUCTURE_LINK)
  });
}

function can_build_vault(room: Room): boolean {
  if (room.storage) {
    return false;
  }

  const storageCons = room.find(FIND_CONSTRUCTION_SITES, { filter: (cs) => cs.structureType == STRUCTURE_STORAGE });
  if (storageCons.length > 0) {
    return false;
  }

  const rcl = room.controller?.level ?? 0;
  const numStorage = CONTROLLER_STRUCTURES.storage[rcl];
  return numStorage > 0;
}

function possible_storage_sites(room: Room): RoomPosition[] {
  const controller = room.controller;
  const spawn = room.find(FIND_MY_SPAWNS)[0];
  if (!controller || !spawn) {
    return [];
  }

  const path = spawn.pos.findPathTo(controller.pos, { ignoreCreeps: true, ignoreRoads: false, maxRooms: 1 });
  const viableSites = _.flatten(_.map(path, (step) => {
    const pos = new RoomPosition(step.x, step.y, room.name);
    return pos.surroundingPositions(5, (site: RoomPosition): boolean => {
      const terrain = site.look();
      for (const t of terrain) {
        switch (t.type) {
          case LOOK_CONSTRUCTION_SITES:
            if (t.constructionSite?.structureType != STRUCTURE_ROAD) {
              return false;
            }
            break;
          case LOOK_STRUCTURES:
            if (t.structure?.structureType != STRUCTURE_ROAD) {
              return false;
            }
            break;
          case LOOK_TERRAIN:
            if (t.terrain == 'wall') {
              return false;
            }
            break;
          default:
            break;
        }
      }
      return true;
    })
  }));

  log.info(`found ${viableSites.length} viable storage sites ${viableSites}`);
  return viableSites;
}

function storage_site_viability(pos: RoomPosition, room: Room): number {
  const spacialViability = _.reduce(
    pos.surroundingPositions(1),
    (a: number, p: RoomPosition): number => {
      const terrain = p.look();
      let viability = 1;
      for (const t of terrain) {
        switch (t.type) {
          case LOOK_SOURCES:
          case LOOK_MINERALS:
            return -2;
          case LOOK_CONSTRUCTION_SITES:
            if (t.constructionSite) {
              if (!u.is_passible_structure(t.constructionSite)) {
                return -1;
              }
              else if (t.constructionSite.structureType == STRUCTURE_ROAD) {
                viability += 0.5;
              }
              else {
                viability -= 0.5;
              }
            }
            break;
          case LOOK_STRUCTURES:
            if (t.structure) {
              if (!u.is_passible_structure(t.structure)) {
                return -1;
              }
              else if (t.structure.structureType == STRUCTURE_ROAD) {
                viability += 0.5;
              }
              else {
                viability -= 0.5;
              }
            }
            break;
          case LOOK_TERRAIN:
            if (t.terrain == 'wall') {
              return -1;
            }
            break;
          default:
            break;
        }
      }
      return a + viability;
    },
    0);

  const spawners = room.find(FIND_MY_SPAWNS);
  if (spawners.length == 0) {
    return spacialViability;
  }
  const locationalViability = _.min(_.map(
    spawners,
    (s: StructureSpawn): number => {
      return pos.findPathTo(s).length;
    }));

  // Want positions with lots of space around, and closer to spawns
  return spacialViability - locationalViability;
}

function vault_building_work(room: Room): BuildingWork[] {
  const possibleSites = possible_storage_sites(room);
  const sortedSites = _.sortBy(possibleSites, (rp) => -storage_site_viability(rp, room));

  const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'solid', stroke: 'purple' };
  let i = 0;
  for (const site of sortedSites) {
    if (i++ == 0) continue;
    style.opacity = (0.25 - (i / sortedSites.length) / 4);
    room.visual.circle(site.x, site.y, style);
  }

  const bestSites = _.take(sortedSites, 1);
  const bestStyle: CircleStyle = { fill: 'green', radius: 0.6, lineStyle: 'solid', stroke: 'green' };
  for (const site of bestSites) {
    room.visual.circle(site.x, site.y, bestStyle);
  }

  return _.map(bestSites, (rp) => new BuildingWork(rp, STRUCTURE_STORAGE));
}

function can_build_link(vault: StructureStorage): boolean {
  const rcl = vault.room.controller?.level ?? 0;
  const numLinks = u.find_num_building_sites(vault.room, STRUCTURE_LINK);
  const allowedNumLinks = CONTROLLER_STRUCTURES.link[rcl];
  return (allowedNumLinks - numLinks) > 0;
}

function possible_link_sites(linkNeighbour: Structure): RoomPosition[] {
  let haveLink: boolean = false;
  const room = linkNeighbour.room;
  if (!room) {
    return [];
  }
  const viableSites = linkNeighbour.pos.surroundingPositions(1, (site: RoomPosition): boolean => {
    if (haveLink) {
      return false;
    }
    const terrain = site.look();
    for (const t of terrain) {
      switch (t.type) {
        case LOOK_CONSTRUCTION_SITES:
          if (t.constructionSite!.structureType == STRUCTURE_LINK) {
            haveLink = true;
          }
          else if (t.constructionSite!.structureType != STRUCTURE_ROAD) {
            return false;
          }
          break;
        case LOOK_STRUCTURES:
          if (t.structure!.structureType == STRUCTURE_LINK) {
            haveLink = true;
          }
          else if (t.structure!.structureType != STRUCTURE_ROAD) {
            return false;
          }
          break;
        case LOOK_TERRAIN:
          if (t.terrain == 'wall') {
            return false;
          }
          break;
        default:
          break;
      }
    }
    return true;
  });

  if (haveLink) {
    return [];
  }

  return viableSites;
}

function link_building_work(vault: StructureStorage): BuildingWork[] {
  const viableSites = possible_link_sites(vault);
  log.info(`${vault}: ${viableSites.length} viable link sites`);
  if (viableSites.length == 0) {
    return [];
  }

  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    const emptyPositions = u.find_empty_surrounding_positions(site);
    return -emptyPositions.length;
  });

  return [new BuildingWork(sortedSites[0], STRUCTURE_LINK)];
}

function update_vault(vault: StructureStorage): void {

  vault._link = undefined;

  // Load information from storage, if possible
  const storageMem: StorageMemory = vault.room.memory.storage ?? { id: vault.id }
  if (storageMem.link) {
    vault._link = Game.getObjectById<StructureLink>(storageMem.link) ?? undefined;
  }

  // The vault link has not been setup yet, search around.
  if (!vault._link) {
    const sites: (AnyStructure | ConstructionSite)[] = find_vault_structures(vault);
    sites.push(...find_vault_construction(vault))

    for (const site of sites) {
      if (site.structureType === STRUCTURE_LINK) {
        vault._link = site;
        log.info(`${vault}: updated link to ${site}`);
      }
    }
  }

  if (vault._link instanceof StructureLink) {
    vault._link._isSink = true;
  }

  // Update storage
  storageMem.link = vault._link?.id;
}

export default class BusinessBanking implements Business.Model {

  static readonly TYPE: string = 'bank';

  private readonly _room: Room;
  private readonly _priority: number;
  private readonly _vault: StructureStorage | undefined;
  private readonly _remoteRooms: Room[];

  constructor(vaultRoom: Room, remoteRooms: Room[], priority: number = 5) {
    this._room = vaultRoom;
    this._priority = priority;
    this._vault = vaultRoom.storage;
    this._remoteRooms = remoteRooms;

    if (this._vault) {
      update_vault(this._vault);
    }
  }

  id(): string {
    return Business.id(BusinessBanking.TYPE, this._room.name);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  canRequestEmployee(): boolean {
    return false;
  }

  needsEmployee(employees: Worker[]): boolean {
    return employees.length < Math.min(3, this._remoteRooms.length + 1);
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {

    if (availEnergy < IDEAL_CLONE_ENERGY && maxEnergy > IDEAL_CLONE_ENERGY) {
      // Wait for more energy
      return [];
    }

    const energyToUse = Math.min(availEnergy, MAX_CLONE_ENERGY);
    return u.generate_body(EMPLOYEE_BODY_BASE, EMPLOYEE_BODY_TEMPLATE, energyToUse);
  }

  permanentJobs(): Job.Model[] {
    // No permanent jobs for banking. Just ensures a good transporter is
    // created
    return [];
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    if (!this._vault) {
      return [];
    }

    const vault: StructureStorage = this._vault;
    const attackers = u.find_nearby_attackers(vault);
    if (attackers.length > 0) {
      log.warning(`${this}: ${attackers} near vault - no contract jobs!`);
      return [];
    }

    let jobs: Job.Model[] = [];

    const hostiles = this._vault.room.find(FIND_HOSTILE_CREEPS).length;
    const minRatio = (hostiles > 0) ? 1.0 : 0.1;
    const energyRatio = this._vault.room.energyAvailable / this._vault.room.energyCapacityAvailable;
    if (vault.available(RESOURCE_ENERGY) > 0) {
      jobs.push(new JobPickup(vault, RESOURCE_ENERGY, Math.max(minRatio, 1.0 - energyRatio) * 1));
    }

    if (vault.freeSpace() > 0) {
      jobs.push(new JobUnload(vault, u.RESOURCE_ALL, Math.max(0.1, energyRatio) * 1));
    }

    const link = vault.link();
    if (link && link.available() > 0) {
      jobs.push(new JobPickup(link, RESOURCE_ENERGY, this._priority));
    }

    return jobs;
  }

  buildings(): BuildingWork[] {

    const work: BuildingWork[] = [];

    if (!this._vault) {
      if (can_build_vault(this._room)) {
        work.push(...vault_building_work(this._room));
      }
      return work;
    }

    const vault = this._vault;
    if (!vault._link && can_build_link(vault)) {
      work.push(...link_building_work(vault));
    }

    return work;
  }
}

Business.factory.addBuilder(BusinessBanking.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  if (!room) {
    return undefined;
  }
  return new BusinessBanking(room, []);
});



