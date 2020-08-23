export default class FunctionCache {

  private _values: { [key: string]: any };

  constructor() {
    this._values = {};
  }

  get<T>(key: string, fn: () => T): T {
    let value: T = this._values[key];
    if (value === undefined) {
      value = fn();
      this._values[key] = value;
    }

    return value;
  }
}
