import sanitizeHtml from "sanitize-html";

const blocks = new Set(["p", "ol", "ul", "li", "h2", "h3", "blockquote"]);
const policy: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ol",
    "ul",
    "li",
    "h2",
    "h3",
    "blockquote",
    "img",
  ],
  allowedAttributes: { img: ["src", "alt"] },
  allowedSchemes: [],
  allowProtocolRelative: false,
  transformTags: {
    div: "p",
    b: "strong",
    i: "em",
    img: (tag, attrs) => ({
      tagName: tag,
      attribs: {
        src: /^\/api\/files\/[a-z0-9-]+$/.test(attrs.src || "")
          ? attrs.src
          : "",
        alt: attrs.alt || "",
      },
    }),
  },
};

/** Sanitize first, then give top-level editor text explicit paragraph boundaries. */
export function normalizeRichText(input: string): string {
  // A second parse repairs nested div-to-p transformations using HTML paragraph rules.
  const safe = sanitizeHtml(sanitizeHtml(input, policy), policy);
  let output = "",
    inline = "",
    blockDepth = 0;
  const flush = () => {
    // Newlines from paste/plain-text input are paragraphs. Keep inline markup intact.
    if (inline.trim()) {
      const hasInlineTags = /<(?:strong|em|u)\b/i.test(inline);
      output += hasInlineTags
        ? `<p>${inline.replace(/\r?\n/g, "<br />")}</p>`
        : inline
            .split(/\r?\n+/)
            .filter((part) => part.trim())
            .map((part) => `<p>${part}</p>`)
            .join("");
    }
    inline = "";
  };
  // This tokenizer only sees already-sanitized HTML with a closed tag vocabulary.
  for (const token of safe.match(/<[^>]*>|[^<]+/g) || []) {
    const tag = token.match(/^<(\/?)([a-z0-9]+)/i);
    if (tag && blocks.has(tag[2].toLowerCase())) {
      if (!tag[1]) {
        if (blockDepth === 0) flush();
        blockDepth++;
      }
      output += token;
      if (tag[1]) blockDepth = Math.max(0, blockDepth - 1);
    } else if (blockDepth > 0) output += token;
    else inline += token;
  }
  flush();
  return sanitizeHtml(output, policy);
}
