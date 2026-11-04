import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { NamingVariables } from "@/components/reference/naming-variables";
import { DocLinks } from "@/components/doc-links";
import { Example, ExampleDownload } from "@/components/example";
import { FlowDiagram } from "@/components/flow-diagram";
import { Path, Paths } from "@/components/hub";
import { RouteComparison } from "@/components/reference/route-comparison";
import { RouteFacts } from "@/components/reference/route-facts";
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
import { SettingsSections } from "@/components/reference/settings-sections";
import { SettingsTable } from "@/components/reference/settings-table";
import {
  DuckdbTested,
  PackageVersions,
  PackNames,
  PlatformChecks,
} from "@/components/reference/versions";
import { Tool, ToolSteps } from "@/components/tool-steps";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    NamingVariables,
    DocLinks,
    Example,
    ExampleDownload,
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
    Path,
    Paths,
    RouteComparison,
    RouteFacts,
    RouteTable,
    ExamplesList,
    ExtensionCommands,
    PackageVersions,
    PackNames,
    PlatformChecks,
    DuckdbTested,
    ...components,
  } satisfies MDXComponents;
}
export const useMDXComponents = getMDXComponents;
declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
