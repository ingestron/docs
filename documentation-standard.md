# Ingestron writing standard

## Voice

Write like a developer explaining a working tool to a colleague. Be specific,
calm and helpful. Use “you” for the reader and “Ingestron” for product behaviour.
Prefer active verbs and short, connected paragraphs. Avoid marketing superlatives,
ceremonial introductions, rhetorical questions and repetitive summaries.

Use task titles: “Generate your first project”, “Check generated files in CI”,
“Add a SQL Server source”. Avoid
internal architecture labels in navigation. Explain “pack” as what turns
definitions into files for a platform and “connector” as the kind of source a
connection reads before using these terms freely.

Examples:

- Prefer “Save your token in `.env`.” to “Configure the secure credential boundary.”
- Prefer “`ingestron apply` writes the files the plan listed.” to “The resolved
  generation artefacts are materialised.”
- Prefer “If `ingestron check` fails, run `ingestron apply` and commit the
  result.” to “Reconcile generated-file drift before re-enabling the CI gate.”
- Prefer “You should see two rows.” to “Verify successful attainment of the outcome.”

Do not promise “just”, “simply”, “seamless” or a completion time that was not tried.
Use estimates sparingly and explain any large download or manual review step.

## Page jobs

Each page should answer one primary need. A small site can combine related topics;
do not create empty sections to fit a template.

- **Overview:** what the product does, who it is for, one useful starting point.
- **Tutorial:** starting state, outcome, prerequisites, working files, ordered steps,
  expected results, recovery and cleanup. Explain choices while teaching the task.
- **How-to:** a focused procedure for a reader who already has a working project.
- **Concept:** explain one relationship or behaviour, with an example if useful.
- **Reference:** exact names, accepted values, defaults, limits and related guides.
- **Troubleshooting:** observable symptom, likely cause, safe check, corrective action.

Put current versions in a small release/support reference. Pin downloadable examples
for repeatability. Avoid making every page begin with the same preview paragraph.

## Examples and steps

Name the working directory. State whether commands are shell commands or file
contents. Copy-paste blocks must not include shell prompts. Use placeholder values
only when the user must supply them, and explain each one nearby. Avoid invented
commands and scaffolding that the installed product does not provide.

After a meaningful action, show the expected file, status or output. Use exact
output only when deterministic. Live-source row counts must be described as variable.
Keep secrets out of commands, tracked files and screenshots. Show secret references
and `.gitignore` entries where the reader creates credentials.

Use downloadable files as the source of truth. Test those files directly and derive
large inline snippets from them rather than maintaining a second version. Include
one safe recovery or rejection exercise when it teaches important behaviour.

## Navigation and review

Organise around tasks, not repositories. Keep “Start here” and the first working
example prominent. Put library API details in the package READMEs and link to them. Give each page a
useful next step without adding a generic concluding paragraph.

Check links, search, code overflow, keyboard focus, narrow layouts and heading order.
Remove stale screenshots, downloads, redirects and dependencies with the retired
content. When a page moves, redirect its old URL to the new page; when a feature
is removed, remove its pages rather than redirecting them to something unrelated.

Review each sentence: Does the reader need it here? Is the claim supported? Could
this be said more plainly? Does the example work with the published package?
