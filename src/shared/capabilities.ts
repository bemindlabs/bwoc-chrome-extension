// Pure capability gating for the palette. bwocd is the real enforcer (403 on a missing
// cap); this only decides what the UI lets the user attempt. `read` is implicit for
// every enrolled controller, mirroring bwocd's `/cli` gate.

import type { Capability } from "./types";
import type { Verb } from "./verbs";

export function hasCapability(caps: readonly string[], needed: string): boolean {
  return needed === "read" || caps.includes(needed);
}

export function isVerbEnabled(verb: Verb, caps: readonly Capability[] | readonly string[]): boolean {
  return hasCapability(caps, verb.capability);
}

/** Why a verb is disabled, or null when it can be used. */
export function disabledReason(verb: Verb, caps: readonly string[]): string | null {
  return hasCapability(caps, verb.capability)
    ? null
    : `Needs the \`${verb.capability}\` capability — ask the operator to grant it to this controller.`;
}

/** Mutations must always be confirmed before they run; reads never are. */
export function requiresConfirm(verb: Verb): boolean {
  return verb.kind === "mutation";
}
