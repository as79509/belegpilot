import type { IntegrationAdapter } from "./integration-provider";

const adapters = new Map<string, IntegrationAdapter>();

export function registerAdapter(adapter: IntegrationAdapter): void {
  adapters.set(adapter.provider.id, adapter);
}

export function getAdapter(id: string): IntegrationAdapter | undefined {
  return adapters.get(id);
}

export function getAllAdapters(): IntegrationAdapter[] {
  return [...adapters.values()];
}

export function getAllProviders() {
  return [...adapters.values()].map((a) => a.provider);
}
