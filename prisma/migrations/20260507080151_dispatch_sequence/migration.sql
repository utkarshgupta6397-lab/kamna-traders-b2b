-- CreateTable
CREATE TABLE "DispatchSequence" (
    "date" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DispatchSequence_pkey" PRIMARY KEY ("date")
);
