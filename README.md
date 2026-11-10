# Pi dotfiles

## Install

Requires Pi (and its supported Node.js version), Bash, and `diff` on `PATH`.

```bash
./install.sh
```

The installer creates missing `settings.json` and `models.json` from the tracked
`*.example.json` templates, then symlinks them into `~/.pi/agent/` alongside the
shared extensions. Existing local files are never overwritten. The current
laptop's configuration and symlinks require no migration. If an existing config
in `~/.pi/agent/` differs from the repository's local working file, installation
stops rather than replacing it. Reconcile or copy that existing configuration to
the ignored repository file, then rerun the installer.

Only templates are versioned. Working `settings.json` and `models.json` files
are ignored by Git: device IDs, changelog versions, model choices, local package
paths, endpoints, and credentials stay on the machine. New working files have
owner-only permissions. Keep `auth.json` outside this repository as well.

## Review configuration changes

Every installation prints a unified diff from each template to the local file:
`-` is the template, `+` is the local configuration. JSON formatting and object
key order are normalized; array order is preserved. Differences are informational
and do not interrupt installation. Invalid/unreadable JSON or a failed diff does.

`apiKey`, `headers`, and `httpProxy` values are masked in the diff, including
nested model/provider fields. Changes only to masked values are not visible.
Other values are printed: do not embed credentials in URLs or arbitrary settings.

After pulling template changes, review the diff and manually copy the desired
changes into your ignored files. There is no automatic merge. Promote settings
you want on every machine to `settings.example.json`; never copy runtime state
or credentials into a template.

The package list in `settings.example.json` is also the installer's portable
package list. Local-only packages can still be installed with `pi install`;
they are stored in the ignored settings file. The installer retains them.

## Local models and credentials

`models.example.json` starts with no custom providers. Configure a laptop's
endpoints and models in `models.json`, and choose its provider/model in
`settings.json`. Prefer environment references such as `"apiKey": "$HAI_API_KEY"`
over literal secrets when practical. Use Pi's `/login` for built-in providers.

## Tests

```bash
node --test tests/install.test.mjs extensions/save-plan-dir/paths.test.ts
bash -n install.sh
```

Installer tests use temporary home/repository directories and stub networked
`pi` and `npx` commands. They do not change the real Pi installation.
