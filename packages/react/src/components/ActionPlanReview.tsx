import type { ActionPlan } from "../types";

export type ActionPlanReviewProps = {
  plan: ActionPlan | null;
  /** Validation errors when the plan could not be built. */
  errors?: string[];
  className?: string;
};

/**
 * Renders an {@link ActionPlan} for review. It always makes explicit that the
 * plan is unsigned and unexecuted — this library never sends transactions. If
 * `plan` is null, it shows the validation errors instead.
 */
export function ActionPlanReview({ plan, errors = [], className }: ActionPlanReviewProps) {
  if (!plan) {
    return (
      <div className={["hiss-card", className].filter(Boolean).join(" ")} role="alert">
        <strong>Plan not ready</strong>
        {errors.length > 0 ? (
          <ul>
            {errors.map((e, i) => (
              <li key={i} className="hiss-muted">
                {e}
              </li>
            ))}
          </ul>
        ) : (
          <span className="hiss-muted">Provide valid inputs to build a plan.</span>
        )}
      </div>
    );
  }
  return (
    <div className={["hiss-card", className].filter(Boolean).join(" ")}>
      <div className="hiss-row" style={{ justifyContent: "space-between" }}>
        <strong>{plan.title}</strong>
        <span className="hiss-plan__flag">Unsigned · not executed</span>
      </div>
      <ol
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {plan.steps.map((step, i) => (
          <li className="hiss-plan__step" key={i}>
            <div>{step.summary}</div>
            <div className="hiss-plan__note hiss-mono">
              chain {step.chainId}
              {step.to ? ` · to ${step.to}` : ""}
              {step.value && step.value !== "0" ? ` · value ${step.value} wei` : ""}
            </div>
          </li>
        ))}
      </ol>
      {plan.notes.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: "1.1em" }}>
          {plan.notes.map((n, i) => (
            <li key={i} className="hiss-plan__note">
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="hiss-plan__note">
        Requires your signature in your own wallet to take effect. This library does not sign or broadcast.
      </p>
    </div>
  );
}
