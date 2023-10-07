import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";

import * as Page from "~/pages/journal/[themeid]/posts";

export default Page.default;
export const getServerSideProps = Page.getServerSideProps;
