import { memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [[rehypeKatex, { trust: false, strict: 'ignore' }]];

export default memo(function MarkdownAnswer({ text }) {
  return (
    <div className="answer-text">
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {text}
      </Markdown>
    </div>
  );
});
