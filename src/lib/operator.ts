/**
 * Operator actions (deleting a note, adding a part) are gated by a shared PIN
 * in the OPERATOR_PIN env var, checked on the server. The app has no accounts;
 * this is the honest stand-in, not a login system. The browser sends the PIN
 * in this header.
 */
export const OPERATOR_PIN_HEADER = "x-operator-pin";
