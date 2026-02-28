import { useMDXComponents as getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { generateStaticParamsFor, importPage } from "nextra/pages";

type DocsPageProps = {
  params: Promise<{
    mdxPath?: string[];
  }>;
};

export const generateStaticParams = generateStaticParamsFor("mdxPath");

export async function generateMetadata(props: DocsPageProps): Promise<Metadata> {
  const { mdxPath = [] } = await props.params;
  const { metadata } = await importPage(mdxPath);
  return metadata;
}

export default async function DocsPage(props: DocsPageProps) {
  const { mdxPath = [] } = await props.params;
  const { default: MDXContent, metadata, toc, sourceCode } = await importPage(mdxPath);
  const Wrapper = getMDXComponents().wrapper;

  return (
    <Wrapper metadata={metadata} toc={toc} sourceCode={sourceCode}>
      <MDXContent {...props} params={{ mdxPath }} />
    </Wrapper>
  );
}
