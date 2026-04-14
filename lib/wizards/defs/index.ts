/**
 * Wizard definitions barrel — single side-effect entrypoint.
 *
 * Every `WizardDefinition` module self-registers via `registerWizard()` at
 * module-load time (see `lib/wizards/registry.ts`). Importing this barrel
 * once guarantees every known wizard is registered before any route or
 * worker asks for one via `getWizard(key)`.
 *
 * Route code (e.g. `/lite/setup/critical-flight/[key]/page.tsx`) imports
 * this file instead of per-def side-effect imports — single place to
 * update when a new wizard ships. Closes `sw5_wizard_defs_barrel_owed`.
 *
 * Owner: SW-6.
 */
import "./stripe-admin";
import "./resend";
import "./graph-api-admin";
import "./pixieset-admin";
import "./meta-ads";
import "./google-ads";
import "./twilio";
