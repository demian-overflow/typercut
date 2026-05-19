import { Fragment } from 'react';
import type { Essay, EssayBlock, InlineNode } from '../../fixtures/scheduler-essay';
import './EssayArticle.css';

interface EssayArticleProps {
  essay: Essay;
}

export default function EssayArticle({ essay }: EssayArticleProps) {
  return (
    <article className="essay-article">
      <div className="essay-eyebrow">
        Essay {essay.number} · {essay.course.title}
      </div>
      <h1 className="essay-h1">
        {essay.title.main}
        {essay.title.em && (
          <>
            <br />
            <em>{essay.title.em}</em>
          </>
        )}
      </h1>
      <p className="essay-deck">{essay.deck}</p>
      <div className="essay-byline">
        <span className="by">{essay.author.name}</span>
        <span className="when">— published {essay.publishedAt}</span>
      </div>
      <div className="essay-prose">
        {essay.blocks.map((block, i) => renderBlock(block, i))}
      </div>
    </article>
  );
}

function renderBlock(block: EssayBlock, key: number) {
  switch (block.kind) {
    case 'p':
      return (
        <p key={key} id={block.anchor}>
          {block.content.map((node, i) => renderInline(node, i))}
        </p>
      );
    case 'h3':
      return <h3 key={key}>{block.text}</h3>;
    case 'code':
      return (
        <pre key={key} className="essay-code">
          <code>{block.text}</code>
        </pre>
      );
    case 'pullquote':
      return (
        <div key={key} className="essay-pullquote">
          {block.text}
        </div>
      );
  }
}

function renderInline(node: InlineNode, key: number) {
  if (typeof node === 'string') return <Fragment key={key}>{node}</Fragment>;
  switch (node.kind) {
    case 'b':
      return <b key={key}>{node.text}</b>;
    case 'em':
      return <em key={key}>{node.text}</em>;
    case 'code':
      return <code key={key}>{node.text}</code>;
    case 'hl':
      return <span key={key} className="essay-highlight">{node.text}</span>;
  }
}
