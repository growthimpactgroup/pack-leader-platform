import "server-only";
import sanitizeHtml from "sanitize-html";

// Every body is cleaned on save, so only the formatting the editor produces can
// be stored and later shown to Grace and the reviewer. Scripts, iframes,
// event handlers and unexpected styles are dropped.
const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^inherit$/];

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "del", "span", "mark", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "hr", "a"],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "target", "rel"],
      mark: ["data-color", "style"],
      ol: ["start", "style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedStyles: {
      "*": {
        color: COLOR,
        "background-color": COLOR,
        "font-size": [/^\d{1,2}(\.\d+)?px$/],
        "font-family": [/^[\w\s,'"-]+$/],
        "text-align": [/^(left|right|center|justify)$/],
        "margin-left": [/^\d{1,3}px$/],
        "line-height": [/^\d(\.\d+)?$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  });
}
