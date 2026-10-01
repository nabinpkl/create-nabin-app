# Releasing to npm

create-nabin-app publishes as the unscoped public package `create-nabin-app`, which is what
makes `pnpm create nabin-app` and `npm create nabin-app` work. Releases after the first
come from [.github/workflows/release.yml](../.github/workflows/release.yml) through npm
trusted publishing: GitHub Actions proves its identity to npm over OIDC, so no npm token
exists to leak, expire, or lose.

## One-time setup

1. **npm account.** Create one at npmjs.com. Turn on two-factor authentication with a
   passkey or security key, and register a second method (another key or an authenticator
   app) as a spare. Save the recovery codes in your password manager. Link your GitHub
   account in npm settings; support uses it to verify you if you are ever locked out.
2. **First publish, by hand.** npm only lets you configure trusted publishing on a package
   that already exists, so version 0.1.0 goes out from your machine:

   ```sh
   npm login                    # browser login, asks for 2FA
   just check
   npm publish --access public  # prepack builds dist/ first; asks for 2FA
   npm view create-nabin-app    # confirm it is live
   ```

3. **Trusted publisher.** On npmjs.com, open the package, then Settings, then Trusted
   publishing. Choose GitHub Actions and enter owner `nabinpkl`, repository
   `create-nabin-app`, workflow `release.yml`, no environment.
4. **Lock it down.** In the same settings page, under Publishing access, choose "Require
   two-factor authentication and disallow tokens". From then on only the workflow, or you
   with 2FA, can publish.

## Every release after that

```sh
just check && just e2e              # e2e covers templates and versions; needs network
npm version patch                   # or minor/major: bumps package.json, commits, tags vX.Y.Z
git push --follow-tags
```

The workflow checks that the tag matches `package.json`, runs `just check`, and publishes.
A failed run publishes nothing; fix the problem, delete the tag, and tag again.

## When something goes wrong

- **Lost 2FA device, recovery codes saved:** log in with a code. npm puts a 72-hour hold
  on the account, during which you can add a new 2FA method but cannot publish. Releases
  from the workflow still need the trusted publisher, which stays configured.
- **Lost 2FA device, no recovery codes:** "Use a recovery code or request a reset" on the
  2FA page, then "Try recovering your account", then a support ticket. A linked GitHub
  account speeds this up. Expect days, not minutes.
- **A token leaked:** there should be none. If you made one for an emergency, revoke it at
  npmjs.com under Access Tokens. Only make granular, short-lived tokens scoped to this
  package.
- **A bad version shipped:** publish a fixed patch and `npm deprecate create-nabin-app@<bad>
  "<reason>"`. Unpublishing is only allowed within 72 hours when nothing depends on the
  package, and a published version number can never be reused.
- **GitHub repo renamed or moved:** update the trusted publisher on npmjs.com, or the
  workflow's publish is rejected.

## Provenance

npm attaches provenance (a public link from each version to the commit and workflow run
that built it) only when the source repository is public. While this repo is private,
releases publish without it. Making the repository public later adds it automatically,
with no workflow change.

Sources: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (updated
2026-09-30), [unpublish policy](https://docs.npmjs.com/policies/unpublish) (no date
verifiable), [2FA recovery](https://docs.npmjs.com/recovering-your-2fa-enabled-account)
(updated 2026-09-10).
