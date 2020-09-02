import Cache from 'Cache';
import * as u from 'Utility';
import Cli from 'Cli';

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

function order_cost_row(order: Order): string[] {
  return [
    `${order.amount} `,
    order.resourceType,
    ' @ ',
    `$${order.price.toFixed(3)} = `,
    `$${Math.round(order.amount * order.price)}`
  ];
}

function energy_cost_row(trade: Trade): string[] {
  const energyPrice = Market$().avgEnergyPrice;
  return [
    `${trade.energyCost} `,
    RESOURCE_ENERGY,
    ' @ ',
    `$${energyPrice.toFixed(3)} = `,
    `$${Math.round(trade.energyCost * energyPrice)}`
  ];
}

function trade_row(trade: Trade): string[] {
  const energyPrice = 0.25;
  const totalEnergyPrice = energyPrice * trade.energyCost;
  const totalTradePrice = trade.order.price * trade.order.amount;
  const sign = (trade.order.type === ORDER_BUY) ? 1 : -1;
  const signStr = (sign === 1) ? '+' : '-';
  const cost = Math.round(sign * totalTradePrice - totalEnergyPrice);
  return [
    `[${trade.order.id}] `,
    ...order_cost_row(trade.order),
    ' => ',
    ...energy_cost_row(trade),
    ' = ',
    `$${Math.abs(cost)}`,
    ` => ${signStr}$${(Math.abs(cost) / trade.order.amount).toFixed(3)}`,
    '/',
    trade.order.resourceType
  ];
}

function deal_row(deal: Deal): string[] {
  return [
    `${deal.amount} `,
    deal.resourceType,
    ` @ $${deal.price.toFixed(3)} `,
    `= $${Math.round(deal.price * deal.amount)} `,
    `- $${Math.round(deal.amount * deal.price * 0.05)} fees `,
    `= $${Math.round(deal.amount * deal.price * 0.95)}`
  ];
}

const MARKET_CLI = {
  find_bargains: (roomName: string, resource: ResourceConstant, maxPrice?: number, limit = 10) => {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`find_bargains: ${roomName} doesn't have a terminal`);
      return;
    }
    console.log(`Bargains for ${resource}:`);
    const tradeRows = _.map(_.take(StockMarket.create().findBargains(room, resource, maxPrice), limit), trade_row);
    const tradeFormat = Cli.getFormatting(tradeRows);
    _.each(tradeRows, (tradeRow) => console.log(Cli.formatRow(tradeRow, tradeFormat)));
  },

  find_deals: (roomName: string, resource: ResourceConstant, minPrice?: number, limit = 10) => {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`find_deals: ${roomName} doesn't have a terminal`);
      return;
    }
    console.log(`Deals for ${resource}:`);
    const tradeRows = _.map(_.take(StockMarket.create().findDeals(room, resource, minPrice), limit), trade_row);
    const tradeFormat = Cli.getFormatting(tradeRows);
    _.each(tradeRows, (tradeRow) => console.log(Cli.formatRow(tradeRow, tradeFormat)));
  },

  best_deals: (roomName: string, resource?: ResourceConstant) => {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`best_deals: ${roomName} doesn't have a terminal`);
      return;
    }
    console.log(`Best deals for ${roomName}:${room.terminal}`);
    const deals = StockMarket.create().bestDeals(room, resource);
    const tradeRows = _.map(deals, trade_row);
    const tradeFormat = Cli.getFormatting(tradeRows);
    _.each(tradeRows, (tradeRow) => console.log(Cli.formatRow(tradeRow, tradeFormat)));
    if (deals.length > 0) {
      const totalAmount = _.sum(deals, (trade) => trade.order.amount);
      const totalPrice = totalAmount * deals[0].order.price;
      const totalEnergy = _.sum(deals, (trade) => trade.energyCost);
      console.log(`Sell ${totalAmount} of ${deals[0].order.resourceType} for $${totalPrice} and ${totalEnergy} energy`);
    } else {
      console.log('No deals to be had :(');
    }
  },

  possible_orders: (roomName: string, resource?: ResourceConstant) => {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`possible_orders: ${roomName} doesn't have a terminal`);
      return;
    }
    console.log(`Possible orders for ${roomName}:${room.terminal}`);
    const possibleOrders = StockMarket.create().possibleOrders(room, resource);
    if (possibleOrders.length === 0) {
      console.log(`No orders can be made from ${roomName}.`);
      return;
    }

    const dealRows = _.map(possibleOrders, deal_row);
    const dealFormat = Cli.getFormatting(dealRows);
    _.each(dealRows, (dealRow) => console.log(Cli.formatRow(dealRow, dealFormat)));
  },

  sell: (roomName: string, resource: ResourceConstant) => {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`sell: ${roomName} doesn't have a terminal`);
      return;
    }
    console.log(`Creating sell order for ${roomName}:${room.terminal} => ${resource}`);
    const possibleOrders = StockMarket.create().possibleOrders(room, resource);
    if (possibleOrders.length === 0) {
      console.log(`No orders can be made for ${resource} from ${roomName}.`);
      return;
    }
    const deal = possibleOrders[0];
    console.log(Cli.formatRow(deal_row(deal)));

    const res = Game.market.createOrder({
      type: ORDER_SELL,
      resourceType: resource,
      price: deal.price,
      totalAmount: deal.amount,
      roomName: deal.roomName
    });
    if (res === OK) {
      console.log('Done!');
    } else {
      console.log(`Failed to create order (${u.errstr(res)})`);
    }
  },

  economy: (roomName: string) => {
    const room = Game.rooms[roomName];
    if (!room) {
      console.log(`economy: Don't have access to ${roomName}`);
    }
  }
};

