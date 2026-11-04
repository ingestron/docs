import type { ComponentProps } from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { KindBlock } from "@/components/code-block";
import type { BlockKind } from "@/lib/block-kind";
import { NamingVariables } from "@/components/reference/naming-variables";
import { DocLinks } from "@/components/doc-links";
import { MarkdownTable } from "@/components/table-frame";
import { BuildTree, Example, ExampleDownload, Request, Template } from "@/components/example";
import { FlowDiagram } from "@/components/flow-diagram";
import { OldAnchor } from "@/components/old-anchor";
import { Path, Paths } from "@/components/hub";
import { RouteComparison } from "@/components/reference/route-comparison";
import { RouteFacts } from "@/components/reference/route-facts";
import { RouteList } from "@/components/reference/route-list";
import { RouteTable } from "@/components/reference/route-table";
import { ProjectSources } from "@/components/reference/project-sources";
import { BuiltInTemplates } from "@/components/reference/built-in-templates";
import { CliCommands } from "@/components/reference/cli-commands";
import { ConnectorNote, ConnectorPage } from "@/components/reference/connector-page";
import { ContractTypes } from "@/components/reference/contract-types";
import { ContractUseTable } from "@/components/reference/contract-use";
import { PackCapabilities } from "@/components/reference/pack-capabilities";
import { DefaultLayers, PackNaming } from "@/components/reference/pack-defaults";
import { SamplesCatalogue } from "@/components/reference/samples-catalogue";
import { ContractFields, DocumentFields } from "@/components/reference/document-fields";
import { ErrorCodes, LoadingCodes } from "@/components/reference/error-codes";
import { ExtensionCommands } from "@/components/reference/extension-commands";
import { ExamplesList } from "@/components/reference/examples-list";
import { PackMethods } from "@/components/reference/pack-methods";
import { PlatformDefaults } from "@/components/reference/platform-defaults";
import { SettingsSections } from "@/components/reference/settings-sections";
import { SettingsTable } from "@/components/reference/settings-table";
import {
  DuckdbTested,
  ExtensionVersion,
  PackageVersions,
  PackNames,
  PlatformChecks,
} from "@/components/reference/versions";
import { Screenshot } from "@/components/screenshot";
import { Tool, ToolSteps } from "@/components/tool-steps";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    // Fumadocs' code block, saying what it holds (lib/block-kind.ts), and its
    // table, with their scrolling frames named (lib/rehype-frame-names.ts)
    // and, for a table, the frame doing the scrolling.
    pre: ({
      "data-frame-label": label,
      "data-kind": kind,
      icon: _icon,
      ...props
    }: Framed<"pre">) => (
      <KindBlock {...props} kind={kind} viewportProps={{ "aria-label": label }} />
    ),
    table: MarkdownTable,
    NamingVariables,
    DocLinks,
    Example,
    ExampleDownload,
    BuildTree,
    Request,
    Template,
    Screenshot,
    Tool,
    ToolSteps,
    SettingsTable,
    SettingsSections,
    PackMethods,
    ConnectorPage,
    ConnectorNote,
    ContractTypes,
    ContractUseTable,
    PackCapabilities,
    PlatformDefaults,
    PackNaming,
    DefaultLayers,
    SamplesCatalogue,
    ErrorCodes,
    LoadingCodes,
    DocumentFields,
    ContractFields,
    CliCommands,
    BuiltInTemplates,
    ProjectSources,
    FlowDiagram,
    OldAnchor,
    Path,
    Paths,
    RouteComparison,
    RouteFacts,
    RouteList,
    RouteTable,
    ExamplesList,
    ExtensionCommands,
    PackageVersions,
    PackNames,
    PlatformChecks,
    DuckdbTested,
    ExtensionVersion,
    ...components,
  } satisfies MDXComponents;
}
export const useMDXComponents = getMDXComponents;

/** An element's props, with the frame name rehypeFrameNames adds. */
type Framed<T extends "pre" | "table"> = ComponentProps<T> & {
  "data-frame-label"?: string;
  "data-kind"?: BlockKind;
  icon?: unknown;
};
declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
