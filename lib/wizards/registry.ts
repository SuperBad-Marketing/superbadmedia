/**
 * Wizard manifest. Each WizardDefinition registers itself here at module
 * load time (via `registerWizard`); the shell looks up by `key`. SW-3
 * populates the admin integration wizards; SW-4+ populate the rest.
 *
 * Duplicate key registration throws — prevents two wizards accidentally
 * claiming the same key and silently overwriting. This is the
 * "shared-primitive collision" guard Phase 3.5 step 7 required.
 *
 * Owner: SW-1. Consumers: every WizardDefinition module.
 */

import type { AnyWizardDefinition, WizardDefinition } from "./types";

const registry = new Map<string, AnyWizardDefinition>();

export function registerWizard<T>(definition: WizardDefinition<T>): void {
  if (registry.has(definition.key)) {
    throw new Error(
      `[wizards] duplicate registration for key="${definition.key}". Every wizard key must be globally unique.`,
    );
  }
  registry.set(definition.key, definition as AnyWizardDefinition);
}

export function getWizard(key: string): AnyWizardDefinition | undefined {
  return registry.get(key);
}

export function listWizardKeys(): string[] {
  return Array.from(registry.keys()).sort();
}

/**
 * Test-only reset. Not exported through a barrel; tests import by path.
 * Never called from production code.
 */
export function __resetWizardRegistryForTests(): void {
  registry.clear();
}
