import { format, parse } from "date-fns"
import { formatInTimeZone } from "date-fns-tz";

export type ZonelessDate = {
    zoneless: string
}
export const Zoneless = {
    fromDate(d: Date): ZonelessDate {
        return {
            zoneless: formatInTimeZone(d, 'UTC', 'y-M-d')
        };
    },
    toDate(z: ZonelessDate): Date {
        return parse(z.zoneless, 'y-M-d', new Date());
    },
}