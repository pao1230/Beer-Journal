import { translate } from "@/lib/i18n/core";

type Vars = Record<string, string | number>;

/** An error meant for the person using the app: `key` is the English text, translated when shown. */
export class UserError extends Error {
  constructor(
    readonly key: string,
    readonly vars?: Vars,
  ) {
    super(translate("en", key, vars));
    this.name = "UserError";
  }
}
