import type { CallTemplateType } from "@/lib/db/schema/call-logs";

export interface ListenForSignal {
  level: "green" | "amber" | "red";
  text: string;
}

export interface TemplateQuestion {
  id: string;
  text: string;
  boldPhrase?: string;
  signals: ListenForSignal[];
}

export interface TemplateSection {
  id: string;
  title: string;
  questions: TemplateQuestion[];
}

export interface CallTemplate {
  type: CallTemplateType;
  label: string;
  description: string;
  sections: TemplateSection[];
}

export interface SectionsState {
  [questionId: string]: {
    checked: boolean;
    notes: string;
  };
}
