// jest-dom's matchers (toBeInTheDocument, toHaveAttribute, …), typed for Vitest.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `globals: false`, so Testing Library cannot register its own auto-cleanup:
// without this, renders pile up in document.body across tests.
afterEach(cleanup);

// Deliberately nothing else.
//
// The unit project's setup stubs matchMedia and emulates <dialog>'s methods,
// because jsdom ships neither. Here both are real, and stubbing either would
// defeat the only reason these tests run in a browser at all: a stubbed
// matchMedia would freeze the container query behind the mobile seam, and a
// polyfilled <dialog> would put us back to asserting our own emulation.
