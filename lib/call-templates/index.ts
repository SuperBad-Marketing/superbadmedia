import type { CallTemplateType } from "@/lib/db/schema/call-logs";
import type { CallTemplate } from "./types";
import { contactedTemplate } from "./contacted";
import { conversationTemplate } from "./conversation";
import { trialShootPreTemplate, trialShootPostTemplate } from "./trial-shoot";
import { quotedTemplate } from "./quoted";
import { negotiatingTemplate } from "./negotiating";

export type { CallTemplate, TemplateSection, TemplateQuestion, ListenForSignal, SectionsState } from "./types";

const TEMPLATES: Record<CallTemplateType, CallTemplate> = {
  contacted: contactedTemplate,
  conversation: conversationTemplate,
  trial_shoot_pre: trialShootPreTemplate,
  trial_shoot_post: trialShootPostTemplate,
  quoted: quotedTemplate,
  negotiating: negotiatingTemplate,
};

export function getCallTemplate(type: CallTemplateType): CallTemplate {
  return TEMPLATES[type];
}

export function getTemplatesForStage(stage: string): CallTemplate[] {
  switch (stage) {
    case "contacted":
      return [contactedTemplate];
    case "conversation":
      return [conversationTemplate];
    case "trial_shoot":
      return [trialShootPreTemplate, trialShootPostTemplate];
    case "quoted":
      return [quotedTemplate];
    case "negotiating":
      return [negotiatingTemplate];
    default:
      return [];
  }
}

export function getTotalQuestions(template: CallTemplate): number {
  return template.sections.reduce((sum, s) => sum + s.questions.length, 0);
}
