export type ColFormat = { width: number; alignLeft: boolean };

export default class Cli {
  static create(): Cli {
    return global.cli ?? new Cli();
  }

  static getFormatting(rows: string[][], alignLeft?: boolean[]): (number | ColFormat)[] {
    const cols: string[][] = _.map(rows[0], (__, col): string[] => _.map(rows, (r) => r[col]));
    return _.map(cols, (col, i) => {
      const width = _.max(_.map(col, (str) => str.length));
      if (alignLeft) {
        return { width, alignLeft: alignLeft[i] ?? true };
      }
      return width;
    });
  }

  static formatRow(tradeRow: string[], separator = ' ', format?: (ColFormat | number)[], alignLeft = true): string {
    let str = '';
    _.each(tradeRow, (col, i) => {
      if (format) {
        if (i !== 0) {
          str += separator;
        }

        const colFormat = format[i];
        const padEnd = (typeof colFormat === 'number') ? alignLeft : colFormat.alignLeft;
        const width = (typeof colFormat === 'number') ? colFormat : colFormat.width;
        if (padEnd) {
          str += col.padEnd(width);
        } else {
          str += col.padStart(width);
        }
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
