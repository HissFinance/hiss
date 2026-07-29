/**
 * View-block renderer — dispatches a declarative {@link ViewBlock} to the
 * matching component (task §13). Also hosts the OSC-8 hyperlink helper (§11):
 * links are emitted ONLY in a color-capable HUMAN terminal; everywhere else the
 * bare, meaningful text (and URL) is printed so nothing is lost.
 *
 * Components emit styled strings; the SINK (output.ts) is responsible for the
 * execution-claim guard and redaction on every emitted line.
 */

import type { OutputContext } from "./context.js";
import type { ViewBlock } from "./view.js";

import { renderBanner } from "./components/banner.js";
import { renderSection } from "./components/section.js";
import { renderKeyValue } from "./components/key-value.js";
import { renderTable } from "./components/table.js";
import { renderStatus } from "./components/status.js";
import { renderPanel } from "./components/panel.js";
import { renderProgress } from "./components/progress.js";
import { renderReceipt } from "./components/receipt.js";
import { renderTransaction } from "./components/transaction.js";
import { renderFuse } from "./components/fuse.js";
import { renderPnl } from "./components/pnl.js";
import { renderError } from "./components/error.js";
import { renderEvidence } from "./components/evidence.js";
import { renderText, renderDivider } from "./components/text.js";

/** Render a single declarative block to styled lines. */
export function renderBlock(ctx: OutputContext, block: ViewBlock): string[] {
  switch (block.kind) {
    case "text":
      return renderText(ctx, block);
    case "divider":
      return renderDivider(ctx);
    case "banner":
      return renderBanner(ctx, block);
    case "section":
      return renderSection(ctx, block, (child) => renderBlock(ctx, child));
    case "keyValue":
      return renderKeyValue(ctx, block);
    case "table":
      return renderTable(ctx, block);
    case "status":
      return renderStatus(ctx, block);
    case "panel":
      return renderPanel(ctx, block);
    case "progress":
      return renderProgress(ctx, block);
    case "transaction":
      return renderTransaction(ctx, block);
    case "receipt":
      return renderReceipt(ctx, block);
    case "fuse":
      return renderFuse(ctx, block);
    case "pnl":
      return renderPnl(ctx, block);
    case "error":
      return renderError(ctx, block);
    case "evidence":
      return renderEvidence(ctx, block);
    default: {
      // Exhaustiveness guard: a new kind must be handled above.
      const _never: never = block;
      return [String(_never)];
    }
  }
}

/** Render a list of blocks, one after another. */
export function renderBlocks(ctx: OutputContext, blocks: ViewBlock[]): string[] {
  const out: string[] = [];
  for (const block of blocks) out.push(...renderBlock(ctx, block));
  return out;
}

const OSC = "\u001B]";
const BEL = "\u0007";

/**
 * A terminal hyperlink. In a color-capable HUMAN terminal, emits an OSC-8
 * sequence wrapping `text`; otherwise returns text with the URL appended so the
 * destination is never hidden. Never used in JSON/PLAIN.
 */
export function hyperlink(ctx: OutputContext, text: string, url: string): string {
  if (ctx.mode === "human" && ctx.color) {
    return `${OSC}8;;${url}${BEL}${ctx.theme.link(text)}${OSC}8;;${BEL}`;
  }
  return `${text} (${url})`;
}
