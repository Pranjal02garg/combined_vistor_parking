import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "ap-south-1" });

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL ?? "no-reply@campus.edu",
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Html: { Data: html, Charset: "UTF-8" } },
      },
    })
  );
}
