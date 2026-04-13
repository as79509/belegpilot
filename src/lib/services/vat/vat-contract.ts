import type { VatCalculation } from "./vat-calculator";
import type { VatWarning } from "./vat-validator";

export interface VatCreateResponse<TVatReturn extends { id: string }> {
  vatReturn: TVatReturn;
  calculation: VatCalculation;
  warnings: VatWarning[];
}

export function mergeVatCreateResponse<TVatReturn extends { id: string }>(
  response: VatCreateResponse<TVatReturn>
): Omit<TVatReturn, "warnings"> & { warnings: VatWarning[] } {
  return {
    ...response.vatReturn,
    warnings: response.warnings,
  };
}

export function selectVatReturnById<TVatReturn extends { id: string }>(
  vatReturns: TVatReturn[],
  selectedId: string | null | undefined
): TVatReturn | null {
  if (!selectedId) return null;
  return vatReturns.find((vatReturn) => vatReturn.id === selectedId) || null;
}
