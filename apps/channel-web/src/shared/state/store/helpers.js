import { boardTabs, feedFilterChoices } from "../../../entities/channel/config.js";
import { defaultAnonymousProfiles } from "../../../entities/identity/config.js";

export const firstBoard = boardTabs[0]?.value || "all";
export const firstFilter = feedFilterChoices[0]?.value || "hot";
export const firstAliasKey = defaultAnonymousProfiles[0]?.key || null;

export const cloneSimple = (value) => (value ? { ...value } : value);
