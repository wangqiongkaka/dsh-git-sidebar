/**
 * The one file-type rule shared by the host route and the change row's menu:
 * an HTML document is what the operating system hands to a browser, so the
 * panel offers "open in browser" for exactly the paths the host accepts.
 * The client must not offer an action the host would refuse, and the host must
 * not launch a document the panel never shows, so both sides read this module.
 */

/** Suffixes of the documents the host opens in the default browser. */
const BROWSER_DOCUMENT_SUFFIXES = ['.html', '.htm']

/**
 * Whether a git-reported path names an HTML document.
 * @param path - a repository-relative or absolute path from `git status`.
 * @returns true when the final name ends in .html/.htm, in any case.
 */
export function isBrowserDocument(path: string): boolean {
  const name = path.replace(/\\/g, '/').toLowerCase()
  return BROWSER_DOCUMENT_SUFFIXES.some(suffix => name.endsWith(suffix))
}
