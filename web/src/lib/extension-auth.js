const EXT_AUTH_QUERY_PARAM = "memit_ext_auth";

/** @param {string} href */
export function isExtensionAuthFlowHref(href) {
  try {
    return new URL(href).searchParams.get(EXT_AUTH_QUERY_PARAM) === "1";
  } catch {
    return false;
  }
}

/** @param {string} baseHref @param {boolean} isExtensionFlow */
export function buildRedirectHref(baseHref, isExtensionFlow) {
  if (!isExtensionFlow) return baseHref;
  try {
    const url = new URL(baseHref);
    url.searchParams.set(EXT_AUTH_QUERY_PARAM, "1");
    return url.toString();
  } catch {
    return baseHref;
  }
}
