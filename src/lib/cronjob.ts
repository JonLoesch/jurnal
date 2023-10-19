import { NextApiHandler } from "next";
import { NextRequest, NextResponse } from "next/server";

export type CronReturn = {
    cronSuccess: boolean
}

const failure: CronReturn = {
    cronSuccess: false
};

export function cronjob(handler: () => Promise<CronReturn> | CronReturn): NextApiHandler<CronReturn> {
    return async (request, response) => {
        const authHeader = request.headers.authorization;
        // https://vercel.com/docs/cron-jobs/manage-cron-jobs
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            response.status(401).json(failure);
            return;
        } else {
            const result = await handler();
            response.status(result.cronSuccess ? 200 : 500).json(result);
            return;
        }
    }
}