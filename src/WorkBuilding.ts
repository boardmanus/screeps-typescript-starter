import { Operation } from 'Operation';
import Work from 'Work';
import * as u from 'Utility';
import log from 'ScrupsLogger';

export default class WorkBuilding implements Work {

  readonly site: RoomPosition;
  readonly type: BuildableStructureConstant;
  readonly room: Room;

  constructor(pos: RoomPosition, type: BuildableStructureConstant) {
    this.site = pos;
    this.type = type;
    this.room = Game.rooms[pos.roomName];
  }

  id() {
    return `work-build-${this.type}-${this.site?.x}-${this.site?.y}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [() => {
      if (!this.site) {
        log.error(`${this}: ${this.type} site undefined!`);
        return;
      }

      if (!this.room) {
        log.warning(`${this}: ${this.site} room not visible!`);
        return;
      }

      const res = this.room.createConstructionSite(this.site.x, this.site.y, this.type);
      switch (res) {
        case OK:
          log.info(`${this}: created construction site`);
          break;
        default:
          log.error(`${this}: failed to create construction site ${this.site} (${u.errstr(res)})`);
          break;
      }
    }];
  }
}
