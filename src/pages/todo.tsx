import { FC } from "react";

const Page: FC = () => {
    return <ul className="list-disc pl-10">
        <li className="line-through">Prism Schema</li>
        <li className="line-through">Data over TRPC</li>
        <li>Prism production migrations</li>
        <li>Guidlines for values in metrics</li>
        <li>Entries with optional post content</li>
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