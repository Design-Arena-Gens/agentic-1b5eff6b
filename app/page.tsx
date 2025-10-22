/* eslint-disable @next/next/no-img-element */
'use client';

import { FormEvent, useMemo, useState } from 'react';

type AgentResult = {
  caption: string;
  thumbnailDataUrl: string;
  emailId: string;
};

export default function HomePage() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canSubmit = useMemo(() => status !== 'processing', [status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('processing');
    setError(null);
    setResult(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Unexpected error while processing request.');
      }

      const payload = (await response.json()) as AgentResult;
      setResult(payload);
      setStatus('done');
      form.reset();
      setPreviewUrl(null);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to run agent. Please try again.');
    }
  };

  return (
    <main className="page">
      <section className="panel">
        <header>
          <h1>Creator&apos;s AI Assistant</h1>
          <p>
            Drop your context and visuals below. The agent crafts a compelling caption, builds a distribution-ready
            thumbnail, and emails the package automatically.
          </p>
        </header>

        <form className="form" onSubmit={onSubmit}>
          <label>
            Your email
            <input name="email" type="email" placeholder="you@example.com" required disabled={!canSubmit} />
          </label>

          <label>
            Campaign brief
            <textarea
              name="prompt"
              placeholder="Describe the message, mood, and target audience..."
              minLength={20}
              rows={5}
              required
              disabled={!canSubmit}
            />
          </label>

          <label className="file-picker">
            Reference photo
            <input
              name="photo"
              type="file"
              accept="image/*"
              required
              disabled={!canSubmit}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setPreviewUrl(url);
                } else {
                  setPreviewUrl(null);
                }
              }}
            />
          </label>

          {previewUrl ? (
            <div className="preview">
              <span>Preview</span>
              <img src={previewUrl} alt="User selected preview" />
            </div>
          ) : null}

          <button type="submit" disabled={!canSubmit}>
            {status === 'processing' ? 'Working...' : 'Launch Agent'}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}

        {result ? (
          <article className="result">
            <h2>Delivered Package</h2>
            <img src={result.thumbnailDataUrl} alt="Generated thumbnail" />
            <div className="caption">
              <h3>Caption</h3>
              <p>{result.caption}</p>
            </div>
            <p className="meta">Email ID: {result.emailId}</p>
          </article>
        ) : null}
      </section>
    </main>
  );
}
