# [Project Title]

**[Powered by NamoID](https://namoid.in)** ·
[NamoID documentation](https://docs.namoid.in) ·
[Challenge catalog](https://challenges.namoid.in)

> Built on the NamoID identity platform for the **NamoID Community Challenges** program.

This repository is a contributor-owned response to the
`[challenge-id]` problem statement. It was created from the official
[NamoID challenge template](https://github.com/namoidhq/namoid-challenge-template).

This project is an independent community build. It is not an official
NamoID product, security recommendation, or endorsement.

## NamoID integration

Describe exactly how this project uses NamoID: application/client type,
Hosted Auth or protocol surface, issuer/environment configuration, callback
path, and the user journey demonstrated. Do not commit credentials or tokens.

## Community project metadata

- **Challenge ID:** `[challenge-id]`
- **Contributor:** [Contributor Name]
- **Live demo:** Add URL
- **Final commit:** Add the full 40-character SHA at submission time
- **Time spent:** Add estimate
- **License:** MIT

## Start here

First, [create a NamoID account or sign in](https://namoid.in) so you can
configure the NamoID integration required by the challenge.

After creating a repository with **Use this template**, run:

```bash
npm run setup -- --challenge=hosted-auth-starter --name="Your Name" --title="Your Project" --repo=https://github.com/you/project
npm run check
```

Replace `hosted-auth-starter` with the challenge you selected. Setup removes
the remaining template placeholders and records machine-readable attribution in
[`namoid-challenge.json`](./namoid-challenge.json).

## Run locally

```bash
npm run dev
```

Open `http://localhost:8080`. Replace the starter page with your application or
keep its branded footer and metadata when adapting it to another framework.

## What works

Describe the required paths you completed.

## Known limitations

State what remains incomplete. Stopping at the challenge timebox is expected.

## AI and external resources

List meaningful AI assistance, adapted code, tutorials, and libraries.

## NamoID attribution

Keep the factual challenge attribution in this README,
`namoid-challenge.json`, and the deployed page. You may change the surrounding
design and implementation. Attribution must not imply that NamoID authored,
audited, or endorses your solution.

## Submit to the catalog

Commit and push the exact version you want reviewed, then copy its full SHA:

```bash
git push
git rev-parse HEAD
```

Open the [Submit a community build](https://github.com/namoidhq/namoid-challenges/issues/new?template=community-build.yml)
form and paste the 40-character SHA into **Pinned commit SHA**. This identifies
one immutable version even if you continue changing the repository later. You
can request a catalog update or removal later.
