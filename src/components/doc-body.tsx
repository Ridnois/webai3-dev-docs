interface DocBodyProps {
  html: string;
}

export function DocBody({ html }: DocBodyProps) {
  return (
    <div
      className="prose w-full max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
