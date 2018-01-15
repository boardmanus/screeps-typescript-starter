export class FunctionCache<T> {

  private _values : { [ key : string ] : T };

  constructor() {
    this._values = {};
  }

  getValue(key : string, fn : () => T) : T {
    let value : T = this._values[key];
    if (value === undefined) {
      value = fn();
      this._values[key] = value;
    }

    return value;
  }
}
