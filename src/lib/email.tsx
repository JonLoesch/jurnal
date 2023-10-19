import React, {
  FC,
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
  createElement,
} from "react";
import { Resend } from "resend";
import { env } from "~/env.mjs";

import { Html } from "@react-email/html";
import { Text } from "@react-email/text";
import { Section } from "@react-email/section";
import { emailStyles } from "./emailStyles";

const resend = new Resend(env.RESEND_KEY);

const DevWrapper: FC<
  PropsWithChildren<{
    from: string;
    to: string;
  }>
> = (props) => {
  return (
    <Html>
      <Section style={emailStyles.paragraph}>
        <Text> This email has been redirected. Original headers: </Text>
        <Text> From: {props.from} </Text>
        <Text> To: {props.to} </Text>
      </Section>
      <Section style={emailStyles.main}>{props.children}</Section>
    </Html>
  );
};
const RealEmails: FC<PropsWithChildren> = (props) => {
  return (
    <Html>
      <Section style={emailStyles.main}>{props.children}</Section>
    </Html>
  );
};

// TODO change
const from = 'onboarding@resend.dev';

export async function sendEmail(props: {
  to: string;
  subject: string;
  react: ReactNode
}) {
  // const html = render(props.react);
  // const text = render(props.react, {
  //   plainText: true,
  // });
  if (env.REAL_EMAILS) {
    await resend.sendEmail({
      from,
      to: props.to,
      subject: props.subject,
      react: <RealEmails> {props.react} </RealEmails>,
    });
  } else {
    await resend.sendEmail({
      from: "onboarding@resend.dev",
      to: 'jonloesch@gmail.com',
      subject: `Redirected: ${props.subject}`,
      react: (
        <DevWrapper from={from} to={props.to}>
          {props.react}
        </DevWrapper>
      ),
    });
  }
}

// resend.emails.send({
//   from: 'onboarding@resend.dev',
//   to: 'jonloesch@gmail.com',
//   subject: 'Hello World',
//   html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
// });
