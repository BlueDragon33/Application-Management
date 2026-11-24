import { calendarGroups, calendarForms } from "./calendar-content";

export type KnowledgeRelation = "form" | "previous" | "next" | "context";
export type KnowledgeLink = { id: string; relation: KnowledgeRelation };

// The existing calendar course remains the sole owner of vocabulary, IPA and examples.
// These links add explicit relationships, not a parallel curriculum or memory store.
const sequences: readonly (readonly string[])[] = [
  ["day-before", "yesterday", "today", "tomorrow", "day-after"],
  ...["day", "week", "season", "month"].map(category =>
    calendarGroups.filter(group => group.category === category).map(group => group.id)),
];
const contexts: readonly (readonly [string, string])[] = [
  ["today", "morning"], ["tomorrow", "morning"], ["yesterday", "evening"],
  ["wednesday", "morning"], ["monday", "morning"],
  ["winter", "dec"], ["winter", "jan"], ["winter", "feb"],
  ["spring", "mar"], ["spring", "apr"], ["spring", "may"],
  ["summer", "jun"], ["summer", "jul"], ["summer", "aug"],
  ["autumn", "sep"], ["autumn", "oct"], ["autumn", "nov"],
];

export function knowledgeLinks(id: string): KnowledgeLink[] {
  const form = calendarForms.find(item => item.id === id);
  if (!form) return [];
  const result: KnowledgeLink[] = [];
  const seen = new Set([id]);
  function add(target: string | undefined, relation: KnowledgeRelation) {
    if (!target || seen.has(target) || !calendarForms.some(item => item.id === target)) return;
    seen.add(target);
    result.push({ id: target, relation });
  }
  for (const sibling of form.group.forms) add(sibling.id, "form");
  const sequence = sequences.find(items => items.includes(form.group.id));
  if (sequence) {
    const position = sequence.indexOf(form.group.id);
    const cyclic = sequence !== sequences[0];
    const previous = position > 0 ? sequence[position - 1] : cyclic ? sequence.at(-1) : undefined;
    const next = position + 1 < sequence.length ? sequence[position + 1] : cyclic ? sequence[0] : undefined;
    add(calendarGroups.find(group => group.id === previous)?.forms[0].id, "previous");
    add(calendarGroups.find(group => group.id === next)?.forms[0].id, "next");
  }
  for (const [left, right] of contexts) {
    const other = left === form.group.id ? right : right === form.group.id ? left : undefined;
    if (other) add(calendarGroups.find(group => group.id === other)?.forms[0].id, "context");
  }
  return result;
}
