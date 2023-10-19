-- CreateTable
CREATE TABLE "EntrySubscription" (
    "entry_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "EntrySubscription_pkey" PRIMARY KEY ("entry_id","user_id")
);

-- CreateTable
CREATE TABLE "ThemeSubscription" (
    "theme_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "ThemeSubscription_pkey" PRIMARY KEY ("theme_id","user_id")
);

-- AddForeignKey
ALTER TABLE "EntrySubscription" ADD CONSTRAINT "EntrySubscription_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntrySubscription" ADD CONSTRAINT "EntrySubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeSubscription" ADD CONSTRAINT "ThemeSubscription_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeSubscription" ADD CONSTRAINT "ThemeSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
