import { Html } from "@react-email/html";
import { Text } from "@react-email/text";
import { Section } from "@react-email/section";
import { Container } from "@react-email/container";
import { emailStyles } from "../lib/emailStyles";
import { ZonelessDate } from "../lib/ZonelessDate";
import { Link } from "@react-email/link";
import { PropsWithChildren } from "react";
import { Prisma } from "@prisma/client";
import { EmailLink } from "~/lib/urls";

export default function NewPost(props: {
  post: Prisma.EntryGetPayload<{
    include: {
      theme: {
        include: {
          owner: true;
        };
      };
    };
  }>;
}) {
  const name = props.post.theme.owner.name;
  return (
    <Html>
      <Section style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Text style={emailStyles.heading}>
            {name ? `${name}'s ` : ""}Jurnal Update
          </Text>
          <Text style={emailStyles.paragraph}>
            Your friend {name} wrote a new jurnal entry. You can view it online{" "}
            <EmailLink page="viewPost" postid={props.post.id}>
              here
            </EmailLink>
            . (I want it to also be directly viewable from this email but
            that&apos;s not working yet)
          </Text>
        </Container>
      </Section>
    </Html>
  );
}
