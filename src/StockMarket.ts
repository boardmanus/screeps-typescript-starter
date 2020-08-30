import Cache from "Cache";
import u from "Utility";


export interface Trade {
  roomName: string;
  energyCost: number;
  order: Order;
}

export interface Deal {
  roomName: string;
  type: ORDER_BUY | ORDER_SELL;
  resourceType: ResourceConstant;
  price: number;
  amount: number;
}


export class StockMarket {

  static create() {
    return Game.market._cache ?? new StockMarket();
  }

  private readonly _cache: Cache;

  private constructor() {
    this._cache = new Cache();
    Game.market._cache = this;
  }

  get avgEnergyPrice() {
    return this._cache.get('avgEnergyPrice', () => {
      const fortniteHistory = Game.market.getHistory(RESOURCE_ENERGY);
      return _.sum(fortniteHistory, (h) => h.avgPrice) / fortniteHistory.length;
    });
  }

  find_bargains(room: Room, resource: ResourceConstant, maxPrice: number = 1000000): Trade[] {
    return _.sortBy(_.map(Game.market.getAllOrders(
      (order) => order.resourceType === resource && order.price <= maxPrice && order.type === ORDER_SELL),
      (order) => ({ roomName: room.name, energyCost: Game.market.calcTransactionCost(order.amount, room.name, order.roomName ?? ""), order: order })),
      (trade) => (trade.order.amount * trade.order.price + trade.energyCost * this.avgEnergyPrice) / trade.order.amount);
  }

  find_deals(room: Room, resource: ResourceConstant, minPrice: number = 0): Trade[] {
    return _.sortBy(_.map(Game.market.getAllOrders(
      (order) => order.resourceType === resource && order.price >= minPrice && order.type === ORDER_BUY),
      (order) => ({ roomName: room.name, energyCost: Game.market.calcTransactionCost(order.amount, room.name, order.roomName ?? ""), order: order })),
      (trade) => -(trade.order.amount * trade.order.price - trade.energyCost * this.avgEnergyPrice) / trade.order.amount);
  }

  best_deals(room: Room, resource?: ResourceConstant, amount: number = 1000000): Trade[] {
    if (!room.terminal) {
      return [];
    }

    if (!resource) {
      resource = u.max_stored_resource(room.terminal.store, u.RESOURCE_MINERALS);
    }

    if (!resource) {
      return [];
    }

    const trades = this.find_deals(room, resource, 0);
    if (trades.length == 0) {
      return [];
    }

    let energy = room.terminal.available(RESOURCE_ENERGY);
    const bestTrades = _.reduce(trades, (res: Trade[], trade) => {
      if (energy == 0 || amount == 0) {
        return res;
      }

      let maxTradeAmount = Math.min(amount, trade.order.amount);
      const energyCost = Math.ceil(maxTradeAmount * trade.energyCost / trade.order.amount);
      if (energyCost <= energy) {
        energy -= energyCost;
        amount -= maxTradeAmount;
      }
      else {
        maxTradeAmount = Math.floor(trade.order.amount * energy / trade.energyCost);
        energy = 0;
        amount -= maxTradeAmount;
      }
      trade.energyCost = Math.ceil(maxTradeAmount * trade.energyCost / trade.order.amount);
      trade.order.amount = maxTradeAmount;
      res.push(trade);
      return res;
    }, []);

    return bestTrades;
  }

  possible_orders(room: Room, resource?: ResourceConstant): Deal[] {
    const terminal = room.terminal;
    if (!terminal) {
      return [];
    }

    const resources = resource ? [resource] : Object.keys(terminal.store);

    return _.map(resources, (resourceStr) => {
      const resource = resourceStr as ResourceConstant;
      const fortniteHistory = Game.market.getHistory(resource);
      const resourceAvg = _.sum(fortniteHistory, (h) => h.avgPrice) / 14;

      return {
        roomName: room.name,
        type: ORDER_SELL,
        resourceType: resource,
        price: resourceAvg,
        amount: terminal.available(resource),
      }
    });
  }
}

export default function Market$(): StockMarket {
  return Game.market._cache;
}
