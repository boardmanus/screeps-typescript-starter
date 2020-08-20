import { Work } from "./Work"
import { Mayor } from "./Mayor"
import { Operation } from "./Operation"
import { log } from './ScrupsLogger'
import * as Monarchy from 'Monarchy'
import { RoomCache } from "RoomCache"

export class King implements Monarchy.Model {

  static readonly TYPE = 'king';

  private _mayors: Mayor[];
  private _name: string;
  private _rooms: Room[];

  constructor() {
    _.each(Game.rooms, (room) => new RoomCache(room));
    this._rooms = _.select(Game.rooms, (room: Room) => { return room.controller ? room.controller.my : false });
    let controller = (this._rooms.length) ? this._rooms[0].controller : undefined;
    this._name = controller?.owner?.username ?? "of-nothing";
    this._mayors = _.map(_.filter(this._rooms, (room) => room.find(FIND_MY_SPAWNS).length > 0), (room) => new Mayor(this, room));
    log.info(`${this}: ${this._mayors.length} mayors`);
  }

  id(): string {
    return `king-${this._name}`
  }

  type(): string {
    return King.TYPE;
  }

  rooms(): Room[] {
    return this._rooms;
  }

  parent(): Monarchy.Model | undefined {
    return undefined;
  }

  cloneRequest(request: Monarchy.CloneRequest): boolean {
    // Eventually... Find closest room to the request
    return _.find(this._mayors, (m) => {
      const res = m.cloneRequest(request);
      return res;
    }) ? true : false;
  }

  toString(): string {
    return this.id();
  }

  survey(): void {
    log.info(`${this} surveying...`);
    _.each(this._mayors, (mayor: Mayor) => { mayor.survey(); });
  }

  report(): string[] {
    let r = new Array<string>();
    r.push(`* Royal report by ${this}`);
    _.each(this._mayors, (mayor: Mayor) => { r.concat(mayor.report()); });
    return r;
  }

  rule(): Operation[] {
    log.info(`${this} about to rule the world...`);
    this.survey();

    const ops = _.reduce(
      this._mayors,
      function (res: Operation[], mayor: Mayor): Operation[] {
        return res.concat(_.flatten(_.map(
          mayor.work(),
          (work: Work): Operation[] => {
            return work.work();
          })));
      },
      []);

    log.info(`${this} has ${ops.length} operations scheduled...`);

    return ops;
  }

  save(): void {
    _.each(this._mayors, (mayor: Mayor) => { mayor.save(); });
  }
}
