import { FC } from "react";

const Page: FC = () => {
    return <ul className="list-disc pl-10">
        <li className="line-through">Prism Schema</li>
        <li className="line-through">Data over TRPC</li>
        <li className="line-through">Prism production migrations</li>
        <li className="line-through">Logins (NextAuth?)</li>
        <li className="line-through">Post Create/Edit UI</li>
        <li>Prisma production data</li>
        <li>Guidelines for values in metrics</li>
        <li className="line-through">Entries with optional post content</li>
        <li>All posts -{"> \"Timeline\""} </li>
        <li>Notifications</li>
        <li>Multiple Journalers</li>
        <li>Todo items</li>
        <li>Goals</li>
        <li>Themes</li>
        <li>Followers / Privacy</li>
        <li>Conversations</li>
    </ul>
}

export default Page;