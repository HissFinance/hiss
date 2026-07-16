// Ambient type augmentation so `@testing-library/jest-dom` matchers (e.g.
// toBeInTheDocument, toHaveTextContent) are typed inside vitest test files.
// Test-only; excluded from the published build.
import "@testing-library/jest-dom/vitest";
