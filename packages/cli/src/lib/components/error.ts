/**
 * ERROR (task §15): code · concise message · component · safe context · likely
 * next action · whether anything was submitted · whether funds were affected ·
 * doc command. Rendered as an error panel. For HISS the submitted/funds lines
 * are reassuring by construction (read-and-prepare only).
 */

import type { OutputContext } from "../context.js";
import { renderPanel } from "./panel.js";

export interface ErrorProps {
  code: string;
  message: string;
  component?: string;
  context?: string;
  nextAction?: string;
  submitted?: boolean;
  fundsAffected?: boolean;
  docCommand?: string;
}

export function renderError(ctx: OutputContext, props: ErrorProps): string[] {
  const s = ctx.symbols;
  const lines: string[] = [ctx.redact(props.message)];
  if (props.component) lines.push(ctx.theme.muted(`component: ${props.component}`));
  if (props.context) lines.push(ctx.theme.muted(`context: ${ctx.redact(props.context)}`));

  // Safety facts — always stated explicitly.
  const submitted = props.submitted === true;
  const funds = props.fundsAffected === true;
  lines.push(
    `${s(submitted ? "warn" : "ok")} ${submitted ? "A transaction was submitted." : "No transaction was submitted."}`,
  );
  lines.push(`${s(funds ? "warn" : "ok")} ${funds ? "Funds may be affected." : "No funds were affected."}`);

  if (props.nextAction) lines.push(`${s("arrow")} ${ctx.redact(props.nextAction)}`);
  if (props.docCommand) lines.push(ctx.theme.muted(`docs: ${props.docCommand}`));

  return renderPanel(ctx, { variant: "error", title: `ERROR ${props.code}`, lines });
}
