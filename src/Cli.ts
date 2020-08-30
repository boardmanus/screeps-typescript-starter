import Market$ from 'StockMarket';
import { Trade, Deal } from 'StockMarket';
import u from 'Utility';

function order_cost_row(order: Order): string[] {
  return [
    `${order.amount} `,
    order.resourceType,
    ' @ ',
    `$${order.price.toFixed(3)} = `,
    `$${Math.round(order.amount * order.price)}`
  ]
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
  const signStr = (sign == 1) ? '+' : '-';
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

function get_formatting(rows: string[][]): number[] {
  const cols: string[][] = _.map(rows[0], (__, col): string[] => _.map(rows, (r) => r[col]));
  return _.map(cols, (col) => _.max(_.map(col, (str) => str.length)));
}

function format_row(tradeRow: string[], format?: number[]) {
  let str = "";
  _.each(tradeRow, (col, i) => {
    if (format) {
      str += col.padEnd(format[i]);
    }
    else {
      str += col;
    }
  });
  return str;
}

class MarketCli {


  find_bargains(roomName: string, resource: ResourceConstant, maxPrice?: number, limit: number = 10) {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`find_bargains: ${roomName} doesn't have a terminal`)
      return;
    }
    console.log(`Bargains for ${resource}:`)
    const tradeRows = _.map(_.take(Market$().find_bargains(room, resource, maxPrice), limit), trade_row);
    const tradeFormat = get_formatting(tradeRows);
    _.each(tradeRows, (tradeRow) => console.log(format_row(tradeRow, tradeFormat)));
  }

  find_deals(roomName: string, resource: ResourceConstant, minPrice?: number, limit: number = 10) {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`find_deals: ${roomName} doesn't have a terminal`)
      return;
    }
    console.log(`Deals for ${resource}:`)
    const tradeRows = _.map(_.take(Market$().find_deals(room, resource, minPrice), limit), trade_row);
    const tradeFormat = get_formatting(tradeRows);
    _.each(tradeRows, (tradeRow) => console.log(format_row(tradeRow, tradeFormat)));
  }

  best_deals(roomName: string, resource?: ResourceConstant) {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`best_deals: ${roomName} doesn't have a terminal`)
      return;
    }
    console.log(`Best deals for ${roomName}:${room.terminal}`);
    const deals = Market$().best_deals(room, resource);
    const tradeRows = _.map(deals, trade_row);
    const tradeFormat = get_formatting(tradeRows);
    _.each(tradeRows, (tradeRow) => console.log(format_row(tradeRow, tradeFormat)));
    if (deals.length > 0) {
      console.log(`Sell ${_.sum(deals, (trade) => trade.order.amount)} of ${deals[0].order.resourceType} for $${_.sum(deals, (trade) => trade.order.amount * trade.order.price)} and ${_.sum(deals, (trade) => trade.energyCost)} energy`);
    }
    else {
      console.log(`No deals to be had :(`);
    }
  }

  possible_orders(roomName: string, resource?: ResourceConstant) {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`possible_orders: ${roomName} doesn't have a terminal`)
      return;
    }
    console.log(`Possible orders for ${roomName}:${room.terminal}`);
    const possibleOrders = Market$().possible_orders(room, resource);
    if (possibleOrders.length == 0) {
      console.log(`No orders can be made from ${roomName}.`);
      return;
    }

    const dealRows = _.map(possibleOrders, deal_row);
    const dealFormat = get_formatting(dealRows);
    _.each(dealRows, (dealRow) => console.log(format_row(dealRow, dealFormat)));
  }

  sell(roomName: string, resource: ResourceConstant) {
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
      console.log(`sell: ${roomName} doesn't have a terminal`)
      return;
    }
    console.log(`Creating sell order for ${roomName}:${room.terminal} => ${resource}`);
    const possibleOrders = Market$().possible_orders(room, resource);
    if (possibleOrders.length == 0) {
      console.log(`No orders can be made for ${resource} from ${roomName}.`);
      return;
    }
    const deal = possibleOrders[0];
    console.log(format_row(deal_row(deal)));

    const res = Game.market.createOrder({
      type: ORDER_SELL,
      resourceType: resource,
      price: deal.price,
      totalAmount: deal.amount,
      roomName: deal.roomName
    });
    if (res == OK) {
      console.log(`Done!`);
    }
    else {
      console.log(`Failed to create order (${u.errstr(res)})`);
    }
  }

  constructor() {
  }
}

export default class Cli {
  static create(): Cli {
    return global.cli ?? new Cli();
  }

  readonly market: MarketCli;

  private constructor() {
    this.market = new MarketCli;
    global.cli = this;
  }
}
