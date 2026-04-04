import { format } from 'date-fns';
import React from 'react';
import { Components, TinaMarkdown, TinaMarkdownContent } from 'tinacms/dist/rich-text';
import Image from 'next/image';
import { Prism } from 'tinacms/dist/rich-text/prism';
import { Video, type VideoData } from './blocks/video';
import { Mermaid } from './blocks/mermaid';

export const components: Components<{
  BlockQuote: {
    children: TinaMarkdownContent;
    authorName: string;
  };
  DateTime: {
    format?: string;
  };
  NewsletterSignup: {
    placeholder: string;
    buttonText: string;
    children: TinaMarkdownContent;
    disclaimer?: TinaMarkdownContent;
  };
  video: VideoData;
}> = {
  code_block: (props) => {
    if (!props) {
      return <></>;
    }
    
    if (props.lang === 'mermaid') {
      return <Mermaid value={props.value} />
    }

    return <Prism lang={props.lang} value={props.value} />;
  },
  BlockQuote: (props: {
    children: TinaMarkdownContent;
    authorName: string;
  }) => {
    return (
      <div>
        <blockquote>
          <TinaMarkdown content={props.children} />
          {props.authorName}
        </blockquote>
      </div>
    );
  },
  DateTime: (props) => {
    const dt = React.useMemo(() => {
      return new Date();
    }, []);

    switch (props.format) {
      case 'iso':
        return <span>{format(dt, 'yyyy-MM-dd')}</span>;
      case 'utc':
        return <span>{format(dt, 'eee, dd MMM yyyy HH:mm:ss OOOO')}</span>;
      case 'local':
        return <span>{format(dt, 'P')}</span>;
      default:
        return <span>{format(dt, 'P')}</span>;
    }
  },
  NewsletterSignup: (props) => {
    return (
      <div style={{
        background: 'oklch(0.13 0.01 85)',
        border: '1px solid oklch(0.78 0.10 85 / 0.20)',
        borderRadius: '4px',
        padding: '1.75rem 1.5rem',
        margin: '1.5rem 0',
      }}>
        <div style={{ marginBottom: '1rem', color: 'oklch(0.88 0.01 85)' }}>
          <TinaMarkdown content={props.children} />
        </div>
        <form style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label htmlFor='email-address' style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            Email address
          </label>
          <input
            id='email-address'
            name='email-address'
            type='email'
            autoComplete='email'
            required
            style={{
              flex: '1 1 200px',
              padding: '0.6rem 0.9rem',
              background: 'oklch(0.09 0 0)',
              border: '1px solid oklch(0.78 0.10 85 / 0.25)',
              borderRadius: '3px',
              color: 'oklch(0.88 0.01 85)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              outline: 'none',
            }}
            placeholder={props.placeholder}
          />
          <button
            type='submit'
            style={{
              padding: '0.6rem 1.2rem',
              background: 'transparent',
              border: '1px solid oklch(0.78 0.10 85 / 0.40)',
              borderRadius: '3px',
              color: 'oklch(0.78 0.10 85)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {props.buttonText}
          </button>
        </form>
        {props.disclaimer && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'oklch(0.45 0 0)' }}>
            <TinaMarkdown content={props.disclaimer} />
          </div>
        )}
      </div>
    );
  },
  img: (props) => {
    if (!props) {
      return <></>;
    }
    return (
      <span className='flex items-center justify-center'>
        <Image src={props.url} alt={props.alt || ''} width={500} height={500} />
      </span>
    );
  },
  mermaid: (props: any) => <Mermaid {...props} />,
  video: (props) => {
    return <Video data={props} />;
  },
};
