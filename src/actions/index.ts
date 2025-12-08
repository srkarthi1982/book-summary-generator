import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  BookSections,
  Books,
  SectionSummaries,
  and,
  db,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedBook(bookId: string, userId: string) {
  const [book] = await db
    .select()
    .from(Books)
    .where(and(eq(Books.id, bookId), eq(Books.userId, userId)));

  if (!book) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Book not found.",
    });
  }

  return book;
}

async function getOwnedSection(sectionId: string, bookId: string, userId: string) {
  await getOwnedBook(bookId, userId);

  const [section] = await db
    .select()
    .from(BookSections)
    .where(and(eq(BookSections.id, sectionId), eq(BookSections.bookId, bookId)));

  if (!section) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Section not found.",
    });
  }

  return section;
}

export const server = {
  createBook: defineAction({
    input: z.object({
      title: z.string().min(1),
      author: z.string().optional(),
      sourceType: z.string().optional(),
      sourceUrl: z.string().optional(),
      language: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [book] = await db
        .insert(Books)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          title: input.title,
          author: input.author,
          sourceType: input.sourceType,
          sourceUrl: input.sourceUrl,
          language: input.language,
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        success: true,
        data: { book },
      };
    },
  }),

  updateBook: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        author: z.string().optional(),
        sourceType: z.string().optional(),
        sourceUrl: z.string().optional(),
        language: z.string().optional(),
        notes: z.string().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.author !== undefined ||
          input.sourceType !== undefined ||
          input.sourceUrl !== undefined ||
          input.language !== undefined ||
          input.notes !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedBook(input.id, user.id);

      const [book] = await db
        .update(Books)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.author !== undefined ? { author: input.author } : {}),
          ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
          ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Books.id, input.id))
        .returning();

      return {
        success: true,
        data: { book },
      };
    },
  }),

  listBooks: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const books = await db
        .select()
        .from(Books)
        .where(eq(Books.userId, user.id));

      return {
        success: true,
        data: { items: books, total: books.length },
      };
    },
  }),

  createBookSection: defineAction({
    input: z.object({
      bookId: z.string().min(1),
      sectionType: z.string().optional(),
      orderIndex: z.number().int().optional(),
      title: z.string().optional(),
      rawText: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedBook(input.bookId, user.id);

      const [section] = await db
        .insert(BookSections)
        .values({
          id: crypto.randomUUID(),
          bookId: input.bookId,
          sectionType: input.sectionType,
          orderIndex: input.orderIndex ?? 1,
          title: input.title,
          rawText: input.rawText,
          createdAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: { section },
      };
    },
  }),

  updateBookSection: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        bookId: z.string().min(1),
        sectionType: z.string().optional(),
        orderIndex: z.number().int().optional(),
        title: z.string().optional(),
        rawText: z.string().optional(),
      })
      .refine(
        (input) =>
          input.sectionType !== undefined ||
          input.orderIndex !== undefined ||
          input.title !== undefined ||
          input.rawText !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSection(input.id, input.bookId, user.id);

      const [section] = await db
        .update(BookSections)
        .set({
          ...(input.sectionType !== undefined ? { sectionType: input.sectionType } : {}),
          ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.rawText !== undefined ? { rawText: input.rawText } : {}),
        })
        .where(eq(BookSections.id, input.id))
        .returning();

      return {
        success: true,
        data: { section },
      };
    },
  }),

  deleteBookSection: defineAction({
    input: z.object({
      id: z.string().min(1),
      bookId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSection(input.id, input.bookId, user.id);

      await db
        .delete(BookSections)
        .where(eq(BookSections.id, input.id));

      await db
        .delete(SectionSummaries)
        .where(eq(SectionSummaries.sectionId, input.id));

      return { success: true };
    },
  }),

  listBookSections: defineAction({
    input: z.object({
      bookId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedBook(input.bookId, user.id);

      const sections = await db
        .select()
        .from(BookSections)
        .where(eq(BookSections.bookId, input.bookId));

      return {
        success: true,
        data: { items: sections, total: sections.length },
      };
    },
  }),

  createSectionSummary: defineAction({
    input: z.object({
      sectionId: z.string().min(1),
      bookId: z.string().min(1),
      variant: z.string().optional(),
      language: z.string().optional(),
      summaryText: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSection(input.sectionId, input.bookId, user.id);

      const [summary] = await db
        .insert(SectionSummaries)
        .values({
          id: crypto.randomUUID(),
          sectionId: input.sectionId,
          variant: input.variant,
          language: input.language,
          summaryText: input.summaryText,
          createdAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: { summary },
      };
    },
  }),

  listSectionSummaries: defineAction({
    input: z.object({
      sectionId: z.string().min(1),
      bookId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSection(input.sectionId, input.bookId, user.id);

      const summaries = await db
        .select()
        .from(SectionSummaries)
        .where(eq(SectionSummaries.sectionId, input.sectionId));

      return {
        success: true,
        data: { items: summaries, total: summaries.length },
      };
    },
  }),
};
