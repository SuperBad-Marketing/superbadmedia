"use client";

import DOMPurify from "dompurify";
import { useMemo } from "react";

const ALLOWED_TAGS = [
  "p", "br", "div", "span", "a",
  "strong", "b", "em", "i", "u", "s",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "table", "thead", "tbody", "tr", "th", "td",
  "img", "hr",
];

const ALLOWED_ATTRS = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "style",
];

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
}

export function EmailBody({
  html,
  text,
  className,
}: {
  html?: string | null;
  text?: string | null;
  className?: string;
}) {
  const sanitizedHtml = useMemo(() => {
    if (html) return sanitize(html);
    return null;
  }, [html]);

  if (sanitizedHtml) {
    return (
      <div
        className={`email-body-rendered ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  return (
    <div className={`whitespace-pre-wrap break-words ${className ?? ""}`}>
      {text ?? ""}
    </div>
  );
}