export class StockMarket {

  static create(): StockMarket {
    return Game.market.cache ?? new StockMarket();
  }

  private readonly cache: Cache;

  private constructor() {
    this.cache = new Cache();
    Cli.create().register('market', MARKET_CLI);
    Game.market.cache = this;
  }

  get avgEnergyPrice() {
    return this.cache.get('avgEnergyPrice', () => {
      const fortniteHistory = Game.market.getHistory(RESOURCE_ENERGY);
      return _.sum(fortniteHistory, (h) => h.avgPrice) / fortniteHistory.length;
    });
  }

  findBargains(room: Room, resource: ResourceConstant, maxPrice = 1000000): Trade[] {
    return _.sortBy(_.map(Game.market.getAllOrders(
      (order) => order.resourceType === resource && order.price <= maxPrice && order.type === ORDER_SELL),
      (order) => ({ roomName: room.name, energyCost: Game.market.calcTransactionCost(order.amount, room.name, order.roomName ?? ''), order })),
      (trade) => (trade.order.amount * trade.order.price + trade.energyCost * this.avgEnergyPrice) / trade.order.amount);
  }

  findDeals(room: Room, resource: ResourceConstant, minPrice = 0): Trade[] {
    return _.sortBy(_.map(Game.market.getAllOrders(
      (order) => order.resourceType === resource && order.price >= minPrice && order.type === ORDER_BUY
    ),
      (order) => ({ roomName: room.name, energyCost: Game.market.calcTransactionCost(order.amount, room.name, order.roomName ?? ''), order })),
      (trade) => -(trade.order.amount * trade.order.price - trade.energyCost * this.avgEnergyPrice) / trade.order.amount);
  }

  bestDeals(room: Room, inresource?: ResourceConstant, inamount = 1000000): Trade[] {
    if (!room.terminal) {
      return [];
    }

    const resource = inresource ?? u.max_stored_resource(room.terminal.store, u.RESOURCE_MINERALS) ?? [];

    const trades = this.findDeals(room, resource, 0);
    if (trades.length === 0) {
      return [];
    }

    let amount = inamount;
    let energy = room.terminal.available(RESOURCE_ENERGY);
    const bestTrades = _.reduce(trades, (res: Trade[], trade) => {
      if (energy === 0 || amount === 0) {
        return res;
      }

      let maxTradeAmount = Math.min(amount, trade.order.amount);
      const energyCost = Math.ceil((maxTradeAmount * trade.energyCost) / trade.order.amount);
      if (energyCost <= energy) {
        energy -= energyCost;
        amount -= maxTradeAmount;
      } else {
        maxTradeAmount = Math.floor((trade.order.amount * energy) / trade.energyCost);
        energy = 0;
        amount -= maxTradeAmount;
      }
      trade.energyCost = Math.ceil((maxTradeAmount * trade.energyCost) / trade.order.amount);
      trade.order.amount = maxTradeAmount;
      res.push(trade);
      return res;
    }, []);

    return bestTrades;
  }

  possibleOrders(room: Room, inresource?: ResourceConstant): Deal[] {
    const { terminal } = room;
    if (!terminal) {
      return [];
    }

    const resources = inresource ? [inresource] : Object.keys(terminal.store);

    return _.map(resources, (resourceStr) => {
      const resource = resourceStr as ResourceConstant;
      const fortniteHistory = Game.market.getHistory(resource);
      const resourceAvg = _.sum(fortniteHistory, (h) => h.avgPrice) / 14;

      return {
        roomName: room.name,
        type: ORDER_SELL,
        resourceType: resource,
        price: resourceAvg,
        amount: terminal.available(resource)
      };
    });
  }

}

export default function Market$(): StockMarket {
  return Game.market.cache;
}
