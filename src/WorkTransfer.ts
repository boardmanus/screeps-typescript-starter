import { Operation } from 'Operation';
import Work from 'Work';
import * as u from 'Utility';
import log from 'ScrupsLogger';

export default class WorkTransfer implements Work {

  readonly from: StructureLink;
  readonly to: StructureLink;
  readonly amount: number;

  constructor(from: StructureLink, to: StructureLink, amount: number) {
    this.from = from;
    this.to = to;
    this.amount = amount;
  }

  id() {
    return `work-transfer-${this.from}-${this.to}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [() => {
      const res = this.from.transferEnergy(this.to, this.amount);
      switch (res) {
        case OK:
          log.info(`${this}: transfered ${this.amount} of energy from ${this.from} to ${this.to}`);
          break;
        default:
          log.error(`${this}: failed to transfer energy from ${this.from} to ${this.to}(${u.errstr(res)})`);
          break;
      }
    }];
  }
}
