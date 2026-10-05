# Loane public legal pages

These files are ready to copy to the separately hosted `joinloane.com` site.
They are not deployed from this repo.

## Files

- `terms.html` should be served at `/terms`
- `privacy.html` should be served at `/privacy`
- `legal.js` loads the latest published document from Firestore
- `style.css` is the shared page styling

## Simplest way to publish

Copy all four files into the current `joinloane.com` site's static/public
folder, then configure routes so:

- `/terms` serves `terms.html`
- `/privacy` serves `privacy.html`

The pages use the public Firebase web config for `loane-code` and read from
the public `legalDocs` collection. They update automatically when a new legal
version is published from the admin panel.
