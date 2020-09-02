export default class Cli {
  static create(): Cli {
    return global.cli ?? new Cli();
  }

  static getFormatting(rows: string[][]): number[] {
    const cols: string[][] = _.map(rows[0], (__, col): string[] => _.map(rows, (r) => r[col]));
    return _.map(cols, (col) => _.max(_.map(col, (str) => str.length)));
  }

  static formatRow(tradeRow: string[], format?: number[]): string {
    let str = '';
    _.each(tradeRow, (col, i) => {
      if (format) {
        str += col.padEnd(format[i]);
      } else {
        str += col;
      }
    });
    return str;
  }

  private cmds: { [key: string]: { [key: string]: (...args: any[]) => void } };

  register(key: string, cmds: { [key: string]: (...args: any[]) => void }) {
    this.cmds[key] = cmds;
  }

  private constructor() {
    this.cmds = {};
    global.cli = this;
  }
}
