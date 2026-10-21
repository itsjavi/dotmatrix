// The composing guide compiles to a component with MDX.
declare module "*.md" {
  import type { MDXContent } from "mdx/types";
  const Content: MDXContent;
  export default Content;
}
