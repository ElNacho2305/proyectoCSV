-- CreateTable
CREATE TABLE "Student" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "year" INTEGER,
    "studyIntensity" INTEGER NOT NULL,
    "sleepProblems" INTEGER NOT NULL,
    "headaches" INTEGER NOT NULL,
    "socialPressure" INTEGER NOT NULL,
    "anxiety" INTEGER NOT NULL,
    "gpa" REAL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_fingerprint_key" ON "Student"("fingerprint");
