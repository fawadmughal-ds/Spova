import type { OrderDto, PositionDto, Tier } from '@spova/shared';

/**
 * Response of GET /v1/internal/trading/index (docs/PHASE3_CONTRACT.md). The API author matches this shape.
 * Money/prices are string decimals. `positions` are open only; `orders` are pending only.
 */
export interface IndexAccountDto {
  id: string;
  userId: string;
  balance: string;
  credit: string;
  leverage: number;
  tier: Tier;
  /** risk_configs[tier].margin_call_pct, e.g. "100.00" */
  marginCallPct: string;
  /** risk_configs[tier].stop_out_pct, e.g. "20.00" */
  stopOutPct: string;
}

export interface IndexSymbolDto {
  id: string;
  contractSize: string;
  digits: number;
  assetClass: string;
  leverageMax: number;
}

export interface TradingIndexDto {
  accounts: IndexAccountDto[];
  positions: PositionDto[];
  orders: OrderDto[];
  /** optional; the worker falls back to its own copy of the symbols table when absent */
  symbols?: IndexSymbolDto[];
}
