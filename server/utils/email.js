import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, text }) => {
  try {
    // We use ethereal email for testing purposes
    // It creates a test account on the fly and logs the preview URL
    let testAccount = await nodemailer.createTestAccount();
    
    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });

    let info = await transporter.sendMail({
      from: '"ResearchHub Communities" <no-reply@researchhub.local>',
      to: to,
      subject: subject,
      text: text,
    });

    console.log("Email sent to %s. Message ID: %s", to, info.messageId);
    console.log("Email Preview URL: %s", nodemailer.getTestMessageUrl(info));
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
};
