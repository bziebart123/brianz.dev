const version = typeof __TFTDUOS_VERSION__ === "string" ? __TFTDUOS_VERSION__ : "0.0";
const notes =
  typeof __TFTDUOS_RELEASE_NOTES__ !== "undefined" && Array.isArray(__TFTDUOS_RELEASE_NOTES__)
    ? __TFTDUOS_RELEASE_NOTES__
    : [];

export const RELEASE_VERSION = version;
export const RELEASE_NOTES = notes;
