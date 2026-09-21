# Apps Script automatic deployment

The production Drive bridge source lives in `google-apps-script/Code.gs`.

GitHub Actions can push that source to the existing Google Apps Script project and update the current web-app deployment. The workflow is `.github/workflows/apps-script-deploy.yml`.

## One-time setup

Two GitHub Actions repository secrets are required:

- `APPS_SCRIPT_ID`: the **Script ID** of the new `Insulog APS - Drive Bridge` Apps Script project. In Apps Script, open **Project Settings** and copy **Script ID**.
- `CLASPRC_JSON`: the complete JSON from the Google account authorized with clasp. This file contains OAuth refresh credentials and must be stored only as a GitHub secret.

To create `CLASPRC_JSON` on a trusted local computer:

1. Enable the Apps Script API for the Google account at Apps Script user settings.
2. Install clasp: `npm install -g @google/clasp@3.4.1`.
3. Run `clasp login` and authorize the Google account that owns the bridge.
4. Copy the complete contents of `~/.clasprc.json` into the GitHub secret `CLASPRC_JSON`.

Never commit `.clasprc.json`, an OAuth client secret, access token, or refresh token.

## Deployment behavior

When `google-apps-script/**` changes on `main`, the workflow:

1. creates a temporary `.clasp.json` targeting `APPS_SCRIPT_ID`;
2. pushes `Code.gs` and `appsscript.json`;
3. updates the existing web-app deployment
   `AKfycbx203QzIWqGmeTh_p1XjjmADWBuu_L3RJmUoV9A1fk12_OEtnhkSLq62bgup0ERe3IlBw`;
4. calls the production `/exec` endpoint and confirms its bridge/schema versions match GitHub.

The same workflow can be run manually with **Actions → Deploy Apps Script bridge → Run workflow**.

If either secret is missing, the deploy job is skipped and a configuration notice is emitted instead.
