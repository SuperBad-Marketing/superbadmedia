import { writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

// Uses Vitest 4's documented reporting lifecycle, including unhandled errors.
// This is a gate report, not application telemetry. Never records secret env values.
export default class QualityReporter {
  selected = [];
  onInit(ctx) { this.root = ctx.config.root; }
  file(id) { return relative(this.root, resolve(id)).replaceAll("\\", "/"); }
  errors(errors) {
    return errors.map(error => ({ name: String(error.name ?? "Error"), message: String(error.message ?? "") }));
  }
  onTestRunStart(specifications) {
    this.selected = specifications.map(spec => this.file(spec.moduleId)).sort();
  }
  onTestRunEnd(modules, unhandledErrors, reason) {
    const report = {
      version: 1,
      nonce: process.env.QUALITY_REPORT_NONCE,
      revision: process.env.QUALITY_REPORT_REVISION,
      reason,
      selected: this.selected,
      unhandledErrors: this.errors(unhandledErrors),
      files: modules.map(module => ({
        file: this.file(module.moduleId),
        state: module.state(),
        errors: this.errors([module, ...module.children.allSuites()].flatMap(suite => suite.errors())),
        tests: [...module.children.allTests()].map(test => ({
          name: test.fullName,
          state: test.result().state,
          errors: this.errors(test.result().errors ?? []),
          flaky: Boolean(test.diagnostic()?.flaky),
        })),
      })),
    };
    if (!process.env.QUALITY_REPORT_PATH || !report.nonce || !report.revision) throw new Error("Missing gate report context.");
    writeFileSync(process.env.QUALITY_REPORT_PATH, JSON.stringify(report), "utf8");
  }
}
