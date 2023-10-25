import { format, parse } from "date-fns"
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";

export type ZonelessDate = {
    zoneless: string
}
export const Zoneless = {
    zod: z.object({
        zoneless: z.string().regex(/\d+-\d+-\d+/),
    }).transform<ZonelessDate>(x => x),
    fromDate(d: Date): ZonelessDate {
        return {
            // zoneless: formatInTimeZone(d, 'UTC', 'y-M-d')
            zoneless: format(d, 'y-M-d')
        };
    },
    toDate(z: ZonelessDate): Date {
        return parse(z.zoneless, 'y-M-d', new Date());
    },
}