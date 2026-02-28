import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";

const navbar = (
  <Navbar
    logo={<span style={{ fontWeight: 700 }}>fun-ai-agent Docs</span>}
    projectLink="https://github.com/fun-ai-agent/fun-ai-agent"
  />
);

const footer = <Footer>{new Date().getFullYear()} © fun-ai-agent</Footer>;

export default async function DocsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pageMap = await getPageMap();

  return (
    <>
      <Head />
      <Layout
        navbar={navbar}
        pageMap={pageMap}
        footer={footer}
        docsRepositoryBase="https://github.com/fun-ai-agent/fun-ai-agent/tree/main/fun-ai-agent"
        editLink={null}
        feedback={{ content: null }}
        sidebar={{
          defaultMenuCollapseLevel: 1,
          autoCollapse: true,
        }}
        toc={{
          backToTop: "Back to top",
        }}
      >
        {children}
      </Layout>
    </>
  );
}
