declare module 'resend' {
  export interface EmailSendOptions {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    tags?: Array<{ name: string; value: string }>;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
    }>;
  }

  export interface EmailSendResponse {
    data?: {
      id: string;
    };
    error?: Error | null;
  }

  export class Resend {
    constructor(apiKey?: string);

    emails: {
      send(options: EmailSendOptions): Promise<EmailSendResponse>;
    };
  }
}