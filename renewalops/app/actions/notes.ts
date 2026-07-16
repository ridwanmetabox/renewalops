"use server";

import { prisma } from "@/lib/prisma";

/* ============================================================
   ADD INTERNAL NOTE
   Creates a new note for a contract.
============================================================ */
export async function addInternalNote(data: {
  contractId: string;
  note: string;
  authorId?: string;
}) {
  return prisma.internalNote.create({
    data,
  });
}

/* ============================================================
   GET NOTES FOR A CONTRACT
   Returns all notes belonging to one contract.
============================================================ */
export async function getContractNotes(contractId: string) {
  return prisma.internalNote.findMany({
    where: {
      contractId,
    },
    include: {
      author: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/* ============================================================
   DELETE NOTE
   Deletes a note using its ID.
============================================================ */
export async function deleteNote(noteId: string) {
  return prisma.internalNote.delete({
    where: {
      id: noteId,
    },
  });
}