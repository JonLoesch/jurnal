import { cronjob } from "~/lib/cronjob";
import { db } from "~/server/db"

export default cronjob(async () => {
    for (const j of await db.theme.findMany()) {
        console.log(j);
    }
    return {
        cronSuccess: true,
    }
})