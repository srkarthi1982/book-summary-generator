/**
 * Book Summary Generator - store book metadata, chapters, and generated summaries.
 *
 * Design goals:
 * - Handle both full books and single-chapter/section uploads.
 * - Separate raw text (input) from generated summaries (output).
 * - Allow multiple summary versions (e.g. "short", "detailed", "bullet points").
 */

import { defineTable, column, NOW } from "astro:db";

export const Books = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    title: column.text(),
    author: column.text({ optional: true }),
    sourceType: column.text({ optional: true }),  // "manual", "upload", "url"
    sourceUrl: column.text({ optional: true }),
    language: column.text({ optional: true }),    // e.g. "en", "ta"
    notes: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const BookSections = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    bookId: column.text({
      references: () => Books.columns.id,
    }),
    sectionType: column.text({ optional: true }), // "chapter", "section", "appendix"
    orderIndex: column.number({ optional: true }),// chapter/section order
    title: column.text({ optional: true }),       // e.g. "Chapter 3 - Markets"
    rawText: column.text(),                       // original content to summarize
    createdAt: column.date({ default: NOW }),
  },
});

export const SectionSummaries = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sectionId: column.text({
      references: () => BookSections.columns.id,
    }),
    variant: column.text({ optional: true }),     // "short", "detailed", "bullets", "kids-friendly"
    language: column.text({ optional: true }),    // summary language
    summaryText: column.text(),
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Books,
  BookSections,
  SectionSummaries,
} as const;
