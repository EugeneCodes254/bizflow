/*
  Warnings:

  - A unique constraint covering the columns `[businessId,reference]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Payment_businessId_reference_key" ON "Payment"("businessId", "reference");
