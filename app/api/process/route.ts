import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CaptionPayload = {
  caption: string;
  hashtags?: string[];
};

const parseCaption = (raw: string): CaptionPayload => {
  try {
    const data = JSON.parse(raw) as CaptionPayload;
    if (!data.caption) {
      throw new Error('Missing caption field.');
    }
    return data;
  } catch (error) {
    return {
      caption: raw.trim()
    };
  }
};

const buildTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Missing SMTP configuration. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
};

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }
  return new OpenAI({ apiKey });
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const email = formData.get('email');
    const prompt = formData.get('prompt');
    const photo = formData.get('photo');

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    if (typeof prompt !== 'string' || prompt.trim().length < 20) {
      return NextResponse.json({ error: 'Please include a detailed campaign brief (min 20 chars).' }, { status: 400 });
    }

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: 'A reference photo is required.' }, { status: 400 });
    }

    if (photo.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Please upload an image smaller than 8MB.' }, { status: 400 });
    }

    const imageArrayBuffer = await photo.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    const thumbnailBuffer = await sharp(imageBuffer)
      .resize({
        width: 720,
        height: 720,
        fit: 'cover',
        position: 'attention'
      })
      .jpeg({ quality: 82 })
      .toBuffer();

    const aiResponse = await getOpenAIClient().responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You generate viral social media captions. Respond only with JSON in the shape { "caption": string, "hashtags": string[] }.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Craft a concise, energetic caption suitable for Instagram or TikTok. Keep it under 220 characters. Include hook, brand tone, and CTA. Campaign brief: ${prompt}`
            }
          ]
        }
      ]
    });

    const parsed = parseCaption(aiResponse.output_text);
    const hashtags = parsed.hashtags?.slice(0, 6) ?? [];
    const decoratedCaption =
      parsed.caption.trim() + (hashtags.length ? `\n\n${hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ')}` : '');

    const transport = buildTransport();
    const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? 'no-reply@example.com';

    const mailInfo = await transport.sendMail({
      from,
      to: email,
      subject: 'Your AI Content Pack',
      text: [
        'Here is your AI-crafted content pack:',
        '',
        `Caption: ${decoratedCaption}`,
        '',
        'The thumbnail is attached to this email.',
        '',
        '— Creator AI'
      ].join('\n'),
      html: `
        <div style="font-family:Inter,Arial,sans-serif;padding:16px;background:#0f172a;color:#e2e8f0;">
          <h1 style="margin-bottom:16px;">Your AI Content Pack</h1>
          <p style="line-height:1.6;white-space:pre-wrap;">${decoratedCaption}</p>
          <p style="margin-top:24px;">Thumbnail attached as <strong>thumbnail.jpg</strong>.</p>
          <p style="margin-top:32px;color:#94a3b8;">Sent automatically by Creator AI.</p>
        </div>
      `,
      attachments: [
        {
          filename: 'thumbnail.jpg',
          content: thumbnailBuffer,
          contentType: 'image/jpeg'
        }
      ]
    });

    const thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;

    return NextResponse.json({
      caption: decoratedCaption,
      thumbnailDataUrl,
      emailId: mailInfo.messageId
    });
  } catch (error) {
    console.error('[process-agent] error', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected server error.'
      },
      { status: 500 }
    );
  }
}
