-- CreateEnum
CREATE TYPE "FolderTier" AS ENUM ('ADVANCED', 'INTERMEDIATE', 'FUNDAMENTALS');

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "tierOverride" "FolderTier";
