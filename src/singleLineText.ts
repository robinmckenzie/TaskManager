/**
 * Turns every line break in `text` into a space, so that a title typed into a
 * text area still behaves as a single line. A Windows-style break (CR LF) is
 * one space, not two. Other spacing is left alone.
 *
 * The Unicode line and paragraph separators (categories Zl and Zp) count as
 * line breaks too.
 */
export const toSingleLine = (text: string): string => text.replace(/\r\n|[\r\n]|\p{Zl}|\p{Zp}/gu, " ")
