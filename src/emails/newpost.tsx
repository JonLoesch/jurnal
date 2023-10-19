import { Html } from "@react-email/html";
import { Text } from "@react-email/text";
import { Section } from "@react-email/section";
import { Container } from "@react-email/container";
import { emailStyles } from "../lib/emailStyles";
import { ZonelessDate } from "../lib/ZonelessDate";
import { Link } from "@react-email/link";

export default function NewPost(props: {
  absoluteURL: string,
  postContent: string,
  date: ZonelessDate
  author: string,
}) {
  return (
    <Html>
      <Section style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Text style={emailStyles.heading}>{props.author}&apos;s Jurnal Update</Text>
          <Text style={emailStyles.paragraph}>Your friend {props.author} wrote a new jurnal entry.  You can view it online <Link href={props.absoluteURL}>here</Link> or below:</Text>
          {props.postContent}
        </Container>
      </Section>
    </Html>
  );
}